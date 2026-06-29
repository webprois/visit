import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { booking } from "@/lib/db/schema"
import {
  createCheckoutSession,
  isTeyaCheckoutConfigured,
} from "@/lib/teya-checkout"

/** Absolute origin for building return / webhook URLs. */
function getOrigin(req: Request): string {
  const url = new URL(req.url)
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host
  const proto =
    req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")
  return `${proto}://${host}`
}

/**
 * Create a Teya Hosted Checkout session for an existing "pending_payment"
 * booking and return the hosted payment-page URL.
 *
 * The amount/currency/customer come from the persisted booking (server-side,
 * already re-priced against Bokun) — never from the client request body. Teya
 * API keys are read from server env only and never exposed to the frontend.
 */
export async function POST(req: Request) {
  if (!isTeyaCheckoutConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Payments are not configured." },
      { status: 503 },
    )
  }

  let bookingId = ""
  try {
    const body = (await req.json()) as { bookingId?: string }
    bookingId = String(body.bookingId ?? "")
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 },
    )
  }
  if (!bookingId) {
    return NextResponse.json(
      { ok: false, error: "Missing bookingId." },
      { status: 400 },
    )
  }

  const [row] = await db
    .select()
    .from(booking)
    .where(eq(booking.id, bookingId))
    .limit(1)
  if (!row) {
    return NextResponse.json(
      { ok: false, error: "Booking not found." },
      { status: 404 },
    )
  }
  if (row.status !== "pending_payment") {
    return NextResponse.json(
      { ok: false, error: "This booking can no longer be paid." },
      { status: 409 },
    )
  }

  const origin = getOrigin(req)
  try {
    const session = await createCheckoutSession({
      reference: row.id,
      amount: row.amountMinor, // ISK is zero-decimal; amountMinor holds the ISK total
      currency: row.currency,
      customerEmail: row.customerEmail,
      successUrl: `${origin}/payment/success?bookingId=${row.id}`,
      cancelUrl: `${origin}/payment/cancel?bookingId=${row.id}`,
      webhookUrl: `${origin}/api/payments/teya/webhook`,
    })

    // Store Teya's session id on the booking for reconciliation.
    await db
      .update(booking)
      .set({ teyaSessionId: session.sessionId, updatedAt: new Date() })
      .where(eq(booking.id, row.id))

    return NextResponse.json({ ok: true, url: session.redirectUrl })
  } catch (err) {
    console.log("[v0] create-checkout error:", (err as Error).message)
    return NextResponse.json(
      { ok: false, error: "Could not start payment. Please try again." },
      { status: 502 },
    )
  }
}
