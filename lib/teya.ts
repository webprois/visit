import "server-only"
import crypto from "node:crypto"

/**
 * Teya / Borgun SecurePay hosted payment page.
 *
 * Flow:
 *  1. We POST an auto-submitting form to SECUREPAY_URL with a `checkhash`
 *     (HMAC-SHA256 of selected fields keyed by the merchant secret).
 *  2. The customer pays on Teya's hosted page.
 *  3. Teya calls our `returnurlsuccessserver` (server-to-server, trusted) and
 *     redirects the browser to `returnurlsuccess`. Both carry an `orderhash`
 *     we re-verify with the same secret before marking a booking paid.
 *
 * Credentials come from the Teya payment-provider config screen:
 *  - TEYA_MERCHANT_ID         (Merchant ID)
 *  - TEYA_PAYMENT_GATEWAY_ID  (Payment Gateway ID)
 *  - TEYA_SECRET_KEY          (Secret Key)
 */

const SECUREPAY_URL = "https://securepay.borgun.is/securepay/default.aspx"

function config() {
  const merchantId = process.env.TEYA_MERCHANT_ID
  const paymentGatewayId = process.env.TEYA_PAYMENT_GATEWAY_ID
  const secret = process.env.TEYA_SECRET_KEY
  if (!merchantId || !paymentGatewayId || !secret) {
    throw new Error("Teya SecurePay is not configured")
  }
  return { merchantId, paymentGatewayId, secret }
}

export function isTeyaConfigured(): boolean {
  return Boolean(
    process.env.TEYA_MERCHANT_ID &&
      process.env.TEYA_PAYMENT_GATEWAY_ID &&
      process.env.TEYA_SECRET_KEY,
  )
}

function hmac(secret: string, message: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(message, "utf8")
    .digest("hex")
}

/** SecurePay expects amounts with two decimals, even for ISK (e.g. 139000.00). */
export function formatAmount(amountIsk: number): string {
  return amountIsk.toFixed(2)
}

export type SecurePayForm = {
  /** Endpoint to POST the form to. */
  url: string
  /** Hidden form fields to submit. */
  fields: Record<string, string>
}

/**
 * Build the signed SecurePay form. The request hash is HMAC-SHA256 over:
 *   merchantid | returnurlsuccess | returnurlsuccessserver | orderid | amount | currency
 */
export function buildSecurePayForm(params: {
  orderId: string
  amountIsk: number
  currency?: string
  buyerEmail?: string
  itemDescription?: string
  returnUrlSuccess: string
  returnUrlSuccessServer: string
  returnUrlCancel: string
  returnUrlError: string
  language?: string
}): SecurePayForm {
  const { merchantId, paymentGatewayId, secret } = config()
  const currency = params.currency ?? "ISK"
  const amount = formatAmount(params.amountIsk)

  const checkMessage = [
    merchantId,
    params.returnUrlSuccess,
    params.returnUrlSuccessServer,
    params.orderId,
    amount,
    currency,
  ].join("|")
  const checkhash = hmac(secret, checkMessage)

  const fields: Record<string, string> = {
    merchantid: merchantId,
    paymentgatewayid: paymentGatewayId,
    checkhash,
    orderid: params.orderId,
    amount,
    currency,
    language: params.language ?? "EN",
    buyeremail: params.buyerEmail ?? "",
    itemdescription_0: params.itemDescription ?? "",
    itemcount_0: "1",
    itemunitamount_0: amount,
    itemamount_0: amount,
    skipreceiptpage: "1",
    returnurlsuccess: params.returnUrlSuccess,
    returnurlsuccessserver: params.returnUrlSuccessServer,
    returnurlcancel: params.returnUrlCancel,
    returnurlerror: params.returnUrlError,
  }

  return { url: SECUREPAY_URL, fields }
}

/**
 * Verify the `orderhash` Teya returns. It is HMAC-SHA256 over:
 *   orderid | amount | currency
 * computed over the exact values Teya echoes back, so we recompute against the
 * returned strings rather than what we originally sent.
 */
export function verifyReturnHash(params: {
  orderId: string
  amount: string
  currency: string
  orderhash: string
}): boolean {
  const { secret } = config()
  const expected = hmac(
    secret,
    [params.orderId, params.amount, params.currency].join("|"),
  )
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(params.orderhash ?? "", "utf8")
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
