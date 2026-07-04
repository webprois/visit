import { runReminderScan } from "@/lib/email/service"

/**
 * Daily reminder cron. Sends one-week-out and one-day-out reminder emails for
 * upcoming bookings. Scheduled via vercel.json; Vercel Cron calls this endpoint
 * with an `Authorization: Bearer <CRON_SECRET>` header.
 *
 * Protected by CRON_SECRET so it can't be triggered by the public. When the
 * secret is unset (e.g. local dev without the var), we allow the request so the
 * endpoint can still be exercised manually.
 */

export const dynamic = "force-dynamic"
// Give the scan room to send a batch of emails.
export const maxDuration = 60

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // not configured — allow (dev)
  // Vercel Cron sends the secret as a Bearer token; allow ?secret= for manual runs.
  const auth = req.headers.get("authorization")
  const url = new URL(req.url)
  const provided =
    auth?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret")
  return provided === secret
}

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return new Response("Unauthorized", { status: 401 })
  }

  try {
    const result = await runReminderScan()
    return Response.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    console.error("[v0] reminder cron failed:", message)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
