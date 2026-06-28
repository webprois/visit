import "server-only"
import { cookies } from "next/headers"
import { asCurrency, CURRENCY_COOKIE, type Currency } from "@/lib/currency"

/** Read the visitor's chosen currency from the cookie (defaults to EUR). */
export async function getCurrency(): Promise<Currency> {
  const store = await cookies()
  return asCurrency(store.get(CURRENCY_COOKIE)?.value)
}
