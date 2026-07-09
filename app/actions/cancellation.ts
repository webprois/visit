"use server"

import { randomUUID } from "node:crypto"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { and, eq, or, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { booking, cancellationRequest, type Booking } from "@/lib/db/schema"
import { cancelBokunBooking } from "@/lib/bokun"
import {
  sendCancellationEmail,
  sendCancellationRequestEmail,
} from "@/lib/email/service"

/**
 * Customer-facing cancellation. Two outcomes, decided by how far out the tour
 * is relative to the tour's own free-cancellation window (frozen onto the
 * booking at booking time as `cancellationCutoffHours`; older bookings without
 * it fall back to the legacy 72h default):
 *
 *  - at/before the window  → free cancellation: cancel in Bokun (with refund),
 *    mark the booking cancelled, email a confirmation. Returns { cancelled }.
 *  - inside the window      → create a pending cancellation request for staff to
 *    review against the policy (fee / no refund), email an acknowledgement.
 *    Returns { requested }. No Bokun cancel happens yet.
 *
 * All email is best-effort. The action is idempotent: an already-cancelled
 * booking or one with an open request is refused.
 */

/** Fallback free-cancellation window (hours) for bookings with no stored policy. */
const DEFAULT_FREE_CANCEL_HOURS = 72

export type CancelResult =
  | { ok: true; outcome: "cancelled" }
  | { ok: true; outcome: "requested"; hoursUntilTour: number }
  | { ok: false; error: string }

/** Parse "YYYY-MM-DD" + optional "HH:MM" into epoch ms (UTC), or null. */
function departureMs(dateStr: string, startTime: string | null): number | null {
  if (!dateStr) return null
  const time = /^\d{1,2}:\d{2}$/.test(startTime ?? "") ? startTime : "00:00"
  const ms = Date.parse(`${dateStr}T${time}:00Z`)
  return Number.isNaN(ms) ? null : ms
}

/** Load a booking the current session is allowed to act on, or null. */
async function loadOwnedBooking(bookingId: string): Promise<Booking | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.email) return null
  const email = session.user.email.trim().toLowerCase()
  const matchEmail = sql`lower(${booking.customerEmail}) = ${email}`
  const [row] = await db
    .select()
    .from(booking)
    .where(
      and(
        eq(booking.id, bookingId),
        or(eq(booking.userId, session.user.id), matchEmail),
      ),
    )
    .limit(1)
  return row ?? null
}

export async function cancelOrRequest(bookingId: string): Promise<CancelResult> {
  const row = await loadOwnedBooking(bookingId)
  if (!row) return { ok: false, error: "Booking not found." }

  // Idempotency guards.
  if (row.status === "cancelled" || row.cancelledAt) {
    return { ok: false, error: "This booking is already cancelled." }
  }

  const isPaid = row.status === "paid" || row.status === "confirmed"
  const isUnpaid =
    row.status === "pending" || row.status === "pending_payment"
  if (!isPaid && !isUnpaid) {
    return {
      ok: false,
      error: "This booking can't be cancelled.",
    }
  }

  const depMs = departureMs(row.tourDate, row.startTime)
  if (depMs !== null && depMs <= Date.now()) {
    return { ok: false, error: "This tour has already departed." }
  }

  // --- Unpaid booking: cancel immediately. No payment was taken, so there's no
  // fee and nothing to refund. ---
  //
  // An unpaid booking is only a Bokun *reservation* (RESERVE_FOR_EXTERNAL_PAYMENT),
  // whose inventory hold expires on its own after ~30 min. Bokun's cancel-booking
  // endpoint only works on *confirmed* bookings and returns "Booking is not
  // confirmed." for a reservation, so we attempt it best-effort and never block
  // the customer's cancellation on its result.
  if (isUnpaid) {
    if (row.bokunConfirmationCode) {
      const res = await cancelBokunBooking(row.bokunConfirmationCode, {
        note: "Cancelled by customer (unpaid booking, no refund due)",
        notify: false,
        refund: false,
      })
      if (!res.ok) {
        console.log(
          `[v0] customer cancel: best-effort Bokun cancel skipped for unpaid booking (${row.id}): ${res.error}`,
        )
      }
    }

    await db
      .update(booking)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(booking.id, row.id))

    // No email here: the standard cancellation email promises a refund, which
    // doesn't apply to an unpaid booking. The toast confirms the outcome.
    revalidatePath("/account")
    return { ok: true, outcome: "cancelled" }
  }

  const hoursUntilTour =
    depMs === null ? Number.POSITIVE_INFINITY : (depMs - Date.now()) / 3_600_000

  // This tour's own free-cancellation window, frozen at booking time. Older
  // bookings (null) keep the legacy 72h behaviour.
  const freeHours = row.cancellationCutoffHours ?? DEFAULT_FREE_CANCEL_HOURS

  // --- Inside the free window: create a staff-review request (once) ---
  if (hoursUntilTour < freeHours) {
    const existing = await db
      .select({ id: cancellationRequest.id })
      .from(cancellationRequest)
      .where(
        and(
          eq(cancellationRequest.bookingId, row.id),
          eq(cancellationRequest.status, "pending"),
        ),
      )
      .limit(1)
    if (existing.length > 0) {
      return {
        ok: false,
        error: "We've already received your cancellation request for this booking.",
      }
    }

    await db.insert(cancellationRequest).values({
      id: randomUUID(),
      bookingId: row.id,
      userId: row.userId,
      bokunBookingId: row.bokunBookingId,
      bokunConfirmationCode: row.bokunConfirmationCode,
      tourTitle: row.tourTitle,
      tourDate: row.tourDate,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      locale: row.locale,
      hoursUntilTour: Number.isFinite(hoursUntilTour)
        ? Math.round(hoursUntilTour)
        : null,
      status: "pending",
    })

    await sendCancellationRequestEmail(row).catch((err) =>
      console.error(`[v0] cancel-request email failed (${row.id}):`, err),
    )

    revalidatePath("/account")
    return {
      ok: true,
      outcome: "requested",
      hoursUntilTour: Number.isFinite(hoursUntilTour)
        ? Math.round(hoursUntilTour)
        : 0,
    }
  }

  // --- At/before the free window: free, immediate cancellation with refund ---
  if (row.bokunConfirmationCode) {
    const res = await cancelBokunBooking(row.bokunConfirmationCode, {
      note: `Cancelled by customer (>= ${freeHours}h before departure, free per policy)`,
      notify: false,
      refund: true,
    })
    if (!res.ok) {
      console.error(
        `[v0] customer cancel: Bokun cancel failed (${row.id}): ${res.error}`,
      )
      return {
        ok: false,
        error:
          "We couldn't cancel your booking just now. Please try again or contact us.",
      }
    }
  } else {
    console.error(
      `[v0] customer cancel: booking ${row.id} has no Bokun confirmation code`,
    )
  }

  await db
    .update(booking)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(booking.id, row.id))

  await sendCancellationEmail(row).catch((err) =>
    console.error(`[v0] cancellation email failed (${row.id}):`, err),
  )

  revalidatePath("/account")
  return { ok: true, outcome: "cancelled" }
}
