/**
 * Absolute base URL of the app, resolvable without an incoming request.
 *
 * Request handlers should prefer deriving the origin from request headers (see
 * `getOrigin` in app/actions/booking.ts). This helper exists for contexts with
 * no request — most importantly the reminder cron and email links — where we
 * still need a correct public URL.
 *
 * Order of preference:
 *  1. NEXT_PUBLIC_APP_URL  — explicit override for a custom domain (e.g. visit.is)
 *  2. VERCEL_PROJECT_PRODUCTION_URL — stable production deployment URL
 *  3. VERCEL_URL — current deployment URL
 *  4. V0_RUNTIME_URL — v0 preview
 *  5. localhost fallback for local dev
 */
export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL
  if (explicit) return explicit.replace(/\/$/, "")

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (prod) return `https://${prod}`

  const current = process.env.VERCEL_URL
  if (current) return `https://${current}`

  if (process.env.V0_RUNTIME_URL) return process.env.V0_RUNTIME_URL

  return "http://localhost:3000"
}
