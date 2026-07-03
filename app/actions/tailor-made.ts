"use server"

import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"
import { tailorMadeRequest } from "@/lib/db/schema"

export type TailorMadeInput = {
  fullName: string
  email: string
  phone?: string
  adults?: number | null
  children?: number | null
  tripDuration?: string
  travelDate?: string
  wantsActivities?: boolean | null
  wantsGuided?: boolean | null
  wantsRentalCar?: boolean | null
  accommodation?: string
  tourType?: string
  interests?: string
  otherInfo?: string
  howFound?: string
  locale?: string
}

export type TailorMadeResult = { ok: boolean; error?: "invalid" | "server" }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clampInt(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null
  return Math.max(0, Math.min(999, Math.trunc(value)))
}

export async function submitTailorMadeRequest(
  input: TailorMadeInput,
): Promise<TailorMadeResult> {
  const fullName = input.fullName?.trim()
  const email = input.email?.trim().toLowerCase()

  if (!fullName || !email || !EMAIL_RE.test(email)) {
    return { ok: false, error: "invalid" }
  }

  try {
    await db.insert(tailorMadeRequest).values({
      id: randomUUID(),
      fullName,
      email,
      phone: input.phone?.trim() || null,
      adults: clampInt(input.adults),
      children: clampInt(input.children),
      tripDuration: input.tripDuration?.trim() || null,
      travelDate: input.travelDate?.trim() || null,
      wantsActivities: input.wantsActivities ?? null,
      wantsGuided: input.wantsGuided ?? null,
      wantsRentalCar: input.wantsRentalCar ?? null,
      accommodation: input.accommodation?.trim() || null,
      tourType: input.tourType?.trim() || null,
      interests: input.interests?.trim() || null,
      otherInfo: input.otherInfo?.trim() || null,
      howFound: input.howFound?.trim() || null,
      locale: input.locale,
    })
    return { ok: true }
  } catch (err) {
    console.error("[v0] tailor-made request failed:", err)
    return { ok: false, error: "server" }
  }
}
