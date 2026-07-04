import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { assertAdmin } from "@/lib/require-auth"
import { db } from "@/lib/db"
import { booking, cancellationRequest, type Booking } from "@/lib/db/schema"
import { cancelBokunBooking } from "@/lib/bokun"
import {
  sendCancellationApprovedEmail,
  sendCancellationDeclinedEmail,
} from "@/lib/email/service"

export const dynamic = "force-dynamic"

/**
 * Resolve a pending cancellation request.
 *
 *  - action "approve": cancel the booking in Bokun (with optional refund),
 *    mark the booking cancelled and the request approved, then email the
 *    customer a confirmation.
 *  - action "decline": mark the request rejected and email the customer that
 *    their booking still stands.
 *
 * Idempotent: a request that is not "pending" is refused.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdmin()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  let body: { action?: string; note?: string; refund?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const action = body.action
  if (action !== "approve" && action !== "decline") {
    return NextResponse.json(
      { error: "action must be 'approve' or 'decline'" },
      { status: 400 },
    )
  }
  const note = body.note?.trim() || null

  // Load the request and guard against double-resolution.
  const [reqRow] = await db
    .select()
    .from(cancellationRequest)
    .where(eq(cancellationRequest.id, id))
    .limit(1)
  if (!reqRow) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 })
  }
  if (reqRow.status !== "pending") {
    return NextResponse.json(
      { error: "This request has already been resolved." },
      { status: 409 },
    )
  }

  // The booking row is needed for the customer email (localized).
  const [bookingRow] = await db
    .select()
    .from(booking)
    .where(eq(booking.id, reqRow.bookingId))
    .limit(1)

  if (action === "decline") {
    await db
      .update(cancellationRequest)
      .set({ status: "rejected", adminNote: note, resolvedAt: new Date() })
      .where(eq(cancellationRequest.id, id))

    if (bookingRow) {
      await sendCancellationDeclinedEmail(bookingRow, note).catch((err) =>
        console.error(`[v0] decline email failed (${id}):`, err),
      )
    }
    return NextResponse.json({ ok: true, status: "rejected" })
  }

  // --- approve: cancel in Bokun first ---
  const code = reqRow.bokunConfirmationCode
  if (code) {
    const res = await cancelBokunBooking(code, {
      note: note || "Cancellation approved by staff",
      notify: false,
      refund: body.refund ?? true,
    })
    if (!res.ok) {
      console.error(`[v0] approve: Bokun cancel failed (${id}): ${res.error}`)
      return NextResponse.json(
        { error: res.error || "Bokun cancellation failed." },
        { status: 502 },
      )
    }
  } else {
    console.error(`[v0] approve: request ${id} has no Bokun confirmation code`)
  }

  await db
    .update(booking)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(eq(booking.id, reqRow.bookingId))

  await db
    .update(cancellationRequest)
    .set({ status: "approved", adminNote: note, resolvedAt: new Date() })
    .where(eq(cancellationRequest.id, id))

  if (bookingRow) {
    const updated: Booking = { ...bookingRow, status: "cancelled" }
    await sendCancellationApprovedEmail(updated, note).catch((err) =>
      console.error(`[v0] approve email failed (${id}):`, err),
    )
  }

  return NextResponse.json({ ok: true, status: "approved" })
}
