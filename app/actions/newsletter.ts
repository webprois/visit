"use server"

import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"
import { newsletterSubscriber } from "@/lib/db/schema"

export type SubscribeResult = { ok: boolean; error?: "invalid" | "server" }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function subscribeToNewsletter(
  email: string,
  locale?: string,
): Promise<SubscribeResult> {
  const value = email.trim().toLowerCase()
  if (!value || !EMAIL_RE.test(value)) {
    return { ok: false, error: "invalid" }
  }

  try {
    await db
      .insert(newsletterSubscriber)
      .values({ id: randomUUID(), email: value, locale })
      // Re-subscribing with the same email is a no-op success.
      .onConflictDoNothing({ target: newsletterSubscriber.email })
    return { ok: true }
  } catch (err) {
    console.error("[v0] newsletter subscribe failed:", err)
    return { ok: false, error: "server" }
  }
}
