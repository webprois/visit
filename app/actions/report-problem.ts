"use server"

import { assertAdmin } from "@/lib/require-auth"
import { sendEmail } from "@/lib/email/client"

/** Where admin problem reports are delivered. */
const REPORT_TO = "kristjan@visit.is"

export type ReportProblemInput = {
  message: string
  /** Public blob URL of an optional screenshot, uploaded before submit. */
  imageUrl?: string | null
  /** Original file name of the screenshot, shown in the email. */
  imageName?: string | null
  /** The admin page the reporter was on, for context. */
  pageUrl?: string | null
}

export type ReportProblemResult =
  | { ok: true }
  | { ok: false; error: string }

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Send an admin-submitted problem report to the support inbox. Requires an
 * admin session; the reporter's name/email is taken from the session (never
 * trusted from the client) and set as the reply-to so replies reach them.
 * The optional screenshot is uploaded to Blob first and referenced by URL.
 */
export async function reportProblem(
  input: ReportProblemInput,
): Promise<ReportProblemResult> {
  const session = await assertAdmin()

  const message = input.message?.trim()
  if (!message) {
    return { ok: false, error: "Please describe the problem." }
  }
  if (message.length > 5000) {
    return { ok: false, error: "Message is too long." }
  }

  const reporterName = session.user.name || "Unknown"
  const reporterEmail = session.user.email
  const safeMessage = escapeHtml(message).replace(/\n/g, "<br>")
  const pageLine = input.pageUrl
    ? `<p style="margin:0 0 4px;color:#555;font-size:13px;">Page: <a href="${escapeHtml(
        input.pageUrl,
      )}">${escapeHtml(input.pageUrl)}</a></p>`
    : ""
  const imageBlock =
    input.imageUrl && /^https:\/\//.test(input.imageUrl)
      ? `<div style="margin-top:16px;">
           <p style="margin:0 0 6px;color:#555;font-size:13px;">Attachment: ${escapeHtml(
             input.imageName || "screenshot",
           )}</p>
           <a href="${escapeHtml(input.imageUrl)}">
             <img src="${escapeHtml(
               input.imageUrl,
             )}" alt="Attached screenshot" style="max-width:100%;border-radius:8px;border:1px solid #e5e5e5;" />
           </a>
         </div>`
      : ""

  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;color:#111;line-height:1.5;">
    <h2 style="margin:0 0 12px;font-size:18px;">Problem report from the admin</h2>
    <p style="margin:0 0 4px;color:#555;font-size:13px;">From: ${escapeHtml(
      reporterName,
    )} (${escapeHtml(reporterEmail)})</p>
    ${pageLine}
    <div style="margin-top:16px;padding:16px;background:#f6f6f6;border-radius:8px;white-space:normal;">${safeMessage}</div>
    ${imageBlock}
  </body></html>`

  const text =
    `Problem report from the admin\n\n` +
    `From: ${reporterName} (${reporterEmail})\n` +
    (input.pageUrl ? `Page: ${input.pageUrl}\n` : "") +
    `\n${message}\n` +
    (input.imageUrl ? `\nAttachment: ${input.imageUrl}\n` : "")

  const result = await sendEmail({
    to: REPORT_TO,
    subject: `Admin problem report from ${reporterName}`,
    html,
    text,
    replyTo: reporterEmail,
  })

  if (!result.ok) {
    return { ok: false, error: "Could not send the report. Please try again." }
  }
  return { ok: true }
}
