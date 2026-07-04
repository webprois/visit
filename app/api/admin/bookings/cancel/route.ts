import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/require-auth"
import { cancelBokunBooking } from "@/lib/bokun"

export const dynamic = "force-dynamic"

/**
 * Admin-only endpoint that cancels a Bokun reservation. This is a destructive
 * write, so it requires an authenticated session and an explicit confirmation
 * code in the body. notify/refund default to false.
 */
export async function POST(request: Request) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { confirmationCode?: string; note?: string; notify?: boolean; refund?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const confirmationCode = body.confirmationCode?.trim()
  if (!confirmationCode) {
    return NextResponse.json({ error: "Missing confirmation code" }, { status: 400 })
  }

  const result = await cancelBokunBooking(confirmationCode, {
    note: body.note,
    notify: Boolean(body.notify),
    refund: Boolean(body.refund),
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
