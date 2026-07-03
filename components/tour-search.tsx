"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Calendar,
  User,
  ChevronDown,
  ChevronUp,
  Check,
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
  Bird,
  Bus,
  Zap,
  Compass,
  TreePine,
  Palette,
  MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { RangeCalendar, toYmd, shortLabel } from "@/components/range-calendar"
import { useDict } from "@/components/i18n-provider"
import { fmt } from "@/lib/translations"

export type Experience = { slug: string; label: string }

/* ---------- experience icon mapping ---------- */

function experienceIcon(label: string) {
  const l = label.toLowerCase()
  if (l.includes("northern light")) return Snowflake
  if (l.includes("ice") || l.includes("glacier")) return Mountain
  if (l.includes("bus") || l.includes("minivan") || l.includes("minibus"))
    return Bus
  if (l.includes("self drive") || l.includes("car") || l.includes("super jeep"))
    return Car
  if (l.includes("hik") || l.includes("walk") || l.includes("trek"))
    return Footprints
  if (l.includes("sightsee")) return Binoculars
  if (l.includes("bird")) return Bird
  if (l.includes("whale")) return Fish
  if (l.includes("snorkel") || l.includes("div") || l.includes("raft") || l.includes("kayak"))
    return Waves
  if (l.includes("boat") || l.includes("ferry") || l.includes("sail")) return Ship
  if (l.includes("snowmobile") || l.includes("hot spring") || l.includes("spa") || l.includes("wellness"))
    return Sparkles
  if (l.includes("photo")) return Camera
  if (l.includes("food") || l.includes("drink") || l.includes("culinary"))
    return Utensils
  if (l.includes("art") || l.includes("culture") || l.includes("museum"))
    return Palette
  if (l.includes("city")) return Building2
  if (l.includes("adrenaline") || l.includes("extreme")) return Zap
  if (l.includes("nature") || l.includes("wildlife")) return TreePine
  if (l.includes("horse") || l.includes("bike") || l.includes("cycl")) return Bike
  if (l.includes("adventure") || l.includes("explor")) return Compass
  return MapPin
}

/* ---------- main widget ---------- */

export function TourSearch({ experiences }: { experiences: Experience[] }) {
  const router = useRouter()
  const dict = useDict()
  // Multi-select: the set of chosen experiences. Empty = "Any experience".
  const [selected, setSelected] = useState<Experience[]>([])
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

  // Add or remove an experience from the current selection.
  function toggleExperience(exp: Experience) {
    setSelected((prev) =>
      prev.some((e) => e.slug === exp.slug)
        ? prev.filter((e) => e.slug !== exp.slug)
        : [...prev, exp],
    )
  }

  function onSearch() {
    const params = new URLSearchParams()
    if (selected.length > 0)
      params.set("experience", selected.map((e) => e.slug).join(","))
    if (from) params.set("from", toYmd(from))
    if (to ?? from) params.set("to", toYmd(to ?? (from as Date)))
    params.set("adults", String(adults))
    params.set("children", String(children))
    router.push(`/tours?${params.toString()}`)
  }

  const travelersLabel = (() => {
    const total = adults + children
    return fmt(total === 1 ? dict.search.traveler : dict.search.travelers, {
      count: total,
    })
  })()

  const experienceLabel =
    selected.length === 0
      ? dict.search.experiencePlaceholder
      : selected.length === 1
        ? selected[0].label
        : fmt(dict.search.experiencesSelected, { count: selected.length })

  const datesLabel =
    from && to
      ? `${shortLabel(from)} - ${shortLabel(to)}`
      : from
        ? shortLabel(from)
        : null

  return (
    <div
      ref={rootRef}
          className="relative z-40 w-full rounded-2xl bg-[#181F2D]/95 p-4 shadow-xl backdrop-blur md:p-5"
    >
      <div className="grid gap-3 md:grid-cols-[1.3fr_1.3fr_1fr_auto]">
        {/* Experience */}
        <div className="relative flex flex-col gap-1.5">
          <span className="px-1 text-xs font-semibold text-muted-foreground">
            {dict.search.experienceLabel}
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
                (selected.length > 0 ? "text-foreground" : "text-muted-foreground")
              }
            >
              {experienceLabel}
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
                onClick={() => setSelected([])}
                className={
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-base hover:bg-secondary/60 " +
                  (selected.length === 0 ? "bg-secondary/60 font-semibold" : "")
                }
              >
                <Search className="size-5 shrink-0 text-primary" aria-hidden="true" />
                {dict.search.anyExperience}
              </button>
              {[...experiences]
                .sort((a, b) => a.label.localeCompare(b.label, "is"))
                .map((exp) => {
                const Icon = experienceIcon(exp.label)
                const active = selected.some((e) => e.slug === exp.slug)
                return (
                  <button
                    key={exp.slug}
                    type="button"
                    onClick={() => toggleExperience(exp)}
                    aria-pressed={active}
                    className={
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-base hover:bg-secondary/60 " +
                      (active ? "bg-secondary/60 font-semibold" : "")
                    }
                  >
                    <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="flex-1 truncate">{exp.label}</span>
                    {active && (
                      <Check
                        className="size-5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Dates */}
        <div className="relative flex flex-col gap-1.5">
          <span className="px-1 text-xs font-semibold text-muted-foreground">
            {dict.search.datesLabel}
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
              {datesLabel ?? dict.search.datesPlaceholder}
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
            {dict.search.travelersLabel}
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
                label={dict.search.adults}
                value={adults}
                min={1}
                onChange={setAdults}
              />
              <div className="my-3 h-px bg-border" />
              <Stepper
                label={dict.search.children}
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
            {dict.search.searchNow}
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
            className="flex size-10 items-center justify-center rounded-full bg-foreground/10 text-foreground transition-colors hover:bg-foreground/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Minus className="size-5" strokeWidth={2.5} aria-hidden="true" />
        </button>
        <span className="w-5 text-center text-base font-semibold tabular-nums text-foreground">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`Increase ${label.toLowerCase()}`}
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Plus className="size-5" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
