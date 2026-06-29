import "server-only"
import crypto from "node:crypto"
import { unstable_cache } from "next/cache"
import type { Tour } from "@/lib/data"

const DOMAIN = "api.bokun.io"

/** Bokun requires a UTC timestamp in the format "yyyy-MM-dd HH:mm:ss". */
function bokunDate(): string {
  return new Date().toISOString().replace("T", " ").substring(0, 19)
}

/** Signature = Base64( HMAC-SHA1( secret, date + accessKey + method + path ) ) */
function sign(date: string, accessKey: string, secret: string, method: string, path: string): string {
  return crypto.createHmac("sha1", secret).update(date + accessKey + method + path).digest("base64")
}

async function bokunRequest<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T | null> {
  const accessKey = process.env.BOKUN_ACCESS_KEY
  const secret = process.env.BOKUN_SECRET_KEY

  if (!accessKey || !secret) {
    console.log("[v0] Bokun keys missing, skipping API call")
    return null
  }

  const date = bokunDate()
  const signature = sign(date, accessKey, secret, method, path)

  try {
    const res = await fetch(`https://${DOMAIN}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Bokun-Date": date,
        "X-Bokun-AccessKey": accessKey,
        "X-Bokun-Signature": signature,
      },
      body: body ? JSON.stringify(body) : undefined,
      // Raw payloads exceed Next's 2MB data-cache limit, so don't cache here.
      // We cache the small, mapped result instead (see getTours).
      cache: "no-store",
    })

    if (!res.ok) {
      console.log("[v0] Bokun request failed:", res.status, path)
      return null
    }

    return (await res.json()) as T
  } catch (err) {
    console.log("[v0] Bokun request error:", (err as Error).message)
    return null
  }
}

/* ---------- Response shapes (subset of Bokun's payload) ---------- */

type BokunDerivedPhoto = { name?: string; url?: string; cleanUrl?: string }
type BokunPhoto = { originalUrl?: string; derived?: BokunDerivedPhoto[] }

type BokunActivity = {
  id: string | number
  title?: string
  price?: number
  durationText?: string
  reviewRating?: number
  reviewCount?: number
  activityCategories?: string[]
  googlePlace?: {
    city?: string
    country?: string
    countryCode?: string
    name?: string
    geoLocationCenter?: { lat?: number; lng?: number }
  }
  keyPhoto?: BokunPhoto
  photos?: BokunPhoto[]
  vendor?: { id?: number; title?: string }
}

type BokunSearchResponse = { items?: BokunActivity[]; totalHits?: number }

const CATEGORY_LABELS: Record<string, string> = {
  ADVENTURE: "Adventure",
  NATURE: "Nature",
  DAY_TRIPS_AND_EXCURSIONS: "Day Tour",
  MULTI_DAY_TOURS: "Multi-Day",
  PRIVATE_TOURS: "Private",
  SELF_DRIVE: "Self Drive",
  BUS_OR_MINIVAN_TOUR: "Bus Tour",
  WALKING_TOUR: "Walking",
  BOAT_TOUR: "Boat Tour",
  WHALE_WATCHING: "Wildlife",
  HORSE_RIDING: "Horse Riding",
  GLACIER: "Glacier",
  NORTHERN_LIGHTS: "Northern Lights",
  PHOTOGRAPHY: "Photography",
  FOOD_AND_DRINK: "Food & Drink",
  SHORE_EXCURSIONS: "Shore Excursion",
  CITY_TRIPS: "City",
  CULTURE: "Culture",
}

function pickTag(categories?: string[]): string {
  if (!categories?.length) return "Tour"
  // Prefer a meaningful category over generic ones.
  const ordered = [...categories].sort((a, b) => {
    const generic = ["DAY_TRIPS_AND_EXCURSIONS", "SHORE_EXCURSIONS", "ADVENTURE"]
    return generic.indexOf(a) - generic.indexOf(b)
  })
  for (const c of categories) {
    if (CATEGORY_LABELS[c] && !["DAY_TRIPS_AND_EXCURSIONS", "SHORE_EXCURSIONS"].includes(c)) {
      return CATEGORY_LABELS[c]
    }
  }
  return CATEGORY_LABELS[ordered[0]] ?? "Tour"
}

function photoUrl(activity: BokunActivity): string {
  const photo = activity.keyPhoto ?? activity.photos?.[0]
  if (!photo) return "/placeholder.svg"
  const large = photo.derived?.find((d) => d.name === "large")
  const preview = photo.derived?.find((d) => d.name === "preview")
  return large?.url ?? preview?.url ?? photo.originalUrl ?? "/placeholder.svg"
}

function mapActivity(activity: BokunActivity): Tour {
  return {
    id: Number(activity.id),
    title: (activity.title ?? "Untitled tour").trim(),
    image: photoUrl(activity),
    duration: activity.durationText?.trim() || "Flexible",
    location: activity.googlePlace?.city ?? activity.googlePlace?.country ?? "Iceland",
    price: Math.round(activity.price ?? 0),
    rating: activity.reviewRating && activity.reviewCount ? Number(activity.reviewRating.toFixed(1)) : 0,
    tag: pickTag(activity.activityCategories),
    operatorId: activity.vendor?.id ?? null,
    operator: activity.vendor?.title?.trim() || null,
    bokunCategories: activity.activityCategories ?? [],
  }
}

async function fetchAllToursUncached(): Promise<Tour[]> {
  const pageSize = 50
  let page = 1
  // De-duplicate by id: Bokun's paginated search can repeat activities across
  // pages, which otherwise causes duplicate React keys and inflated counts.
  const byId = new Map<number, Tour>()

  while (true) {
    // Request English content so the public site defaults to English
    // regardless of each tour's base language in Bokun.
    const data = await bokunRequest<BokunSearchResponse>(
      "POST",
      "/activity.json/search?lang=en",
      { page, pageSize },
    )
    if (!data?.items?.length) break

    for (const item of data.items) {
      const tour = mapActivity(item)
      if (tour.id != null && !byId.has(tour.id)) byId.set(tour.id, tour)
    }

    const total = data.totalHits ?? byId.size
    if (byId.size >= total || data.items.length < pageSize) break
    page += 1
    if (page > 50) break // safety cap
  }

  return Array.from(byId.values())
}

/**
 * Fetches all bookable activities from Bokun and caches the small mapped
 * result for an hour, so repeat page loads are instant.
 */
export const fetchAllTours = unstable_cache(fetchAllToursUncached, ["bokun-all-tours-v3"], {
  revalidate: 3600,
  tags: ["bokun-tours"],
})

/* ---------- Original texts per language ---------- */

export type TourTranslation = {
  lang: string
  title: string
  excerpt: string
  description: string
  /** Newline-joined list of "what's included" items. */
  included: string
  /** Newline-joined list of "not included" items. */
  excluded: string
  /** Free-text requirements / what to bring. */
  requirements: string
  /** Free-text important notice / attention. */
  attention: string
  /** Newline-joined "good to know" / know-before-you-go items. */
  goodToKnow: string
  /** Itinerary steps from Bokun's agenda. */
  itinerary: ItineraryStep[]
}

type BokunActivityDetail = {
  title?: string
  excerpt?: string
  description?: string
  included?: string
  excluded?: string
  requirements?: string
  attention?: string
  knowBeforeYouGoItems?: Array<{
    title?: string
    body?: string
    text?: string
    value?: string
  }>
  agendaItems?: Array<{ title?: string; body?: string; description?: string }>
}

/** Strip HTML tags and decode a few common entities for readable plain text. */
function stripHtml(html?: string): string {
  if (!html) return ""
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    // Decode numeric entities, e.g. &#34; → " and &#39; → '
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

async function fetchTourTranslationsUncached(bokunId: string): Promise<TourTranslation[]> {
  // We deliberately fetch only English from Bokun. The site's other languages
  // are produced by translating from this English base, so the tour's other
  // Bokun languages are intentionally ignored here.
  const d = await bokunRequest<BokunActivityDetail>(
    "GET",
    `/activity.json/${bokunId}?lang=en`,
  )
  if (!d) return []

  const knowItems = (d.knowBeforeYouGoItems ?? [])
    .map((i) => stripHtml(i.body ?? i.text ?? i.value ?? i.title))
    .filter(Boolean)
  const itinerary = (d.agendaItems ?? [])
    .map((a) => ({
      title: (a.title ?? "").trim(),
      body: stripHtml(a.body ?? a.description),
    }))
    .filter((s) => s.title || s.body)

  const en: TourTranslation = {
    lang: "EN",
    title: (d.title ?? "").trim(),
    excerpt: stripHtml(d.excerpt),
    description: stripHtml(d.description),
    included: htmlListToItems(d.included).join("\n"),
    excluded: htmlListToItems(d.excluded).join("\n"),
    requirements: stripHtml(d.requirements),
    attention: stripHtml(d.attention),
    goodToKnow: knowItems.join("\n"),
    itinerary,
  }

  // Only surface the card when Bokun actually has English text for this tour.
  const hasContent = [
    en.title,
    en.excerpt,
    en.description,
    en.included,
    en.excluded,
    en.requirements,
    en.attention,
    en.goodToKnow,
  ].some((v) => v.trim()) || en.itinerary.length > 0

  return hasContent ? [en] : []
}

/** Original English Bokun texts for one tour (other languages are ignored). */
export function fetchTourTranslations(bokunId: string): Promise<TourTranslation[]> {
  return unstable_cache(
    () => fetchTourTranslationsUncached(bokunId),
    ["bokun-translations-v2", bokunId],
    { revalidate: 3600, tags: ["bokun-tours"] },
  )()
}

/* ---------- Rich single-tour detail ---------- */

export type ItineraryStep = { title: string; body: string }

export type TourDetail = {
  description: string
  gallery: string[]
  included: string[]
  excluded: string[]
  requirements: string
  attention: string
  knowBeforeYouGo: string[]
  itinerary: ItineraryStep[]
  durationText: string | null
  difficulty: string | null
  minAge: number | null
  minPerBooking: number | null
  maxPerBooking: number | null
  priceAmount: number | null
  priceCurrency: string | null
  location: string | null
  lat: number | null
  lng: number | null
  cancellationHours: number | null
  hasPickup: boolean
}

type BokunFullDetail = BokunActivityDetail & {
  included?: string
  excluded?: string
  requirements?: string
  attention?: string
  knowBeforeYouGoItems?: Array<{ title?: string; body?: string; text?: string; value?: string }>
  agendaItems?: Array<{ title?: string; body?: string; description?: string }>
  durationText?: string
  difficultyLevel?: string
  minAge?: number
  photos?: BokunPhoto[]
  keyPhoto?: BokunPhoto
  rates?: Array<{ minPerBooking?: number; maxPerBooking?: number }>
  nextDefaultPriceMoney?: { amount?: number; currency?: string }
  googlePlace?: {
    city?: string
    country?: string
    name?: string
    geoLocationCenter?: { lat?: number; lng?: number }
  }
  cancellationPolicy?: { simpleCutoffHours?: number }
  pickupService?: boolean
}

const DIFFICULTY_LABELS: Record<string, string> = {
  VERY_EASY: "Very easy",
  EASY: "Easy",
  MODERATE: "Moderate",
  DEMANDING: "Demanding",
  VERY_DEMANDING: "Very demanding",
  EXTREME: "Extreme",
}

/** Turn an HTML "<ul><li>...</li></ul>" string into an array of plain items. */
function htmlListToItems(html?: string): string[] {
  if (!html) return []
  const matches = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  const items = matches.map((m) => stripHtml(m[1])).filter(Boolean)
  if (items.length > 0) return items
  // Fallback: split plain text on line breaks.
  return stripHtml(html)
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
}

function galleryUrls(detail: BokunFullDetail): string[] {
  const photos = [
    ...(detail.keyPhoto ? [detail.keyPhoto] : []),
    ...(detail.photos ?? []),
  ]
  const urls = photos
    .map((p) => {
      const large = p.derived?.find((d) => d.name === "large")
      const preview = p.derived?.find((d) => d.name === "preview")
      return large?.url ?? preview?.url ?? p.originalUrl
    })
    .filter((u): u is string => Boolean(u))
  // De-duplicate while keeping order.
  return [...new Set(urls)]
}

async function fetchTourDetailUncached(bokunId: string): Promise<TourDetail | null> {
  const d = await bokunRequest<BokunFullDetail>("GET", `/activity.json/${bokunId}?lang=en`)
  if (!d) return null

  const rate = d.rates?.[0]
  const place = d.googlePlace
  const knowItems = (d.knowBeforeYouGoItems ?? [])
    .map((i) => stripHtml(i.body ?? i.text ?? i.value ?? i.title))
    .filter(Boolean)
  const itinerary = (d.agendaItems ?? [])
    .map((a) => ({
      title: (a.title ?? "").trim(),
      body: stripHtml(a.body ?? a.description),
    }))
    .filter((s) => s.title || s.body)

  return {
    description: stripHtml(d.description),
    gallery: galleryUrls(d),
    included: htmlListToItems(d.included),
    excluded: htmlListToItems(d.excluded),
    requirements: stripHtml(d.requirements),
    attention: stripHtml(d.attention),
    knowBeforeYouGo: knowItems,
    itinerary,
    durationText: d.durationText?.trim() || null,
    difficulty: d.difficultyLevel
      ? (DIFFICULTY_LABELS[d.difficultyLevel] ?? null)
      : null,
    minAge: typeof d.minAge === "number" && d.minAge > 0 ? d.minAge : null,
    minPerBooking: rate?.minPerBooking ?? null,
    maxPerBooking: rate?.maxPerBooking ?? null,
    priceAmount:
      typeof d.nextDefaultPriceMoney?.amount === "number"
        ? d.nextDefaultPriceMoney.amount
        : null,
    priceCurrency: d.nextDefaultPriceMoney?.currency ?? null,
    location: place?.city ?? place?.country ?? null,
    lat: place?.geoLocationCenter?.lat ?? null,
    lng: place?.geoLocationCenter?.lng ?? null,
    cancellationHours: d.cancellationPolicy?.simpleCutoffHours ?? null,
    hasPickup: Boolean(d.pickupService),
  }
}

/** Rich detail for a single tour, cached for an hour. */
export function fetchTourDetail(bokunId: string): Promise<TourDetail | null> {
  return unstable_cache(
    () => fetchTourDetailUncached(bokunId),
    ["bokun-detail-v2", bokunId],
    { revalidate: 3600, tags: ["bokun-tours"] },
  )()
}

/* ---------- Availability ---------- */

/** A single bookable departure for a tour on a given day. */
export type Availability = {
  /** Local day in YYYY-MM-DD form. */
  date: string
  /** Seats left for this departure (ignore when `unlimited`). */
  seats: number
  /** True when the departure has no seat cap. */
  unlimited: boolean
  /** Minimum participants required to book. */
  minPax: number
}

type BokunAvailability = {
  date?: number
  localizedDate?: string
  availabilityCount?: number
  unlimitedAvailability?: boolean
  minParticipants?: number
  soldOut?: boolean
}

/** Convert Bokun's epoch-ms day into a YYYY-MM-DD string (UTC). */
function msToDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

async function fetchTourAvailabilityUncached(
  bokunId: string,
  start: string,
  end: string,
): Promise<Availability[]> {
  const path =
    `/activity.json/${bokunId}/availabilities` +
    `?start=${start}&end=${end}&lang=EN&currency=ISK&includeSoldOut=false`
  const data = await bokunRequest<BokunAvailability[]>("GET", path)
  if (!Array.isArray(data)) return []

  return data
    .filter((a) => !a.soldOut && typeof a.date === "number")
    .map((a) => ({
      date: msToDate(a.date as number),
      seats: a.availabilityCount ?? 0,
      unlimited: Boolean(a.unlimitedAvailability),
      minPax: a.minParticipants ?? 1,
    }))
}

/**
 * Bookable departures for one tour between two YYYY-MM-DD dates (inclusive),
 * cached for 30 minutes per tour + date range so repeat searches are instant.
 */
export function fetchTourAvailability(
  bokunId: string,
  start: string,
  end: string,
): Promise<Availability[]> {
  return unstable_cache(
    () => fetchTourAvailabilityUncached(bokunId, start, end),
    ["bokun-availability-v1", bokunId, start, end],
    { revalidate: 1800, tags: ["bokun-tours"] },
  )()
}

/* ---------- Bookable slots (rich availability + pricing) ---------- */

/**
 * One selectable price line within a slot. For per-person tours this is a
 * pricing category (e.g. "Adult"); for per-booking tours there is a single
 * line representing the whole booking. All amounts are in ISK.
 */
export type SlotPriceLine = {
  /** pricingCategoryId (per-person) or rateId (per-booking). */
  id: number
  title: string
  minAge: number
  /**
   * Tiered unit prices in ISK. Pick the entry whose [minPax,maxPax] range
   * contains the total participant count; non-tiered tours have one entry.
   */
  tiers: { unitIsk: number; minPax: number; maxPax: number }[]
}

/** A single bookable departure with everything the form needs to price it. */
export type BookableSlot = {
  /** Bokun availability id, e.g. "182076_20260628". */
  id: string
  date: string
  startTime: string
  startTimeId: number
  seats: number
  unlimited: boolean
  minPax: number
  maxPax: number
  /** True when priced per person/category; false for a flat per-booking price. */
  pricedPerPerson: boolean
  /** Flat total in ISK for per-booking tours (0 when priced per person). */
  flatPriceIsk: number
  lines: SlotPriceLine[]
  /** Human-readable cancellation summary, e.g. "Free cancellation up to 48h before". */
  cancellation: string
}

type BokunMoney = { amount?: number; currency?: string }
type BokunPenaltyRule = { cutoffHours?: number; charge?: number }
type BokunCancellationPolicy = {
  simpleCutoffHours?: number | null
  penaltyRules?: BokunPenaltyRule[]
}
type BokunRate = {
  id: number
  title?: string
  pricedPerPerson?: boolean
  minPerBooking?: number
  maxPerBooking?: number
  cancellationPolicy?: BokunCancellationPolicy
}
type BokunCategoryUnitPrice = {
  id: number
  amount?: BokunMoney
  minParticipantsRequired?: number
  maxParticipantsRequired?: number
}
type BokunPriceByRate = {
  activityRateId: number
  pricePerBooking?: BokunMoney
  pricePerCategoryUnit?: BokunCategoryUnitPrice[]
}
type BokunRichAvailability = BokunAvailability & {
  id?: string
  startTime?: string | null
  startTimeId?: number
  defaultRateId?: number
  rates?: BokunRate[]
  pricesByRate?: BokunPriceByRate[]
  unavailable?: boolean
}
type BokunPricingCategory = {
  id: number
  title?: string
  fullTitle?: string
  minAge?: number
}

/** Summarise a cancellation policy into one short sentence. */
function cancellationText(policy?: BokunCancellationPolicy): string {
  if (!policy) return ""
  // Find the latest cutoff (hours before start) that still allows a full refund.
  const freeRules = (policy.penaltyRules ?? []).filter((r) => r.charge === 0)
  const cutoff =
    policy.simpleCutoffHours ??
    (freeRules.length
      ? Math.min(...freeRules.map((r) => r.cutoffHours ?? Infinity))
      : null)
  if (!cutoff || !isFinite(cutoff)) return ""
  const label = cutoff % 24 === 0 ? `${cutoff / 24} days` : `${cutoff}h`
  return `Free cancellation up to ${label} before`
}

async function fetchBookableSlotsUncached(
  bokunId: string,
  start: string,
  end: string,
): Promise<BookableSlot[]> {
  const path =
    `/activity.json/${bokunId}/availabilities` +
    `?start=${start}&end=${end}&lang=EN&currency=ISK&includeSoldOut=false`
  const [rows, activity] = await Promise.all([
    bokunRequest<BokunRichAvailability[]>("GET", path),
    bokunRequest<{ pricingCategories?: BokunPricingCategory[] }>(
      "GET",
      `/activity.json/${bokunId}?lang=EN&currency=ISK`,
    ),
  ])
  if (!Array.isArray(rows)) return []

  const catById = new Map<number, BokunPricingCategory>()
  for (const c of activity?.pricingCategories ?? []) catById.set(c.id, c)

  const slots: BookableSlot[] = []
  for (const a of rows) {
    if (a.soldOut || a.unavailable || typeof a.date !== "number") continue
    const seats = a.availabilityCount ?? 0
    const unlimited = Boolean(a.unlimitedAvailability)
    if (!unlimited && seats <= 0) continue

    const rate =
      a.rates?.find((r) => r.id === a.defaultRateId) ?? a.rates?.[0]
    if (!rate) continue
    const priceRow =
      a.pricesByRate?.find((p) => p.activityRateId === rate.id) ??
      a.pricesByRate?.[0]

    const pricedPerPerson = Boolean(rate.pricedPerPerson)
    const maxPax = rate.maxPerBooking && rate.maxPerBooking > 0
      ? rate.maxPerBooking
      : unlimited
        ? 20
        : seats

    let flatPriceIsk = 0
    const lines: SlotPriceLine[] = []

    if (!pricedPerPerson) {
      flatPriceIsk = Math.round(priceRow?.pricePerBooking?.amount ?? 0)
    } else {
      // Group tiered per-category unit prices by pricing category id.
      const byCat = new Map<number, SlotPriceLine>()
      for (const u of priceRow?.pricePerCategoryUnit ?? []) {
        const cat = catById.get(u.id)
        let line = byCat.get(u.id)
        if (!line) {
          line = {
            id: u.id,
            title: cat?.title ?? cat?.fullTitle ?? "Participant",
            minAge: cat?.minAge ?? 0,
            tiers: [],
          }
          byCat.set(u.id, line)
        }
        line.tiers.push({
          unitIsk: Math.round(u.amount?.amount ?? 0),
          minPax: u.minParticipantsRequired ?? 1,
          maxPax: u.maxParticipantsRequired ?? 9999,
        })
      }
      lines.push(...byCat.values())
      // Tours with no per-category prices fall back to a flat booking price.
      if (lines.length === 0) {
        flatPriceIsk = Math.round(priceRow?.pricePerBooking?.amount ?? 0)
      }
    }

    slots.push({
      id: a.id ?? `${a.startTimeId}_${msToDate(a.date)}`,
      date: msToDate(a.date),
      startTime: a.startTime ?? "",
      startTimeId: a.startTimeId ?? 0,
      seats,
      unlimited,
      minPax: Math.max(1, a.minParticipants ?? rate.minPerBooking ?? 1),
      maxPax: Math.max(1, maxPax),
      pricedPerPerson: pricedPerPerson && lines.length > 0,
      flatPriceIsk,
      lines,
      cancellation: cancellationText(rate.cancellationPolicy),
    })
  }
  return slots
}

/**
 * Rich bookable departures (times + pricing) for one tour between two
 * YYYY-MM-DD dates. Cached 15 minutes per tour + range. All prices in ISK.
 */
export function fetchBookableSlots(
  bokunId: string,
  start: string,
  end: string,
): Promise<BookableSlot[]> {
  return unstable_cache(
    () => fetchBookableSlotsUncached(bokunId, start, end),
    ["bokun-slots-v1", bokunId, start, end],
    { revalidate: 900, tags: ["bokun-tours"] },
  )()
}

/** Selected quantity per price line. */
export type SlotSelection = { lineId: number; qty: number }

/**
 * Authoritative total (in ISK) for a slot given quantity selections. Used by
 * both the form (display) and the server (recompute before charging) so the
 * price can never be tampered with. Tiered per-person prices are resolved
 * against the total participant count.
 */
export function priceSlotIsk(
  slot: BookableSlot,
  selections: SlotSelection[],
): number {
  if (!slot.pricedPerPerson) return slot.flatPriceIsk
  const totalPax = selections.reduce((n, s) => n + Math.max(0, s.qty), 0)
  if (totalPax <= 0) return 0
  let total = 0
  for (const sel of selections) {
    if (sel.qty <= 0) continue
    const line = slot.lines.find((l) => l.id === sel.lineId)
    if (!line) continue
    const tier =
      line.tiers.find((t) => totalPax >= t.minPax && totalPax <= t.maxPax) ??
      line.tiers[0]
    total += (tier?.unitIsk ?? 0) * sel.qty
  }
  return Math.round(total)
}

/* ---------- Tour extras (add-ons) ---------- */

/** A bookable, paid add-on for a tour (e.g. meal, equipment rental). */
export type TourExtra = {
  id: number
  title: string
  information: string
  /** Price label hint: per person vs a flat per-booking fee. */
  pricedPerPerson: boolean
  unitIsk: number
  /** Hard cap on quantity (0 = no explicit cap). */
  maxPerBooking: number
  /** When true, the quantity should not exceed the participant count. */
  limitByPax: boolean
}

type BokunExtra = {
  id: number
  title?: string
  information?: string
  included?: boolean
  free?: boolean
  pricingType?: string
  price?: unknown
  maxPerBooking?: number
  limitByPax?: boolean
}

/** Defensively pull an ISK number out of Bokun's various money shapes. */
function moneyToIsk(value: unknown): number {
  if (typeof value === "number") return Math.round(value)
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>
    if (typeof v.amount === "number") return Math.round(v.amount)
    if (v.amount && typeof v.amount === "object") {
      const inner = (v.amount as Record<string, unknown>).amount
      if (typeof inner === "number") return Math.round(inner)
    }
  }
  return 0
}

async function fetchTourExtrasUncached(bokunId: string): Promise<TourExtra[]> {
  const activity = await bokunRequest<{ bookableExtras?: BokunExtra[] }>(
    "GET",
    `/activity.json/${bokunId}?lang=EN&currency=ISK`,
  )
  const raw = activity?.bookableExtras
  if (!Array.isArray(raw) || raw.length === 0) return []

  const extras: TourExtra[] = []
  for (const e of raw) {
    if (e.included || e.free) continue
    const unitIsk = moneyToIsk(e.price)
    if (unitIsk <= 0) continue // skip "ask"/priceless extras
    extras.push({
      id: e.id,
      title: e.title ?? "Add-on",
      information: e.information ?? "",
      pricedPerPerson: /PERSON|PARTICIPANT|PAX/i.test(e.pricingType ?? ""),
      unitIsk,
      maxPerBooking: e.maxPerBooking && e.maxPerBooking > 0 ? e.maxPerBooking : 0,
      limitByPax: Boolean(e.limitByPax),
    })
  }
  return extras
}

/**
 * Paid, bookable add-ons for one tour (in ISK). Cached 15 minutes; returns an
 * empty array when none exist or the extras list fails to load (caller hides
 * the section). Booking participants still works without it.
 */
export function fetchTourExtras(bokunId: string): Promise<TourExtra[]> {
  return unstable_cache(
    () => fetchTourExtrasUncached(bokunId),
    ["bokun-extras-v2", bokunId],
    { revalidate: 900, tags: ["bokun-tours"] },
  )()
}

/** Selected quantity per add-on. */
export type AddonSelection = { extraId: number; qty: number }

/**
 * Authoritative add-ons total (ISK). Each add-on is charged unit price × qty.
 * Used by both the form (display) and the server (recompute before charging).
 */
export function priceExtrasIsk(
  extras: TourExtra[],
  addons: AddonSelection[],
): number {
  let total = 0
  for (const a of addons) {
    if (a.qty <= 0) continue
    const ex = extras.find((e) => e.id === a.extraId)
    if (!ex) continue
    total += ex.unitIsk * Math.floor(a.qty)
  }
  return Math.round(total)
}

/** Clamp the selectable quantity for an add-on given participant count. */
export function maxAddonQty(extra: TourExtra, totalPax: number): number {
  const caps = [99]
  if (extra.maxPerBooking > 0) caps.push(extra.maxPerBooking)
  if (extra.limitByPax) caps.push(Math.max(1, totalPax))
  return Math.max(0, Math.min(...caps))
}

/* ---------- Pickup / drop-off ---------- */

/** A selectable pickup or drop-off location. */
export type PickupPlace = {
  id: number
  title: string
  /** ACCOMMODATION | STATION | PORT | AIRPORT | OTHER */
  type: string
  /** Hotels often need a room number alongside the place. */
  askForRoomNumber: boolean
  /** Human-readable address, when available. */
  address: string
}

/**
 * Pickup configuration for a tour. `required` is true for PICK_UP tours (the
 * guest must choose where to be collected); MEET_ON_LOCATION_OR_PICK_UP tours
 * make it optional ("I'll meet at the location"). Empty `pickupPlaces` →
 * the booking form hides the section.
 */
export type TourPickup = {
  meetingType: string
  required: boolean
  pickupPlaces: PickupPlace[]
  dropoffPlaces: PickupPlace[]
}

type BokunPickupPlace = {
  id: number
  title?: string
  type?: string
  askForRoomNumber?: boolean
  location?: { wholeAddress?: string; address?: string; city?: string }
}

function mapPlace(p: BokunPickupPlace): PickupPlace {
  const loc = p.location ?? {}
  const address =
    loc.wholeAddress ??
    [loc.address, loc.city].filter(Boolean).join(", ") ??
    ""
  return {
    id: p.id,
    title: (p.title ?? "").trim(),
    type: p.type ?? "OTHER",
    askForRoomNumber: Boolean(p.askForRoomNumber),
    address,
  }
}

async function fetchTourPickupUncached(bokunId: string): Promise<TourPickup> {
  const empty: TourPickup = {
    meetingType: "MEET_ON_LOCATION",
    required: false,
    pickupPlaces: [],
    dropoffPlaces: [],
  }

  const activity = await bokunRequest<{
    meetingType?: string
    displaySettings?: { showPickupPlaces?: boolean }
  }>("GET", `/activity.json/${bokunId}?lang=EN&currency=ISK`)
  // Throw (rather than return empty) so a transient API failure is never
  // cached as a valid "no pickup" result and stuck for the cache lifetime.
  if (!activity) throw new Error(`Bokun activity ${bokunId} unavailable`)

  const meetingType = activity.meetingType ?? "MEET_ON_LOCATION"
  const offersPickup =
    /PICK_UP/i.test(meetingType) ||
    Boolean(activity.displaySettings?.showPickupPlaces)
  if (!offersPickup) return { ...empty, meetingType }

  const places = await bokunRequest<{
    pickupPlaces?: BokunPickupPlace[]
    dropoffPlaces?: BokunPickupPlace[]
  }>("GET", `/activity.json/${bokunId}/pickup-places?lang=EN`)
  // A tour that advertises pickup but whose places request failed must not be
  // cached as empty — throw so the next render retries.
  if (!places) throw new Error(`Bokun pickup-places ${bokunId} unavailable`)

  const pickupPlaces = (places.pickupPlaces ?? [])
    .map(mapPlace)
    .filter((p) => p.title)
  const dropoffPlaces = (places.dropoffPlaces ?? [])
    .map(mapPlace)
    .filter((p) => p.title)

  return {
    meetingType,
    // Only force a choice when there are places to choose from.
    required: meetingType === "PICK_UP" && pickupPlaces.length > 0,
    pickupPlaces,
    dropoffPlaces,
  }
}

/**
 * Pickup/drop-off options for one tour. Cached 15 minutes; on any failure
 * returns a safe "no pickup" result so the booking form simply hides the
 * section and participant booking still works.
 */
export function fetchTourPickup(bokunId: string): Promise<TourPickup> {
  return unstable_cache(
    () => fetchTourPickupUncached(bokunId),
    ["bokun-pickup-v2", bokunId],
    { revalidate: 900, tags: ["bokun-tours"] },
  )()
}
