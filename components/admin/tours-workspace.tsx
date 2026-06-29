"use client"

import { useMemo, useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Star,
  Compass,
  Eye,
  EyeOff,
  Tag,
  X,
  Loader2,
} from "lucide-react"
import { TourEditor } from "./tour-editor"
import {
  bulkSetVisibility,
  bulkSetFeatured,
  bulkAddCategory,
  bulkRemoveCategory,
} from "@/app/actions/admin"
import type { MergedTour } from "@/lib/tours"
import type { TourCategory, StartingLocation } from "@/lib/db/schema"

/** True when a tour is missing the short description shown on its card. */
function isMissingContent(t: MergedTour): boolean {
  return !t.excerpt || t.excerpt.trim().length === 0
}

type StatusFilter = "all" | "published" | "draft" | "featured"
type TypeFilter = "all" | "day" | "multi-day"

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All statuses",
  published: "Published",
  draft: "Draft",
  featured: "Featured",
}

const TYPE_LABELS: Record<TypeFilter, string> = {
  all: "All types",
  day: "Day tour",
  "multi-day": "Multi-day tour",
}

function formatUpdated(value: Date | null): string {
  if (!value) return "Not edited yet"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "Not edited yet"
  return `Updated ${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`
}

export function ToursWorkspace({
  tours,
  categories,
  locations,
}: {
  tours: MergedTour[]
  categories: TourCategory[]
  locations: StartingLocation[]
}) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [operatorFilter, setOperatorFilter] = useState<string>("all")
  const [selectedId, setSelectedId] = useState<string | null>(
    tours[0]?.bokunId ?? null,
  )
  // Multi-select for bulk actions (set of bokunIds).
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState<string>("")
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const stats = useMemo(() => {
    let published = 0
    let drafts = 0
    let featured = 0
    let uncategorized = 0
    let missingContent = 0
    for (const t of tours) {
      if (t.visible) published++
      else drafts++
      if (t.featured) featured++
      if (t.categoryIds.length === 0) uncategorized++
      if (isMissingContent(t)) missingContent++
    }
    return {
      total: tours.length,
      published,
      drafts,
      featured,
      uncategorized,
      missingContent,
    }
  }, [tours])

  // Unique operators (Bokun vendors) present in the synced tours, sorted A→Z.
  const operators = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of tours) {
      if (t.operatorId != null && t.operator) {
        map.set(String(t.operatorId), t.operator)
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [tours])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tours.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false
      if (statusFilter === "published" && !t.visible) return false
      if (statusFilter === "draft" && t.visible) return false
      if (statusFilter === "featured" && !t.featured) return false
      if (typeFilter !== "all" && t.tourType !== typeFilter) return false
      if (categoryFilter !== "all") {
        if (categoryFilter === "none" && t.categoryIds.length > 0) return false
        if (
          categoryFilter !== "none" &&
          !t.categoryIds.includes(Number(categoryFilter))
        )
          return false
      }
      if (operatorFilter !== "all" && String(t.operatorId ?? "") !== operatorFilter)
        return false
      return true
    })
  }, [tours, query, statusFilter, typeFilter, categoryFilter, operatorFilter])

  const selected =
    tours.find((t) => t.bokunId === selectedId) ?? null

  const checkedIds = useMemo(
    () => filtered.filter((t) => checked.has(t.bokunId)).map((t) => t.bokunId),
    [filtered, checked],
  )
  const allFilteredChecked =
    filtered.length > 0 && filtered.every((t) => checked.has(t.bokunId))

  function toggleChecked(bokunId: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(bokunId)) next.delete(bokunId)
      else next.add(bokunId)
      return next
    })
  }

  function toggleAllFiltered() {
    setChecked((prev) => {
      const next = new Set(prev)
      if (allFilteredChecked) {
        for (const t of filtered) next.delete(t.bokunId)
      } else {
        for (const t of filtered) next.add(t.bokunId)
      }
      return next
    })
  }

  function clearSelection() {
    setChecked(new Set())
  }

  function runBulk(fn: () => Promise<void>, message: string) {
    startTransition(async () => {
      try {
        await fn()
        toast.success(message)
        clearSelection()
        router.refresh()
      } catch {
        toast.error("Something went wrong. Please try again.")
      }
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Tours</h1>
          <p className="text-xs text-muted-foreground">
            {tours.length} tours synced from Bokun
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatChip label="Total" value={stats.total} />
          <StatChip label="Published" value={stats.published} tone="success" />
          <StatChip label="Drafts" value={stats.drafts} />
          <StatChip label="Featured" value={stats.featured} tone="primary" />
          <StatChip
            label="Uncategorized"
            value={stats.uncategorized}
            tone={stats.uncategorized > 0 ? "warning" : undefined}
          />
          <StatChip
            label="Missing content"
            value={stats.missingContent}
            tone={stats.missingContent > 0 ? "warning" : undefined}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left: list panel */}
        <div className="flex w-full shrink-0 flex-col border-b border-border lg:h-full lg:w-[380px] lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-3 border-b border-border p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tours..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter((v as StatusFilter) ?? "all")}
              >
                <SelectTrigger aria-label="Filter by status">
                  <SelectValue>
                    {(value: StatusFilter) => STATUS_LABELS[value] ?? "Status"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="featured">Featured</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={categoryFilter}
                onValueChange={(v) => setCategoryFilter(v ?? "all")}
              >
                <SelectTrigger aria-label="Filter by category">
                  <SelectValue>
                    {(value: string) =>
                      value === "all"
                        ? "All categories"
                        : value === "none"
                          ? "Uncategorized"
                          : (categories.find((c) => String(c.id) === value)?.name ??
                            "Category")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter((v as TypeFilter) ?? "all")}
              >
                <SelectTrigger aria-label="Filter by tour type">
                  <SelectValue>
                    {(value: TypeFilter) => TYPE_LABELS[value] ?? "Tour type"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="day">Day tour</SelectItem>
                  <SelectItem value="multi-day">Multi-day tour</SelectItem>
                </SelectContent>
              </Select>

              {operators.length > 0 && (
                <Select
                  value={operatorFilter}
                  onValueChange={(v) => setOperatorFilter(v ?? "all")}
                >
                  <SelectTrigger aria-label="Filter by operator">
                    <SelectValue>
                      {(value: string) =>
                        value === "all"
                          ? "All operators"
                          : (operators.find((o) => o.id === value)?.name ??
                            "Operator")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All operators</SelectItem>
                    {operators.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "result" : "results"}
              </p>
              {filtered.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllFiltered}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {allFilteredChecked ? "Clear selection" : "Select all"}
                </button>
              )}
            </div>
          </div>

          {/* Bulk action bar */}
          {checkedIds.length > 0 && (
            <div className="flex flex-col gap-2 border-b border-border bg-secondary/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {checkedIds.length} selected
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" /> Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    runBulk(
                      () => bulkSetVisibility(checkedIds, true),
                      "Tours published",
                    )
                  }
                >
                  <Eye className="size-4" /> Publish
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    runBulk(
                      () => bulkSetVisibility(checkedIds, false),
                      "Tours unpublished",
                    )
                  }
                >
                  <EyeOff className="size-4" /> Unpublish
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    runBulk(
                      () => bulkSetFeatured(checkedIds, true),
                      "Tours featured",
                    )
                  }
                >
                  <Star className="size-4" /> Feature
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    runBulk(
                      () => bulkSetFeatured(checkedIds, false),
                      "Tours unfeatured",
                    )
                  }
                >
                  <Star className="size-4" /> Unfeature
                </Button>
              </div>
              {categories.length > 0 && (
                <div className="flex items-center gap-2">
                  <Tag
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Select
                    value={bulkCategory || undefined}
                    onValueChange={(v) => setBulkCategory(v ?? "")}
                  >
                    <SelectTrigger className="h-9 flex-1" aria-label="Bulk category">
                      <SelectValue placeholder="Choose category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending || !bulkCategory}
                    onClick={() =>
                      runBulk(
                        () => bulkAddCategory(checkedIds, Number(bulkCategory)),
                        "Category added",
                      )
                    }
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={isPending || !bulkCategory}
                    onClick={() =>
                      runBulk(
                        () => bulkRemoveCategory(checkedIds, Number(bulkCategory)),
                        "Category removed",
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              )}
              {isPending && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Applying…
                </span>
              )}
            </div>
          )}

          {/* Scrollable tour list */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 max-lg:max-h-[40vh]">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                <Compass className="size-8 text-muted-foreground/40" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">No tours found</p>
                <p className="text-xs text-muted-foreground">
                  Try adjusting your search or filters.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {filtered.map((tour) => {
                  const isActive = tour.bokunId === selectedId
                  const isChecked = checked.has(tour.bokunId)
                  return (
                    <li key={tour.bokunId}>
                      <div
                        className={
                          "flex w-full items-center gap-2 rounded-xl border p-2.5 transition-colors " +
                          (isActive
                            ? "border-primary bg-secondary"
                            : isChecked
                              ? "border-border bg-secondary/40"
                              : "border-transparent hover:border-border hover:bg-secondary/50")
                        }
                      >
                        <label className="flex shrink-0 cursor-pointer items-center justify-center p-1">
                          <span className="sr-only">Select {tour.title}</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleChecked(tour.bokunId)}
                            className="size-4 accent-primary"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setSelectedId(tour.bokunId)}
                          aria-current={isActive ? "true" : undefined}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                        <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <Image
                            src={tour.image || "/placeholder.svg"}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="truncate text-sm font-semibold text-foreground">
                              {tour.title}
                            </h3>
                            {tour.featured && (
                              <Star
                                className="size-3.5 shrink-0 fill-primary text-primary"
                                aria-label="Featured"
                              />
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <StatusDot visible={tour.visible} />
                            <span className="truncate text-xs text-muted-foreground">
                              {tour.categoryName ?? "Uncategorized"}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                            {formatUpdated(tour.updatedAt)}
                          </p>
                        </div>
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: editor */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selected ? (
            <TourEditor
              key={selected.bokunId}
              tour={selected}
              categories={categories}
              locations={locations}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary">
                <Compass className="size-7 text-muted-foreground" aria-hidden="true" />
              </div>
              <h2 className="font-heading text-lg font-bold text-foreground">
                Select a tour to edit
              </h2>
              <p className="max-w-xs text-sm text-muted-foreground">
                Choose a tour from the list to manage its content, images, categories
                and publish status.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "success" | "primary" | "warning"
}) {
  const dot =
    tone === "success"
      ? "var(--chart-3)"
      : tone === "primary"
        ? "var(--primary)"
        : tone === "warning"
          ? "var(--chart-1)"
          : "var(--muted-foreground)"
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5">
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: dot }}
        aria-hidden="true"
      />
      <span className="text-sm font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function StatusDot({ visible }: { visible: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: visible ? "var(--chart-3)" : "var(--muted-foreground)" }}
        aria-hidden="true"
      />
      <span className="text-xs font-medium text-muted-foreground">
        {visible ? "Published" : "Draft"}
      </span>
    </span>
  )
}
