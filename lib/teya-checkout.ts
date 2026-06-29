import "server-only"
import crypto from "node:crypto"

/**
 * Teya Online Payments "Hosted Checkout" (the modern successor to the legacy
 * Borgun SecurePay form in lib/teya.ts).
 *
 * Flow (https://docs.teya.com/online-payments/hosted-checkout/get-started):
 *   1. Get an OAuth access token (client_credentials) from the store's ecommerce
 *      API credentials.
 *   2. POST /v2/checkout/sessions to create a session → returns `session_url`.
 *   3. Redirect the customer to `session_url`.
 *   4. Confirm the result via the signed payment webhook (NOT the browser
 *      redirect). Webhook URLs are configured per-store in the Business Portal.
 *
 * Verified against docs.teya.com:
 *   - API base:   https://api.teya.xyz (staging) / https://api.teya.com (prod)
 *   - OAuth:      https://id.teya.xyz/oauth/v2/oauth-token (staging)
 *                 https://id.teya.com/oauth/v2/oauth-token (prod)
 *   - Scopes:     "checkout/sessions/create checkout/sessions/id/get refunds/create"
 *   - Create:     POST {API_BASE}/v2/checkout/sessions
 *                   body { amount:{value,currency}, type, success_url, cancel_url,
 *                          merchant_reference }
 *                   header Idempotency-Key
 *                 → { session_id, session_token, session_url, session_status }
 *   - Webhook:    header `x-teya-signature`, SHA256withRSA (RSASSA-PKCS1-v1_5),
 *                 Base64-encoded, verified against the store's webhook public key.
 *                 Payload: { event, timestamp, data:{ status, merchant_reference,
 *                            transaction_id, session_id, ... } }
 *
 * `amount.value` is always in the smallest currency unit. ISK is zero-decimal,
 * so the value equals the plain ISK amount (matches booking.amountMinor).
 */

const IS_PROD = process.env.TEYA_ENV === "production"

const API_BASE =
  process.env.TEYA_API_BASE ??
  (IS_PROD ? "https://api.teya.com" : "https://api.teya.xyz")

const TOKEN_URL =
  process.env.TEYA_TOKEN_URL ??
  (IS_PROD
    ? "https://id.teya.com/oauth/v2/oauth-token"
    : "https://id.teya.xyz/oauth/v2/oauth-token")

const SCOPE =
  process.env.TEYA_SCOPE ??
  "checkout/sessions/create checkout/sessions/id/get refunds/create"

function config() {
  const clientId = process.env.TEYA_CLIENT_ID
  const clientSecret = process.env.TEYA_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("Teya Online Payments is not configured")
  }
  return { clientId, clientSecret }
}

export function isTeyaCheckoutConfigured(): boolean {
  return Boolean(process.env.TEYA_CLIENT_ID && process.env.TEYA_CLIENT_SECRET)
}

/* ---------------- OAuth (client_credentials) ---------------- */

let cachedToken: { value: string; expiresAt: number } | null = null

/** Client-credentials OAuth token, cached in-memory until shortly before expiry. */
async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value
  }

  const { clientId, clientSecret } = config()
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: SCOPE,
    }),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(
      `Teya token request failed: ${res.status} ${await res.text()}`,
    )
  }

  const json = (await res.json()) as {
    access_token?: string
    expires_in?: number
  }
  if (!json.access_token) {
    throw new Error("Teya token response missing access_token")
  }

  // Refresh ~60s before the real expiry; fall back to 5 min if not provided.
  const ttlMs = Math.max(30, (json.expires_in ?? 300) - 60) * 1000
  cachedToken = { value: json.access_token, expiresAt: Date.now() + ttlMs }
  return cachedToken.value
}

/* ---------------- Create checkout session ---------------- */

export type CreateCheckoutInput = {
  /** Our booking id — echoed back as `merchant_reference` on the webhook. */
  reference: string
  /** ISK is zero-decimal, so this is the plain ISK amount (smallest unit). */
  amount: number
  currency: string // e.g. "ISK"
  customerEmail?: string
  /** Browser lands here after a successful payment. */
  successUrl: string
  /** Browser lands here if the customer cancels / payment fails. */
  cancelUrl: string
}

export type CreateCheckoutResult = {
  sessionId: string
  /** The hosted payment page URL to redirect the customer to. */
  redirectUrl: string
}

/**
 * Create a hosted-checkout session and return the URL to redirect the customer
 * to. The booking id is sent as `merchant_reference` and `Idempotency-Key`, so
 * retrying the same booking won't create a duplicate session.
 */
export async function createCheckoutSession(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  const token = await getAccessToken()

  const body = {
    amount: { value: input.amount, currency: input.currency },
    type: "SALE",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    merchant_reference: input.reference,
  }

  const res = await fetch(`${API_BASE}/v2/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.reference,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(
      `Teya checkout session failed: ${res.status} ${await res.text()}`,
    )
  }

  const json = (await res.json()) as {
    session_id?: string
    session_url?: string
    session_status?: string
  }
  const sessionId = json.session_id ?? ""
  const redirectUrl = json.session_url ?? ""
  if (!redirectUrl) {
    throw new Error("Teya checkout response missing session_url")
  }
  return { sessionId, redirectUrl }
}

/* ---------------- Webhook signature + parsing ---------------- */

/**
 * Load the store's webhook public key (provided by Teya in the Business Portal).
 * Accepts a PEM block or a raw Base64 DER (SPKI) string in TEYA_WEBHOOK_PUBLIC_KEY.
 */
function getWebhookPublicKey(): crypto.KeyObject {
  const raw = process.env.TEYA_WEBHOOK_PUBLIC_KEY
  if (!raw) throw new Error("TEYA_WEBHOOK_PUBLIC_KEY is not configured")
  const value = raw.trim()
  if (value.includes("BEGIN")) {
    // PEM — replace any escaped newlines that survived env-var storage.
    return crypto.createPublicKey(value.replace(/\\n/g, "\n"))
  }
  // Base64 DER (SubjectPublicKeyInfo).
  return crypto.createPublicKey({
    key: Buffer.from(value, "base64"),
    format: "der",
    type: "spki",
  })
}

/**
 * Verify a Teya webhook signature: SHA256withRSA (RSASSA-PKCS1-v1_5) over the
 * raw request body, with the Base64-encoded signature from `x-teya-signature`.
 * The raw body MUST be the exact bytes received (not re-serialised JSON).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
): boolean {
  if (!signatureHeader) return false
  let signature: Buffer
  try {
    signature = Buffer.from(signatureHeader, "base64")
  } catch {
    return false
  }
  if (signature.length === 0) return false
  try {
    return crypto.verify(
      "RSA-SHA256",
      Buffer.from(rawBody, "utf8"),
      getWebhookPublicKey(),
      signature,
    )
  } catch {
    return false
  }
}

export type TeyaWebhookEvent = {
  /** Our booking id (the `merchant_reference` we sent creating the session). */
  reference: string
  /** True only when Teya reports a successful payment. */
  paid: boolean
  /** Raw status / event string from Teya, for logging. */
  status: string
  /** Teya's transaction id, stored on the booking (used for refunds/receipts). */
  paymentId: string | null
}

/**
 * Normalise a Teya webhook body into the fields we act on. Returns null if the
 * event isn't a payment result we recognise (e.g. missing merchant_reference).
 */
export function parseWebhookEvent(rawBody: string): TeyaWebhookEvent | null {
  let json: Record<string, unknown>
  try {
    json = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return null
  }

  const event = String(json.event ?? "")
  const data = (json.data ?? {}) as Record<string, unknown>
  const reference = String(data.merchant_reference ?? "")
  if (!reference) return null

  const status = String(data.status ?? event)
  // Teya currently only sends webhooks for successful payments, but we still
  // gate on an explicit success signal rather than the mere presence of a body.
  const paid =
    event.startsWith("payment.succeeded") ||
    status.toUpperCase() === "SUCCESS"
  const paymentId = (data.transaction_id as string) ?? null

  return { reference, paid, status, paymentId }
}
