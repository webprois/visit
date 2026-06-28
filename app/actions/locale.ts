"use server"

import { cookies } from "next/headers"
import { asLocale, LOCALE_COOKIE } from "@/lib/i18n"

/** Persist the visitor's chosen language for a year. */
export async function setLocale(value: string) {
  const locale = asLocale(value)
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  })
}
