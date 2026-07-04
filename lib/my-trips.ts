import { eq, or, sql, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { booking, type Booking } from "@/lib/db/schema"
import { fetchBokunBookings } from "@/lib/bokun"
import { asCurrency, type Currency } from "@/lib/currency"

/** A booking shown on the customer's "My Trips" page. */
export type MyTrip = {
  /** Stable key for React (confirmation code when known). */
  id: string
  /** Internal booking row id — used to target cancellation. */
  bookingId: string
  bokunId: string | null
  /** Bokun's numeric booking id — used to fetch the voucher PDF. */
  bokunBookingId: number | null
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

/** Who to load trips for. A signed-in customer always has both. */
export type MyTripsOwner = {
  /** Better Auth user id — the reliable account link. */
  userId?: string | null
  /** Account email — also matches guest bookings made before signing up. */
  email: string
}

/** Parse our stored "YYYY-MM-DD" travel date into ms since epoch. */
function parseTravelDate(date: string | null): number | null {
  if (!date) return null
  const ms = Date.parse(date)
  return Number.isNaN(ms) ? null : ms
}

/** Derive the lifecycle status from a stored row + optional live Bokun status. */
function deriveStatus(
  row: Booking,
  travelDate: number | null,
  liveStatus: string | null,
): MyTrip["status"] {
  if (liveStatus === "CANCELLED" || row.status === "cancelled") return "cancelled"
  // Payment not completed yet (Teya Hosted Checkout flow).
  if (row.status === "pending_payment" || row.status === "pending") {
    return "pending"
  }
  if (travelDate && travelDate < Date.now()) return "completed"
  return "upcoming"
}

/**
 * Load every trip for a customer from our own booking records, which are the
 * reliable per-account index (Bokun's booking search can't filter by email).
 * Bookings are matched by account id first, and by email as a fallback for
 * guest bookings made before the account existed. Live status (e.g.
 * cancellations) is enriched from Bokun per booking, best-effort.
 * Returns most-recent travel date first.
 */
export async function getMyTrips(owner: MyTripsOwner): Promise<MyTrip[]> {
  const email = owner.email.trim().toLowerCase()
  const userId = owner.userId?.trim() || null
  if (!email && !userId) return []

  const matchEmail = sql`lower(${booking.customerEmail}) = ${email}`
  const where = userId ? or(eq(booking.userId, userId), matchEmail) : matchEmail

  const rows = await db
    .select()
    .from(booking)
    .where(where)
    .orderBy(desc(booking.createdAt))
    .catch((err) => {
      console.error("[v0] getMyTrips DB query failed:", err)
      return [] as Booking[]
    })

  // Only surface bookings that actually reached Bokun (reserved/confirmed) or
  // are still awaiting payment. Failed/legacy rows without a Bokun booking are
  // internal noise and never shown.
  const visible = rows.filter(
    (r) => r.bokunConfirmationCode || r.status === "confirmed",
  )

  // Enrich each booking with its live Bokun status, best-effort and in
  // parallel. If Bokun is unreachable we fall back to our stored status.
  const trips = await Promise.all(
    visible.map(async (row): Promise<MyTrip> => {
      const travelDate = parseTravelDate(row.tourDate)
      let liveStatus: string | null = null
      if (row.bokunConfirmationCode) {
        const live = await fetchBokunBookings({
          confirmationCode: row.bokunConfirmationCode,
          pageSize: 1,
        }).catch(() => null)
        liveStatus = live?.items[0]?.status ?? null
      }
      return {
        id: row.bokunConfirmationCode || row.id,
        bookingId: row.id,
        bokunId: row.bokunId || null,
        bokunBookingId: row.bokunBookingId ?? null,
        confirmationCode: row.bokunConfirmationCode || null,
        tourTitle: row.tourTitle,
        travelDate,
        startTime: row.startTime,
        totalPax: row.totalPax,
        amount: Math.round(row.amountMinor),
        currency: asCurrency(row.currency),
        status: deriveStatus(row, travelDate, liveStatus),
      }
    }),
  )

  return trips.sort((a, b) => (b.travelDate ?? 0) - (a.travelDate ?? 0))
}
