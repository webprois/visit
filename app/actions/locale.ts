"use server"

import { cookies, headers } from "next/headers"
import { asLocale, LOCALE_COOKIE } from "@/lib/i18n"

/** Persist the visitor's chosen language for a year. */
export async function setLocale(value: string) {
  const locale = asLocale(value)
  const [store, headerList] = await Promise.all([cookies(), headers()])

  // Use SameSite=None + Secure so the preference is stored and sent even when
  // the site is embedded in a cross-site iframe (e.g. the v0/Vercel preview).
  // Lax cookies are dropped in that context, which made the language switch
  // appear to do nothing. We must fall back to Lax on plain-http origins,
  // since browsers reject SameSite=None without Secure. Detect the real scheme
  // from the forwarded protocol so it works behind the preview's HTTPS proxy
  // even while the dev server itself runs over http.
  const proto =
    headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "http"
  const isSecure = proto === "https"

  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: isSecure ? "none" : "lax",
    secure: isSecure,
  })
}
