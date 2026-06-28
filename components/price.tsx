"use client"

import { useCurrency } from "@/components/currency-provider"

/**
 * Render an ISK-based amount in the visitor's active currency. Falls back to
 * `fallback` (default "On request") when the amount is not a positive number.
 */
export function Price({
  isk,
  fallback = "On request",
}: {
  isk: number
  fallback?: string
}) {
  const { format } = useCurrency()
  if (!(isk > 0)) return <>{fallback}</>
  return <>{format(isk)}</>
}
