import "server-only"
import { Resend } from "resend"

/**
 * Thin wrapper around Resend for transactional email (booking confirmations and
 * reminders). Email is a non-critical side effect: a failure here must never
 * break a booking or a cron run, so `sendEmail` catches and reports instead of
 * throwing.
 *
 * Configuration comes from two env vars:
 *  - RESEND_API_KEY — API key from the Resend dashboard
 *  - EMAIL_FROM     — verified sender, e.g. "Visit Iceland <bookings@mail.visit.is>"
 *
 * When either is missing (e.g. before the account is set up) we no-op and log,
 * so the rest of the app keeps working.
 */

let client: Resend | null = null

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  if (!client) client = new Resend(key)
  return client
}

/** True when Resend is configured and emails will actually be delivered. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  /** Optional plain-text fallback; recommended for deliverability. */
  text?: string
  replyTo?: string
}

export type SendEmailResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string }

export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const resend = getClient()
  const from = process.env.EMAIL_FROM

  if (!resend || !from) {
    console.log(
      "[v0] Email skipped (RESEND_API_KEY / EMAIL_FROM not set):",
      input.subject,
      "->",
      input.to,
    )
    return { ok: false, error: "Email not configured" }
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    })
    if (error) {
      console.log("[v0] Email send error:", error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true, id: data?.id ?? null }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error"
    console.log("[v0] Email send threw:", message)
    return { ok: false, error: message }
  }
}
