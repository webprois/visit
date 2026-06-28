import "server-only"
import { FALLBACK_RATES, type IskRates } from "@/lib/currency"

/**
 * Fetch live ISK→EUR/USD exchange rates from the free Frankfurter API
 * (ECB data, no API key). Cached for 24 hours via the Next.js fetch cache.
 * Falls back to fixed rates if the request fails so prices always render.
 */
export async function getExchangeRates(): Promise<IskRates> {
  try {
    const res = await fetch(
      "https://api.frankfurter.app/latest?base=ISK&symbols=EUR,USD",
      { next: { revalidate: 60 * 60 * 24 } },
    )
    if (!res.ok) return FALLBACK_RATES
    const data = (await res.json()) as { rates?: Record<string, number> }
    const eur = data.rates?.EUR
    const usd = data.rates?.USD
    if (typeof eur !== "number" || typeof usd !== "number") {
      return FALLBACK_RATES
    }
    return { ISK: 1, EUR: eur, USD: usd }
  } catch {
    return FALLBACK_RATES
  }
}
