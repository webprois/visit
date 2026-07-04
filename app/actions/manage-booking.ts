"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { booking } from "@/lib/db/schema"
import { auth } from "@/lib/auth"
import { fetchTourPickup } from "@/lib/bokun"

export type UpdatePickupInput = {
  bookingId: string
  /** Chosen pickup place id, or null for "meet at start" (optional tours). */
  pickupId?: number | null
  /** Chosen drop-off place id, or null for "same as pickup". */
  dropoffId?: number | null
  /** Room/house number when the pickup place asks for one. */
  roomNumber?: string | null
}

export type UpdatePickupResult = { ok: true } | { ok: false; error: string }

/** Statuses whose pickup a customer is still allowed to change. */
const EDITABLE_STATUSES = new Set([
  "pending",
  "pending_payment",
  "confirmed",
  "paid",
])

/**
 * Change the pickup/drop-off on a customer's own site booking. Verifies the
 * signed-in user owns the booking, that it is still upcoming and editable, then
 * re-validates the chosen places against live Bokun data before saving. Only
 * updates the Neon record (bookings that live solely in Bokun can't be edited
 * here). Never trusts the client's place titles — those come from Bokun.
 */
export async function updateBookingPickup(
  input: UpdatePickupInput,
): Promise<UpdatePickupResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  const email = session?.user?.email
  if (!email) {
    return { ok: false, error: "Please sign in to manage your booking." }
  }

  const [row] = await db
    .select()
    .from(booking)
    .where(eq(booking.id, input.bookingId))
    .limit(1)
  if (!row) return { ok: false, error: "Booking not found." }

  // Ownership: a customer may only edit bookings made with their email.
  if (row.customerEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return { ok: false, error: "You can only edit your own bookings." }
  }

  if (!EDITABLE_STATUSES.has(row.status)) {
    return { ok: false, error: "This booking can no longer be edited." }
  }

  // Don't allow edits once the tour has departed.
  const ms = Date.parse(`${row.tourDate}T${row.startTime ?? "00:00:00"}`)
  if (!Number.isNaN(ms) && ms < Date.now()) {
    return { ok: false, error: "This tour has already departed." }
  }

  // Re-fetch live pickup config and validate the selection (never trust client).
  const config = await fetchTourPickup(row.bokunId)
  if (config.pickupPlaces.length === 0) {
    return { ok: false, error: "This tour has no pickup options." }
  }

  const pickupPlace = config.pickupPlaces.find((p) => p.id === input.pickupId)
  if (config.required && !pickupPlace) {
    return { ok: false, error: "Please choose a pickup location." }
  }
  if (pickupPlace?.askForRoomNumber && !input.roomNumber?.trim()) {
    return { ok: false, error: "Please add your room or house number." }
  }

  const dropoffOptions =
    config.dropoffPlaces.length > 0 ? config.dropoffPlaces : config.pickupPlaces
  const dropoffPlace = dropoffOptions.find((p) => p.id === input.dropoffId)

  const storedPickup =
    pickupPlace || dropoffPlace
      ? {
          pickupId: pickupPlace?.id ?? null,
          pickupTitle: pickupPlace?.title ?? null,
          roomNumber:
            pickupPlace?.askForRoomNumber && input.roomNumber?.trim()
              ? input.roomNumber.trim()
              : null,
          dropoffId: dropoffPlace?.id ?? null,
          dropoffTitle: dropoffPlace?.title ?? null,
        }
      : null

  await db
    .update(booking)
    .set({ pickup: storedPickup, updatedAt: new Date() })
    .where(eq(booking.id, input.bookingId))

  revalidatePath("/account")
  return { ok: true }
}
