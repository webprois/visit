"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  asCurrency,
  convertFromIsk,
  formatMoney,
  type Currency,
  type IskRates,
} from "@/lib/currency"
import { setCurrency as persistCurrency } from "@/app/actions/currency"

type CurrencyContextValue = {
  currency: Currency
  rates: IskRates
  setCurrency: (next: Currency) => void
  /** Convert an ISK amount to the active currency (numeric). */
  convert: (amountIsk: number) => number
  /** Convert + format an ISK amount in the active currency. */
  format: (amountIsk: number) => string
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({
  initialCurrency,
  rates,
  children,
}: {
  initialCurrency: Currency
  rates: IskRates
  children: ReactNode
}) {
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency)

  const setCurrency = useCallback((next: Currency) => {
    const value = asCurrency(next)
    setCurrencyState(value)
    // Persist for future requests so SSR renders the right currency.
    void persistCurrency(value)
  }, [])

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      rates,
      setCurrency,
      convert: (amountIsk) => convertFromIsk(amountIsk, currency, rates),
      format: (amountIsk) =>
        formatMoney(convertFromIsk(amountIsk, currency, rates), currency),
    }),
    [currency, rates, setCurrency],
  )

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext)
  if (!ctx) {
    throw new Error("useCurrency must be used within a CurrencyProvider")
  }
  return ctx
}
