import { getEmailStrings, fmtEmail, type EmailStrings } from "@/lib/email/copy"
import { getAppUrl } from "@/lib/app-url"

/**
 * Server-rendered HTML email templates (plain string HTML, table-based, inline
 * styles) for maximum email-client compatibility. Each builder returns the
 * subject, HTML body, and a plain-text fallback.
 *
 * These are intentionally framework-free: emails are rendered in Gmail/Outlook/
 * Apple Mail, not a browser, so we avoid external CSS and modern layout.
 */

// Brand palette (kept in sync with the site's dark theme, but emails use a
// light background for readability across clients).
const COLORS = {
  bg: "#f4f5f7",
  card: "#ffffff",
  text: "#1f2430",
  muted: "#6b7280",
  border: "#e5e7eb",
  accent: "#e2574c", // matches the site's primary red
  accentText: "#ffffff",
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export type BuiltEmail = { subject: string; html: string; text: string }

type DetailRow = { label: string; value: string }

/** Shared HTML shell: header band, white card, footer. */
function layout(opts: {
  s: EmailStrings
  heading: string
  bodyHtml: string
  year?: number
}): string {
  const { s, heading, bodyHtml } = opts
  const year = opts.year ?? new Date().getFullYear()
  const baseUrl = getAppUrl()
  const logoUrl = `${baseUrl}/email-logo.png`
  const accountUrl = `${baseUrl}/account`
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.text};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;">
            <tr>
              <td style="padding:8px 8px 20px;text-align:center;">
                <a href="${baseUrl}" style="text-decoration:none;">
                  <img src="${logoUrl}" alt="${escapeHtml(s.brand)}" width="132" style="display:inline-block;width:132px;max-width:60%;height:auto;border:0;" />
                </a>
              </td>
            </tr>
            <tr>
              <td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;padding:32px;">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${COLORS.text};">${escapeHtml(heading)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 8px;text-align:center;color:${COLORS.muted};font-size:12px;line-height:1.5;">
                <a href="${accountUrl}" style="color:${COLORS.accent};font-weight:600;text-decoration:none;">${escapeHtml(s.myAccountLabel)}</a><br/><br/>
                ${s.questionsHtml}<br/>
                &copy; ${year} ${escapeHtml(s.brand)}. ${escapeHtml(s.footerRights)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COLORS.text};">${escapeHtml(text)}</p>`
}

function mutedParagraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.muted};">${escapeHtml(text)}</p>`
}

function detailsTable(rows: DetailRow[]): string {
  const body = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 0;font-size:13px;color:${COLORS.muted};width:40%;vertical-align:top;">${escapeHtml(r.label)}</td>
        <td style="padding:8px 0;font-size:15px;color:${COLORS.text};font-weight:600;">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("")
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${COLORS.border};border-bottom:1px solid ${COLORS.border};margin:0 0 20px;">${body}</table>`
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
    <tr>
      <td style="border-radius:8px;background:${COLORS.accent};">
        <a href="${href}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:${COLORS.accentText};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`
}

function textDetails(rows: DetailRow[]): string {
  return rows.map((r) => `${r.label}: ${r.value}`).join("\n")
}

export type BookingEmailData = {
  locale: string
  customerName: string
  tourTitle: string
  tourDate: string
  guests: string
  bookingRef: string
  voucherUrl: string
  manageUrl: string
}

/** Confirmation email with voucher download link. */
export function buildConfirmationEmail(data: BookingEmailData): BuiltEmail {
  const s = getEmailStrings(data.locale)
  const rows: DetailRow[] = [
    { label: s.tourLabel, value: data.tourTitle },
    { label: s.dateLabel, value: data.tourDate },
    { label: s.guestsLabel, value: data.guests },
    { label: s.bookingRefLabel, value: data.bookingRef },
  ]
  const bodyHtml = [
    paragraph(fmtEmail(s.hi, { name: data.customerName })),
    paragraph(s.confirmIntro),
    detailsTable(rows),
    `<h2 style="margin:0 0 8px;font-size:16px;color:${COLORS.text};">${escapeHtml(s.voucherHeading)}</h2>`,
    paragraph(s.voucherText),
    button(data.voucherUrl, s.voucherButton),
    mutedParagraph(s.confirmOutro),
  ].join("\n")

  const text = [
    fmtEmail(s.hi, { name: data.customerName }),
    "",
    s.confirmIntro,
    "",
    textDetails(rows),
    "",
    `${s.voucherHeading}: ${data.voucherUrl}`,
    "",
    s.confirmOutro,
  ].join("\n")

  return {
    subject: fmtEmail(s.confirmSubject, { tour: data.tourTitle }),
    html: layout({ s, heading: s.confirmHeading, bodyHtml }),
    text,
  }
}

/** Reminder email; `when` selects the one-week vs one-day copy. */
export function buildReminderEmail(
  data: BookingEmailData,
  when: "week" | "day",
): BuiltEmail {
  const s = getEmailStrings(data.locale)
  const heading = when === "week" ? s.reminderHeadingWeek : s.reminderHeadingDay
  const intro = when === "week" ? s.reminderIntroWeek : s.reminderIntroDay
  const subject = fmtEmail(
    when === "week" ? s.reminderSubjectWeek : s.reminderSubjectDay,
    { tour: data.tourTitle },
  )
  const rows: DetailRow[] = [
    { label: s.tourLabel, value: data.tourTitle },
    { label: s.dateLabel, value: data.tourDate },
    { label: s.guestsLabel, value: data.guests },
    { label: s.bookingRefLabel, value: data.bookingRef },
  ]
  const bodyHtml = [
    paragraph(fmtEmail(s.hi, { name: data.customerName })),
    paragraph(intro),
    detailsTable(rows),
    paragraph(s.reminderVoucherText),
    button(data.voucherUrl, s.reminderButton),
    mutedParagraph(s.reminderChecklist),
    mutedParagraph(s.reminderCancelNote),
  ].join("\n")

  const text = [
    fmtEmail(s.hi, { name: data.customerName }),
    "",
    intro,
    "",
    textDetails(rows),
    "",
    `${s.reminderVoucherText} ${data.voucherUrl}`,
    "",
    s.reminderChecklist,
    "",
    s.reminderCancelNote,
  ].join("\n")

  return { subject, html: layout({ s, heading, bodyHtml }), text }
}

export type CancellationEmailData = {
  locale: string
  customerName: string
  tourTitle: string
  tourDate: string
  bookingRef: string
  /** Optional free-text note from staff, shown in resolution emails. */
  adminNote?: string
}

/** Confirmation that a booking was cancelled (free, 72h+ before departure). */
export function buildCancellationEmail(
  data: CancellationEmailData,
): BuiltEmail {
  const s = getEmailStrings(data.locale)
  const rows: DetailRow[] = [
    { label: s.tourLabel, value: data.tourTitle },
    { label: s.dateLabel, value: data.tourDate },
    { label: s.bookingRefLabel, value: data.bookingRef },
  ]
  const bodyHtml = [
    paragraph(fmtEmail(s.hi, { name: data.customerName })),
    paragraph(s.cancelIntro),
    detailsTable(rows),
    paragraph(s.cancelRefund),
    mutedParagraph(s.cancelOutro),
  ].join("\n")

  const text = [
    fmtEmail(s.hi, { name: data.customerName }),
    "",
    s.cancelIntro,
    "",
    textDetails(rows),
    "",
    s.cancelRefund,
    "",
    s.cancelOutro,
  ].join("\n")

  return {
    subject: fmtEmail(s.cancelSubject, { tour: data.tourTitle }),
    html: layout({ s, heading: s.cancelHeading, bodyHtml }),
    text,
  }
}

/** Acknowledgement that a cancellation request was received (under 72h). */
export function buildCancellationRequestEmail(
  data: CancellationEmailData,
): BuiltEmail {
  const s = getEmailStrings(data.locale)
  const rows: DetailRow[] = [
    { label: s.tourLabel, value: data.tourTitle },
    { label: s.dateLabel, value: data.tourDate },
    { label: s.bookingRefLabel, value: data.bookingRef },
  ]
  const bodyHtml = [
    paragraph(fmtEmail(s.hi, { name: data.customerName })),
    paragraph(s.cancelReqIntro),
    detailsTable(rows),
    mutedParagraph(s.cancelReqOutro),
  ].join("\n")

  const text = [
    fmtEmail(s.hi, { name: data.customerName }),
    "",
    s.cancelReqIntro,
    "",
    textDetails(rows),
    "",
    s.cancelReqOutro,
  ].join("\n")

  return {
    subject: fmtEmail(s.cancelReqSubject, { tour: data.tourTitle }),
    html: layout({ s, heading: s.cancelReqHeading, bodyHtml }),
    text,
  }
}

/** Staff approved an under-72h cancellation request: booking is now cancelled. */
export function buildCancellationApprovedEmail(
  data: CancellationEmailData,
): BuiltEmail {
  const s = getEmailStrings(data.locale)
  const rows: DetailRow[] = [
    { label: s.tourLabel, value: data.tourTitle },
    { label: s.dateLabel, value: data.tourDate },
    { label: s.bookingRefLabel, value: data.bookingRef },
  ]
  if (data.adminNote) rows.push({ label: s.adminNoteLabel, value: data.adminNote })

  const bodyHtml = [
    paragraph(fmtEmail(s.hi, { name: data.customerName })),
    paragraph(s.cancelApprovedIntro),
    detailsTable(rows),
    mutedParagraph(s.cancelApprovedOutro),
  ].join("\n")

  const text = [
    fmtEmail(s.hi, { name: data.customerName }),
    "",
    s.cancelApprovedIntro,
    "",
    textDetails(rows),
    "",
    s.cancelApprovedOutro,
  ].join("\n")

  return {
    subject: fmtEmail(s.cancelApprovedSubject, { tour: data.tourTitle }),
    html: layout({ s, heading: s.cancelApprovedHeading, bodyHtml }),
    text,
  }
}

/** Staff declined a cancellation request: booking still stands. */
export function buildCancellationDeclinedEmail(
  data: CancellationEmailData,
): BuiltEmail {
  const s = getEmailStrings(data.locale)
  const rows: DetailRow[] = [
    { label: s.tourLabel, value: data.tourTitle },
    { label: s.dateLabel, value: data.tourDate },
    { label: s.bookingRefLabel, value: data.bookingRef },
  ]
  if (data.adminNote) rows.push({ label: s.adminNoteLabel, value: data.adminNote })

  const bodyHtml = [
    paragraph(fmtEmail(s.hi, { name: data.customerName })),
    paragraph(s.cancelDeclinedIntro),
    detailsTable(rows),
    mutedParagraph(s.cancelDeclinedOutro),
  ].join("\n")

  const text = [
    fmtEmail(s.hi, { name: data.customerName }),
    "",
    s.cancelDeclinedIntro,
    "",
    textDetails(rows),
    "",
    s.cancelDeclinedOutro,
  ].join("\n")

  return {
    subject: fmtEmail(s.cancelDeclinedSubject, { tour: data.tourTitle }),
    html: layout({ s, heading: s.cancelDeclinedHeading, bodyHtml }),
    text,
  }
}
