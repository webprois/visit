"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { MapPin, Search, Plus, X, Loader2, Trash2, Save } from "lucide-react"
import { toast } from "sonner"
import {
  createStartingLocation,
  renameStartingLocation,
  deleteStartingLocation,
} from "@/app/actions/admin"
import type { MergedTour } from "@/lib/tours"
import type { StartingLocation } from "@/lib/db/schema"

export function LocationsWorkspace({
  tours,
  locations,
}: {
  tours: MergedTour[]
  locations: StartingLocation[]
}) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<number | null>(
    locations[0]?.id ?? null,
  )
  const [query, setQuery] = useState("")
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [isPending, startTransition] = useTransition()

  // Tours grouped per assigned location id.
  const { toursByLocation, countByLocation, unassignedCount } = useMemo(() => {
    const toursByLocation = new Map<number, MergedTour[]>()
    let unassignedCount = 0
    for (const l of locations) toursByLocation.set(l.id, [])
    for (const tour of tours) {
      if (tour.locationIds.length === 0) {
        unassignedCount++
        continue
      }
      for (const id of tour.locationIds) toursByLocation.get(id)?.push(tour)
    }
    const countByLocation = new Map<number, number>()
    for (const [id, list] of toursByLocation) countByLocation.set(id, list.length)
    return { toursByLocation, countByLocation, unassignedCount }
  }, [tours, locations])

  // Keep a valid selection as locations are added/removed.
  useEffect(() => {
    if (locations.length === 0) {
      setSelectedId(null)
    } else if (!locations.some((l) => l.id === selectedId)) {
      setSelectedId(locations[0].id)
    }
  }, [locations, selectedId])

  const selected = locations.find((l) => l.id === selectedId) ?? null

  const selectedTours = useMemo(() => {
    if (!selected) return []
    const list = toursByLocation.get(selected.id) ?? []
    const q = query.trim().toLowerCase()
    const filtered = q
      ? list.filter((t) => t.title.toLowerCase().includes(q))
      : list
    return [...filtered].sort((a, b) => a.title.localeCompare(b.title))
  }, [toursByLocation, selected, query])

  function addLocation() {
    const name = newName.trim()
    if (!name) return
    setNewName("")
    setAdding(false)
    startTransition(async () => {
      await createStartingLocation(name)
      toast.success("Location created")
      router.refresh()
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">
            Starting Locations
          </h1>
          <p className="text-xs text-muted-foreground">
            {locations.length}{" "}
            {locations.length === 1 ? "location" : "locations"} · {tours.length}{" "}
            tours
            {unassignedCount > 0 ? ` · ${unassignedCount} unassigned` : ""}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left: location list */}
        <div className="flex w-full shrink-0 flex-col border-b border-border lg:h-full lg:w-[380px] lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-3 border-b border-border p-4">
            <p className="text-xs text-muted-foreground">
              Create and manage starting locations here. Assign them to tours
              from the Tours editor — a tour can belong to several at once.
            </p>
            {adding ? (
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  placeholder="Location name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addLocation()
                    } else if (e.key === "Escape") {
                      setAdding(false)
                      setNewName("")
                    }
                  }}
                />
                <Button
                  onClick={addLocation}
                  disabled={!newName.trim() || isPending}
                >
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setAdding(false)
                    setNewName("")
                  }}
                  aria-label="Cancel"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <Button onClick={() => setAdding(true)} className="w-full">
                <Plus className="size-4" />
                Add location
              </Button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 max-lg:max-h-[40vh]">
            {locations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                <MapPin
                  className="size-8 text-muted-foreground/40"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-foreground">
                  No locations yet
                </p>
                <p className="text-xs text-muted-foreground">
                  Create your first starting location to get started.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {locations.map((loc) => {
                  const isActive = loc.id === selectedId
                  const count = countByLocation.get(loc.id) ?? 0
                  return (
                    <li key={loc.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(loc.id)}
                        aria-current={isActive ? "true" : undefined}
                        className={
                          "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors " +
                          (isActive
                            ? "border-primary bg-secondary"
                            : "border-transparent hover:border-border hover:bg-secondary/50")
                        }
                      >
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <MapPin
                            className="size-5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold text-foreground">
                            {loc.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {count} {count === 1 ? "tour" : "tours"}
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

        {/* Right: selected location editor + its tours */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selected ? (
            <LocationDetail
              key={selected.id}
              location={selected}
              tourCount={countByLocation.get(selected.id) ?? 0}
              tours={selectedTours}
              query={query}
              onQueryChange={setQuery}
              onSaved={() => router.refresh()}
              onDeleted={() => {
                setSelectedId(null)
                router.refresh()
              }}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary">
                <MapPin
                  className="size-7 text-muted-foreground"
                  aria-hidden="true"
                />
              </div>
              <h2 className="font-heading text-lg font-bold text-foreground">
                Select a location
              </h2>
              <p className="max-w-xs text-sm text-muted-foreground">
                Choose a starting location to rename or delete it, or create a
                new one.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function LocationDetail({
  location,
  tourCount,
  tours,
  query,
  onQueryChange,
  onSaved,
  onDeleted,
}: {
  location: StartingLocation
  tourCount: number
  tours: MergedTour[]
  query: string
  onQueryChange: (value: string) => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const [name, setName] = useState(location.name)
  const [saving, startSave] = useTransition()
  const [deleting, startDelete] = useTransition()

  const dirty = name.trim() !== location.name && name.trim().length > 0

  function save() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    startSave(async () => {
      await renameStartingLocation(location.id, name.trim())
      toast.success("Location saved")
      onSaved()
    })
  }

  function remove() {
    startDelete(async () => {
      await deleteStartingLocation(location.id)
      toast.success("Location deleted")
      onDeleted()
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Editable header */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <MapPin className="size-5 text-primary" aria-hidden="true" />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                if (dirty) save()
              }
            }}
            aria-label="Location name"
            className="h-10 max-w-xs font-heading text-base font-bold"
          />
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {tourCount} {tourCount === 1 ? "tour" : "tours"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button onClick={save} disabled={!dirty || saving} size="sm">
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  />
                }
              >
                <Trash2 className="size-4" />
                Delete
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete “{location.name}”?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the location. It will be unassigned
                    from {tourCount} {tourCount === 1 ? "tour" : "tours"}. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={remove}>
                    {deleting && <Loader2 className="size-4 animate-spin" />}
                    Delete location
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={`Search tours in ${location.name}...`}
            className="pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tours.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <MapPin
              className="size-8 text-muted-foreground/40"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-foreground">
              No tours start here
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              {query
                ? "Try a different search."
                : "Assign this location to tours from the Tours editor."}
            </p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {tours.map((tour, i) => (
              <li
                key={tour.id ?? i}
                className="flex items-center gap-3 rounded-xl border border-border p-2.5"
              >
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {tour.image ? (
                    <Image
                      src={tour.image || "/placeholder.svg"}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <MapPin
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-medium text-foreground">
                    {tour.title}
                  </h3>
                  {tour.locationNames.length > 1 && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {tour.locationNames.join(" · ")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
