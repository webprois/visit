import { fetchBokunBookingsByEmail } from "@/lib/bokun"
import { asCurrency, type Currency } from "@/lib/currency"

/** A booking shown on the customer's "My Trips" page. */
export type MyTrip = {
  /** Stable key for React (confirmation code when known). */
  id: string
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

/** Map a Bokun status + travel date onto our simplified lifecycle status. */
function bokunStatus(
  status: string,
  travelDate: number | null,
): MyTrip["status"] {
  if (status === "CANCELLED") return "cancelled"
  if (travelDate && travelDate < Date.now()) return "completed"
  return "upcoming"
}

/**
 * Load every trip for a customer from Bokun, matched by email. Bokun is the
 * single source of truth: bookings made on the site are reserved and confirmed
 * in Bokun, so the internal Neon reconciliation rows are never shown here.
 * Returns most-recent travel date first.
 */
export async function getMyTrips(email: string): Promise<MyTrip[]> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return []

  const bokunRows = await fetchBokunBookingsByEmail(normalized).catch((err) => {
    console.error("[v0] getMyTrips Bokun query failed:", err)
    return []
  })

  const trips: MyTrip[] = bokunRows.map((b) => {
    const travelDate = b.travelDateTime ?? b.travelDate ?? null
    return {
      id: b.confirmationCode || `bokun-${b.id}`,
      bokunId: b.productId ? String(b.productId) : null,
      bokunBookingId: b.id ?? null,
      confirmationCode: b.confirmationCode || null,
      tourTitle: b.productTitle,
      travelDate,
      startTime: b.startTime,
      totalPax: b.totalParticipants,
      amount: Math.round(b.totalPrice),
      currency: asCurrency(b.currency),
      status: bokunStatus(b.status, travelDate),
    }
  })

  return trips.sort((a, b) => (b.travelDate ?? 0) - (a.travelDate ?? 0))
}
