/** Supported content languages across the site. English is the default. */
export const LOCALES = ["en", "es", "pt", "it"] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "en"

/** Native display names for each locale, used in the language switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
  it: "Italiano",
}

/** Short codes shown in compact UI (e.g. the header pill). */
export const LOCALE_SHORT: Record<Locale, string> = {
  en: "EN",
  es: "ES",
  pt: "PT",
  it: "IT",
}

/** Cookie name used to remember the visitor's chosen language. */
export const LOCALE_COOKIE = "locale"

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value)
}

export function asLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}
