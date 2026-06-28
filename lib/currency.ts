/** Currencies the visitor can switch between. EUR is the site default. */
export const CURRENCIES = ["EUR", "USD", "ISK"] as const

export type Currency = (typeof CURRENCIES)[number]

/** Default display currency. Bokun prices arrive in ISK; we show EUR by default. */
export const DEFAULT_CURRENCY: Currency = "EUR"

/** Cookie name used to remember the visitor's chosen currency. */
export const CURRENCY_COOKIE = "currency"

/** Labels for the currency switcher dropdown. */
export const CURRENCY_LABELS: Record<Currency, string> = {
  EUR: "Euro",
  USD: "US Dollar",
  ISK: "Icelandic Króna",
}

/** Short codes / symbols shown in compact UI (e.g. the header pill). */
export const CURRENCY_SHORT: Record<Currency, string> = {
  EUR: "EUR",
  USD: "USD",
  ISK: "ISK",
}

/**
 * Conversion rates FROM 1 ISK to the target currency. EUR/USD are multiplied
 * against an ISK amount. ISK is always 1. These are sensible fallbacks used
 * when the live exchange-rate API is unavailable.
 */
export type IskRates = Record<Currency, number>

export const FALLBACK_RATES: IskRates = {
  ISK: 1,
  EUR: 0.0066,
  USD: 0.0072,
}

export function isCurrency(value: string | undefined | null): value is Currency {
  return !!value && (CURRENCIES as readonly string[]).includes(value)
}

export function asCurrency(value: string | undefined | null): Currency {
  return isCurrency(value) ? value : DEFAULT_CURRENCY
}

/** Convert an ISK amount into the target currency using the given rates. */
export function convertFromIsk(
  amountIsk: number,
  currency: Currency,
  rates: IskRates,
): number {
  if (currency === "ISK") return amountIsk
  return amountIsk * (rates[currency] ?? FALLBACK_RATES[currency])
}

const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })

/**
 * Format a converted amount for display. ISK uses the Icelandic "21.990 kr."
 * style (period as the thousands separator); EUR and USD use their currency
 * symbol (e.g. "€145", "$160"). Amounts are rounded to whole units for clean
 * "from" pricing.
 */
export function formatMoney(amount: number, currency: Currency): string {
  const rounded = Math.round(amount)
  if (currency === "ISK") {
    // Force a period thousands separator regardless of the runtime's locale
    // data, e.g. 21990 -> "21.990 kr.".
    const grouped = Math.round(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    return `${grouped} kr.`
  }
  const symbol = currency === "EUR" ? "€" : "$"
  return `${symbol}${wholeNumber.format(rounded)}`
}

/** Convenience: convert an ISK amount and format it in one step. */
export function formatFromIsk(
  amountIsk: number,
  currency: Currency,
  rates: IskRates,
): string {
  return formatMoney(convertFromIsk(amountIsk, currency, rates), currency)
}
