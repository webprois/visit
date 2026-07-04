import { db } from "@/lib/db"
import { booking } from "@/lib/db/schema"
import { sql } from "drizzle-orm"
import { fetchBokunBookingsByEmail, fetchTourPickup } from "@/lib/bokun"
import { asCurrency, type Currency } from "@/lib/currency"

/** A pickup or drop-off option the customer can pick from when editing. */
export type PickupOption = {
  id: number
  title: string
  askForRoomNumber: boolean
}

/**
 * Everything the "edit pickup" panel needs for a site booking whose tour offers
 * pickup: the choices, whether one is required, and the current selection.
 */
export type EditablePickup = {
  required: boolean
  pickupPlaces: PickupOption[]
  dropoffPlaces: PickupOption[]
  current: {
    pickupId: number | null
    dropoffId: number | null
    roomNumber: string | null
  }
}

/** Shape of the `pickup` JSONB stored on a site booking row. */
type StoredPickup = {
  pickupId?: number | null
  pickupTitle?: string | null
  roomNumber?: string | null
  dropoffId?: number | null
  dropoffTitle?: string | null
} | null

/** A booking shown on the customer's "My Trips" page, from either source. */
export type MyTrip = {
  /** Stable key for React and dedup (confirmation code when known). */
  id: string
  source: "bokun" | "site"
  /** The Neon booking row id (site bookings only) — needed to edit pickup. */
  siteId: string | null
  bokunId: string | null
  confirmationCode: string | null
  tourTitle: string
  /** Travel date as ms since epoch, or null when unknown. */
  travelDate: number | null
  startTime: string | null
  totalPax: number
  /** Amount in major units, shown in `currency`. */
  amount: number
  currency: Currency
  /** Normalized lifecycle status for the badge. */
  status: "upcoming" | "completed" | "cancelled" | "pending"
  /** Present when this booking's pickup can be changed by the customer. */
  editablePickup: EditablePickup | null
}

/** Map a Bokun status + travel date onto our simplified lifecycle status. */
function bokunStatus(
  status: string,
  travelDate: number | null,
): MyTrip["status"] {
  if (status === "CANCELLED") return "cancelled"
  if (travelDate && travelDate < Date.now()) return "completed"
  return "upcoming"
}

/** Map a Neon booking status + travel date onto our simplified status. */
function siteStatus(status: string, travelDate: number | null): MyTrip["status"] {
  if (status === "cancelled") return "cancelled"
  if (status === "pending" || status === "pending_payment") return "pending"
  if (travelDate && travelDate < Date.now()) return "completed"
  return "upcoming"
}

/** Parse a Neon "YYYY-MM-DD" tour date (optionally with time) into ms. */
function parseSiteDate(date: string, time: string | null): number | null {
  const iso = time ? `${date}T${time}` : `${date}T00:00:00`
  const ms = Date.parse(iso)
  return Number.isNaN(ms) ? null : ms
}

/**
 * Load every trip for a customer, matched by email, from both the site database
 * (Neon) and Bokun. Site bookings that have already synced to Bokun (same
 * confirmation code) are de-duplicated in favour of the Bokun record, which is
 * the long-term source of truth. Returns most-recent travel date first.
 */
export async function getMyTrips(email: string): Promise<MyTrip[]> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return []

  const [siteRows, bokunRows] = await Promise.all([
    db
      .select()
      .from(booking)
      .where(sql`lower(${booking.customerEmail}) = ${normalized}`)
      .catch((err) => {
        console.error("[v0] getMyTrips site query failed:", err)
        return [] as (typeof booking.$inferSelect)[]
      }),
    fetchBokunBookingsByEmail(normalized).catch((err) => {
      console.error("[v0] getMyTrips Bokun query failed:", err)
      return []
    }),
  ])

  const trips: MyTrip[] = []
  const bokunCodes = new Set<string>()

  for (const b of bokunRows) {
    if (b.confirmationCode) bokunCodes.add(b.confirmationCode)
    trips.push({
      id: b.confirmationCode || `bokun-${b.id}`,
      source: "bokun",
      siteId: null,
      bokunId: b.productId ? String(b.productId) : null,
      confirmationCode: b.confirmationCode || null,
      tourTitle: b.productTitle,
      travelDate: b.travelDateTime ?? b.travelDate ?? null,
      startTime: b.startTime,
      totalPax: b.totalParticipants,
      amount: Math.round(b.totalPrice),
      currency: asCurrency(b.currency),
      status: bokunStatus(b.status, b.travelDateTime ?? b.travelDate ?? null),
      editablePickup: null,
    })
  }

  // Site trips that may be pickup-editable, paired with their raw row so we can
  // read the current pickup selection when enriching below.
  const editableSite: { trip: MyTrip; pickup: StoredPickup; bokunId: string }[] = []

  for (const s of siteRows) {
    // Skip site bookings already represented by a Bokun record.
    if (s.teyaReference && bokunCodes.has(s.teyaReference)) continue
    const travelDate = parseSiteDate(s.tourDate, s.startTime)
    const status = siteStatus(s.status, travelDate)
    const trip: MyTrip = {
      id: `site-${s.id}`,
      source: "site",
      siteId: s.id,
      bokunId: s.bokunId,
      confirmationCode: s.teyaReference,
      tourTitle: s.tourTitle,
      travelDate,
      startTime: s.startTime,
      totalPax: s.totalPax,
      amount: Math.round(s.amountMinor / 100),
      currency: asCurrency(s.currency),
      status,
      editablePickup: null,
    }
    trips.push(trip)
    // Only future upcoming/pending bookings with a tour id can change pickup.
    const isFuture = travelDate === null || travelDate >= Date.now()
    if ((status === "upcoming" || status === "pending") && isFuture && s.bokunId) {
      editableSite.push({
        trip,
        pickup: s.pickup as StoredPickup,
        bokunId: s.bokunId,
      })
    }
  }

  // Fetch pickup options for eligible site trips in parallel (cached in Bokun
  // layer). Any failure just leaves the trip non-editable.
  await Promise.all(
    editableSite.map(async ({ trip, pickup, bokunId }) => {
      try {
        const config = await fetchTourPickup(bokunId)
        if (config.pickupPlaces.length === 0) return
        trip.editablePickup = {
          required: config.required,
          pickupPlaces: config.pickupPlaces.map((p) => ({
            id: p.id,
            title: p.title,
            askForRoomNumber: p.askForRoomNumber,
          })),
          dropoffPlaces: config.dropoffPlaces.map((p) => ({
            id: p.id,
            title: p.title,
            askForRoomNumber: p.askForRoomNumber,
          })),
          current: {
            pickupId: pickup?.pickupId ?? null,
            dropoffId: pickup?.dropoffId ?? null,
            roomNumber: pickup?.roomNumber ?? null,
          },
        }
      } catch (err) {
        console.error("[v0] getMyTrips pickup fetch failed:", err)
      }
    }),
  )

  return trips.sort((a, b) => (b.travelDate ?? 0) - (a.travelDate ?? 0))
}
