"use server"

import { assertAdmin } from "@/lib/require-auth"
import { db } from "@/lib/db"
import {
  tourOverride,
  tourCategory,
  tourCategoryLink,
  startingLocation,
  tourStartingLocation,
  tourTranslation,
  type TourTranslation as TourTranslationRow,
  type MapStop,
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath, revalidateTag } from "next/cache"
import {
  fetchTourTranslations,
  fetchTourDetail,
  type TourTranslation,
} from "@/lib/bokun"
import { autoCategorizeTours, TOUR_TYPES, type TourType } from "@/lib/tours"
import { translateTexts } from "@/lib/translate"
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n"
import { generateText, Output } from "ai"
import { z } from "zod"
import {
  geocodeIceland,
  geocodeIcelandSequential,
  type GeocodeHit,
} from "@/lib/geocode"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function revalidateAll() {
  revalidatePath("/")
  revalidatePath("/admin")
}

/** Upsert helper: ensures a row exists for this Bokun id, then patches it. */
async function upsertOverride(
  bokunId: string,
  values: Partial<typeof tourOverride.$inferInsert>,
) {
  await db
    .insert(tourOverride)
    .values({ bokunId, ...values })
    .onConflictDoUpdate({
      target: tourOverride.bokunId,
      set: { ...values, updatedAt: new Date() },
    })
}

export async function setTourVisibility(bokunId: string, visible: boolean) {
  await assertAdmin()
  await upsertOverride(bokunId, { visible })
  revalidateAll()
}

  export async function setTourFeatured(bokunId: string, featured: boolean) {
  await assertAdmin()
  await upsertOverride(bokunId, { featured })
  revalidateAll()
  }

  export async function setTourHidden(bokunId: string, hidden: boolean) {
  await assertAdmin()
  await upsertOverride(bokunId, { hidden })
  revalidateAll()
  }

/* ---------------- Bulk tour actions ---------------- */

/** Publish or unpublish many tours at once. */
export async function bulkSetVisibility(bokunIds: string[], visible: boolean) {
  await assertAdmin()
  for (const id of bokunIds) {
    await upsertOverride(id, { visible })
  }
  revalidateAll()
}

/** Feature or unfeature many tours at once. */
export async function bulkSetFeatured(bokunIds: string[], featured: boolean) {
  await assertAdmin()
  for (const id of bokunIds) {
    await upsertOverride(id, { featured })
  }
  revalidateAll()
}

/**
 * Add a category to many tours without touching their other content. Keeps the
 * legacy single-category column populated when a tour had none.
 */
export async function bulkAddCategory(bokunIds: string[], categoryId: number) {
  await assertAdmin()
  if (!Number.isFinite(categoryId)) return
  for (const bokunId of bokunIds) {
    await db
      .insert(tourCategoryLink)
      .values({ bokunId, categoryId })
      .onConflictDoNothing()
    const [row] = await db
      .select()
      .from(tourOverride)
      .where(eq(tourOverride.bokunId, bokunId))
    if (!row?.categoryId) {
      await upsertOverride(bokunId, { categoryId })
    }
  }
  revalidateAll()
}

/**
 * Remove a category from many tours. Repoints the legacy single-category column
 * to a remaining category (or null) when it pointed at the removed one.
 */
export async function bulkRemoveCategory(
  bokunIds: string[],
  categoryId: number,
) {
  await assertAdmin()
  if (!Number.isFinite(categoryId)) return
  for (const bokunId of bokunIds) {
    await db
      .delete(tourCategoryLink)
      .where(
        and(
          eq(tourCategoryLink.bokunId, bokunId),
          eq(tourCategoryLink.categoryId, categoryId),
        ),
      )
    const [row] = await db
      .select()
      .from(tourOverride)
      .where(eq(tourOverride.bokunId, bokunId))
    if (row?.categoryId === categoryId) {
      const remaining = await db
        .select()
        .from(tourCategoryLink)
        .where(eq(tourCategoryLink.bokunId, bokunId))
      await upsertOverride(bokunId, {
        categoryId: remaining[0]?.categoryId ?? null,
      })
    }
  }
  revalidateAll()
}

export type TourOverrideInput = {
  title?: string | null
  excerpt?: string | null
  description?: string | null
  location?: string | null
  duration?: string | null
  difficulty?: string | null
  groupSize?: string | null
  imageUrl?: string | null
  /**
   * Curated, ordered gallery. When provided (even as an empty array) the
   * tour's stored gallery is replaced. Pass `undefined` to leave it untouched.
   */
  gallery?: { url: string; alt?: string | null }[]
  categoryIds?: number[]
  /**
   * Starting-location assignments. When provided (even as an empty array) the
   * tour's location links are replaced. Pass `undefined` to leave existing
   * location links untouched.
   */
  locationIds?: number[]
  tourType?: string
  /** Optional publish state. true = Published, false = Draft. */
  visible?: boolean
  /** Map starting-point coordinates. Pass null to clear, undefined to leave. */
  mapLat?: number | null
  mapLng?: number | null
  /**
   * Ordered route stops for multi-location tours. When provided (even as an
   * empty array) the stored stops are replaced and mapLat/mapLng are synced to
   * the first stop. Pass `undefined` to leave stops untouched.
   */
  mapStops?: { name?: string | null; lat: number; lng: number }[]
  /** Whether the tour is shown on the homepage map. */
  showOnMap?: boolean
  /** Admin-only: hide from the workspace list and exclude from the Total count. */
  hidden?: boolean
}

export async function saveTourOverride(bokunId: string, input: TourOverrideInput) {
  await assertAdmin()
  const categoryIds = (input.categoryIds ?? []).filter(
    (id, i, arr) => Number.isFinite(id) && arr.indexOf(id) === i,
  )
  // Normalize the curated gallery, when provided. Empty array clears it.
  let gallerySet: { gallery: string | null } | undefined
  if (input.gallery !== undefined) {
    const clean = input.gallery
      .map((g) => ({
        url: typeof g.url === "string" ? g.url.trim() : "",
        ...(g.alt?.trim() ? { alt: g.alt.trim() } : {}),
      }))
      .filter((g) => g.url)
    gallerySet = { gallery: clean.length > 0 ? JSON.stringify(clean) : null }
  }

  // Normalize route stops when provided, and sync the legacy single coordinate
  // to the first stop so anything reading mapLat/mapLng keeps working.
  let stopsSet:
    | {
        mapStops: { name: string; lat: number; lng: number }[]
        mapLat: number | null
        mapLng: number | null
      }
    | undefined
  if (input.mapStops !== undefined) {
    const cleanStops = input.mapStops
      .filter(
        (s) =>
          s &&
          Number.isFinite(s.lat) &&
          Number.isFinite(s.lng),
      )
      .map((s) => ({
        name: typeof s.name === "string" ? s.name.trim() : "",
        lat: s.lat,
        lng: s.lng,
      }))
    stopsSet = {
      mapStops: cleanStops,
      mapLat: cleanStops[0]?.lat ?? null,
      mapLng: cleanStops[0]?.lng ?? null,
    }
  }

  await upsertOverride(bokunId, {
    title: input.title?.trim() || null,
    excerpt: input.excerpt?.trim() || null,
    description: input.description?.trim() || null,
    location: input.location?.trim() || null,
    duration: input.duration?.trim() || null,
    difficulty: input.difficulty?.trim() || null,
    groupSize: input.groupSize?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
    ...(gallerySet ?? {}),
    // Keep the legacy single-category column in sync with the first selection.
    categoryId: categoryIds[0] ?? null,
    tourType: TOUR_TYPES.includes(input.tourType as TourType)
      ? (input.tourType as TourType)
      : "day",
    ...(typeof input.visible === "boolean" ? { visible: input.visible } : {}),
    // Route stops drive the coordinates when provided; otherwise fall back to
    // the single-coordinate inputs (each only touched when explicitly passed).
    ...(stopsSet
      ? stopsSet
      : {
          ...(input.mapLat !== undefined
            ? { mapLat: Number.isFinite(input.mapLat as number) ? input.mapLat : null }
            : {}),
          ...(input.mapLng !== undefined
            ? { mapLng: Number.isFinite(input.mapLng as number) ? input.mapLng : null }
            : {}),
        }),
    ...(typeof input.showOnMap === "boolean"
      ? { showOnMap: input.showOnMap }
      : {}),
    ...(typeof input.hidden === "boolean" ? { hidden: input.hidden } : {}),
  })
  // Replace the tour's category links with the new selection.
  await db.delete(tourCategoryLink).where(eq(tourCategoryLink.bokunId, bokunId))
  if (categoryIds.length > 0) {
    await db
      .insert(tourCategoryLink)
      .values(categoryIds.map((categoryId) => ({ bokunId, categoryId })))
      .onConflictDoNothing()
  }
  // Replace the tour's starting-location links when locations were provided.
  if (input.locationIds !== undefined) {
    const locationIds = Array.from(
      new Set(input.locationIds.filter((id) => Number.isFinite(id))),
    )
    await db
      .delete(tourStartingLocation)
      .where(eq(tourStartingLocation.bokunId, bokunId))
    if (locationIds.length > 0) {
      await db
        .insert(tourStartingLocation)
        .values(locationIds.map((locationId) => ({ bokunId, locationId })))
        .onConflictDoNothing()
    }
  }
  revalidateAll()
}

export async function createCategory(name: string) {
  await assertAdmin()
  const trimmed = name.trim()
  if (!trimmed) return
  // Place new categories at the end of the current order.
  const existing = await db.select().from(tourCategory)
  const nextOrder =
    existing.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1
  await db
    .insert(tourCategory)
    .values({ name: trimmed, slug: slugify(trimmed), sortOrder: nextOrder })
    .onConflictDoNothing({ target: tourCategory.slug })
  revalidateAll()
}

export async function renameCategory(id: number, name: string) {
  await assertAdmin()
  const trimmed = name.trim()
  if (!trimmed) return
  await db
    .update(tourCategory)
    .set({ name: trimmed, slug: slugify(trimmed) })
    .where(eq(tourCategory.id, id))
  revalidateAll()
}

export type CategoryDetailsInput = {
  name?: string | null
  slug?: string | null
  description?: string | null
  sortOrder?: number | null
  imageUrl?: string | null
  icon?: string | null
  nameEn?: string | null
  nameEs?: string | null
  namePt?: string | null
  nameIt?: string | null
}

/**
 * Update all of a category's editable fields in one go: name, slug,
 * short description, sort order, image and translated display names.
 */
export async function updateCategory(id: number, input: CategoryDetailsInput) {
  await assertAdmin()
  const values: Partial<typeof tourCategory.$inferInsert> = {
    description: input.description?.trim() || null,
    imageUrl: input.imageUrl?.trim() || null,
    icon: input.icon?.trim() || null,
    nameEn: input.nameEn?.trim() || null,
    nameEs: input.nameEs?.trim() || null,
    namePt: input.namePt?.trim() || null,
    nameIt: input.nameIt?.trim() || null,
  }
  // Name / slug are optional; only update when a non-empty name is provided.
  const name = input.name?.trim()
  if (name) {
    values.name = name
    values.slug = input.slug?.trim() ? slugify(input.slug) : slugify(name)
  }
  if (typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)) {
    values.sortOrder = Math.max(0, Math.round(input.sortOrder))
  }
  await db.update(tourCategory).set(values).where(eq(tourCategory.id, id))
  revalidateAll()
}

/**
 * Persist a new category ordering. `orderedIds` is the full list of category
 * ids in the order they should appear on the site.
 */
export async function reorderCategories(orderedIds: number[]) {
  await assertAdmin()
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(tourCategory)
        .set({ sortOrder: index })
        .where(eq(tourCategory.id, id)),
    ),
  )
  revalidateAll()
}

export async function deleteCategory(id: number) {
  await assertAdmin()
  await db.delete(tourCategory).where(eq(tourCategory.id, id))
  // Clear the category from any tours that referenced it.
  await db
    .update(tourOverride)
    .set({ categoryId: null })
    .where(eq(tourOverride.categoryId, id))
  revalidateAll()
}

/* ---------------- Starting locations CRUD ---------------- */

export async function createStartingLocation(name: string) {
  await assertAdmin()
  const trimmed = name.trim()
  if (!trimmed) return
  const existing = await db.select().from(startingLocation)
  const nextOrder =
    existing.reduce((max, l) => Math.max(max, l.sortOrder), -1) + 1
  await db
    .insert(startingLocation)
    .values({ name: trimmed, slug: slugify(trimmed), sortOrder: nextOrder })
    .onConflictDoNothing({ target: startingLocation.slug })
  revalidateAll()
}

export async function renameStartingLocation(id: number, name: string) {
  await assertAdmin()
  const trimmed = name.trim()
  if (!trimmed) return
  await db
    .update(startingLocation)
    .set({ name: trimmed, slug: slugify(trimmed) })
    .where(eq(startingLocation.id, id))
  revalidateAll()
}

/**
 * Persist a new starting-location ordering. `orderedIds` is the full list of
 * location ids in the order they should appear.
 */
export async function reorderStartingLocations(orderedIds: number[]) {
  await assertAdmin()
  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(startingLocation)
        .set({ sortOrder: index })
        .where(eq(startingLocation.id, id)),
    ),
  )
  revalidateAll()
}

export async function deleteStartingLocation(id: number) {
  await assertAdmin()
  // tour_starting_location rows are removed automatically via ON DELETE CASCADE.
  await db.delete(startingLocation).where(eq(startingLocation.id, id))
  revalidateAll()
}

export async function refreshBokun() {
  await assertAdmin()
  revalidateTag("bokun-tours", "max")
  // Auto-categorize from Bokun categories. Tours that already have categories
  // (e.g. set manually) are left untouched; missing categories are created.
  const result = await autoCategorizeTours()
  revalidateAll()
  return result
}

/** Original photo URLs for a tour from Bokun, for the Images tab (admin only). */
export async function getBokunGallery(bokunId: string): Promise<string[]> {
  await assertAdmin()
  const detail = await fetchTourDetail(bokunId)
  return detail?.gallery ?? []
}

/** Original Bokun texts for a tour in every published language (admin only). */
export async function getTourTranslations(
  bokunId: string,
): Promise<TourTranslation[]> {
  await assertAdmin()
  return fetchTourTranslations(bokunId)
}

/**
 * Auto-translate a category name from English into the other published
 * languages (es/pt/it). English is the source, so it's not returned. Results
 * are cached per language via `translateTexts`.
 */
export async function translateCategoryName(
  name: string,
): Promise<{ es: string; pt: string; it: string }> {
  await assertAdmin()
  const source = name.trim()
  if (!source) return { es: "", pt: "", it: "" }
  const [es, pt, it] = await Promise.all([
    translateTexts([source], "es"),
    translateTexts([source], "pt"),
    translateTexts([source], "it"),
  ])
  return { es: es[0] ?? "", pt: pt[0] ?? "", it: it[0] ?? "" }
}

/* ---------------- Per-language editable content ---------------- */

export type TourTranslationInput = {
  title?: string | null
  excerpt?: string | null
  description?: string | null
  included?: string | null
  excluded?: string | null
  goodToKnow?: string | null
  whatToBring?: string | null
  importantInfo?: string | null
  /** JSON-encoded array of { title, body } itinerary steps. */
  itinerary?: string | null
  /** SEO meta title override for this language (falls back to the tour title). */
  metaTitle?: string | null
  /** SEO meta description override (falls back to the excerpt/description). */
  metaDescription?: string | null
}

function cleanText(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * Validate and normalize an itinerary JSON string. Returns canonical JSON of a
 * `{ title, body }[]` array, or null when empty/invalid so the column clears.
 */
function cleanItinerary(value?: string | null): string | null {
  if (!value?.trim()) return null
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return null
    const steps = parsed
      .map((s) => ({
        title: typeof s?.title === "string" ? s.title.trim() : "",
        body: typeof s?.body === "string" ? s.body.trim() : "",
      }))
      .filter((s) => s.title || s.body)
    return steps.length > 0 ? JSON.stringify(steps) : null
  } catch {
    return null
  }
}

/** Load saved per-language content for a tour, keyed by locale (admin). */
export async function getTourTranslationContent(
  bokunId: string,
): Promise<Partial<Record<Locale, TourTranslationRow>>> {
  await assertAdmin()
  const rows = await db
    .select()
    .from(tourTranslation)
    .where(eq(tourTranslation.bokunId, bokunId))
  const map: Partial<Record<Locale, TourTranslationRow>> = {}
  for (const row of rows) {
    if ((LOCALES as readonly string[]).includes(row.lang)) {
      map[row.lang as Locale] = row
    }
  }
  return map
}

/**
 * Save editable content for a tour across every language. The English values
 * are also mirrored onto tour_override so product cards keep working without
 * needing a locale lookup.
 */
export async function saveTourTranslations(
  bokunId: string,
  byLang: Partial<Record<Locale, TourTranslationInput>>,
) {
  await assertAdmin()

  for (const lang of LOCALES) {
    const input = byLang[lang]
    if (!input) continue
    const values = {
      title: cleanText(input.title),
      excerpt: cleanText(input.excerpt),
      description: cleanText(input.description),
      included: cleanText(input.included),
      excluded: cleanText(input.excluded),
      goodToKnow: cleanText(input.goodToKnow),
      whatToBring: cleanText(input.whatToBring),
      importantInfo: cleanText(input.importantInfo),
      itinerary: cleanItinerary(input.itinerary),
      metaTitle: cleanText(input.metaTitle),
      metaDescription: cleanText(input.metaDescription),
    }
    await db
      .insert(tourTranslation)
      .values({ bokunId, lang, ...values })
      .onConflictDoUpdate({
        target: [tourTranslation.bokunId, tourTranslation.lang],
        set: { ...values, updatedAt: new Date() },
      })
  }

  // Keep the legacy English columns on tour_override in sync for cards/lists.
  const en = byLang.en
  if (en) {
    await upsertOverride(bokunId, {
      title: cleanText(en.title),
      excerpt: cleanText(en.excerpt),
      description: cleanText(en.description),
    })
  }

  revalidateAll()
}

/* ---------------- AI translation ---------------- */

const translationSchema = z.object({
  title: z.string().describe("Translated tour title"),
  excerpt: z.string().describe("Translated short description"),
  description: z.string().describe("Translated full description"),
  included: z
    .string()
    .describe("Translated 'what is included' list, one item per line"),
  excluded: z
    .string()
    .describe("Translated 'not included' list, one item per line"),
  goodToKnow: z
    .string()
    .describe("Translated 'good to know' list, one item per line"),
  whatToBring: z
    .string()
    .describe("Translated 'what to bring' list, one item per line"),
  importantInfo: z
    .string()
    .describe("Translated 'important information' free-text block"),
  itinerary: z
    .array(
      z.object({
        title: z.string().describe("Translated step title"),
        body: z.string().describe("Translated step description"),
      }),
    )
    .describe(
      "Translated itinerary steps, same number and order as the input",
    ),
})

/**
 * Translate the English content of a tour into the target language with AI.
 * Returns the translated fields; the caller decides whether to apply/save them.
 * Empty English fields are returned empty (nothing invented).
 */
export async function translateTourContent(
  source: TourTranslationInput,
  target: Locale,
): Promise<TourTranslationInput> {
  await assertAdmin()

  if (target === "en") return source

  const languageName = LOCALE_LABELS[target]

  // Parse the incoming itinerary JSON so the model gets structured steps.
  let sourceItinerary: { title: string; body: string }[] = []
  if (source.itinerary?.trim()) {
    try {
      const parsed = JSON.parse(source.itinerary)
      if (Array.isArray(parsed)) {
        sourceItinerary = parsed.map((s) => ({
          title: typeof s?.title === "string" ? s.title : "",
          body: typeof s?.body === "string" ? s.body : "",
        }))
      }
    } catch {
      sourceItinerary = []
    }
  }

  const payload = {
    title: source.title ?? "",
    excerpt: source.excerpt ?? "",
    description: source.description ?? "",
    included: source.included ?? "",
    excluded: source.excluded ?? "",
    goodToKnow: source.goodToKnow ?? "",
    whatToBring: source.whatToBring ?? "",
    importantInfo: source.importantInfo ?? "",
    itinerary: sourceItinerary,
  }

  const { output } = await generateText({
    model: "openai/gpt-5.4-mini",
    // Cap reasoning effort: gpt-5 reasoning models are slow and highly variable
    // at the default effort, and the heavier "generate all content" call could
    // exceed the route's maxDuration and get killed (the "This page couldn't
    // load" crash). "low" keeps quality while cutting latency and variance.
    providerOptions: { openai: { reasoningEffort: "low" } },
    // Abort just under the route maxDuration so a slow generation fails as a
    // clean, catchable error (surfaced as a toast) instead of the whole
    // server-action request timing out at the platform level.
    abortSignal: AbortSignal.timeout(55_000),
    system:
      `You are a professional translator for an Icelandic travel/tours website. ` +
      `Translate the provided tour content from English into ${languageName}. ` +
      `Rules: keep the tone natural and engaging for travellers; preserve the ` +
      `meaning and any names of places, tours, and brands; do NOT translate proper ` +
      `nouns that are place names unless they have a well-known local form; for the ` +
      `list fields (included, excluded, goodToKnow, whatToBring) keep exactly one item per line ` +
      `and the same number of lines; for the itinerary, keep exactly the same number ` +
      `and order of steps; if an input field is empty, return it empty. ` +
      `Return only the translation, no extra commentary.`,
    prompt: JSON.stringify(payload),
    output: Output.object({ schema: translationSchema }),
  })

  // Serialize the translated itinerary back into the JSON string format used
  // throughout the editor and storage.
  const { itinerary, ...rest } = output
  return {
    ...rest,
    itinerary: Array.isArray(itinerary) && itinerary.length > 0
      ? JSON.stringify(itinerary)
      : null,
  }
}

/* ---------------- Bokun source data for AI ---------------- */

/**
 * Fetch the original Bokun content for a tour and shape it into a compact
 * reference object the AI prompts can use as their factual source. Returns
 * null when the tour has no Bokun detail (or the fetch fails) so generation
 * gracefully falls back to the admin-entered fields only.
 */
async function buildBokunReference(bokunId?: string | null) {
  if (!bokunId) return null
  try {
    const d = await fetchTourDetail(bokunId)
    if (!d) return null
    return {
      description: d.description || "",
      included: d.included,
      excluded: d.excluded,
      requirements: d.requirements || "",
      attention: d.attention || "",
      knowBeforeYouGo: d.knowBeforeYouGo,
      itinerary: d.itinerary,
      durationText: d.durationText ?? "",
      difficulty: d.difficulty ?? "",
      minAge: d.minAge,
      minPerBooking: d.minPerBooking,
      maxPerBooking: d.maxPerBooking,
      location: d.location ?? "",
      cancellationHours: d.cancellationHours,
      hasPickup: d.hasPickup,
    }
  } catch (err) {
    console.error("[v0] buildBokunReference failed:", err)
    return null
  }
}

/** Shared prompt rules for how the model must treat the Bokun source data. */
const BOKUN_SOURCE_RULES =
  `The input may contain a "bokunSource" object holding the ORIGINAL operator ` +
  `data for this tour from the Bokun booking system (description, inclusions, ` +
  `requirements, itinerary, duration, age limits, pickup, cancellation policy). ` +
  `When present, treat it as the authoritative factual source: base all facts ` +
  `on it, never contradict it, and prefer its specifics over guessing. Rewrite ` +
  `and polish the wording rather than copying it verbatim. When it is absent, ` +
  `fall back to the other provided details. `

/* ---------------- AI short description ---------------- */

export type ExcerptSourceInput = {
  bokunId?: string | null
  title?: string | null
  description?: string | null
  duration?: string | null
  difficulty?: string | null
  groupSize?: string | null
  location?: string | null
  categories?: string[]
}

const excerptSchema = z.object({
  excerpt: z
    .string()
    .describe(
      "A punchy one- to two-sentence tour summary, under 160 characters",
    ),
})

/**
 * Generate a short, card-friendly description for a tour from its own data
 * (title, full description, duration, difficulty, group size, location and
 * categories). Returns a single line of text in the requested language; the
 * caller decides whether to apply it.
 */
export async function generateTourExcerpt(
  source: ExcerptSourceInput,
  target: Locale = "en",
): Promise<AiResult<string>> {
  try {
    await assertAdmin()

    const languageName = LOCALE_LABELS[target]

    const bokunSource = await buildBokunReference(source.bokunId)

    const payload = {
      title: source.title ?? "",
      description: source.description ?? "",
      duration: source.duration ?? "",
      difficulty: source.difficulty ?? "",
      groupSize: source.groupSize ?? "",
      location: source.location ?? "",
      categories: source.categories ?? [],
      bokunSource,
    }

    // Nothing meaningful to work from.
    if (
      !payload.title &&
      !payload.description &&
      payload.categories.length === 0 &&
      !bokunSource
    ) {
      return { ok: true, data: "" }
    }

    const { output } = await generateText({
      model: "openai/gpt-5.4-mini",
    // Cap reasoning effort: gpt-5 reasoning models are slow and highly variable
    // at the default effort, and the heavier "generate all content" call could
    // exceed the route's maxDuration and get killed (the "This page couldn't
    // load" crash). "low" keeps quality while cutting latency and variance.
    providerOptions: { openai: { reasoningEffort: "low" } },
    // Abort just under the route maxDuration so a slow generation fails as a
    // clean, catchable error (surfaced as a toast) instead of the whole
    // server-action request timing out at the platform level.
    abortSignal: AbortSignal.timeout(55_000),
      system:
        `You write short, enticing marketing summaries for an Icelandic ` +
        `travel/tours website. Given the details of a single tour, write ONE ` +
        `short description in ${languageName} that would sit on the tour card. ` +
        BOKUN_SOURCE_RULES +
        `Rules: 1-2 sentences, under 160 characters; lead with what makes the ` +
        `experience exciting; be concrete using the provided details (place ` +
        `names, activities, duration) but do NOT invent facts that aren't ` +
        `supported by the input; keep the tone natural and engaging for ` +
        `travellers; no quotes, no hashtags, no emoji. Return only the summary.`,
      prompt: JSON.stringify(payload),
      output: Output.object({ schema: excerptSchema }),
    })

    return { ok: true, data: output.excerpt.trim() }
  } catch (err) {
    console.error("[v0] generateTourExcerpt failed:", err)
    return { ok: false, error: aiErrorMessage(err) }
  }
}

/* ---------------- AI full content ---------------- */

export type FullContentSourceInput = {
  bokunId?: string | null
  title?: string | null
  description?: string | null
  duration?: string | null
  difficulty?: string | null
  groupSize?: string | null
  location?: string | null
  categories?: string[]
}

const fullContentSchema = z.object({
  title: z.string().describe("A clear, catchy tour title"),
  excerpt: z
    .string()
    .describe("A punchy 1-2 sentence tour summary, under 160 characters"),
  description: z
    .string()
    .describe(
      "An engaging full description of 2-4 short paragraphs for the tour page",
    ),
  included: z
    .string()
    .describe("What's included list, one concise item per line"),
  excluded: z
    .string()
    .describe("What's not included list, one concise item per line"),
  goodToKnow: z
    .string()
    .describe("Practical 'good to know' notes, one item per line"),
  whatToBring: z
    .string()
    .describe(
      "What travellers should bring/wear for this tour, one concise item per line",
    ),
  importantInfo: z
    .string()
    .describe(
      "Important information travellers must read (safety, requirements, " +
        "restrictions), as a short free-text block; use blank lines to " +
        "separate distinct points",
    ),
  itinerary: z
    .array(
      z.object({
        title: z.string().describe("Short step title"),
        body: z.string().describe("1-2 sentence step description"),
      }),
    )
    .describe("An ordered itinerary of 3-6 plausible steps for the tour"),
})

/**
 * Generate a full draft of every content field for a tour
 * (title, excerpt, description, included, excluded, good to know, itinerary)
 * from its basic details, in the requested language. The model is allowed to
 * make reasonable, plausible assumptions to produce a complete draft, so the
 * output MUST be reviewed and edited before publishing. The caller decides
 * whether to apply the result.
 */
export async function generateFullTourContent(
  source: FullContentSourceInput,
  target: Locale = "en",
): Promise<AiResult<TourTranslationInput>> {
  try {
    await assertAdmin()

    const languageName = LOCALE_LABELS[target]

    const bokunSource = await buildBokunReference(source.bokunId)

    const payload = {
      title: source.title ?? "",
      description: source.description ?? "",
      duration: source.duration ?? "",
      difficulty: source.difficulty ?? "",
      groupSize: source.groupSize ?? "",
      location: source.location ?? "",
      categories: source.categories ?? [],
      bokunSource,
    }

    const { output } = await generateText({
      model: "openai/gpt-5.4-mini",
    // Cap reasoning effort: gpt-5 reasoning models are slow and highly variable
    // at the default effort, and the heavier "generate all content" call could
    // exceed the route's maxDuration and get killed (the "This page couldn't
    // load" crash). "low" keeps quality while cutting latency and variance.
    providerOptions: { openai: { reasoningEffort: "low" } },
    // Abort just under the route maxDuration so a slow generation fails as a
    // clean, catchable error (surfaced as a toast) instead of the whole
    // server-action request timing out at the platform level.
    abortSignal: AbortSignal.timeout(55_000),
      system:
        `You write complete marketing content for an Icelandic travel/tours ` +
        `website. Given the details of a single tour, write a full draft ` +
        `of ALL content fields in ${languageName}. ` +
        BOKUN_SOURCE_RULES +
        `Rules: keep the tone natural ` +
        `and engaging for travellers; build on the provided details (place ` +
        `names, activities, duration, difficulty, group size, categories); you ` +
        `may make reasonable, plausible assumptions to fill small gaps, but keep ` +
        `them realistic for this kind of tour and do NOT invent specific prices, ` +
        `exact times, or brand names that aren't implied; for the list fields keep ` +
        `one concise item per line; make the itinerary a sensible ordered sequence ` +
        `(follow the bokunSource itinerary when it exists). ` +
        `If a provided title already exists, you may refine it but keep the same ` +
        `subject. Return only the content.`,
      prompt: JSON.stringify(payload),
      output: Output.object({ schema: fullContentSchema }),
    })

    if (!output) {
      return { ok: false, error: "AI did not return any content" }
    }

    const { itinerary, ...rest } = output
    return {
      ok: true,
      data: {
        ...rest,
        itinerary:
          Array.isArray(itinerary) && itinerary.length > 0
            ? JSON.stringify(itinerary)
            : null,
      },
    }
  } catch (err) {
    console.error("[v0] generateFullTourContent failed:", err)
    return { ok: false, error: aiErrorMessage(err) }
  }
}

const itinerarySchema = z.object({
  itinerary: z
    .array(
      z.object({
        title: z.string().describe("Short step title"),
        body: z.string().describe("1-2 sentence step description"),
      }),
    )
    .describe("An ordered itinerary of 3-6 plausible steps for the tour"),
})

/**
 * Generate just the itinerary steps for a tour from its basic
 * details, in the requested language. The model may make reasonable, plausible
 * assumptions, so the result MUST be reviewed before publishing. Returns the
 * steps as a JSON string (or null when none were produced).
 */
export async function generateTourItinerary(
  source: FullContentSourceInput,
  target: Locale = "en",
): Promise<AiResult<string | null>> {
  try {
    await assertAdmin()

    const languageName = LOCALE_LABELS[target]

    const bokunSource = await buildBokunReference(source.bokunId)

    const payload = {
      title: source.title ?? "",
      description: source.description ?? "",
      duration: source.duration ?? "",
      difficulty: source.difficulty ?? "",
      groupSize: source.groupSize ?? "",
      location: source.location ?? "",
      categories: source.categories ?? [],
      bokunSource,
    }

    const { output } = await generateText({
      model: "openai/gpt-5.4-mini",
    // Cap reasoning effort: gpt-5 reasoning models are slow and highly variable
    // at the default effort, and the heavier "generate all content" call could
    // exceed the route's maxDuration and get killed (the "This page couldn't
    // load" crash). "low" keeps quality while cutting latency and variance.
    providerOptions: { openai: { reasoningEffort: "low" } },
    // Abort just under the route maxDuration so a slow generation fails as a
    // clean, catchable error (surfaced as a toast) instead of the whole
    // server-action request timing out at the platform level.
    abortSignal: AbortSignal.timeout(55_000),
      system:
        `You write itineraries for an Icelandic travel/tours website. Given the ` +
        `details of a single tour, write a sensible ordered itinerary in ` +
        `${languageName}. ` +
        BOKUN_SOURCE_RULES +
        `When the bokunSource has an itinerary, follow its steps and order, ` +
        `rewriting each step's wording to be clear and engaging. ` +
        `Rules: base everything on the provided details (place names, ` +
        `activities, duration, difficulty); you may make reasonable, plausible ` +
        `assumptions but keep them realistic and do NOT invent specific prices, ` +
        `exact times, or brand names that aren't implied; keep each step's body ` +
        `to 1-2 sentences. Return only the itinerary.`,
      prompt: JSON.stringify(payload),
      output: Output.object({ schema: itinerarySchema }),
    })

    const value =
      output && Array.isArray(output.itinerary) && output.itinerary.length > 0
        ? JSON.stringify(output.itinerary)
        : null
    return { ok: true, data: value }
  } catch (err) {
    console.error("[v0] generateTourItinerary failed:", err)
    return { ok: false, error: aiErrorMessage(err) }
  }
}

/* ---------------- AI single field ---------------- */

/** Text content fields that can be generated individually with AI. */
export type GeneratableField =
  | "title"
  | "description"
  | "included"
  | "excluded"
  | "goodToKnow"
  | "whatToBring"
  | "importantInfo"

/** Per-field guidance the model follows when generating a single field. */
const FIELD_GUIDANCE: Record<GeneratableField, string> = {
  title:
    "Write ONE clear, catchy tour title of at most 60 characters. Lead with " +
    "the main attraction or activity, use title case, and do NOT wrap it in " +
    "quotes or end it with a period. If a current title is provided in the " +
    "input, treat it as the working title and improve it while keeping the " +
    "same subject.",
  description:
    "Write an engaging full description of 2-4 short paragraphs for the tour " +
    "page. Separate paragraphs with a blank line.",
  included:
    "Write a \"What's included\" list. This MUST be a list: return 4-8 items, " +
    "each a short phrase (not a full sentence) on its own line, separated by " +
    "newlines. End every item with a period. Do NOT write a paragraph. Do NOT " +
    "add bullet characters, dashes, or numbering.",
  excluded:
    "Write a \"Not included\" list. This MUST be a list: return 3-6 items, each " +
    "a short phrase (not a full sentence) on its own line, separated by " +
    "newlines. End every item with a period. Do NOT write a paragraph. Do NOT " +
    "add bullet characters, dashes, or numbering.",
  goodToKnow:
    "Write practical \"good to know\" notes for travellers. This MUST be a " +
    "list: return 3-6 items, each a short phrase on its own line, separated by " +
    "newlines. End every item with a period. Do NOT write a paragraph. Do NOT " +
    "add bullet characters, dashes, or numbering.",
  whatToBring:
    "Write a \"What to bring\" list of what travellers should bring or wear. " +
    "This MUST be a list: return 3-8 items, each a short phrase on its own " +
    "line, separated by newlines. End every item with a period. Do NOT write a " +
    "paragraph. Do NOT add bullet characters, dashes, or numbering.",
  importantInfo:
    "Write important information travellers must read (safety, requirements, " +
    "restrictions) as a short free-text block. Separate distinct points with a " +
    "blank line.",
}

const fieldSchema = z.object({
  value: z.string().describe("The generated content for the requested field"),
})

/**
 * Discriminated result for AI generation actions. We RETURN errors instead of
 * throwing because Next.js redacts thrown Server Action errors in production
 * builds (replacing them with a generic "Server Components render" message).
 * Returning the message keeps the real cause visible to the admin UI.
 */
export type AiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

/** Turn any caught value into a readable message for the admin UI. */
function aiErrorMessage(err: unknown): string {
  // A timeout/abort (from the request budget running out) has a cryptic native
  // message, so translate it into something the admin can act on.
  if (
    err instanceof Error &&
    (err.name === "TimeoutError" ||
      err.name === "AbortError" ||
      /abort|timed? ?out/i.test(err.message))
  ) {
    return "The request timed out. Please try again — this can happen on longer generations."
  }
  if (err instanceof Error && err.message) return err.message
  if (typeof err === "string" && err) return err
  return "AI generation failed. Please try again."
  }

/**
 * Generate a single content field for a tour from its basic
 * details, in the requested language. The model may make reasonable, plausible
 * assumptions, so the result MUST be reviewed before publishing. Returns the
 * generated text (empty string when there's nothing to work from).
 */
export async function generateTourField(
  source: FullContentSourceInput,
  field: GeneratableField,
  target: Locale = "en",
): Promise<AiResult<string>> {
  try {
    await assertAdmin()

    const languageName = LOCALE_LABELS[target]

    const bokunSource = await buildBokunReference(source.bokunId)

    const payload = {
      title: source.title ?? "",
      description: source.description ?? "",
      duration: source.duration ?? "",
      difficulty: source.difficulty ?? "",
      groupSize: source.groupSize ?? "",
      location: source.location ?? "",
      categories: source.categories ?? [],
      bokunSource,
    }

    if (
      !payload.title &&
      !payload.description &&
      payload.categories.length === 0 &&
      !bokunSource
    ) {
      return { ok: true, data: "" }
    }

    const { output } = await generateText({
      model: "openai/gpt-5.4-mini",
    // Cap reasoning effort: gpt-5 reasoning models are slow and highly variable
    // at the default effort, and the heavier "generate all content" call could
    // exceed the route's maxDuration and get killed (the "This page couldn't
    // load" crash). "low" keeps quality while cutting latency and variance.
    providerOptions: { openai: { reasoningEffort: "low" } },
    // Abort just under the route maxDuration so a slow generation fails as a
    // clean, catchable error (surfaced as a toast) instead of the whole
    // server-action request timing out at the platform level.
    abortSignal: AbortSignal.timeout(55_000),
      system:
        `You write marketing content for an Icelandic travel/tours website. ` +
        `Given the details of a single tour, write content for ONE ` +
        `specific field in ${languageName}. ${FIELD_GUIDANCE[field]} ` +
        BOKUN_SOURCE_RULES +
        `Rules: keep ` +
        `the tone natural and engaging for travellers; build on the provided ` +
        `details (place names, activities, duration, difficulty, group size, ` +
        `categories); you may make reasonable, plausible assumptions but keep ` +
        `them realistic and do NOT invent specific prices, exact times, or brand ` +
        `names that aren't implied; no emoji. Return only the content for this ` +
        `field.`,
      prompt: JSON.stringify(payload),
      output: Output.object({ schema: fieldSchema }),
    })

    return { ok: true, data: output?.value?.trim() ?? "" }
  } catch (err) {
    console.error("[v0] generateTourField failed:", err)
    return { ok: false, error: aiErrorMessage(err) }
  }
}

/* ---------------- AI map stops (testing) ---------------- */

export type TourStopsSourceInput = {
  bokunId?: string | null
  title?: string | null
  description?: string | null
  location?: string | null
  /** Itinerary step titles, in order, when the editor already has them. */
  itinerary?: string[]
}

const stopsSchema = z.object({
  stops: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            "Short display label for the stop, e.g. 'Þingvellir National Park'",
          ),
        query: z
          .string()
          .describe(
            "A precise, geocodable place name in Iceland for this stop, " +
              "including region if helpful, e.g. 'Gullfoss waterfall, Iceland'",
          ),
      }),
    )
    .describe("Ordered list of stops along the tour route, start to finish"),
})

/**
 * Extract an ordered list of route stops for a tour from its content and its
 * original Bokun data, then geocode each one to real coordinates within
 * Iceland. Returns MapStop[] the admin can review on the map before saving.
 *
 * The AI only decides which named places make up the route and their order;
 * the coordinates always come from the geocoder, so pins land on the real
 * location rather than an AI-guessed latitude/longitude.
 */
export async function generateTourStops(
  source: TourStopsSourceInput,
): Promise<AiResult<MapStop[]>> {
  try {
    await assertAdmin()

    const bokunSource = await buildBokunReference(source.bokunId)

    const payload = {
      title: source.title ?? "",
      description: source.description ?? "",
      location: source.location ?? "",
      itinerary: source.itinerary ?? [],
      bokunSource,
    }

    if (
      !payload.title &&
      !payload.description &&
      !payload.location &&
      payload.itinerary.length === 0 &&
      !bokunSource
    ) {
      return {
        ok: false,
        error: "Add a title, description, or itinerary first, then generate.",
      }
    }

    const { output } = await generateText({
      model: "openai/gpt-5.4-mini",
    // Cap reasoning effort: gpt-5 reasoning models are slow and highly variable
    // at the default effort, and the heavier "generate all content" call could
    // exceed the route's maxDuration and get killed (the "This page couldn't
    // load" crash). "low" keeps quality while cutting latency and variance.
    providerOptions: { openai: { reasoningEffort: "low" } },
    // Abort just under the route maxDuration so a slow generation fails as a
    // clean, catchable error (surfaced as a toast) instead of the whole
    // server-action request timing out at the platform level.
    abortSignal: AbortSignal.timeout(55_000),
      system:
        `You map out the physical route of an Icelandic tour. Given a tour's ` +
        `details, itinerary, and original Bokun data, identify the real, named ` +
        `places the tour visits, in the order they are visited (start to end). ` +
        BOKUN_SOURCE_RULES +
        `Rules: only include actual, mappable places in Iceland (natural ` +
        `landmarks, towns, sites, attractions) — never vague items like "lunch" ` +
        `or "pickup"; do NOT invent stops that aren't supported by the input; ` +
        `for each stop give a concise display name and a precise, geocodable ` +
        `query ending in ", Iceland"; keep the list focused (typically 2-8 ` +
        `stops); if the tour clearly visits a single place, return just that ` +
        `one. Return only the stops.`,
      prompt: JSON.stringify(payload),
      output: Output.object({ schema: stopsSchema }),
    })

    const proposed = output?.stops ?? []
    if (proposed.length === 0) {
      return { ok: false, error: "No mappable stops could be identified." }
    }

    // Coordinates come from the geocoder, not the model. Drop any that can't
    // be resolved so we never place a pin on a guessed location.
    const hits = await geocodeIcelandSequential(proposed.map((s) => s.query))
    const stops: MapStop[] = []
    proposed.forEach((s, i) => {
      const hit = hits[i]
      if (hit) stops.push({ name: s.name.trim(), lat: hit.lat, lng: hit.lng })
    })

    if (stops.length === 0) {
      return {
        ok: false,
        error:
          "Couldn't find coordinates for the identified stops. Try adding them by address instead.",
      }
    }

    return { ok: true, data: stops }
  } catch (err) {
    console.error("[v0] generateTourStops failed:", err)
    return { ok: false, error: aiErrorMessage(err) }
  }
}

/**
 * Geocode a single free-text address or place name (within Iceland) into a
 * map stop the admin can add to a tour's route.
 */
export async function geocodePlace(
  query: string,
): Promise<AiResult<MapStop>> {
  try {
    await assertAdmin()

    const q = query.trim()
    if (!q) return { ok: false, error: "Enter an address or place name." }

    let hit: GeocodeHit | null = null
    try {
      hit = await geocodeIceland(q)
    } catch (err) {
      console.error("[v0] geocodePlace lookup failed:", err)
      return { ok: false, error: "Address lookup failed. Please try again." }
    }

    if (!hit) {
      return {
        ok: false,
        error: `No location found in Iceland for "${q}".`,
      }
    }

    // Use the typed query as the stop label; it's usually cleaner than the
    // geocoder's long formatted address.
    return { ok: true, data: { name: q, lat: hit.lat, lng: hit.lng } }
  } catch (err) {
    console.error("[v0] geocodePlace failed:", err)
    return { ok: false, error: aiErrorMessage(err) }
  }
}
