"use client"

import { Coins } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { useCurrency } from "@/components/currency-provider"
import {
  CURRENCIES,
  CURRENCY_LABELS,
  CURRENCY_SHORT,
  isCurrency,
} from "@/lib/currency"

export function CurrencySwitcher() {
  const { currency, setCurrency } = useCurrency()

  function onChange(value: string | null) {
    if (!value || value === currency || !isCurrency(value)) return
    setCurrency(value)
  }

  return (
    <Select value={currency} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Select currency"
        className="h-9 w-auto gap-1.5 border-border bg-transparent px-2.5"
      >
        <Coins className="size-4" aria-hidden="true" />
        <span className="text-sm font-medium">{CURRENCY_SHORT[currency]}</span>
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (
          <SelectItem key={c} value={c}>
            {CURRENCY_LABELS[c]} ({CURRENCY_SHORT[c]})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
