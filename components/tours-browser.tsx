"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { MergedTour } from "@/lib/tours"
import { tourBlurb } from "@/lib/tour-blurb"
import type { TourCategory } from "@/lib/db/schema"
import { Price } from "@/components/price"
import { PriceRangeSlider } from "@/components/price-range-slider"
import {
  Clock,
  MapPin,
  Star,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"


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

function durationLabel(bucket: number): string {
  return bucket <= 1 ? "Day tour" : `${bucket} days`
}

export function ToursBrowser({
  tours,
  categories,
  initialCategoryId = null,
}: {
  tours: MergedTour[]
  categories: TourCategory[]
  initialCategoryId?: number | null
}) {
  const [query, setQuery] = useState("")
  // Selected category ids (multi-select). Empty = no activity filter.
  const [activeCategories, setActiveCategories] = useState<Set<number>>(
    new Set(initialCategoryId != null ? [initialCategoryId] : []),
  )
  // Selected starting location ids (multi-select). Empty = no location filter.
  const [activeLocations, setActiveLocations] = useState<Set<number>>(new Set())
  // Selected duration buckets (multi-select). Empty = no duration filter.
  const [activeDurations, setActiveDurations] = useState<Set<number>>(new Set())
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

  function clearAll() {
    setQuery("")
    setActiveCategories(new Set())
    setActiveLocations(new Set())
    setActiveDurations(new Set())
    setActivitySearch("")
    setLocationSearch("")
    setPriceRange([priceBounds.min, priceBounds.max])
  }

  const activeFilterCount =
    activeCategories.size +
    activeLocations.size +
    activeDurations.size +
    (priceActive ? 1 : 0)

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
      const matchesPrice =
        !priceActive ||
        t.price === 0 ||
        (t.price >= priceRange[0] && t.price <= priceRange[1])
      const matchesQuery =
        q === "" ||
        t.title.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q)
      if (matchesLocation && matchesDuration && matchesPrice && matchesQuery) {
        for (const id of t.categoryIds) set.add(id)
      }
    }
    return set
  }, [
    tours,
    query,
    activeLocations,
    activeDurations,
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
      const matchesPrice =
        !priceActive ||
        t.price === 0 ||
        (t.price >= priceRange[0] && t.price <= priceRange[1])
      const matchesQuery =
        q === "" ||
        t.title.toLowerCase().includes(q) ||
        t.location.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q)
      if (matchesCategory && matchesDuration && matchesPrice && matchesQuery) {
        for (const id of t.locationIds) set.add(id)
      }
    }
    return set
  }, [
    tours,
    query,
    activeCategories,
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
      {/* Duration */}
      {allDurationBuckets.length > 1 && (
        <FilterSection title="Duration">
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
                  {durationLabel(bucket)}
                </Chip>
              )
            })}
          </div>
        </FilterSection>
      )}

      {/* Price range */}
      {priceBounds.max > priceBounds.min && (
        <FilterSection title="Price">
          <PriceRangeSlider
            min={priceBounds.min}
            max={priceBounds.max}
            value={priceRange}
            onChange={setPriceRange}
          />
          <div className="mt-3 flex items-center justify-between text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Min price</p>
              <p className="font-semibold text-foreground">
                <Price isk={priceRange[0]} />
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Max price</p>
              <p className="font-semibold text-foreground">
                <Price isk={priceRange[1]} />
              </p>
            </div>
          </div>
        </FilterSection>
      )}

      {/* Activities (categories) */}
      {availableCategories.length > 0 && (
        <FilterSection title="Activities">
          <FilterSearch
            value={activitySearch}
            onChange={setActivitySearch}
            label="Search activities"
          />
          <ul className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
            {shownCategories.length === 0 ? (
              <li className="px-1 py-2 text-sm text-muted-foreground">
                No matches
              </li>
            ) : (
              shownCategories.map((c) => (
                <CheckRow
                  key={c.id}
                  checked={activeCategories.has(c.id)}
                  disabled={
                    !enabledCategoryIds.has(c.id) && !activeCategories.has(c.id)
                  }
                  onChange={() => toggleSet(setActiveCategories, c.id)}
                  label={c.nameEn?.trim() || c.name}
                />
              ))
            )}
          </ul>
        </FilterSection>
      )}

      {/* Starting location */}
      {availableLocations.length > 0 && (
        <FilterSection title="Starting location">
          <FilterSearch
            value={locationSearch}
            onChange={setLocationSearch}
            label="Search locations"
          />
          <ul className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto pr-1">
            {shownLocations.length === 0 ? (
              <li className="px-1 py-2 text-sm text-muted-foreground">
                No matches
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
              placeholder="Search by tour, location or category…"
              className="pl-9"
              aria-label="Search tours"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground lg:hidden"
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Filters
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
        <div className="relative rounded-2xl border border-border bg-card p-5 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="absolute right-5 top-5 z-10 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <X className="size-3.5" aria-hidden="true" />
              Clear all
            </button>
          )}
          {sidebar}
        </div>
      </aside>

      {/* Results */}
      <div>
        <p className="mb-5 text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "tour" : "tours"}
        </p>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <p className="font-heading text-lg font-bold text-foreground">
              No tours found
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try adjusting or clearing your filters.
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="mt-4 inline-flex text-sm font-semibold text-primary hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((tour) => (
              <a
                key={tour.bokunId}
                href={`/tours/${tour.bokunId}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={tour.image || "/placeholder.svg"}
                    alt={tour.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  />
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

                  <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                    <div>
                      <span className="text-xs text-muted-foreground">From</span>
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
                      View tour
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
    <div className="border-t border-border pt-5 first:border-t-0 first:pt-0">
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
}: {
  value: string
  onChange: (v: string) => void
  label: string
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
        placeholder="Search…"
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
          "flex items-center gap-2.5 rounded-md px-1 py-1.5 text-sm " +
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
        "flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : disabled
            ? "cursor-not-allowed border-border/50 bg-card text-muted-foreground/40"
            : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground")
      }
    >
      {children}
    </button>
  )
}
