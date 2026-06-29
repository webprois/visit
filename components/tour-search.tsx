"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Snowflake,
  Mountain,
  Car,
  Footprints,
  Binoculars,
  Waves,
  Fish,
  Sparkles,
  Ship,
  Camera,
  Utensils,
  Building2,
  Bike,
  MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export type Experience = { slug: string; label: string }

/* ---------- date helpers (local, timezone-safe) ---------- */

function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function sameDay(a: Date, b: Date): boolean {
  return toYmd(a) === toYmd(b)
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function shortLabel(d: Date): string {
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`
}

/* ---------- experience icon mapping ---------- */

function experienceIcon(label: string) {
  const l = label.toLowerCase()
  if (l.includes("northern light")) return Snowflake
  if (l.includes("ice") || l.includes("glacier")) return Mountain
  if (l.includes("self drive") || l.includes("car") || l.includes("super jeep"))
    return Car
  if (l.includes("hik") || l.includes("walk")) return Footprints
  if (l.includes("sightsee")) return Binoculars
  if (l.includes("whale") || l.includes("bird")) return Fish
  if (l.includes("snorkel") || l.includes("div") || l.includes("raft") || l.includes("kayak"))
    return Waves
  if (l.includes("boat") || l.includes("ferry") || l.includes("sail")) return Ship
  if (l.includes("snowmobile") || l.includes("hot spring") || l.includes("spa") || l.includes("wellness"))
    return Sparkles
  if (l.includes("photo")) return Camera
  if (l.includes("food") || l.includes("drink")) return Utensils
  if (l.includes("city") || l.includes("culture")) return Building2
  if (l.includes("horse") || l.includes("bike") || l.includes("cycl")) return Bike
  return MapPin
}

/* ---------- main widget ---------- */

export function TourSearch({ experiences }: { experiences: Experience[] }) {
  const router = useRouter()
  const [experience, setExperience] = useState<Experience | null>(null)
  const [from, setFrom] = useState<Date | null>(null)
  const [to, setTo] = useState<Date | null>(null)
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [openPanel, setOpenPanel] = useState<"exp" | "dates" | "pax" | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)

  // Close any open panel on outside click or Escape.
  useEffect(() => {
    if (!openPanel) return
    function onPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenPanel(null)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenPanel(null)
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [openPanel])

  function toggle(panel: "exp" | "dates" | "pax") {
    setOpenPanel((p) => (p === panel ? null : panel))
  }

  function onSearch() {
    const params = new URLSearchParams()
    if (experience) params.set("experience", experience.slug)
    if (from) params.set("from", toYmd(from))
    if (to ?? from) params.set("to", toYmd(to ?? (from as Date)))
    params.set("adults", String(adults))
    params.set("children", String(children))
    router.push(`/tours?${params.toString()}`)
  }

  const travelersLabel = (() => {
    const total = adults + children
    return `${total} ${total === 1 ? "traveler" : "travelers"}`
  })()

  const datesLabel =
    from && to
      ? `${shortLabel(from)} – ${shortLabel(to)}`
      : from
        ? shortLabel(from)
        : null

  return (
    <div
      ref={rootRef}
          className="relative z-40 w-full rounded-2xl border border-border/60 bg-[#181F2D]/95 p-4 shadow-xl backdrop-blur md:p-5"
    >
      <div className="grid gap-3 md:grid-cols-[1.3fr_1.3fr_1fr_auto]">
        {/* Experience */}
        <div className="relative flex flex-col gap-1.5">
          <span className="px-1 text-xs font-semibold text-muted-foreground">
            Choose your perfect Icelandic experience
          </span>
          <button
            type="button"
            onClick={() => toggle("exp")}
            aria-expanded={openPanel === "exp"}
            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
          >
            <span
              className={
                "truncate text-base " +
                (experience ? "text-foreground" : "text-muted-foreground")
              }
            >
              {experience?.label ?? "Choose an experience"}
            </span>
            {openPanel === "exp" ? (
              <ChevronUp className="size-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-primary" aria-hidden="true" />
            )}
          </button>

          {openPanel === "exp" && (
            <div className="absolute left-0 top-full z-30 mt-1 max-h-80 w-[min(92vw,26rem)] overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setExperience(null)
                  setOpenPanel(null)
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-base hover:bg-secondary/60"
              >
                <Search className="size-5 shrink-0 text-primary" aria-hidden="true" />
                Any experience
              </button>
              {[...experiences]
                .sort((a, b) => a.label.localeCompare(b.label, "is"))
                .map((exp) => {
                const Icon = experienceIcon(exp.label)
                const active = experience?.slug === exp.slug
                return (
                  <button
                    key={exp.slug}
                    type="button"
                    onClick={() => {
                      setExperience(exp)
                      setOpenPanel(null)
                    }}
                    className={
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-base hover:bg-secondary/60 " +
                      (active ? "bg-secondary/60 font-semibold" : "")
                    }
                  >
                    <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                    {exp.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="relative flex flex-col gap-1.5">
          <span className="px-1 text-xs font-semibold text-muted-foreground">
            Select dates
          </span>
          <button
            type="button"
            onClick={() => toggle("dates")}
            aria-expanded={openPanel === "dates"}
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
          >
            <Calendar className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span
              className={
                "truncate text-base " +
                (datesLabel ? "text-foreground" : "text-muted-foreground")
              }
            >
              {datesLabel ?? "Starting date — Final date"}
            </span>
          </button>

          {openPanel === "dates" && (
            <div className="absolute left-0 top-full z-30 mt-1 w-[min(94vw,44rem)] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl md:p-4">
              <RangeCalendar
                from={from}
                to={to}
                onChange={(f, t) => {
                  setFrom(f)
                  setTo(t)
                  if (f && t) setOpenPanel(null)
                }}
              />
            </div>
          )}
        </div>

        {/* Travelers */}
        <div className="relative flex flex-col gap-1.5">
          <span className="px-1 text-xs font-semibold text-muted-foreground">
            Add travelers
          </span>
          <button
            type="button"
            onClick={() => toggle("pax")}
            aria-expanded={openPanel === "pax"}
            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
          >
            <span className="flex items-center gap-2 text-base text-foreground">
              <User className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {travelersLabel}
            </span>
            {openPanel === "pax" ? (
              <ChevronUp className="size-4 shrink-0 text-primary" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-primary" aria-hidden="true" />
            )}
          </button>

          {openPanel === "pax" && (
            <div className="absolute left-0 top-full z-30 mt-1 w-[min(90vw,20rem)] rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-2xl">
              <Stepper
                label="Adults"
                value={adults}
                min={1}
                onChange={setAdults}
              />
              <div className="my-3 h-px bg-border" />
              <Stepper
                label="Children"
                value={children}
                min={0}
                onChange={setChildren}
              />
            </div>
          )}
        </div>

        {/* Search */}
        <div className="flex flex-col justify-end">
          <Button
            size="lg"
            onClick={onSearch}
            className="h-[46px] rounded-xl text-base font-bold md:px-8"
          >
            <Search className="size-5" aria-hidden="true" />
            Search Now
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------- travelers stepper ---------- */

function Stepper({
  label,
  value,
  min,
  onChange,
}: {
  label: string
  value: number
  min: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-base font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="flex size-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span className="w-5 text-center text-base font-semibold tabular-nums text-foreground">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label.toLowerCase()}`}
          className="flex size-9 items-center justify-center rounded-full border border-primary/40 text-primary transition-colors hover:bg-primary/10"
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/* ---------- two-month range calendar ---------- */

function RangeCalendar({
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
          const inRange =
            from && to && day > from && day < to
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
