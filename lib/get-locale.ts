import "server-only"
import { cookies } from "next/headers"
import { asLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n"

/** Read the visitor's chosen locale from the cookie (defaults to English). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies()
  return asLocale(store.get(LOCALE_COOKIE)?.value)
}
