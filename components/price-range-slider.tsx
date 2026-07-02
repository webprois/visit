"use client"

import { useCallback } from "react"

/**
 * A dual-handle range slider built from two overlaid native range inputs, with
 * a filled track between the handles. Values are clamped so the two handles
 * cannot cross. No external dependencies.
 */
export function PriceRangeSlider({
  min,
  max,
  value,
  onChange,
  step = 1,
}: {
  min: number
  max: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  step?: number
}) {
  const [low, high] = value
  const span = Math.max(1, max - min)
  const lowPct = ((low - min) / span) * 100
  const highPct = ((high - min) / span) * 100

  const setLow = useCallback(
    (v: number) => onChange([Math.min(v, high), high]),
    [high, onChange],
  )
  const setHigh = useCallback(
    (v: number) => onChange([low, Math.max(v, low)]),
    [low, onChange],
  )

  return (
    <div className="relative mx-2.5 h-5 select-none">
      {/* Base track */}
      <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-secondary" />
      {/* Filled range. Positions track the thumb centers, which the browser
          insets by half a thumb-width (0.625rem) at each extreme, so the fill
          never spills past the handles. */}
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
        style={{
          left: `calc(0.625rem + ${lowPct / 100} * (100% - 1.25rem))`,
          right: `calc(0.625rem + ${(100 - highPct) / 100} * (100% - 1.25rem))`,
        }}
      />
      {/* Low handle */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={low}
        onChange={(e) => setLow(Number(e.target.value))}
        className="range-thumb pointer-events-none absolute h-5 w-full appearance-none bg-transparent"
        aria-label="Minimum price"
      />
      {/* High handle */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={high}
        onChange={(e) => setHigh(Number(e.target.value))}
        className="range-thumb pointer-events-none absolute h-5 w-full appearance-none bg-transparent"
        aria-label="Maximum price"
      />

      <style jsx>{`
        .range-thumb::-webkit-slider-thumb {
          pointer-events: auto;
          appearance: none;
          height: 1.25rem;
          width: 1.25rem;
          border-radius: 9999px;
          background: var(--color-card, #fff);
          border: 2px solid var(--color-primary, #ec4647);
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .range-thumb::-webkit-slider-thumb:hover,
        .range-thumb::-webkit-slider-thumb:active {
          transform: scale(1.15);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
        }
        .range-thumb::-moz-range-thumb {
          pointer-events: auto;
          height: 1.25rem;
          width: 1.25rem;
          border-radius: 9999px;
          background: var(--color-card, #fff);
          border: 2px solid var(--color-primary, #ec4647);
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .range-thumb::-moz-range-thumb:hover,
        .range-thumb::-moz-range-thumb:active {
          transform: scale(1.15);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
        }
        .range-thumb::-webkit-slider-runnable-track {
          background: transparent;
        }
        .range-thumb::-moz-range-track {
          background: transparent;
        }
      `}</style>
    </div>
  )
}
