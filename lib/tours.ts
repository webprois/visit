import "server-only"
import {
  fetchAllTours,
  fetchTourTranslations,
  fetchTourDetail,
  fetchTourAvailability,
  fetchTourAvailabilityUncached,
  type TourDetail,
  type ItineraryStep,
} from "@/lib/bokun"
import { db } from "@/lib/db"
import { eq, and, gte, lte, or, inArray, notInArray, sql } from "drizzle-orm"
import {
  tourOverride,
  tourCategory,
  tourCategoryLink,
  startingLocation,
  tourStartingLocation,
  tourTranslation,
  tourAvailability,
  type TourCategory,
  type StartingLocation,
  type MapStop,
} from "@/lib/db/schema"
import type { Tour } from "@/lib/data"
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n"

export type TourType = "day" | "multi-day" | "admission" | "transfer"

/** All valid tour types, used to validate stored/incoming values. */
export const TOUR_TYPES: TourType[] = [
  "day",
  "multi-day",
  "admission",
  "transfer",
]

/** Resolve a category's display name for a locale, falling back to English. */
export function categoryName(c: TourCategory, locale: Locale): string {
  const byLocale: Record<Locale, string | null> = {
    en: c.nameEn,
    es: c.nameEs,
    pt: c.namePt,
    it: c.nameIt,
  }
  return byLocale[locale]?.trim() || c.nameEn?.trim() || c.name
}

/** Split newline-separated text into a trimmed, non-empty list. */
function parseList(text?: string | null): string[] {
  if (!text) return []
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Parse a stored itinerary JSON string into a clean `{ title, body }[]`. */
function parseItinerary(text?: string | null): ItineraryStep[] {
  if (!text?.trim()) return []
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((s) => ({
        title: typeof s?.title === "string" ? s.title.trim() : "",
        body: typeof s?.body === "string" ? s.body.trim() : "",
      }))
      .filter((s) => s.title || s.body)
  } catch {
    return []
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

/**
 * Bokun activity-category codes that describe the tour format rather than a
 * theme. These are skipped during auto-categorization so we don't create noisy
 * "Day Tour" style categories (tour type is handled separately).
 */
const GENERIC_BOKUN_CODES = new Set([
  "DAY_TRIPS_AND_EXCURSIONS",
  "SHORE_EXCURSIONS",
  "MULTI_DAY_TOURS",
  "MULTI_DAY_TOURS_AND_PACKAGES",
  "PRIVATE_TOURS",
  "PRIVATE_AND_LUXURY",
  "SELF_DRIVE",
  "SELF_GUIDED",
])

/** Friendly display names for common Bokun codes; others are humanized. */
const BOKUN_CATEGORY_NAMES: Record<string, string> = {
  ADVENTURE: "Adventure",
  NATURE: "Nature",
  SIGHTSEEING: "Sightseeing",
  HIKING: "Hiking",
  GLACIER_HIKING: "Glacier Hiking",
  GLACIER: "Glacier",
  ICE_CLIMBING: "Ice Climbing",
  ICE_CAVE: "Ice Cave",
  CAVING: "Caving",
  DOLPHIN_OR_WHALEWATCHING: "Whale Watching",
  WHALE_WATCHING: "Whale Watching",
  BIRDWATCHING: "Birdwatching",
  NORTHERN_LIGHTS: "Northern Lights",
  HORSEBACK_RIDING: "Horse Riding",
  HORSE_RIDING: "Horse Riding",
  RAFTING: "Rafting",
  KAYAKING: "Kayaking",
  SNORKELING_AND_DIVING: "Snorkeling & Diving",
  SUPER_JEEP: "Super Jeep",
  SNOWMOBILE: "Snowmobile",
  FOOD_AND_DRINK: "Food & Drink",
  CULTURE: "Culture",
  CITY_TRIPS: "City",
  SPA_AND_WELLNESS: "Spa & Wellness",
  PHOTOGRAPHY: "Photography",
  BOAT_TOUR: "Boat Tour",
  WALKING_TOUR: "Walking",
}

/** Turn an unmapped code like "GLACIER_HIKING" into "Glacier Hiking". */
function humanizeCode(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((w) =>
      w === "and" || w === "or"
        ? "&"
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ")
}

/** Resolve the site category name for a Bokun activity-category code. */
export function categoryNameForBokunCode(code: string): string {
  return BOKUN_CATEGORY_NAMES[code] ?? humanizeCode(code)
}

/**
 * Auto-categorize tours from their Bokun activity categories. Runs at sync
 * time. Tours that already have ANY category link are left untouched, which
 * protects manual categorization and keeps the operation idempotent. Missing
 * categories are created automatically.
 */
export async function autoCategorizeTours(): Promise<{
  toursUpdated: number
  categoriesCreated: number
  linksCreated: number
}> {
  const [tours, categories, links] = await Promise.all([
    fetchAllTours(),
    db.select().from(tourCategory),
    db.select().from(tourCategoryLink),
  ])

  const linkedTourIds = new Set(links.map((l) => l.bokunId))
  const bySlug = new Map(categories.map((c) => [c.slug, c]))
  let nextOrder =
    categories.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1

  const newLinks: { bokunId: string; categoryId: number }[] = []
  const toursUpdated = new Set<string>()
  let categoriesCreated = 0

  for (const t of tours) {
    const bokunId = String(t.id)
    // Skip tours already categorized (manually or in a previous sync).
    if (linkedTourIds.has(bokunId)) continue

    const names = Array.from(
      new Set(
        (t.bokunCategories ?? [])
          .filter((code) => !GENERIC_BOKUN_CODES.has(code))
          .map(categoryNameForBokunCode),
      ),
    )
    if (names.length === 0) continue

    for (const name of names) {
      const slug = slugify(name)
      if (!slug) continue
      let cat = bySlug.get(slug)
      if (!cat) {
        const [created] = await db
          .insert(tourCategory)
          .values({ name, slug, sortOrder: nextOrder++, nameEn: name })
          .onConflictDoNothing({ target: tourCategory.slug })
          .returning()
        cat =
          created ??
          (
            await db
              .select()
              .from(tourCategory)
              .where(eq(tourCategory.slug, slug))
          )[0]
        if (cat) {
          bySlug.set(slug, cat)
          categoriesCreated++
        }
      }
      if (cat) {
        newLinks.push({ bokunId, categoryId: cat.id })
        toursUpdated.add(bokunId)
      }
    }
  }

  // Insert links in chunks to stay within parameter limits.
  for (let i = 0; i < newLinks.length; i += 500) {
    await db
      .insert(tourCategoryLink)
      .values(newLinks.slice(i, i + 500))
      .onConflictDoNothing()
  }

  return {
    toursUpdated: toursUpdated.size,
    categoriesCreated,
    linksCreated: newLinks.length,
  }
}

/** A single curated gallery image with optional alt text. */
export type GalleryImage = { url: string; alt: string | null }

/** Parse the stored gallery JSON into a clean `{ url, alt }[]`. */
export function parseGallery(value?: string | null): GalleryImage[] {
  if (!value?.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((g) => ({
        url: typeof g?.url === "string" ? g.url.trim() : "",
        alt: typeof g?.alt === "string" && g.alt.trim() ? g.alt.trim() : null,
      }))
      .filter((g) => g.url)
  } catch {
    return []
  }
}

export type MergedTour = Tour & {
  bokunId: string
  visible: boolean
  featured: boolean
  excerpt: string | null
  description: string | null
  /** Curated, ordered gallery managed in the admin. Empty = use Bokun photos. */
  gallery: GalleryImage[]
  difficulty: string | null
  groupSize: string | null
  /** Primary category (first assigned), used for the card badge. */
  categoryId: number | null
  categoryName: string | null
  /** All categories assigned to this tour. */
  categoryIds: number[]
  categoryNames: string[]
  /** Starting location ids assigned to this tour (admin-managed). */
  locationIds: number[]
  /** Starting location display names, ordered by the locations' sortOrder. */
  locationNames: string[]
  tourType: TourType
  sortOrder: number
  /** Whether this tour is shown on the homepage map. */
  showOnMap: boolean
  /** Admin-only: hide from the workspace list and exclude from the Total count. */
  hidden: boolean
  /** Admin-set map coordinates (null when unset — the map falls back to Bokun). */
  mapLat: number | null
  mapLng: number | null
  /** Ordered route stops for multi-location tours (empty for single-location). */
  mapStops: MapStop[]
  updatedAt: Date | null
}

/**
 * Fetch Bokun tours and apply admin overrides, category names and the
 * editable per-language content for the given locale. Text fields resolve as:
 * translation[locale] → translation[en] → admin override → Bokun source.
 */
export async function getMergedTours(
  locale: Locale = DEFAULT_LOCALE,
): Promise<MergedTour[]> {
  const [
    tours,
    overrides,
    categories,
    links,
    locations,
    locationLinks,
    translations,
  ] = await Promise.all([
    fetchAllTours(),
    db.select().from(tourOverride),
    db.select().from(tourCategory),
    db.select().from(tourCategoryLink),
    db.select().from(startingLocation),
    db.select().from(tourStartingLocation),
    db.select().from(tourTranslation),
  ])

  const overrideMap = new Map(overrides.map((o) => [o.bokunId, o]))
  const categoryMap = new Map(categories.map((c) => [c.id, categoryName(c, locale)]))
  // Order categories by their sortOrder so the primary (badge) category is stable.
  const categoryOrder = new Map(categories.map((c, i) => [c.id, c.sortOrder ?? i]))

  // Nested map: bokunId → lang → translation row.
  const translationMap = new Map<string, Record<string, (typeof translations)[number]>>()
  for (const row of translations) {
    const byLang = translationMap.get(row.bokunId) ?? {}
    byLang[row.lang] = row
    translationMap.set(row.bokunId, byLang)
  }

  // Group category ids per tour, sorted by category sortOrder.
  const linksByTour = new Map<string, number[]>()
  for (const link of links) {
    const arr = linksByTour.get(link.bokunId) ?? []
    arr.push(link.categoryId)
    linksByTour.set(link.bokunId, arr)
  }
  for (const arr of linksByTour.values()) {
    arr.sort((a, b) => (categoryOrder.get(a) ?? 0) - (categoryOrder.get(b) ?? 0))
  }

  // Location lookups: id → name, and id → sortOrder for stable ordering.
  const locationName = new Map(locations.map((l) => [l.id, l.name]))
  const locationOrder = new Map(locations.map((l, i) => [l.id, l.sortOrder ?? i]))

  // Group starting-location ids per tour, sorted by the locations' sortOrder.
  const locationsByTour = new Map<string, number[]>()
  for (const link of locationLinks) {
    if (!locationName.has(link.locationId)) continue
    const arr = locationsByTour.get(link.bokunId) ?? []
    arr.push(link.locationId)
    locationsByTour.set(link.bokunId, arr)
  }
  for (const arr of locationsByTour.values()) {
    arr.sort((a, b) => (locationOrder.get(a) ?? 0) - (locationOrder.get(b) ?? 0))
  }

  return tours.map((t) => {
    const bokunId = String(t.id)
    const o = overrideMap.get(bokunId)
    const byLang = translationMap.get(bokunId)
    const categoryIds = linksByTour.get(bokunId) ?? []
    const categoryNames = categoryIds
      .map((id) => categoryMap.get(id))
      .filter((n): n is string => Boolean(n))
    const categoryId = categoryIds[0] ?? null

    // Starting locations are assigned manually in the admin.
    const locationIds = locationsByTour.get(bokunId) ?? []
    const locationNames = locationIds
      .map((id) => locationName.get(id))
      .filter((n): n is string => Boolean(n))

    // Pick a localized text field, falling back to English then null.
    const tr = (field: "title" | "excerpt" | "description"): string | null =>
      byLang?.[locale]?.[field]?.trim() || byLang?.en?.[field]?.trim() || null

    // Normalize the stored route stops (guard against bad JSON / stray values).
    const mapStops: MapStop[] = Array.isArray(o?.mapStops)
      ? o!.mapStops.filter(
          (s): s is MapStop =>
            !!s &&
            typeof s.lat === "number" &&
            typeof s.lng === "number" &&
            Number.isFinite(s.lat) &&
            Number.isFinite(s.lng),
        )
      : []
    // The primary marker sits at the first stop, then the admin's single
    // coordinate, then Bokun's coordinate.
    const primaryLat = mapStops[0]?.lat ?? o?.mapLat ?? t.lat ?? null
    const primaryLng = mapStops[0]?.lng ?? o?.mapLng ?? t.lng ?? null

    return {
      ...t,
      bokunId,
      // Admin-set coordinates take precedence over Bokun's, when provided.
      lat: primaryLat,
      lng: primaryLng,
      mapLat: o?.mapLat ?? null,
      mapLng: o?.mapLng ?? null,
      mapStops,
      showOnMap: o?.showOnMap ?? true,
      hidden: o?.hidden ?? false,
      title: tr("title") || o?.title?.trim() || t.title,
      image: o?.imageUrl || t.image,
      location: o?.location?.trim() || t.location,
      duration: o?.duration?.trim() || t.duration,
      excerpt: tr("excerpt") || o?.excerpt?.trim() || null,
      description: tr("description") || o?.description?.trim() || null,
      gallery: parseGallery(o?.gallery),
      difficulty: o?.difficulty ?? null,
      groupSize: o?.groupSize ?? null,
      // Tours are unpublished (draft) by default. A tour only becomes visible
      // on the public site once an admin explicitly publishes it, so anything
      // newly synced from Bokun stays hidden until reviewed.
      visible: o?.visible ?? false,
      featured: o?.featured ?? false,
      categoryId,
      categoryName: categoryId != null ? (categoryMap.get(categoryId) ?? null) : null,
      categoryIds,
      categoryNames,
      locationIds,
      locationNames,
      tourType: TOUR_TYPES.includes(o?.tourType as TourType)
        ? (o!.tourType as TourType)
        : "day",
      sortOrder: o?.sortOrder ?? 0,
      updatedAt: o?.updatedAt ?? null,
    }
  })
}

/** Visible, sorted tours for the public site in the given locale. */
export async function getVisibleTours(
  locale: Locale = DEFAULT_LOCALE,
): Promise<MergedTour[]> {
  const tours = await getMergedTours(locale)
  return tours
    .filter((t) => t.visible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function getCategories(): Promise<TourCategory[]> {
  return db.select().from(tourCategory).orderBy(tourCategory.sortOrder)
}

export async function getStartingLocations(): Promise<StartingLocation[]> {
  return db.select().from(startingLocation).orderBy(startingLocation.sortOrder)
}

/** Run an async mapper over items with a bounded concurrency. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  )
  return results
}

/**
 * Keep only the tours that have at least one bookable departure between
 * `from` and `to` (inclusive) with room for `pax` travellers.
 *
 * Availability is served from the `tour_availability` table, which a cron job
 * keeps fresh (see `refreshTourAvailability`). This turns search into a single
 * indexed DB query instead of one Bokun call per tour. If the table has not
 * been populated yet (e.g. right after a fresh deploy, before the first cron
 * run) we transparently fall back to querying Bokun directly so search still
 * works.
 */
export async function filterToursByAvailability(
  tours: MergedTour[],
  from: string,
  to: string,
  pax: number,
): Promise<MergedTour[]> {
  const wanted = Math.max(1, pax)
  if (tours.length === 0) return []
  const ids = tours.map((t) => t.bokunId)

  // Ids that have at least one bookable day in the requested range, read from
  // our server-side availability cache.
  const rows = await db
    .selectDistinct({ bokunId: tourAvailability.bokunId })
    .from(tourAvailability)
    .where(
      and(
        inArray(tourAvailability.bokunId, ids),
        gte(tourAvailability.date, from),
        lte(tourAvailability.date, to),
        or(
          eq(tourAvailability.unlimited, true),
          gte(
            tourAvailability.seats,
            sql`GREATEST(${wanted}, ${tourAvailability.minPax})`,
          ),
        ),
      ),
    )

  // If the cache is completely empty for these tours, it likely hasn't been
  // populated yet — fall back to the live Bokun path for correctness.
  if (rows.length === 0) {
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(tourAvailability)
      .where(inArray(tourAvailability.bokunId, ids))
    if (total === 0) {
      return filterToursByAvailabilityLive(tours, from, to, wanted)
    }
  }

  const available = new Set(rows.map((r) => r.bokunId))
  return tours.filter((t) => available.has(t.bokunId))
}

/**
 * Live availability filter that queries Bokun per tour (cached for 30 min).
 * Used as a fallback when the server-side availability cache is empty.
 */
async function filterToursByAvailabilityLive(
  tours: MergedTour[],
  from: string,
  to: string,
  wanted: number,
): Promise<MergedTour[]> {
  const windowStart = `${from.slice(0, 7)}-01`
  const ey = Number(to.slice(0, 4))
  const em = Number(to.slice(5, 7))
  const lastDay = new Date(ey, em, 0).getDate()
  const windowEnd = `${to.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`

  const flags = await mapWithConcurrency(tours, 24, async (tour) => {
    const days = await fetchTourAvailability(tour.bokunId, windowStart, windowEnd)
    return days.some(
      (d) =>
        d.date >= from &&
        d.date <= to &&
        (d.unlimited || d.seats >= Math.max(wanted, d.minPax)),
    )
  })
  return tours.filter((_, i) => flags[i])
}

/** How many days of availability to keep cached ahead of today. */
const AVAILABILITY_WINDOW_DAYS = 365

/**
 * Refresh the server-side availability cache for every *published* tour.
 * Fetches a rolling window (today → +1 year) of departures per tour and
 * upserts them into `tour_availability`, replacing that tour's future rows.
 *
 * Only tours an admin has explicitly published (`tourOverride.visible`) are
 * cached, since those are the only ones that can appear in search. Future rows
 * for tours that are no longer published are pruned so the cache stays in sync
 * with what the site shows. Intended to be run on a schedule by the
 * availability cron. Returns a small summary.
 */
export async function refreshTourAvailability(): Promise<{
  tours: number
  rows: number
}> {
  const [allTours, visibleOverrides] = await Promise.all([
    fetchAllTours(),
    db
      .select({ bokunId: tourOverride.bokunId })
      .from(tourOverride)
      .where(eq(tourOverride.visible, true)),
  ])

  // Only keep tours that both exist in Bokun and are published on the site.
  const visibleIds = new Set(visibleOverrides.map((o) => o.bokunId))
  const tours = allTours.filter((t) => visibleIds.has(String(t.id)))

  const today = new Date().toISOString().slice(0, 10)
  const end = new Date(Date.now() + AVAILABILITY_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10)

  // Prune future availability for any tour that is no longer published, so the
  // cache never serves departures for hidden tours.
  const keepIds = tours.map((t) => String(t.id))
  await db
    .delete(tourAvailability)
    .where(
      and(
        gte(tourAvailability.date, today),
        keepIds.length > 0
          ? notInArray(tourAvailability.bokunId, keepIds)
          : sql`true`,
      ),
    )

  let totalRows = 0

  // Bounded concurrency keeps us within Bokun rate limits and the pg pool.
  await mapWithConcurrency(tours, 8, async (tour) => {
    const bokunId = String(tour.id)
    const days = await fetchTourAvailabilityUncached(bokunId, today, end)

    // Bokun can return several departures for the same day (different start
    // times). We store one row per day, keeping the most bookable option:
    // unlimited if any departure is unlimited, the largest seat count, and the
    // smallest minimum-participant requirement.
    const byDate = new Map<string, (typeof days)[number]>()
    for (const d of days) {
      const prev = byDate.get(d.date)
      if (!prev) {
        byDate.set(d.date, { ...d })
      } else {
        prev.unlimited = prev.unlimited || d.unlimited
        prev.seats = Math.max(prev.seats, d.seats)
        prev.minPax = Math.min(prev.minPax, d.minPax)
      }
    }
    const values = Array.from(byDate.values()).map((d) => ({
      bokunId,
      date: d.date,
      seats: d.seats,
      unlimited: d.unlimited,
      minPax: d.minPax,
    }))

    // Replace this tour's future rows atomically so search never sees a gap.
    await db.transaction(async (tx) => {
      await tx
        .delete(tourAvailability)
        .where(
          and(
            eq(tourAvailability.bokunId, bokunId),
            gte(tourAvailability.date, today),
          ),
        )
      if (values.length > 0) {
        await tx.insert(tourAvailability).values(values)
      }
    })

    totalRows += values.length
  })

  return { tours: tours.length, rows: totalRows }
}

/** A single visible tour by its Bokun id, or null if missing/hidden. */
export async function getTourById(
  bokunId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<MergedTour | null> {
  const tours = await getMergedTours(locale)
  return tours.find((t) => t.bokunId === bokunId && t.visible) ?? null
}

export type FullTour = MergedTour & {
  detail: TourDetail | null
  /** Resolved description: translation → admin → Bokun → excerpt. */
  fullDescription: string
  /** Resolved difficulty: admin override, else Bokun. */
  difficultyLabel: string | null
  /** Resolved group size: admin override, else Bokun min/max booking. */
  groupSizeLabel: string | null
  /** Localized lists; fall back to English then the Bokun source. */
  includedItems: string[]
  excludedItems: string[]
  goodToKnowItems: string[]
  /** Localized itinerary steps; edited content wins, else Bokun's agenda. */
  itinerary: ItineraryStep[]
}

/**
 * Everything needed to render a single tour page in a given locale: the merged
 * tour, the editable per-language content, plus the rich Bokun detail
 * (gallery, price, location, etc.). Editable content always wins over Bokun.
 */
export async function getFullTour(
  bokunId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<FullTour | null> {
  const tour = await getTourById(bokunId, locale)
  if (!tour) return null

  const [detail, rows] = await Promise.all([
    fetchTourDetail(bokunId),
    db.select().from(tourTranslation).where(eq(tourTranslation.bokunId, bokunId)),
  ])

  const byLang: Record<string, (typeof rows)[number]> = {}
  for (const r of rows) byLang[r.lang] = r

  // Pick a localized list field: translation[locale] → translation[en] → fallback.
  const list = (
    field: "included" | "excluded" | "goodToKnow",
    fallback: string[],
  ): string[] => {
    const localized = parseList(byLang[locale]?.[field])
    if (localized.length > 0) return localized
    const english = parseList(byLang.en?.[field])
    if (english.length > 0) return english
    return fallback
  }

  // Description priority: localized/merged tour → Bokun detail → excerpt.
  const fullDescription =
    tour.description?.trim() || detail?.description?.trim() || tour.excerpt?.trim() || ""

  const difficultyLabel = tour.difficulty?.trim() || detail?.difficulty || null

  let groupSizeLabel = tour.groupSize?.trim() || null
  if (!groupSizeLabel && detail?.maxPerBooking) {
    groupSizeLabel = `Up to ${detail.maxPerBooking} people`
  }

  // Itinerary priority: edited locale → edited English → Bokun's agenda.
  const itinerary =
    parseItinerary(byLang[locale]?.itinerary).length > 0
      ? parseItinerary(byLang[locale]?.itinerary)
      : parseItinerary(byLang.en?.itinerary).length > 0
        ? parseItinerary(byLang.en?.itinerary)
        : (detail?.itinerary ?? [])

  return {
    ...tour,
    detail,
    fullDescription,
    difficultyLabel,
    groupSizeLabel,
    includedItems: list("included", detail?.included ?? []),
    excludedItems: list("excluded", detail?.excluded ?? []),
    goodToKnowItems: list("goodToKnow", detail?.knowBeforeYouGo ?? []),
    itinerary,
  }
}

/**
 * The full description for a tour's detail page. Prefers the admin override,
 * then falls back to the original English text from Bokun, then the excerpt.
 */
export async function getTourDescription(tour: MergedTour): Promise<string> {
  if (tour.description?.trim()) return tour.description.trim()

  const translations = await fetchTourTranslations(tour.bokunId)
  const en =
    translations.find((t) => t.lang === "EN") ??
    translations.find((t) => t.description?.trim())
  if (en?.description?.trim()) return en.description.trim()

  return tour.excerpt?.trim() || ""
}

/** Up to `limit` other visible tours that share a category with this one. */
export async function getRelatedTours(
  tour: MergedTour,
  limit = 3,
  locale: Locale = DEFAULT_LOCALE,
): Promise<MergedTour[]> {
  const tours = await getVisibleTours(locale)
  const related = tours.filter(
    (t) =>
      t.bokunId !== tour.bokunId &&
      t.categoryIds.some((id) => tour.categoryIds.includes(id)),
  )
  // Fall back to any other tours if there are no category matches.
  const pool = related.length > 0 ? related : tours.filter((t) => t.bokunId !== tour.bokunId)
  return pool.slice(0, limit)
}

export type HomeCategory = {
  id: number
  name: string
  slug: string
  image: string | null
  count: number
}

/**
 * Backend categories for the homepage grid: only those with an image set,
 * each with a live count of visible tours assigned to it.
 */
export async function getHomeCategories(
  visibleTours?: MergedTour[],
  locale: Locale = DEFAULT_LOCALE,
): Promise<HomeCategory[]> {
  const [tours, categories] = await Promise.all([
    visibleTours ? Promise.resolve(visibleTours) : getVisibleTours(locale),
    getCategories(),
  ])

  const counts = new Map<number, number>()
  for (const t of tours) {
    for (const id of t.categoryIds) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }

  return categories
    .filter((c) => c.imageUrl)
    .map((c) => ({
      id: c.id,
      name: categoryName(c, locale),
      slug: c.slug,
      image: c.imageUrl,
      count: counts.get(c.id) ?? 0,
    }))
}
