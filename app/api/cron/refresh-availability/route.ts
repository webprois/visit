import { NextResponse } from "next/server"
import { refreshTourAvailability } from "@/lib/tours"

// This job hits Bokun for every tour, so give it room and never cache it.
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Refresh the server-side Bokun availability cache. Triggered hourly by Vercel
 * Cron (see vercel.json). Protected with CRON_SECRET: Vercel Cron sends it as a
 * Bearer token, and it can also be passed as `?secret=` for manual runs.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get("authorization")
    const url = new URL(request.url)
    const provided = auth?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret")
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const started = Date.now()
    const result = await refreshTourAvailability()
    return NextResponse.json({
      ok: true,
      ...result,
      ms: Date.now() - started,
    })
  } catch (err) {
    console.error("[v0] refresh-availability failed:", err)
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    )
  }
}
