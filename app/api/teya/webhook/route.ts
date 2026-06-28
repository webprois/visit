import { NextResponse } from "next/server"
import { confirmBookingFromReturn } from "@/app/actions/booking"

/**
 * Teya SecurePay server-to-server callback (`returnurlsuccessserver`).
 *
 * SecurePay POSTs form-encoded fields here before redirecting the browser.
 * This path is the source of truth: we re-verify the `orderhash` against our
 * secret inside confirmBookingFromReturn() and never trust the status alone.
 */
export async function POST(req: Request) {
  let params: Record<string, string> = {}
  try {
    const contentType = req.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      params = (await req.json()) as Record<string, string>
    } else {
      const form = await req.formData()
      for (const [k, v] of form.entries()) params[k] = String(v)
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const orderId = String(params.orderid ?? params.orderId ?? "")
  if (!orderId) return NextResponse.json({ ok: true })

  await confirmBookingFromReturn(orderId, {
    orderId,
    status: params.status,
    amount: params.amount,
    currency: params.currency,
    orderhash: params.orderhash,
    step: params.step,
  })

  return NextResponse.json({ ok: true })
}
