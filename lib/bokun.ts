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
    lat: activity.googlePlace?.geoLocationCenter?.lat ?? null,
    lng: activity.googlePlace?.geoLocationCenter?.lng ?? null,
  }
}

async function fetchPage(page: number, pageSize: number) {
  // Request English content so the public site defaults to English regardless
  // of each tour's base language in Bokun.
  return bokunRequest<BokunSearchResponse>("POST", "/activity.json/search?lang=en", {
    page,
    pageSize,
  })
}

async function fetchAllToursUncached(): Promise<Tour[]> {
  const pageSize = 50
  const MAX_PAGES = 100 // hard safety cap (covers far more than today's catalog)
  const CONCURRENCY = 6
  // De-duplicate by id: Bokun's paginated search can repeat activities across
  // pages, which otherwise causes duplicate React keys and inflated counts.
  const byId = new Map<number, Tour>()

  const collect = (data: BokunSearchResponse | null) => {
    for (const item of data?.items ?? []) {
      const tour = mapActivity(item)
      if (tour.id != null && !byId.has(tour.id)) byId.set(tour.id, tour)
    }
  }

  // Fetch page 1 first to learn the total result count. Bokun uses page-based
  // pagination with a fixed pageSize, so page N maps to [(N-1)*pageSize,
  // N*pageSize) even when an individual page returns fewer than pageSize items
  // (which Bokun does mid-list). We therefore page all the way to lastPage
  // instead of stopping at the first short page, which previously dropped tours.
  const first = await fetchPage(1, pageSize)
  collect(first)
  if (!first?.items?.length) return Array.from(byId.values())

  const total = first.totalHits ?? first.items.length
  const lastPage = Math.min(MAX_PAGES, Math.ceil(total / pageSize))

  // Fetch the remaining pages in bounded-concurrency batches for speed.
  for (let start = 2; start <= lastPage; start += CONCURRENCY) {
    const batch: number[] = []
    for (let p = start; p < start + CONCURRENCY && p <= lastPage; p++) batch.push(p)
    const results = await Promise.all(batch.map((p) => fetchPage(p, pageSize)))
    results.forEach(collect)
  }

  return Array.from(byId.values())
}

/**
 * Fetches all bookable activities from Bokun and caches the small mapped
 * result for an hour, so repeat page loads are instant.
 */
export const fetchAllTours = unstable_cache(fetchAllToursUncached, ["bokun-all-tours-v5"], {
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
    ["bokun-detail-v3", bokunId],
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

/**
 * Uncached availability fetch straight from Bokun. Used by the availability
 * refresh cron so it always writes fresh data to the DB. Prefer
 * `fetchTourAvailability` (cached) for request-time reads.
 */
export async function fetchTourAvailabilityUncached(
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
  /** Pricing categories bookable on this rate (used to reserve flat-priced tours). */
  pricingCategoryIds?: number[]
  /** "UNAVAILABLE" | "PRESELECTED" | "OPTIONAL" | ... — governs pickup fields. */
  pickupSelectionType?: string
  dropoffSelectionType?: string
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
  ticketCategory?: string
  defaultCategory?: boolean
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
  // Implausibly large cutoffs (e.g. Bokun's ~999-day placeholder) really just
  // mean "free cancellation anytime" — don't surface a misleading day count.
  if (cutoff > 24 * 30) return "Free cancellation"
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
        // Skip orphaned pricing categories: entries that appear in the price
        // matrix but are no longer real bookable categories on the activity
        // (Bokun sometimes leaves stale, often 0-priced, ids behind). Booking
        // them makes Bokun reject the whole reservation.
        const cat = catById.get(u.id)
        if (!cat) continue
        let line = byCat.get(u.id)
        if (!line) {
          line = {
            id: u.id,
            title: cat.title ?? cat.fullTitle ?? "Participant",
            minAge: cat.minAge ?? 0,
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
      // Order categories so the primary "Adult"/default line comes first. Bokun
      // rejects bookings that include e.g. a Child without an Adult, so the
      // default category must be the natural first choice in the UI.
      const orderedLines = [...byCat.values()].sort((a, b) => {
        const ca = catById.get(a.id)
        const cb = catById.get(b.id)
        const adultA = ca?.defaultCategory || ca?.ticketCategory === "ADULT" ? 1 : 0
        const adultB = cb?.defaultCategory || cb?.ticketCategory === "ADULT" ? 1 : 0
        if (adultA !== adultB) return adultB - adultA
        // Then oldest age band first (Adult 16+ before Child 8+).
        return (cb?.minAge ?? 0) - (ca?.minAge ?? 0)
      })
      lines.push(...orderedLines)
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

/**
 * A mandatory, preselected paid extra that Bokun auto-adds to every booking
 * (e.g. a national park fee). It is always charged, so it must be shown in the
 * price and order summary — never offered as an optional toggle.
 */
export type TourFee = {
  id: number
  title: string
  /** When true, charged once per participant; otherwise a flat per-booking fee. */
  pricedPerPerson: boolean
  unitIsk: number
}

type ExtrasBundle = { addons: TourExtra[]; fees: TourFee[] }

/**
 * Number of nights a tour spans, derived from its Bokun duration. Day tours
 * (measured in hours/minutes) count as a single unit so that "per night" fees
 * are charged exactly once — matching how Bokun bills a 0-night activity.
 *
 * For multi-day tours we count nights as (total days − 1), e.g. a 3-day tour is
 * 2 nights and a 1-week tour is 6 nights. This is an estimate used only for the
 * displayed price; the amount actually charged always comes from Bokun's
 * authoritative reserved total.
 */
function nightsFromDuration(a: {
  durationType?: string
  durationDays?: number
  durationWeeks?: number
}): number {
  const totalDays = (a.durationWeeks ?? 0) * 7 + (a.durationDays ?? 0)
  return Math.max(1, totalDays - 1)
}

async function fetchExtrasBundleUncached(bokunId: string): Promise<ExtrasBundle> {
  const activity = await bokunRequest<{
    bookableExtras?: BokunExtra[]
    durationType?: string
    durationDays?: number
    durationWeeks?: number
  }>("GET", `/activity.json/${bokunId}?lang=EN&currency=ISK`)
  const raw = activity?.bookableExtras
  if (!Array.isArray(raw) || raw.length === 0) return { addons: [], fees: [] }

  const nights = nightsFromDuration(activity ?? {})

  const addons: TourExtra[] = []
  const fees: TourFee[] = []
  for (const e of raw) {
    if (e.free) continue // genuinely free inclusions never affect price
    const rawUnitIsk = moneyToIsk(e.price)
    if (rawUnitIsk <= 0) continue // skip "ask"/priceless extras
    const pricingType = e.pricingType ?? ""
    const pricedPerPerson = /PERSON|PARTICIPANT|PAX/i.test(pricingType)
    // "Per night" pricing (e.g. PER_PERSON_PER_NIGHT) multiplies by the number
    // of nights. Baked into the unit price here so all downstream pricing and
    // line-item rendering stay night-agnostic. Day tours have nights = 1.
    const perNight = /NIGHT/i.test(pricingType)
    const unitIsk = perNight ? rawUnitIsk * nights : rawUnitIsk
    if (e.included) {
      // Mandatory preselected paid extra (e.g. Vatnajökull National Park Fee):
      // Bokun applies it to every booking automatically, so we surface it as a
      // fee rather than an optional add-on.
      fees.push({ id: e.id, title: e.title ?? "Fee", pricedPerPerson, unitIsk })
      continue
    }
    addons.push({
      id: e.id,
      title: e.title ?? "Add-on",
      information: e.information ?? "",
      pricedPerPerson,
      unitIsk,
      maxPerBooking: e.maxPerBooking && e.maxPerBooking > 0 ? e.maxPerBooking : 0,
      limitByPax: Boolean(e.limitByPax),
    })
  }
  return { addons, fees }
}

function fetchExtrasBundle(bokunId: string): Promise<ExtrasBundle> {
  return unstable_cache(
    () => fetchExtrasBundleUncached(bokunId),
    ["bokun-extras-bundle-v2", bokunId],
    { revalidate: 900, tags: ["bokun-tours"] },
  )()
}

/**
 * Paid, optional bookable add-ons for one tour (in ISK). Cached 15 minutes;
 * returns an empty array when none exist or the extras list fails to load
 * (caller hides the section). Booking participants still works without it.
 */
export async function fetchTourExtras(bokunId: string): Promise<TourExtra[]> {
  return (await fetchExtrasBundle(bokunId)).addons
}

/**
 * Mandatory, auto-applied fees for one tour (in ISK), e.g. a national park fee.
 * These are always charged by Bokun and must be included in the displayed total.
 */
export async function fetchTourFees(bokunId: string): Promise<TourFee[]> {
  return (await fetchExtrasBundle(bokunId)).fees
}

/** Total of all mandatory fees (ISK) for a given participant count. */
export function priceMandatoryFeesIsk(fees: TourFee[], totalPax: number): number {
  let total = 0
  for (const f of fees) {
    total += f.pricedPerPerson ? f.unitIsk * Math.max(0, totalPax) : f.unitIsk
  }
  return Math.round(total)
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

/* =====================================================================
   Bookings — read every reservation from Bokun (all sales channels,
   including bookings placed on this site which sync back into Bokun).
   The key has booking READ access (verified) even though booking WRITE
   is not permitted, so this is the source of truth for the admin list.
   ===================================================================== */

export type BokunBookingStatus =
  | "CONFIRMED"
  | "CANCELLED"
  | "ARRIVED"
  | "NO_SHOW"
  | "REJECTED"
  | string

/** A single reservation, mapped to a clean shape for the admin UI. */
export type BokunBooking = {
  id: number
  parentBookingId: number | null
  confirmationCode: string
  productConfirmationCode: string | null
  status: BokunBookingStatus
  /** Sales channel the booking came through (e.g. Website, Marketplace). */
  channel: string | null
  channelType: string | null
  productId: number | null
  productTitle: string
  productExternalId: string | null
  vendor: string | null
  seller: string | null
  /** Customer / lead traveller. */
  customerName: string
  customerFirstName: string | null
  customerLastName: string | null
  customerEmail: string | null
  customerPhone: string | null
  customerNationality: string | null
  /** Milliseconds since epoch. */
  bookedAt: number | null
  travelDate: number | null
  travelDateTime: number | null
  startTime: string | null
  rateTitle: string | null
  totalParticipants: number
  /** Per pricing-category breakdown, e.g. [{ title: "Adult", quantity: 2 }]. */
  participants: { title: string; quantity: number }[]
  /** Booked add-ons, e.g. [{ title: "National Park Fee", quantity: 6 }]. */
  extras: { title: string; quantity: number }[]
  totalPrice: number
  currency: string
  paidAmount: number
  paidType: string | null
  prepaid: boolean
  discountAmount: number
  discountPercentage: number
  /** Seller commission — always in the seller's base currency (ISK), NOT the booking's sale currency. */
  sellerCommission: number
  /** Cancellation metadata (null when active). */
  cancelledAt: number | null
  cancelNote: string | null
  specialRequests: string | null
  pickup: boolean
  dropoff: boolean
  pickupDescription: string | null
  labels: string[]
}

export type BokunBookingResult = {
  items: BokunBooking[]
  totalHits: number
  page: number
  pageSize: number
}

export type BokunBookingFilters = {
  page?: number
  pageSize?: number
  /** Booking statuses to include; omit for all. */
  statuses?: BokunBookingStatus[]
  /** Exact Bokun confirmation code (e.g. "VTI-95561587"). */
  confirmationCode?: string
  /** Travel-date range as "yyyy-MM-dd" strings (inclusive). */
  travelFrom?: string
  travelTo?: string
}

/* ---- Raw response shapes (subset of Bokun's payload) ---- */

type RawParty = { id?: number; title?: string }
type RawCustomer = {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phoneNumber?: string | null
  nationality?: string | null
}
type RawInvoice = { total?: number; currency?: string; totalCommission?: number }
type RawPriceCat = { bookedTitle?: string; pricingCategory?: { title?: string }; quantity?: number }
type RawExtra = { extra?: { title?: string }; unitCount?: number }
type RawBookingFields = {
  startTimeStr?: string | null
  pickup?: boolean
  dropoff?: boolean
  pickupPlaceDescription?: string | null
  totalParticipants?: number
  priceCategoryBookings?: RawPriceCat[]
  bookedExtras?: RawExtra[]
}
type RawBooking = {
  id: number
  parentBookingId?: number | null
  confirmationCode?: string
  productConfirmationCode?: string | null
  status?: string
  channel?: { title?: string; channelType?: string }
  product?: RawParty
  productExternalId?: string | null
  vendor?: RawParty
  seller?: RawParty
  customer?: RawCustomer
  creationDate?: number | null
  bookingCreationDate?: number | null
  startDate?: number | null
  startDateTime?: number | null
  rateTitle?: string | null
  totalParticipants?: number
  totalPrice?: number
  currency?: string
  paidAmount?: number
  paidType?: string | null
  prepaid?: boolean
  discountAmount?: number
  discountPercentage?: number
  sellerCommission?: number
  cancellationDate?: number | null
  cancelNote?: string | null
  specialRequests?: string | null
  customerInvoice?: RawInvoice
  labels?: { title?: string }[] | string[]
  fields?: RawBookingFields
}

type RawBookingSearch = { totalHits?: number; results?: RawBooking[] }

/** Collapse repeated pricing-category / extra rows into title + quantity. */
function tally<T>(rows: T[], titleOf: (r: T) => string, qtyOf: (r: T) => number) {
  const map = new Map<string, number>()
  for (const r of rows) {
    const title = titleOf(r).trim()
    if (!title) continue
    map.set(title, (map.get(title) ?? 0) + (qtyOf(r) || 0))
  }
  return [...map.entries()].map(([title, quantity]) => ({ title, quantity }))
}

function mapBooking(b: RawBooking): BokunBooking {
  const f = b.fields ?? {}
  const first = b.customer?.firstName?.trim() || null
  const last = b.customer?.lastName?.trim() || null
  const fullName = [first, last].filter(Boolean).join(" ") || "—"
  const labels = (b.labels ?? [])
    .map((l) => (typeof l === "string" ? l : l?.title))
    .filter((l): l is string => Boolean(l))

  return {
    id: b.id,
    parentBookingId: b.parentBookingId ?? null,
    confirmationCode: b.confirmationCode ?? String(b.id),
    productConfirmationCode: b.productConfirmationCode ?? null,
    status: b.status ?? "CONFIRMED",
    channel: b.channel?.title?.trim() || null,
    channelType: b.channel?.channelType ?? null,
    productId: b.product?.id ?? null,
    productTitle: b.product?.title?.trim() || "—",
    productExternalId: b.productExternalId ?? null,
    vendor: b.vendor?.title?.trim() || null,
    seller: b.seller?.title?.trim() || null,
    customerName: fullName,
    customerFirstName: first,
    customerLastName: last,
    customerEmail: b.customer?.email?.trim() || null,
    customerPhone: b.customer?.phoneNumber?.trim() || null,
    customerNationality: b.customer?.nationality || null,
    bookedAt: b.bookingCreationDate ?? b.creationDate ?? null,
    travelDate: b.startDate ?? null,
    travelDateTime: b.startDateTime ?? null,
    startTime: f.startTimeStr ?? null,
    rateTitle: b.rateTitle ?? null,
    totalParticipants: f.totalParticipants ?? b.totalParticipants ?? 0,
    participants: tally(
      f.priceCategoryBookings ?? [],
      (r) => r.bookedTitle || r.pricingCategory?.title || "",
      (r) => r.quantity ?? 1,
    ),
    extras: tally(
      f.bookedExtras ?? [],
      (r) => r.extra?.title || "",
      (r) => r.unitCount ?? 1,
    ),
    totalPrice: Math.round(b.totalPrice ?? b.customerInvoice?.total ?? 0),
    currency: b.currency ?? b.customerInvoice?.currency ?? "ISK",
    paidAmount: Math.round(b.paidAmount ?? 0),
    paidType: b.paidType ?? null,
    prepaid: Boolean(b.prepaid),
    discountAmount: Math.round(b.discountAmount ?? 0),
    discountPercentage: b.discountPercentage ?? 0,
    sellerCommission: Math.round(b.sellerCommission ?? 0),
    cancelledAt: b.cancellationDate ?? null,
    cancelNote: b.cancelNote ?? null,
    specialRequests: b.specialRequests?.trim() || null,
    pickup: Boolean(f.pickup),
    dropoff: Boolean(f.dropoff),
    pickupDescription: f.pickupPlaceDescription ?? null,
    labels,
  }
}

/**
 * Fetch reservations from Bokun with optional server-side filters (status,
 * confirmation code, travel-date range) and pagination. Live data — not
 * cached. Returns an empty result if the API is unavailable so the admin
 * page still renders.
 */
export async function fetchBokunBookings(
  filters: BokunBookingFilters = {},
): Promise<BokunBookingResult> {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 50))

  const body: Record<string, unknown> = {
    page,
    pageSize,
    excludeComboBookings: false,
  }
  if (filters.statuses?.length) body.bookingStatuses = filters.statuses
  if (filters.confirmationCode?.trim()) body.confirmationCode = filters.confirmationCode.trim()
  if (filters.travelFrom || filters.travelTo) {
    body.startDateRange = {
      from: filters.travelFrom ? Date.parse(filters.travelFrom) : 0,
      to: filters.travelTo ? Date.parse(filters.travelTo) + 86_399_000 : Date.now() + 10 * 365 * 86_400_000,
      includeLower: true,
      includeUpper: true,
    }
  }

  const data = await bokunRequest<RawBookingSearch>(
    "POST",
    "/booking.json/product-booking-search?lang=EN",
    body,
  )

  if (!data) return { items: [], totalHits: 0, page, pageSize }

  return {
    items: (data.results ?? []).map(mapBooking),
    totalHits: data.totalHits ?? 0,
    page,
    pageSize,
  }
}

/**
 * Fetch all bookings belonging to a customer, matched by email address. Uses
 * Bokun's free-text search to narrow server-side, then filters exactly on
 * customerEmail (case-insensitive) so we never show someone else's booking.
 * Returns most-recent-first. Empty on error so the account page still renders.
 */
export async function fetchBokunBookingsByEmail(
  email: string,
  maxPages = 3,
): Promise<BokunBooking[]> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return []

  const pageSize = 100
  const collected: BokunBooking[] = []

  for (let page = 1; page <= maxPages; page++) {
    const data = await bokunRequest<RawBookingSearch>(
      "POST",
      "/booking.json/product-booking-search?lang=EN",
      { page, pageSize, excludeComboBookings: false, textSearch: normalized },
    )
    const results = data?.results ?? []
    for (const r of results) collected.push(mapBooking(r))
    if (results.length < pageSize) break
  }

  return collected
    .filter((b) => b.customerEmail?.trim().toLowerCase() === normalized)
    .sort((a, b) => (b.travelDate ?? b.bookedAt ?? 0) - (a.travelDate ?? a.bookedAt ?? 0))
}

/**
 * Fetch every matching booking by walking Bokun's paged search (200 per page).
 * Used by the dashboard to aggregate revenue, channels and departures across
 * the whole book of business. Capped so a runaway account can't fetch forever.
 * The mapped result is cached briefly to keep the dashboard snappy.
 */
async function fetchAllBokunBookingsUncached(
  statuses: BokunBookingStatus[],
  maxBookings = 4000,
): Promise<BokunBooking[]> {
  const pageSize = 200
  const all: BokunBooking[] = []

  for (let page = 1; ; page++) {
    const body: Record<string, unknown> = {
      page,
      pageSize,
      excludeComboBookings: false,
    }
    if (statuses.length) body.bookingStatuses = statuses

    const data = await bokunRequest<RawBookingSearch>(
      "POST",
      "/booking.json/product-booking-search?lang=EN",
      body,
    )

    const results = data?.results ?? []
    for (const r of results) all.push(mapBooking(r))

    const totalHits = data?.totalHits ?? all.length
    if (results.length < pageSize || all.length >= totalHits || all.length >= maxBookings) {
      break
    }
  }

  return all
}

export const fetchAllBokunBookings = unstable_cache(
  fetchAllBokunBookingsUncached,
  ["bokun-all-bookings"],
  { revalidate: 600, tags: ["bokun-bookings"] },
)

export type CancelBookingOptions = {
  /** Reason shown in Bokun's cancellation record. */
  note?: string
  /** Email the customer (and supplier) about the cancellation. Default false. */
  notify?: boolean
  /** Attempt an automatic refund of any prepaid amount. Default false. */
  refund?: boolean
}

export type CancelBookingResult = { ok: true } | { ok: false; error: string }

/**
 * Cancel a reservation in Bokun by its confirmation code. This is a live,
 * destructive write against Bokun — unlike the read helpers it does its own
 * fetch so it can surface Bokun's exact error message on failure. Defaults are
 * intentionally conservative: no customer notification and no auto-refund.
 */
export async function cancelBokunBooking(
  confirmationCode: string,
  options: CancelBookingOptions = {},
): Promise<CancelBookingResult> {
  const accessKey = process.env.BOKUN_ACCESS_KEY
  const secret = process.env.BOKUN_SECRET_KEY
  if (!accessKey || !secret) return { ok: false, error: "Bokun API keys are not configured." }

  const code = confirmationCode.trim()
  if (!code) return { ok: false, error: "Missing confirmation code." }

  const method = "POST"
  const path = `/booking.json/cancel-booking/${encodeURIComponent(code)}?lang=EN`
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
      body: JSON.stringify({
        note: options.note?.trim() || "Cancelled from admin",
        notify: Boolean(options.notify),
        refund: Boolean(options.refund),
      }),
      cache: "no-store",
    })

    const text = await res.text()
    if (!res.ok) {
      let message = `Bokun returned ${res.status}`
      try {
        const parsed = JSON.parse(text) as { message?: string; error?: string }
        message = parsed.message || parsed.error || message
      } catch {
        if (text) message = text.slice(0, 200)
      }
      console.log("[v0] Bokun cancel failed:", res.status, message)
      return { ok: false, error: message }
    }

    return { ok: true }
  } catch (err) {
    const message = (err as Error).message
    console.log("[v0] Bokun cancel error:", message)
    return { ok: false, error: message }
  }
}

/* ---------- Creating bookings (reserve → external payment → confirm) ---------- */

/**
 * Low-level authenticated Bokun write that surfaces the HTTP status and Bokun's
 * exact error text (the shared `bokunRequest` helper swallows both). Used only
 * for the booking-creation writes, where we must react to the precise failure.
 */
async function bokunWrite<T>(
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  const accessKey = process.env.BOKUN_ACCESS_KEY
  const secret = process.env.BOKUN_SECRET_KEY
  if (!accessKey || !secret) {
    return { ok: false, status: 0, data: null, error: "Bokun API keys are not configured." }
  }
  const date = bokunDate()
  const signature = sign(date, accessKey, secret, "POST", path)
  try {
    const res = await fetch(`https://${DOMAIN}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "X-Bokun-Date": date,
        "X-Bokun-AccessKey": accessKey,
        "X-Bokun-Signature": signature,
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    })
    const text = await res.text()
    let data: T | null = null
    try {
      data = text ? (JSON.parse(text) as T) : null
    } catch {
      // Non-JSON body; leave data null and fall back to raw text for errors.
    }
    if (!res.ok) {
      let message = `Bokun returned ${res.status}`
      const parsed = data as { message?: string; error?: string } | null
      if (parsed?.message || parsed?.error) message = parsed.message || parsed.error || message
      else if (text) message = text.slice(0, 200)
      return { ok: false, status: res.status, data, error: message }
    }
    return { ok: true, status: res.status, data, error: null }
  } catch (err) {
    return { ok: false, status: 0, data: null, error: (err as Error).message }
  }
}

export type ReserveContact = {
  firstName: string
  lastName: string
  email: string
  phone?: string | null
}

export type ReserveBookingInput = {
  bokunId: string
  /** Availability id, e.g. "182076_20260628", to match the exact departure. */
  slotId: string
  /** YYYY-MM-DD. */
  date: string
  startTimeId: number
  pricedPerPerson: boolean
  totalPax: number
  /** Per-person tours: lineId is the pricingCategoryId. */
  selections: SlotSelection[]
  pickupId?: number | null
  dropoffId?: number | null
  contact: ReserveContact
  /**
   * Optional promo/discount code, as entered by the customer. Passed to Bokun,
   * which applies the discount if the code is valid & eligible for this booking.
   * Bokun silently ignores invalid/ineligible codes (no error), so callers must
   * detect "no discount applied" via `discountIsk` on the result.
   */
  promoCode?: string | null
}

export type ReserveBookingResult =
  | {
      ok: true
      confirmationCode: string
      bookingId: number | null
      /**
       * Bokun's authoritative activity total in ISK for the reserved booking.
       * This is what the customer must pay for the activity (excludes any local
       * add-ons); charge exactly this so no balance is left on the booking.
       * Null if it couldn't be read — callers fall back to the computed total.
       */
      activityTotalIsk: number | null
      /**
       * Discount (in ISK) that Bokun actually applied from the promo code, if
       * any. 0 when no code was sent, or when the code was invalid/ineligible
       * (Bokun ignores such codes without erroring). Read from the reserved
       * booking so it reflects Bokun's real calculation.
       */
      discountIsk: number
    }
  | { ok: false; error: string }

type CheckoutSubmitResponse = {
  booking?: { bookingId?: number; confirmationCode?: string; status?: string }
}

/**
 * Read the authoritative activity total (in ISK) for a just-reserved booking.
 * Bokun re-computes the real total during checkout, which can differ from the
 * availability unit prices (e.g. booking fees, rounding), so we charge exactly
 * this to avoid leaving a remaining balance. Returns null if it can't be read.
 */
async function fetchReservedTotalIsk(
  bookingId: number,
): Promise<{ totalIsk: number | null; discountIsk: number }> {
  try {
    const data = await bokunRequest<{
      totalPrice?: number
      currency?: string
      productBookings?: { discountAmount?: number; savedAmount?: number }[]
      activityBookings?: { discountAmount?: number; savedAmount?: number }[]
    }>("GET", `/booking.json/booking/${bookingId}`)
    const total = data?.totalPrice
    // The applied promo discount is exposed PER PRODUCT booking (as
    // `discountAmount`/`savedAmount`), not on the top-level booking — the
    // top-level `discountAmount`/`totalDiscount` fields come back null. Sum the
    // per-product discounts to get the total ISK saved. (top-level `totalPrice`
    // already reflects the discounted amount, so we still charge it as-is.)
    const productBookings = data?.productBookings ?? data?.activityBookings ?? []
    const rawDiscount = productBookings.reduce(
      (sum, pb) => sum + (pb.discountAmount ?? pb.savedAmount ?? 0),
      0,
    )
    const discountIsk =
      typeof rawDiscount === "number" && rawDiscount > 0 ? Math.round(rawDiscount) : 0
    const totalIsk =
      typeof total === "number" && total > 0 ? Math.round(total) : null
    return { totalIsk, discountIsk }
  } catch (err) {
    console.log("[v0] fetchReservedTotalIsk failed:", (err as Error).message)
  }
  return { totalIsk: null, discountIsk: 0 }
}

/**
 * Reserve a booking in Bokun (holds inventory for ~30 min) using the
 * RESERVE_FOR_EXTERNAL_PAYMENT flow, so payment can be taken via Teya and the
 * booking confirmed afterwards. Re-reads live availability to resolve the exact
 * rate, pricing categories and pickup/drop-off configuration.
 */
export async function reserveBokunBooking(
  input: ReserveBookingInput,
): Promise<ReserveBookingResult> {
  const rows = await bokunRequest<BokunRichAvailability[]>(
    "GET",
    `/activity.json/${input.bokunId}/availabilities` +
      `?start=${input.date}&end=${input.date}&lang=EN&currency=ISK&includeSoldOut=false`,
  )
  const row =
    (rows ?? []).find((a) => a.id === input.slotId) ??
    (rows ?? []).find((a) => a.startTimeId === input.startTimeId)
  if (!row) return { ok: false, error: "Selected departure is no longer available." }
  const rate = row.rates?.find((r) => r.id === row.defaultRateId) ?? row.rates?.[0]
  if (!rate) return { ok: false, error: "No rate available for this departure." }

  // One passenger per head, each tagged with its pricing category.
  const passengers: { pricingCategoryId: number }[] = []
  if (input.pricedPerPerson) {
    for (const sel of input.selections) {
      const qty = Math.max(0, Math.floor(sel.qty))
      for (let i = 0; i < qty; i++) passengers.push({ pricingCategoryId: sel.lineId })
    }
  } else {
    const pcid = rate.pricingCategoryIds?.[0]
    if (!pcid) return { ok: false, error: "No pricing category configured for this tour." }
    for (let i = 0; i < input.totalPax; i++) passengers.push({ pricingCategoryId: pcid })
  }
  if (passengers.length === 0) return { ok: false, error: "No participants to reserve." }

  const activityBooking: Record<string, unknown> = {
    activityId: Number(input.bokunId),
    rateId: rate.id,
    date: input.date,
    startTimeId: input.startTimeId,
    passengers,
  }
  const pickupOff = !rate.pickupSelectionType || rate.pickupSelectionType === "UNAVAILABLE"
  if (!pickupOff && input.pickupId) {
    activityBooking.pickup = true
    activityBooking.pickupPlaceId = input.pickupId
  }
  const dropoffOff = !rate.dropoffSelectionType || rate.dropoffSelectionType === "UNAVAILABLE"
  if (!dropoffOff && input.dropoffId) {
    activityBooking.dropoff = true
    activityBooking.dropoffPlaceId = input.dropoffId
  }
  // Per Bokun's Booking Request schema, the promo code belongs on the booking
  // request (directBooking), NOT on the individual activity booking — setting
  // it on the activity booking is silently ignored and no discount is applied.
  // Bokun validates & ignores invalid/ineligible codes without erroring, so we
  // detect whether it actually applied by reading the discount back below.
  const promoCode = input.promoCode?.trim()

  const mainContactDetails: { questionId: string; values: string[] }[] = [
    { questionId: "firstName", values: [input.contact.firstName] },
    { questionId: "lastName", values: [input.contact.lastName] },
    { questionId: "email", values: [input.contact.email] },
  ]
  if (input.contact.phone) {
    mainContactDetails.push({ questionId: "phoneNumber", values: [input.contact.phone] })
  }

  const directBooking: Record<string, unknown> = {
    mainContactDetails,
    activityBookings: [activityBooking],
  }
  if (promoCode) directBooking.promoCode = promoCode
  const submitBody = {
    source: "DIRECT_REQUEST",
    checkoutOption: "CUSTOMER_FULL_PAYMENT",
    paymentMethod: "RESERVE_FOR_EXTERNAL_PAYMENT",
    sendNotificationToMainContact: false,
    directBooking,
  }
  const res = await bokunWrite<CheckoutSubmitResponse>("/checkout.json/submit?currency=ISK", submitBody)

  const code = res.data?.booking?.confirmationCode
  if (!res.ok || !code) {
    console.log("[v0] Bokun reserve failed:", res.status, res.error)
    return { ok: false, error: res.error ?? "Could not reserve the booking in Bokun." }
  }
  const bookingId = res.data?.booking?.bookingId ?? null
  console.log(
    `[v0] Bokun RESERVED ${code} (bookingId=${bookingId ?? "?"}) for ${input.contact.email}`,
  )
  // Read Bokun's authoritative ISK total so we charge the exact amount owed,
  // plus the discount Bokun actually applied from the promo code (if any).
  const reserved = bookingId
    ? await fetchReservedTotalIsk(bookingId)
    : { totalIsk: null, discountIsk: 0 }
  if (promoCode) {
    console.log(
      `[v0] Bokun promo "${promoCode}" on ${code}: discount=${reserved.discountIsk} ISK`,
    )
  }
  return {
    ok: true,
    confirmationCode: code,
    bookingId,
    activityTotalIsk: reserved.totalIsk,
    discountIsk: reserved.discountIsk,
  }
}

export type ConfirmBokunResult = { ok: true } | { ok: false; error: string }

/**
 * Confirm a previously reserved booking after external (Teya) payment has
 * succeeded. Idempotency is handled by the caller (only confirms once).
 */
export async function confirmBokunBooking(
  confirmationCode: string,
  paid: { amount: number; currency: string; transactionId?: string | null },
): Promise<ConfirmBokunResult> {
  const code = confirmationCode.trim()
  if (!code) return { ok: false, error: "Missing confirmation code." }

  const body: Record<string, unknown> = {
    amount: paid.amount,
    currency: paid.currency,
    // Have Bokun email the confirmation + voucher to the customer once the
    // reserved booking is confirmed (payment already succeeded at this point).
    sendNotificationToMainContact: true,
    showPricesInNotification: true,
  }
  if (paid.transactionId) {
    body.transactionDetails = {
      transactionId: paid.transactionId,
      transactionDate: bokunDate(),
    }
  }

  const res = await bokunWrite<CheckoutSubmitResponse>(
    `/checkout.json/confirm-reserved/${encodeURIComponent(code)}`,
    body,
  )
  if (!res.ok) {
    console.log("[v0] Bokun confirm failed:", res.status, res.error)
    return { ok: false, error: res.error ?? "Could not confirm the reserved booking." }
  }
  console.log(`[v0] Bokun CONFIRMED ${code}`)
  return { ok: true }
}

/**
 * Fetch the customer-facing voucher PDF for a confirmed Bokun booking. Returns
 * the raw PDF bytes, or null if unavailable. `bokunBookingId` is Bokun's
 * numeric booking id (stored on our booking row / returned by booking search).
 */
export async function fetchBokunVoucherPdf(
  bokunBookingId: number,
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  const accessKey = process.env.BOKUN_ACCESS_KEY
  const secret = process.env.BOKUN_SECRET_KEY
  if (!accessKey || !secret) return null
  if (!Number.isFinite(bokunBookingId) || bokunBookingId <= 0) return null

  // The voucher (ticket) is a per-product document, so it's keyed by the
  // ACTIVITY booking's product confirmation code (e.g. "ARC-T136613520"), not
  // the parent booking id we store. Resolve it from the parent booking first.
  // (Using `/booking.json/{id}/summary?type=CUSTOMER` here was the bug: that
  // endpoint returns the customer INVOICE PDF, not the voucher.)
  const parent = await bokunRequest<{
    productBookings?: { productConfirmationCode?: string | null }[]
    activityBookings?: { productConfirmationCode?: string | null }[]
  }>("GET", `/booking.json/booking/${bokunBookingId}`)
  const productBookings =
    parent?.productBookings ?? parent?.activityBookings ?? []
  const productCode = productBookings
    .map((pb) => pb.productConfirmationCode?.trim())
    .find((c): c is string => Boolean(c))
  if (!productCode) {
    console.log("[v0] Bokun voucher: no product confirmation code for", bokunBookingId)
    return null
  }

  const path = `/booking.json/activity-booking/${encodeURIComponent(productCode)}/ticket`
  const date = bokunDate()
  const signature = sign(date, accessKey, secret, "GET", path)
  try {
    const res = await fetch(`https://${DOMAIN}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/pdf",
        "X-Bokun-Date": date,
        "X-Bokun-AccessKey": accessKey,
        "X-Bokun-Signature": signature,
      },
      cache: "no-store",
    })
    if (!res.ok) {
      console.log("[v0] Bokun voucher fetch failed:", res.status)
      return null
    }
    const contentType = res.headers.get("content-type") ?? "application/pdf"
    if (!contentType.includes("pdf")) {
      console.log("[v0] Bokun voucher unexpected content-type:", contentType)
      return null
    }
    return { bytes: await res.arrayBuffer(), contentType }
  } catch (err) {
    console.log("[v0] Bokun voucher fetch error:", (err as Error).message)
    return null
  }
}
// End of Bokun helpers.
