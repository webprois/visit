import "server-only"
import crypto from "node:crypto"

/**
 * DRAFT — Teya Online Payments "Hosted Checkout" (the modern successor to the
 * legacy Borgun SecurePay form in lib/teya.ts).
 *
 * Flow (per https://docs.teya.com/online-payments/hosted-checkout/get-started):
 *   1. Get an OAuth access token (client-credentials) from the Developer Portal app.
 *   2. POST /v2/checkout/sessions to create a session → returns a hosted page URL.
 *   3. Redirect the customer to that URL.
 *   4. Confirm the result via a signed webhook (NOT the browser redirect).
 *
 * Verified from Teya docs / API:
 *   - Endpoint:  POST https://api.teya.com/v2/checkout/sessions   (prod)
 *                POST https://api.teya.xyz/v2/checkout/sessions   (staging)
 *
 * ⚠️ NOT yet verified against the live API reference (the docs are JS-rendered /
 * portal-gated). Everything marked `TODO(teya)` must be confirmed against
 * docs.teya.com + a sandbox app before this is wired into the booking flow:
 *   - the OAuth token URL, grant params and scopes,
 *   - the exact request body field names,
 *   - which response field carries the redirect URL + session id,
 *   - the webhook signature scheme (header name + HMAC input).
 */

const API_BASE =
  process.env.TEYA_API_BASE ??
  (process.env.TEYA_ENV === "production"
    ? "https://api.teya.com"
    : "https://api.teya.xyz")

// TODO(teya): confirm the token endpoint + grant from the Developer Portal.
const TOKEN_URL = process.env.TEYA_TOKEN_URL ?? `${API_BASE}/oauth/token`

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

/** Client-credentials OAuth token. TODO(teya): confirm scopes / params. */
async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret } = config()
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      // TODO(teya): add the correct scope(s), e.g. "online-payments".
    }),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Teya token request failed: ${res.status}`)
  }
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error("Teya token response missing access_token")
  return json.access_token
}

export type CreateCheckoutInput = {
  /** Our booking id, echoed back on the webhook for reconciliation. */
  reference: string
  /** ISK is a zero-decimal currency, so this is the plain ISK amount.
   *  TODO(teya): confirm whether Teya expects minor units (×100) for ISK. */
  amount: number
  currency: string // e.g. "ISK"
  customerEmail?: string
  /** Browser lands here after a successful payment. */
  successUrl: string
  /** Browser lands here if the customer cancels / payment fails. */
  cancelUrl: string
  /** Server-to-server callback Teya posts the verified result to. */
  webhookUrl: string
}

export type CreateCheckoutResult = {
  sessionId: string
  /** The hosted payment page URL to redirect the customer to. */
  redirectUrl: string
}

/**
 * Create a hosted-checkout session. Returns the URL to redirect the customer to.
 * TODO(teya): confirm every body/response field name against the API reference.
 */
export async function createCheckoutSession(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  const token = await getAccessToken()

  // TODO(teya): replace this body with the documented schema (field names).
  const body = {
    reference: input.reference,
    amount: { value: input.amount, currency: input.currency },
    customer: input.customerEmail ? { email: input.customerEmail } : undefined,
    returnUrls: {
      success: input.successUrl,
      cancel: input.cancelUrl,
    },
    webhookUrl: input.webhookUrl,
    mode: "hosted",
  }

  const res = await fetch(`${API_BASE}/v2/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  if (!res.ok) {
    throw new Error(`Teya checkout session failed: ${res.status} ${await res.text()}`)
  }

  // TODO(teya): map to the real response shape (field names below are guesses).
  const json = (await res.json()) as {
    id?: string
    sessionId?: string
    url?: string
    redirectUrl?: string
    links?: { redirect?: string }
  }
  const sessionId = json.sessionId ?? json.id ?? ""
  const redirectUrl = json.redirectUrl ?? json.url ?? json.links?.redirect ?? ""
  if (!redirectUrl) throw new Error("Teya checkout response missing redirect URL")
  return { sessionId, redirectUrl }
}

/**
 * Verify a webhook signature. TODO(teya): confirm the header name and exact
 * signed payload (raw body vs. canonicalised) from the webhook docs.
 * See https://docs.teya.com/online-payments/webhook-signature-validator
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
): boolean {
  const secret = process.env.TEYA_WEBHOOK_SECRET
  if (!secret) throw new Error("TEYA_WEBHOOK_SECRET is not configured")
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex")
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(signatureHeader ?? "", "utf8")
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export type TeyaWebhookEvent = {
  /** Our booking id (the `reference` we sent when creating the session). */
  reference: string
  /** True only when Teya reports a fully captured/approved payment. */
  paid: boolean
  /** Raw status string from Teya, for logging. */
  status: string
  /** Teya's payment / transaction id, stored on the booking. */
  paymentId: string | null
}

/**
 * Normalise a Teya webhook body into the fields we act on.
 * TODO(teya): map to the real event schema — confirm the property paths for
 * reference, status (the set of "paid"/"approved"/"captured" values), and the
 * payment id. Returns null if the event isn't a payment-result we recognise.
 */
export function parseWebhookEvent(rawBody: string): TeyaWebhookEvent | null {
  let json: Record<string, unknown>
  try {
    json = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return null
  }
  // TODO(teya): adjust these property paths to the documented payload.
  const data = (json.data ?? json) as Record<string, unknown>
  const reference = String(
    (data.reference as string) ?? (data.merchantReference as string) ?? "",
  )
  if (!reference) return null
  const status = String((data.status as string) ?? (json.type as string) ?? "")
  const paid = ["paid", "approved", "captured", "succeeded", "completed"].includes(
    status.toLowerCase(),
  )
  const paymentId =
    (data.paymentId as string) ??
    (data.transactionId as string) ??
    (data.id as string) ??
    null
  return { reference, paid, status, paymentId }
}
