"use server"

import { cookies } from "next/headers"
import { asCurrency, CURRENCY_COOKIE } from "@/lib/currency"

/** Persist the visitor's chosen currency for a year. */
export async function setCurrency(value: string) {
  const currency = asCurrency(value)
  const store = await cookies()
  store.set(CURRENCY_COOKIE, currency, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })
}
