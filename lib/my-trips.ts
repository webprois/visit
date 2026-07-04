import { db } from "@/lib/db"
import { booking } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { fetchBokunBookingsByEmail } from "@/lib/bokun"
import { asCurrency, type Currency } from "@/lib/currency"

/** A booking shown on the customer's "My Trips" page, from either source. */
export type MyTrip = {
  /** Stable key for React and dedup (confirmation code when known). */
  id: string
  source: "bokun" | "site"
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
      bokunId: b.productId ? String(b.productId) : null,
      confirmationCode: b.confirmationCode || null,
      tourTitle: b.productTitle,
      travelDate: b.travelDateTime ?? b.travelDate ?? null,
      startTime: b.startTime,
      totalPax: b.totalParticipants,
      amount: Math.round(b.totalPrice),
      currency: asCurrency(b.currency),
      status: bokunStatus(b.status, b.travelDateTime ?? b.travelDate ?? null),
    })
  }

  for (const s of siteRows) {
    // Skip site bookings already represented by a Bokun record.
    if (s.teyaReference && bokunCodes.has(s.teyaReference)) continue
    const travelDate = parseSiteDate(s.tourDate, s.startTime)
    trips.push({
      id: `site-${s.id}`,
      source: "site",
      bokunId: s.bokunId,
      confirmationCode: s.teyaReference,
      tourTitle: s.tourTitle,
      travelDate,
      startTime: s.startTime,
      totalPax: s.totalPax,
      amount: Math.round(s.amountMinor / 100),
      currency: asCurrency(s.currency),
      status: siteStatus(s.status, travelDate),
    })
  }

  return trips.sort((a, b) => (b.travelDate ?? 0) - (a.travelDate ?? 0))
}
