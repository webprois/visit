import { NextResponse } from "next/server"
import {
  parseWebhookEvent,
  verifyWebhookSignature,
} from "@/lib/teya-checkout"
import { markBookingConfirmed } from "@/app/actions/booking"

/**
 * Teya server-to-server payment webhook. This is the ONLY place a booking is
 * confirmed — never the browser redirect (the success page just reflects this
 * result). We verify the signature against TEYA_WEBHOOK_SECRET and only confirm
 * on a verified "paid" event.
 *
 * Teya signs the request with `x-teya-signature` (SHA256withRSA, Base64) over
 * the raw body; we verify it against TEYA_WEBHOOK_PUBLIC_KEY. The success event
 * is `payment.succeeded.v1` and carries our booking id as `merchant_reference`.
 * See https://docs.teya.com/online-payments/webhooks.
 */
export async function POST(req: Request) {
  const raw = await req.text()

  const signature =
    req.headers.get("teya-signature") ??
    req.headers.get("x-teya-signature") ??
    req.headers.get("x-signature") ??
    ""

  let valid = false
  try {
    valid = verifyWebhookSignature(raw, signature)
  } catch (err) {
    // Misconfiguration (missing secret) — reject rather than trust the event.
    console.log("[v0] teya webhook verify error:", (err as Error).message)
  }
  if (!valid) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const event = parseWebhookEvent(raw)
  if (!event) {
    // Unrecognised event — acknowledge so Teya doesn't retry forever.
    return NextResponse.json({ ok: true })
  }

  if (event.paid) {
    await markBookingConfirmed(event.reference, event.paymentId)
  } else {
    console.log(
      `[v0] teya webhook for ${event.reference}: status="${event.status}" (not confirming)`,
    )
  }

  return NextResponse.json({ ok: true })
}
