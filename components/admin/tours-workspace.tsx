"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Star, Compass } from "lucide-react"
import { TourEditor } from "./tour-editor"
import type { MergedTour } from "@/lib/tours"
import type { TourCategory, StartingLocation } from "@/lib/db/schema"

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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Tours</h1>
          <p className="text-xs text-muted-foreground">
            {tours.length} tours synced from Bokun
          </p>
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
            <p className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "result" : "results"}
            </p>
          </div>

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
                  return (
                    <li key={tour.bokunId}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(tour.bokunId)}
                        aria-current={isActive ? "true" : undefined}
                        className={
                          "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors " +
                          (isActive
                            ? "border-primary bg-secondary"
                            : "border-transparent hover:border-border hover:bg-secondary/50")
                        }
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
