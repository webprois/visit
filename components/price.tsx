"use client"

import { useCurrency } from "@/components/currency-provider"
import { formatMoney } from "@/lib/currency"

/**
 * Render an ISK-based amount in the visitor's active currency. Falls back to
 * `fallback` (default "On request") when the amount is not a positive number.
 *
 * When `showIskBelow` is set and the active currency isn't already ISK, the
 * exact ISK amount (what actually gets charged) is shown underneath in
 * parentheses. Used on the final booking step so customers see the amount
 * they'll be billed in ISK.
 */
export function Price({
  isk,
  fallback = "On request",
  showIskBelow = false,
}: {
  isk: number
  fallback?: string
  showIskBelow?: boolean
}) {
  const { format, currency } = useCurrency()
  if (!(isk > 0)) return <>{fallback}</>
  if (showIskBelow && currency !== "ISK") {
    return (
      <span className="flex flex-col items-end leading-tight">
        <span>{format(isk)}</span>
        <span className="text-sm font-normal text-muted-foreground">
          ({formatMoney(isk, "ISK")})
        </span>
      </span>
    )
  }
  return <>{format(isk)}</>
}
