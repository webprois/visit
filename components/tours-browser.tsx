"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { MergedTour } from "@/lib/tours"
import { tourBlurb } from "@/lib/tour-blurb"
import type { TourCategory } from "@/lib/db/schema"
import { getCategoryIcon } from "@/lib/category-icons"
import { Price } from "@/components/price"
import { PriceRangeSlider } from "@/components/price-range-slider"
import { useDict } from "@/components/i18n-provider"
import { fmt, type Dictionary } from "@/lib/translations"
import {
  RangeCalendar,
  toYmd,
  fromYmd,
  shortLabel,
} from "@/components/range-calendar"
import {
  Clock,
  MapPin,
  Star,
  Search,
  SlidersHorizontal,
  Calendar,
  User,
  ChevronUp,
  ChevronDown,
  Minus,
  Plus,
  X,
} from "lucide-react"

/** Rank difficulty labels so chips render easiest → hardest. */
function difficultyRank(d: string): number {
  const order = ["easy", "moderate", "challenging", "difficult", "hard", "extreme"]
  const i = order.indexOf(d.trim().toLowerCase())
  return i === -1 ? order.length : i
}


/**
 * Map a tour's free-text duration (e.g. "8 hours", "1 day", "3 days") to a
 * day bucket: 1 means a single-day/"Day tour", N (>1) means an N-day tour.
 * Anything measured only in hours/minutes counts as a day tour.
 */
function durationBucket(duration: string): number {
  const dayMatch = duration.toLowerCase().match(/(\d+)\s*day/)
  if (dayMatch) return Math.max(1, Number(dayMatch[1]))
  return 1
}

function durationLabel(bucket: number, dict: Dictionary): string {
  return bucket <= 1
    ? dict.browser.dayTour
    : fmt(dict.browser.days, { count: bucket })
}

export function ToursBrowser({
  tours,
  categories,
  initialCategoryId = null,
  initialCategoryIds,
}: {
  tours: MergedTour[]
  categories: TourCategory[]
  initialCategoryId?: number | null
  /** Multi-select seed; takes precedence over `initialCategoryId` when given. */
  initialCategoryIds?: number[]
}) {
  const router = useRouter()
  const dict = useDict()
  const searchParams = useSearchParams()
  // Current travel-date search context (server-side availability filter).
  const dateFrom = searchParams.get("from") ?? ""
  const dateTo = searchParams.get("to") ?? ""
  const hasDateSearch = /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)
  const fromDate = fromYmd(dateFrom)
  const toDate = fromYmd(dateTo)
  const datesLabel =
    fromDate && toDate
      ? `${shortLabel(fromDate)} - ${shortLabel(toDate)}`
      : fromDate
        ? shortLabel(fromDate)
        : null

  // Single-field calendar popover (mirrors the home search widget). The
  // calendar is portaled to the body with fixed positioning so it escapes the
  // sidebar's scroll/clip container instead of being cut off at its edge.
  const [dateOpen, setDateOpen] = useState(false)
  const dateBtnRef = useRef<HTMLButtonElement>(null)
  const datePopRef = useRef<HTMLDivElement>(null)
  const [datePos, setDatePos] = useState<{
    top: number
    left: number
    width: number
  }>({
    top: 0,
    left: 0,
    width: 0,
  })
  // Draft range while picking. We only commit to the URL once a FULL range is
  // chosen, so the first click doesn't trigger a navigation that would close
  // the popover before the end date can be picked.
  const [draftFrom, setDraftFrom] = useState<Date | null>(fromDate)
  const [draftTo, setDraftTo] = useState<Date | null>(toDate)

  // Position the calendar under the trigger. The two-month calendar needs more
  // room than the narrow sidebar button, so give the popover a comfortable
  // width (enough for both months) but never wider than the viewport. On small
  // screens it falls back to the trigger width, where the calendar shows a
  // single month.
  function positionDatePopover() {
    const btn = dateBtnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const vw = window.innerWidth
    // Two months (~252px each) + gap + padding above the `sm` breakpoint; below
    // it the calendar renders a single month, so use nearly the full viewport
    // width. Never wider than the viewport.
    const desired = vw >= 640 ? 600 : vw - 24
    const width = Math.min(desired, vw - 24)
    const left = Math.min(Math.max(12, r.left), vw - width - 12)
    setDatePos({ top: r.bottom + 8, left, width })
  }

  function openDatePopover() {
    positionDatePopover()
    // Sync the draft to whatever is currently committed in the URL.
    setDraftFrom(fromDate)
    setDraftTo(toDate)
    setDateOpen((o) => !o)
  }

  // Called by the calendar on every pick. Update the draft; once a complete
  // range exists, commit it to the URL and close.
  function handleCalendarChange(from: Date | null, to: Date | null) {
    setDraftFrom(from)
    setDraftTo(to)
    if (from && to) {
      applyDates(from, to)
      setDateOpen(false)
    } else if (!from && !to) {
      // "Clear" inside the calendar removes any committed date search.
      if (hasDateSearch) clearDates()
    }
  }

  useEffect(() => {
    if (!dateOpen) return
    function onPointer(e: PointerEvent) {
      const t = e.target as Node
      if (
        !dateBtnRef.current?.contains(t) &&
        !datePopRef.current?.contains(t)
      ) {
        setDateOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDateOpen(false)
    }
    // Keep the popover pinned to the trigger while the page/sidebar scrolls
    // instead of letting it float away detached from the button.
    function onReflow() {
      positionDatePopover()
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    window.addEventListener("resize", onReflow)
    window.addEventListener("scroll", onReflow, true)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", onReflow)
      window.removeEventListener("scroll", onReflow, true)
    }
  }, [dateOpen])

  // Current travelers context (only affects availability when dates are set).
  const urlAdults = Math.max(1, Number(searchParams.get("adults")) || 1)
  const urlChildren = Math.max(0, Number(searchParams.get("children")) || 0)
  const urlPax = urlAdults + urlChildren
  const travelersLabel = fmt(
    urlPax === 1 ? dict.browser.traveler : dict.browser.travelers2,
    { count: urlPax },
  )

  // Travelers popover (mirrors the home search widget). Portaled like the
  // calendar so it isn't clipped by the sidebar's scroll container. We keep a
  // local draft while stepping and only commit to the URL when it closes, so
  // the popover doesn't re-mount (and close) on every +/- tap.
  const [paxOpen, setPaxOpen] = useState(false)
  const paxBtnRef = useRef<HTMLButtonElement>(null)
  const paxPopRef = useRef<HTMLDivElement>(null)
  const [paxPos, setPaxPos] = useState<{
    top: number
    left: number
    width: number
  }>({
    top: 0,
    left: 0,
    width: 0,
  })
  const [draftAdults, setDraftAdults] = useState(urlAdults)
  const [draftChildren, setDraftChildren] = useState(urlChildren)

  function positionPaxPopover() {
    const btn = paxBtnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const left = Math.min(Math.max(12, r.left), window.innerWidth - r.width - 12)
    setPaxPos({ top: r.bottom + 8, left, width: r.width })
  }

  function openPaxPopover() {
    positionPaxPopover()
    setDraftAdults(urlAdults)
    setDraftChildren(urlChildren)
    setPaxOpen((o) => !o)
  }

  // Commit the draft party size to the URL, only navigating when it changed.
  function commitPax(adults: number, children: number) {
    if (adults === urlAdults && children === urlChildren) return
    const params = new URLSearchParams(searchParams.toString())
    if (adults > 1) params.set("adults", String(adults))
    else params.delete("adults")
    if (children > 0) params.set("children", String(children))
    else params.delete("children")
    router.push(`/tours?${params.toString()}`)
  }

  function closePax() {
    setPaxOpen(false)
    commitPax(draftAdults, draftChildren)
  }

  useEffect(() => {
    if (!paxOpen) return
    function onPointer(e: PointerEvent) {
      const t = e.target as Node
      if (!paxBtnRef.current?.contains(t) && !paxPopRef.current?.contains(t)) {
        closePax()
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closePax()
    }
    function onReflow() {
      positionPaxPopover()
    }
    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)
    window.addEventListener("resize", onReflow)
    window.addEventListener("scroll", onReflow, true)
    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("resize", onReflow)
      window.removeEventListener("scroll", onReflow, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paxOpen, draftAdults, draftChildren])

  const [query, setQuery] = useState("")
  // Selected category ids (multi-select). Empty = no activity filter.
  const [activeCategories, setActiveCategories] = useState<Set<number>>(
    () =>
      new Set(
        initialCategoryIds && initialCategoryIds.length > 0
          ? initialCategoryIds
          : initialCategoryId != null
            ? [initialCategoryId]
            : [],
      ),
  )
  // Selected starting location ids (multi-select). Empty = no location filter.
  const [activeLocations, setActiveLocations] = useState<Set<number>>(new Set())
  // Selected duration buckets (multi-select). Empty = no duration filter.
  const [activeDurations, setActiveDurations] = useState<Set<number>>(new Set())
  // Selected difficulty labels (multi-select). Empty = no difficulty filter.
  const [activeDifficulties, setActiveDifficulties] = useState<Set<string>>(
    new Set(),
  )
  // Search-within-filter text for the two long lists.
  const [activitySearch, setActivitySearch] = useState("")
  const [locationSearch, setLocationSearch] = useState("")
  // Mobile filter drawer visibility.
  const [showFilters, setShowFilters] = useState(false)

  // Price bounds across all tours (ISK). Used to seed the slider.
  const priceBounds = useMemo(() => {
    const prices = tours.map((t) => t.price).filter((p) => p > 0)
    if (prices.length === 0) return { min: 0, max: 0 }
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }, [tours])
  const [priceRange, setPriceRange] = useState<[number, number]>([
    priceBounds.min,
    priceBounds.max,
  ])
  const priceActive =
    priceRange[0] > priceBounds.min || priceRange[1] < priceBounds.max

  // Only show categories ("activities") that actually have visible tours.
  const usedCategoryIds = useMemo(
    () => new Set(tours.flatMap((t) => t.categoryIds)),
    [tours],
  )
  const availableCategories = useMemo(
    () =>
      categories
        .filter((c) => usedCategoryIds.has(c.id))
        .sort((a, b) =>
          (a.nameEn?.trim() || a.name).localeCompare(
            b.nameEn?.trim() || b.name,
          ),
        ),
    [categories, usedCategoryIds],
  )

  // Only show locations that actually have visible tours, ordered by first
  // appearance (which follows the locations' sortOrder).
  const availableLocations = useMemo(() => {
    const byId = new Map<number, string>()
    for (const t of tours) {
      t.locationIds.forEach((id, i) => {
        if (!byId.has(id)) byId.set(id, t.locationNames[i] ?? "")
      })
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name }))
  }, [tours])

  // The full ladder of duration buckets present across all tours, ascending.
  const allDurationBuckets = useMemo(() => {
    const set = new Set(tours.map((t) => durationBucket(t.duration)))
    return [...set].sort((a, b) => a - b)
  }, [tours])

  // Distinct difficulty labels present across all tours, easiest → hardest.
  const allDifficulties = useMemo(() => {
    const set = new Set<string>()
    for (const t of tours) {
      const d = t.difficulty?.trim()
      if (d) set.add(d)
    }
    return [...set].sort((a, b) => difficultyRank(a) - difficultyRank(b))
  }, [tours])

  function toggleSet(
    setter: React.Dispatch<React.SetStateAction<Set<number>>>,
    id: number,
  ) {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleDifficulty(label: string) {
    setActiveDifficulties((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  // Navigate to update the server-side travel-date availability filter,
  // preserving the current experience/category context in the URL. Called by
  // the calendar with Date objects; a full range closes the popover.
  function applyDates(from: Date | null, to: Date | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (from) params.set("from", toYmd(from))
    else params.delete("from")
    if (from && to) params.set("to", toYmd(to))
    else params.delete("to")
    router.push(`/tours?${params.toString()}`)
    if (from && to) setDateOpen(false)
  }

  function clearDates() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("from")
    params.delete("to")
    router.push(`/tours?${params.toString()}`)
  }

  function clearAll() {
    setQuery("")
    setActiveCategories(new Set())
    setActiveLocations(new Set())
    setActiveDurations(new Set())
    setActiveDifficulties(new Set())
    setActivitySearch("")
    setLocationSearch("")
    setPriceRange([priceBounds.min, priceBounds.max])
    setDraftAdults(1)
    setDraftChildren(0)
    // Remove every URL-driven search param (dates + travelers) in one push.
    if (hasDateSearch || urlPax > 1) {
      const params = new URLSearchParams(searchParams.toString())
      params.delete("from")
      params.delete("to")
      params.delete("adults")
      params.delete("children")
      router.push(`/tours?${params.toString()}`)
    }
  }

  const activeFilterCount =
    activeCategories.size +
    activeLocations.size +
    activeDurations.size +
    activeDifficulties.size +
    (priceActive ? 1 : 0) +
    (hasDateSearch ? 1 : 0) +
    (urlPax > 1 ? 1 : 0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tours.filter((t) => {
      const matchesCategory =
        activeCategories.size === 0 ||
        t.categoryIds.some((id) => activeCategories.has(id))
      const matchesLocation =
        activeLocations.size === 0 ||
        t.locationIds.some((id) => activeLocations.has(id))
      const matchesDuration =
        activeDurations.size === 0 ||
        activeDurations.has(durationBucket(t.duration))
      const matchesDifficulty =
        activeDifficulties.size === 0 ||
        (t.difficulty != null && activeDifficulties.has(t.difficulty.trim()))
      const matchesPrice =
        !priceActive ||
        t.price === 0 ||
        (t.price >= priceRange[0] && t.price <= priceRange[1])
      const matchesQuery =
        q === "" ||
        t.title.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q)
      return (
        matchesCategory &&
        matchesLocation &&
        matchesDuration &&
        matchesDifficulty &&
        matchesPrice &&
        matchesQuery
      )
    })
  }, [
    tours,
    query,
    activeCategories,
    activeLocations,
    activeDurations,
    activeDifficulties,
    priceActive,
    priceRange,
  ])

  // Duration buckets that still have results given every other active filter,
  // so we can grey out buckets that would yield nothing.
  const enabledDurationBuckets = useMemo(() => {
    const q = query.trim().toLowerCase()
    const set = new Set<number>()
    for (const t of tours) {
      const matchesCategory =
        activeCategories.size === 0 ||
        t.categoryIds.some((id) => activeCategories.has(id))
      const matchesLocation =
        activeLocations.size === 0 ||
        t.locationIds.some((id) => activeLocations.has(id))
      const matchesDifficulty =
        activeDifficulties.size === 0 ||
        (t.difficulty != null && activeDifficulties.has(t.difficulty.trim()))
      const matchesPrice =
        !priceActive ||
        t.price === 0 ||
        (t.price >= priceRange[0] && t.price <= priceRange[1])
      const matchesQuery =
        q === "" ||
        t.title.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q)
      if (
        matchesCategory &&
        matchesLocation &&
        matchesDifficulty &&
        matchesPrice &&
        matchesQuery
      ) {
        set.add(durationBucket(t.duration))
      }
    }
    return set
  }, [
    tours,
    query,
    activeCategories,
    activeLocations,
    activeDifficulties,
    priceActive,
    priceRange,
  ])

  // Category ids that still have results given every OTHER active filter
  // (ignoring the category selection itself), so we can disable dead options.
  const enabledCategoryIds = useMemo(() => {
    const q = query.trim().toLowerCase()
    const set = new Set<number>()
    for (const t of tours) {
      const matchesLocation =
        activeLocations.size === 0 ||
        t.locationIds.some((id) => activeLocations.has(id))
      const matchesDuration =
        activeDurations.size === 0 ||
        activeDurations.has(durationBucket(t.duration))
      const matchesDifficulty =
        activeDifficulties.size === 0 ||
        (t.difficulty != null && activeDifficulties.has(t.difficulty.trim()))
      const matchesPrice =
        !priceActive ||
        t.price === 0 ||
        (t.price >= priceRange[0] && t.price <= priceRange[1])
      const matchesQuery =
        q === "" ||
        t.title.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q)
      if (
        matchesLocation &&
        matchesDuration &&
        matchesDifficulty &&
        matchesPrice &&
        matchesQuery
      ) {
        for (const id of t.categoryIds) set.add(id)
      }
    }
    return set
  }, [
    tours,
    query,
    activeLocations,
    activeDurations,
    activeDifficulties,
    priceActive,
    priceRange,
  ])

  // Location ids that still have results given every OTHER active filter
  // (ignoring the location selection itself).
  const enabledLocationIds = useMemo(() => {
    const q = query.trim().toLowerCase()
    const set = new Set<number>()
    for (const t of tours) {
      const matchesCategory =
        activeCategories.size === 0 ||
        t.categoryIds.some((id) => activeCategories.has(id))
      const matchesDuration =
        activeDurations.size === 0 ||
        activeDurations.has(durationBucket(t.duration))
      const matchesDifficulty =
        activeDifficulties.size === 0 ||
        (t.difficulty != null && activeDifficulties.has(t.difficulty.trim()))
      const matchesPrice =
        !priceActive ||
        t.price === 0 ||
        (t.price >= priceRange[0] && t.price <= priceRange[1])
      const matchesQuery =
        q === "" ||
        t.title.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q)
      if (
        matchesCategory &&
        matchesDuration &&
        matchesDifficulty &&
        matchesPrice &&
        matchesQuery
      ) {
        for (const id of t.locationIds) set.add(id)
      }
    }
    return set
  }, [
    tours,
    query,
    activeCategories,
    activeDurations,
    activeDifficulties,
    priceActive,
    priceRange,
  ])

  // Difficulty labels that still have results given every OTHER active filter
  // (ignoring the difficulty selection itself).
  const enabledDifficulties = useMemo(() => {
    const q = query.trim().toLowerCase()
    const set = new Set<string>()
    for (const t of tours) {
      const d = t.difficulty?.trim()
      if (!d) continue
      const matchesCategory =
        activeCategories.size === 0 ||
        t.categoryIds.some((id) => activeCategories.has(id))
      const matchesLocation =
        activeLocations.size === 0 ||
        t.locationIds.some((id) => activeLocations.has(id))
      const matchesDuration =
        activeDurations.size === 0 ||
        activeDurations.has(durationBucket(t.duration))
      const matchesPrice =
        !priceActive ||
        t.price === 0 ||
        (t.price >= priceRange[0] && t.price <= priceRange[1])
      const matchesQuery =
        q === "" ||
        t.title.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q)
      if (
        matchesCategory &&
        matchesLocation &&
        matchesDuration &&
        matchesPrice &&
        matchesQuery
      ) {
        set.add(d)
      }
    }
    return set
  }, [
    tours,
    query,
    activeCategories,
    activeLocations,
    activeDurations,
    priceActive,
    priceRange,
  ])

  // Filtered lists for the searchable filter sections.
  const shownCategories = availableCategories.filter((c) =>
    (c.nameEn?.trim() || c.name)
      .toLowerCase()
      .includes(activitySearch.trim().toLowerCase()),
  )
  const shownLocations = availableLocations.filter((l) =>
    l.name.toLowerCase().includes(locationSearch.trim().toLowerCase()),
  )

  const sidebar = (
    <div className="flex flex-col gap-6">
      {/* Travel dates (server-side availability) */}
      <FilterSection title={dict.browser.travelDates}>
        <div className="flex flex-col gap-2">
          <button
            ref={dateBtnRef}
            type="button"
            onClick={openDatePopover}
            aria-expanded={dateOpen}
            className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
          >
            <Calendar
              className="size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span
              className={
                "truncate text-sm " +
                (datesLabel ? "text-foreground" : "text-muted-foreground")
              }
            >
              {datesLabel ?? dict.browser.datesPlaceholder}
            </span>
          </button>

          {dateOpen &&
            createPortal(
              <div
                ref={datePopRef}
                style={{
                  position: "fixed",
                  top: datePos.top,
                  left: datePos.left,
                  width: datePos.width,
                }}
                className="z-50 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-2xl md:p-4"
              >
                <RangeCalendar
                  from={draftFrom}
                  to={draftTo}
                  onChange={handleCalendarChange}
                />
              </div>,
              document.body,
            )}

          {hasDateSearch && (
            <button
              type="button"
              onClick={clearDates}
              className="self-start text-sm font-medium text-primary hover:underline"
            >
              {dict.browser.clearDates}
            </button>
          )}
        </div>
      </FilterSection>

      {/* Travelers (affects availability when dates are set) */}
      <FilterSection title={dict.browser.travelers}>
        <div className="flex flex-col gap-2">
          <button
            ref={paxBtnRef}
            type="button"
            onClick={openPaxPopover}
            aria-expanded={paxOpen}
            className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:bg-secondary/40"
          >
            <span className="flex items-center gap-2 text-sm text-foreground">
              <User className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {travelersLabel}
            </span>
            {paxOpen ? (
              <ChevronUp
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            ) : (
              <ChevronDown
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
            )}
          </button>

          {paxOpen &&
            createPortal(
              <div
                ref={paxPopRef}
                style={{
                  position: "fixed",
                  top: paxPos.top,
                  left: paxPos.left,
                  width: paxPos.width,
                }}
                className="z-50 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-2xl"
              >
                <Stepper
                  label={dict.browser.adults}
                  value={draftAdults}
                  min={1}
                  onChange={setDraftAdults}
                />
                <div className="my-3 h-px bg-border" />
                <Stepper
                  label={dict.browser.children}
                  value={draftChildren}
                  min={0}
                  onChange={setDraftChildren}
                />
              </div>,
              document.body,
            )}
        </div>
      </FilterSection>

      {/* Duration */}
      {allDurationBuckets.length > 1 && (
        <FilterSection title={dict.browser.duration}>
          <div className="flex flex-wrap gap-2">
            {allDurationBuckets.map((bucket) => {
              const enabled = enabledDurationBuckets.has(bucket)
              const active = activeDurations.has(bucket)
              return (
                <Chip
                  key={bucket}
                  active={active}
                  disabled={!enabled && !active}
                  onClick={() => toggleSet(setActiveDurations, bucket)}
                >
                  {durationLabel(bucket, dict)}
                </Chip>
              )
            })}
          </div>
        </FilterSection>
      )}

      {/* Difficulty */}
      {allDifficulties.length > 0 && (
        <FilterSection title={dict.browser.difficulty}>
          <div className="flex flex-wrap gap-2">
            {allDifficulties.map((d) => {
              const enabled = enabledDifficulties.has(d)
              const active = activeDifficulties.has(d)
              return (
                <Chip
                  key={d}
                  active={active}
                  disabled={!enabled && !active}
                  onClick={() => toggleDifficulty(d)}
                >
                  {d}
                </Chip>
              )
            })}
          </div>
        </FilterSection>
      )}

      {/* Price range */}
      {priceBounds.max > priceBounds.min && (
        <FilterSection title={dict.browser.price}>
          <PriceRangeSlider
            min={priceBounds.min}
            max={priceBounds.max}
            value={priceRange}
            onChange={setPriceRange}
          />
          <div className="mt-3 flex items-center justify-between text-sm">
            <div>
              <p className="text-xs text-muted-foreground">{dict.browser.minPrice}</p>
              <p className="font-semibold text-foreground">
                <Price isk={priceRange[0]} />
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{dict.browser.maxPrice}</p>
              <p className="font-semibold text-foreground">
                <Price isk={priceRange[1]} />
              </p>
            </div>
          </div>
        </FilterSection>
      )}

      {/* Activities (categories) */}
      {availableCategories.length > 0 && (
        <FilterSection title={dict.browser.activities}>
          <FilterSearch
            value={activitySearch}
            onChange={setActivitySearch}
            label={dict.browser.searchActivities}
            placeholder={dict.browser.searchShort}
          />
          <ul className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
            {shownCategories.length === 0 ? (
              <li className="px-1 py-2 text-sm text-muted-foreground">
                {dict.browser.noMatches}
              </li>
            ) : (
              shownCategories.map((c) => {
                const Ico = getCategoryIcon(c.icon)
                return (
                  <CheckRow
                    key={c.id}
                    checked={activeCategories.has(c.id)}
                    disabled={
                      !enabledCategoryIds.has(c.id) &&
                      !activeCategories.has(c.id)
                    }
                    onChange={() => toggleSet(setActiveCategories, c.id)}
                    label={c.nameEn?.trim() || c.name}
                    icon={
                      Ico ? (
                        <Ico
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : undefined
                    }
                  />
                )
              })
            )}
          </ul>
        </FilterSection>
      )}

      {/* Starting location */}
      {availableLocations.length > 0 && (
        <FilterSection title={dict.browser.startingLocation}>
          <FilterSearch
            value={locationSearch}
            onChange={setLocationSearch}
            label={dict.browser.searchLocations}
            placeholder={dict.browser.searchShort}
          />
          <ul className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
            {shownLocations.length === 0 ? (
              <li className="px-1 py-2 text-sm text-muted-foreground">
                {dict.browser.noMatches}
              </li>
            ) : (
              shownLocations.map((loc) => (
                <CheckRow
                  key={loc.id}
                  checked={activeLocations.has(loc.id)}
                  disabled={
                    !enabledLocationIds.has(loc.id) &&
                    !activeLocations.has(loc.id)
                  }
                  onChange={() => toggleSet(setActiveLocations, loc.id)}
                  label={loc.name}
                  icon={
                    <MapPin
                      className="size-3.5 text-primary"
                      aria-hidden="true"
                    />
                  }
                />
              ))
            )}
          </ul>
        </FilterSection>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[280px_1fr] lg:items-start lg:gap-8">
      {/* Search + mobile filter toggle (full width on top) */}
      <div className="lg:col-span-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.browser.searchPlaceholder}
              className="border-0 pl-9 focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label={dict.browser.searchAria}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary lg:hidden"
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {dict.browser.filters}
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={
          "lg:sticky lg:top-24 " + (showFilters ? "block" : "hidden lg:block")
        }
      >
        <div className="relative rounded-2xl bg-card p-5 shadow-sm lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="absolute right-5 top-5 z-10 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <X className="size-3.5" aria-hidden="true" />
              {dict.browser.clearAll}
            </button>
          )}
          {sidebar}
        </div>
      </aside>

      {/* Results */}
      <div>
        <p className="mb-5 text-sm text-muted-foreground">
          {fmt(
            filtered.length === 1
              ? dict.browser.resultTour
              : dict.browser.resultTours,
            { count: filtered.length },
          )}
        </p>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <p className="font-heading text-lg font-bold text-foreground">
              {dict.browser.noToursTitle}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {dict.browser.noToursText}
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
              >
                {dict.browser.clearAllFilters}
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((tour) => (
              <a
                key={tour.bokunId}
                href={`/tours/${tour.slug}`}
                className="card-lift group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={tour.image || "/placeholder.svg"}
                    alt={tour.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </div>

                <div className="flex flex-1 flex-col p-5">
                  {tour.rating > 0 && (
                    <div className="mb-2 flex items-center gap-1 text-sm font-semibold text-foreground">
                      <Star
                        className="size-4 fill-accent text-accent"
                        aria-hidden="true"
                      />
                      {tour.rating.toFixed(1)}
                    </div>
                  )}
                  <h3 className="text-balance font-heading text-lg font-bold leading-snug text-foreground">
                    {tour.title}
                  </h3>

                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {tourBlurb(tour)}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-4" aria-hidden="true" />
                      {tour.duration}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4" aria-hidden="true" />
                      {tour.location}
                    </span>
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-5">
                    <div>
                      <span className="text-xs text-muted-foreground">{dict.browser.from}</span>
                      <p className="font-heading text-xl font-extrabold text-foreground">
                        <Price isk={tour.price} />
                      </p>
                    </div>
                    <span
                      className={buttonVariants({
                        size: "sm",
                        className: "rounded-full",
                      })}
                    >
                      {dict.browser.viewTour}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h3 className="mb-3 font-heading text-sm font-bold uppercase tracking-wide text-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}

function FilterSearch({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  placeholder: string
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 pl-9"
        aria-label={label}
      />
    </div>
  )
}

function CheckRow({
  checked,
  onChange,
  label,
  icon,
  disabled = false,
}: {
  checked: boolean
  onChange: () => void
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <li>
      <label
        className={
          "flex items-center gap-2.5 rounded-md px-1 py-1.5 text-sm transition-colors " +
          (disabled
            ? "cursor-not-allowed opacity-40"
            : "cursor-pointer hover:bg-secondary")
        }
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="size-4 shrink-0 rounded border-border text-primary accent-primary focus:ring-primary disabled:cursor-not-allowed"
        />
        {icon}
        <span className="text-foreground">{label}</span>
      </label>
    </li>
  )
}

function Chip({
  active,
  onClick,
  disabled = false,
  children,
}: {
  active: boolean
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-all active:scale-95 " +
        (active
          ? "bg-primary text-primary-foreground glow-primary"
          : disabled
            ? "cursor-not-allowed bg-secondary/50 text-muted-foreground/40 active:scale-100"
            : "bg-secondary text-muted-foreground hover:bg-card hover:text-foreground")
      }
    >
      {children}
    </button>
  )
}

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
