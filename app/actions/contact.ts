"use server"

import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"
import { contactMessage } from "@/lib/db/schema"

export type ContactInput = {
  fullName: string
  email: string
  phone?: string
  message: string
  locale?: string
}

export type ContactResult = { ok: boolean; error?: "invalid" | "server" }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function submitContactMessage(
  input: ContactInput,
): Promise<ContactResult> {
  const fullName = input.fullName?.trim()
  const email = input.email?.trim().toLowerCase()
  const phone = input.phone?.trim() || null
  const message = input.message?.trim()

  if (!fullName || !email || !EMAIL_RE.test(email) || !message) {
    return { ok: false, error: "invalid" }
  }

  try {
    await db.insert(contactMessage).values({
      id: randomUUID(),
      fullName,
      email,
      phone,
      message,
      locale: input.locale,
    })
    return { ok: true }
  } catch (err) {
    console.error("[v0] contact message failed:", err)
    return { ok: false, error: "server" }
  }
}
