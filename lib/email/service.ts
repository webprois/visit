import "server-only"
import { and, eq, isNull, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { booking, type Booking } from "@/lib/db/schema"
import { getAppUrl } from "@/lib/app-url"
import { asLocale, type Locale } from "@/lib/i18n"
import { sendEmail } from "@/lib/email/client"
import {
  buildConfirmationEmail,
  buildReminderEmail,
  buildCancellationEmail,
  buildCancellationRequestEmail,
  buildCancellationApprovedEmail,
  buildCancellationDeclinedEmail,
  buildVerificationEmail,
  buildPasswordResetEmail,
  type BookingEmailData,
  type CancellationEmailData,
} from "@/lib/email/templates"

/**
 * Orchestrates transactional booking email: turns a `booking` row into the
 * right localized template and sends it, then records the send on the row so it
 * is never sent twice. All functions are best-effort — a failure logs and
 * returns false rather than throwing, so booking/cron flows are never broken.
 */

/** Human-readable travel date in the customer's locale (e.g. "5 August 2026"). */
function formatTourDate(dateStr: string, locale: Locale): string {
  const ms = Date.parse(dateStr)
  if (Number.isNaN(ms)) return dateStr
  try {
    return new Intl.DateTimeFormat(localeToBcp47(locale), {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(ms))
  } catch {
    return dateStr
  }
}

function localeToBcp47(locale: Locale): string {
  switch (locale) {
    case "es":
      return "es-ES"
    case "pt":
      return "pt-PT"
    case "it":
      return "it-IT"
    default:
      return "en-GB"
  }
}

/** Voucher download link that works for guests (unguessable UUID booking id). */
function voucherUrl(bookingId: string): string {
  return `${getAppUrl()}/api/bookings/${bookingId}/voucher`
}

function manageUrl(): string {
  return `${getAppUrl()}/account`
}

function toBookingEmailData(row: Booking): BookingEmailData {
  const locale = asLocale(row.locale)
  const guests = String(row.totalPax)
  const dateWithTime = row.startTime
    ? `${formatTourDate(row.tourDate, locale)} · ${row.startTime}`
    : formatTourDate(row.tourDate, locale)
  return {
    locale,
    customerName: row.customerName,
    tourTitle: row.tourTitle,
    tourDate: dateWithTime,
    guests,
    bookingRef: row.bokunConfirmationCode ?? row.id,
    voucherUrl: voucherUrl(row.id),
    manageUrl: manageUrl(),
  }
}

function toCancellationEmailData(row: Booking): CancellationEmailData {
  const locale = asLocale(row.locale)
  return {
    locale,
    customerName: row.customerName,
    tourTitle: row.tourTitle,
    tourDate: formatTourDate(row.tourDate, locale),
    bookingRef: row.bokunConfirmationCode ?? row.id,
  }
}

/**
 * Send the booking confirmation with voucher link. Idempotent: skips if already
 * sent. Marks `confirmationEmailSentAt` on success. Call after the Bokun
 * booking is confirmed (so the voucher is available).
 */
export async function sendConfirmationEmail(
  bookingId: string,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(booking)
    .where(eq(booking.id, bookingId))
    .limit(1)
  if (!row) return false
  if (row.confirmationEmailSentAt) return true // already sent
  if (!row.customerEmail) return false

  const email = buildConfirmationEmail(toBookingEmailData(row))
  const result = await sendEmail({
    to: row.customerEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
  if (!result.ok) return false

  await db
    .update(booking)
    .set({ confirmationEmailSentAt: new Date() })
    .where(eq(booking.id, bookingId))
  return true
}

/**
 * Send a reminder email (week/day) for a booking row and stamp the matching
 * column. Returns true on success. The cron passes rows already filtered to
 * those due; this function stamps to stay idempotent even across retries.
 */
export async function sendReminderEmail(
  row: Booking,
  when: "week" | "day",
): Promise<boolean> {
  if (!row.customerEmail) return false
  if (when === "week" && row.reminderWeekSentAt) return true
  if (when === "day" && row.reminderDaySentAt) return true

  const email = buildReminderEmail(toBookingEmailData(row), when)
  const result = await sendEmail({
    to: row.customerEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
  if (!result.ok) return false

  await db
    .update(booking)
    .set(
      when === "week"
        ? { reminderWeekSentAt: new Date() }
        : { reminderDaySentAt: new Date() },
    )
    .where(eq(booking.id, row.id))
  return true
}

/** Confirmation that a booking was cancelled (free, 72h+ before departure). */
export async function sendCancellationEmail(row: Booking): Promise<boolean> {
  if (!row.customerEmail) return false
  const email = buildCancellationEmail(toCancellationEmailData(row))
  const result = await sendEmail({
    to: row.customerEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
  return result.ok
}

/** Acknowledge a cancellation request (under 72h, needs staff review). */
export async function sendCancellationRequestEmail(
  row: Booking,
): Promise<boolean> {
  if (!row.customerEmail) return false
  const email = buildCancellationRequestEmail(toCancellationEmailData(row))
  const result = await sendEmail({
    to: row.customerEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
  return result.ok
}

/** Tell the customer their cancellation request was approved (booking cancelled). */
export async function sendCancellationApprovedEmail(
  row: Booking,
  adminNote?: string | null,
): Promise<boolean> {
  if (!row.customerEmail) return false
  const email = buildCancellationApprovedEmail({
    ...toCancellationEmailData(row),
    adminNote: adminNote?.trim() || undefined,
  })
  const result = await sendEmail({
    to: row.customerEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
  return result.ok
}

/** Tell the customer their cancellation request was declined (booking stands). */
export async function sendCancellationDeclinedEmail(
  row: Booking,
  adminNote?: string | null,
): Promise<boolean> {
  if (!row.customerEmail) return false
  const email = buildCancellationDeclinedEmail({
    ...toCancellationEmailData(row),
    adminNote: adminNote?.trim() || undefined,
  })
  const result = await sendEmail({
    to: row.customerEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
  return result.ok
}

/**
 * Send the account email-verification link (Better Auth sign-up / unverified
 * sign-in). `locale` comes from the visitor's language cookie so the email
 * matches the site language they used.
 */
export async function sendAccountVerificationEmail(input: {
  to: string
  name?: string | null
  url: string
  locale: string
}): Promise<boolean> {
  const email = buildVerificationEmail({
    locale: input.locale,
    name: input.name,
    url: input.url,
  })
  const result = await sendEmail({
    to: input.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
  return result.ok
}

/** Send the password-reset link (Better Auth "forgot password" flow). */
export async function sendPasswordResetEmail(input: {
  to: string
  name?: string | null
  url: string
  locale: string
}): Promise<boolean> {
  const email = buildPasswordResetEmail({
    locale: input.locale,
    name: input.name,
    url: input.url,
  })
  const result = await sendEmail({
    to: input.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  })
  return result.ok
}

/** A booking status counts as "live" (paid/confirmed) for reminder purposes. */
const LIVE_STATUSES = ["paid", "confirmed"] as const

/** "YYYY-MM-DD" for a date `days` from today, in UTC. */
function isoDatePlus(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export type ReminderScanResult = {
  weekSent: number
  daySent: number
  weekFailed: number
  dayFailed: number
}

/**
 * Find bookings whose departure is exactly one week / one day out and send the
 * matching reminder, then stamp the row so it never repeats. Designed to run
 * once daily from a cron. Tour dates are stored as "YYYY-MM-DD" strings, so we
 * match on the exact target date string.
 *
 * Idempotent by construction: only rows with a null reminder column are picked
 * up, and `sendReminderEmail` stamps the column on success.
 */
export async function runReminderScan(): Promise<ReminderScanResult> {
  const weekTarget = isoDatePlus(7)
  const dayTarget = isoDatePlus(1)

  const [weekRows, dayRows] = await Promise.all([
    db
      .select()
      .from(booking)
      .where(
        and(
          eq(booking.tourDate, weekTarget),
          inArray(booking.status, [...LIVE_STATUSES]),
          isNull(booking.cancelledAt),
          isNull(booking.reminderWeekSentAt),
        ),
      ),
    db
      .select()
      .from(booking)
      .where(
        and(
          eq(booking.tourDate, dayTarget),
          inArray(booking.status, [...LIVE_STATUSES]),
          isNull(booking.cancelledAt),
          isNull(booking.reminderDaySentAt),
        ),
      ),
  ])

  const result: ReminderScanResult = {
    weekSent: 0,
    daySent: 0,
    weekFailed: 0,
    dayFailed: 0,
  }

  for (const row of weekRows) {
    const ok = await sendReminderEmail(row, "week")
    if (ok) result.weekSent++
    else result.weekFailed++
  }
  for (const row of dayRows) {
    const ok = await sendReminderEmail(row, "day")
    if (ok) result.daySent++
    else result.dayFailed++
  }

  console.log(
    `[v0] reminder scan: week ${weekTarget} sent=${result.weekSent} failed=${result.weekFailed}; ` +
      `day ${dayTarget} sent=${result.daySent} failed=${result.dayFailed}`,
  )
  return result
}
