"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

/* ---------- date helpers (local, timezone-safe) ---------- */

export function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Parse a `yyyy-mm-dd` string into a local Date, or null if invalid. */
export function fromYmd(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? null : date
}

export function sameDay(a: Date, b: Date): boolean {
  return toYmd(a) === toYmd(b)
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function shortLabel(d: Date): string {
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`
}

/* ---------- two-month range calendar ---------- */

export function RangeCalendar({
  from,
  to,
  onChange,
}: {
  from: Date | null
  to: Date | null
  onChange: (from: Date | null, to: Date | null) => void
}) {
  const today = startOfDay(new Date())
  const [viewMonth, setViewMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )

  function handlePick(day: Date) {
    // No start yet, or a full range exists → start a new range.
    if (!from || (from && to)) {
      onChange(day, null)
      return
    }
    // Start exists, picking the end.
    if (day < from) {
      onChange(day, null)
    } else {
      onChange(from, day)
    }
  }

  const nextMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)
  const canGoPrev =
    viewMonth.getFullYear() > today.getFullYear() ||
    (viewMonth.getFullYear() === today.getFullYear() &&
      viewMonth.getMonth() > today.getMonth())

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            setViewMonth(
              new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
            )
          }
          disabled={!canGoPrev}
          aria-label="Previous month"
          className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() =>
            setViewMonth(
              new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
            )
          }
          aria-label="Next month"
          className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-secondary"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <MonthGrid
          month={viewMonth}
          today={today}
          from={from}
          to={to}
          onPick={handlePick}
        />
        <div className="hidden sm:block">
          <MonthGrid
            month={nextMonth}
            today={today}
            from={from}
            to={to}
            onPick={handlePick}
          />
        </div>
      </div>

      {/* Footer: selected range summary + clear */}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-sm text-muted-foreground">
          {from && to ? (
            <span className="text-foreground">
              {shortLabel(from)} – {shortLabel(to)}
            </span>
          ) : from ? (
            <>
              <span className="text-foreground">{shortLabel(from)}</span>
              {" — select an end date"}
            </>
          ) : (
            "Select your travel dates"
          )}
        </p>
        {(from || to) && (
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

function MonthGrid({
  month,
  today,
  from,
  to,
  onPick,
}: {
  month: Date
  today: Date
  from: Date | null
  to: Date | null
  onPick: (day: Date) => void
}) {
  const year = month.getFullYear()
  const m = month.getMonth()
  const firstWeekday = new Date(year, m, 1).getDay()
  const daysInMonth = new Date(year, m + 1, 0).getDate()

  const cells: (Date | null)[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, m, d))

  return (
    <div>
      <p className="mb-2 text-center font-heading text-base font-bold text-foreground">
        {MONTHS[m]} {year}
      </p>
      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="pb-1 text-center text-xs font-medium text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} aria-hidden="true" />
          const disabled = day < today
          const isFrom = from && sameDay(day, from)
          const isTo = to && sameDay(day, to)
          const inRange = from && to && day > from && day < to
          const isEdge = isFrom || isTo

          return (
            <div
              key={i}
              className={
                "flex justify-center " +
                (inRange || isEdge ? "bg-primary/10 " : "") +
                (isFrom && to ? "rounded-l-full " : "") +
                (isTo ? "rounded-r-full " : "")
              }
            >
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(day)}
                aria-label={`${MONTHS[m]} ${day.getDate()}, ${year}`}
                className={
                  "flex size-9 items-center justify-center rounded-full text-sm transition-colors " +
                  (disabled
                    ? "cursor-not-allowed text-muted-foreground/40 "
                    : "text-foreground hover:bg-primary/20 ") +
                  (isEdge
                    ? "bg-primary font-bold text-primary-foreground hover:bg-primary "
                    : "")
                }
              >
                {day.getDate()}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
