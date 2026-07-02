"use client"

import { createContext, useContext } from "react"
import type { Dictionary } from "@/lib/translations"
import type { Locale } from "@/lib/i18n"

type I18nValue = { locale: Locale; dict: Dictionary }

const I18nContext = createContext<I18nValue | null>(null)

/**
 * Provides the active locale and its UI dictionary to client components. The
 * dictionary is resolved on the server (from the locale cookie) and passed in
 * as a plain serializable object, so client components can translate without a
 * network round-trip.
 */
export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale
  dict: Dictionary
  children: React.ReactNode
}) {
  return (
    <I18nContext.Provider value={{ locale, dict }}>
      {children}
    </I18nContext.Provider>
  )
}

/** Access the UI dictionary inside a client component. */
export function useDict(): Dictionary {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error("useDict must be used within an I18nProvider")
  }
  return ctx.dict
}

/** Access the active locale inside a client component. */
export function useLocale(): Locale {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    throw new Error("useLocale must be used within an I18nProvider")
  }
  return ctx.locale
}
