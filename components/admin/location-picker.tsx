"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import {
  MapPin,
  Loader2,
  X,
  ChevronUp,
  ChevronDown,
  Plus,
  Sparkles,
  Search,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import type { MapStop } from "@/lib/db/schema"

// The Leaflet map is client-only; load it lazily with a placeholder.
const LocationPickerMap = dynamic(() => import("./location-picker-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  ),
})

/** Parse a free-text coordinate input into a finite number or null. */
function parseCoord(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function LocationPicker({
  stops,
  showOnMap,
  onChangeStops,
  onToggleShow,
  onGenerateStops,
  generatingStops,
  onAddAddress,
}: {
  stops: MapStop[]
  showOnMap: boolean
  onChangeStops: (stops: MapStop[]) => void
  onToggleShow: (value: boolean) => void
  /** TESTING: let AI work out the route stops from the tour's content. */
  onGenerateStops?: () => void
  generatingStops?: boolean
  /** Geocode a free-text address/place and append it; returns an error or null. */
  onAddAddress?: (query: string) => Promise<string | null>
}) {
  // Local state for the "add by address" input.
  const [address, setAddress] = useState("")
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  async function submitAddress() {
    if (!onAddAddress) return
    const q = address.trim()
    if (!q) return
    setAdding(true)
    setAddError(null)
    const err = await onAddAddress(q)
    setAdding(false)
    if (err) {
      setAddError(err)
      return
    }
    setAddress("")
  }

  const addStop = (lat: number, lng: number) =>
    onChangeStops([...stops, { name: "", lat, lng }])

  const moveCoord = (index: number, lat: number, lng: number) =>
    onChangeStops(stops.map((s, i) => (i === index ? { ...s, lat, lng } : s)))

  const updateStop = (index: number, patch: Partial<MapStop>) =>
    onChangeStops(stops.map((s, i) => (i === index ? { ...s, ...patch } : s)))

  const removeStop = (index: number) =>
    onChangeStops(stops.filter((_, i) => i !== index))

  const reorder = (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= stops.length) return
    const copy = [...stops]
    ;[copy[index], copy[next]] = [copy[next], copy[index]]
    onChangeStops(copy)
  }

  const isRoute = stops.length > 1

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">
            Map location{isRoute ? " & route" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="showOnMap" className="text-xs text-muted-foreground">
            Show on map
          </Label>
          <Switch
            id="showOnMap"
            checked={showOnMap}
            onCheckedChange={onToggleShow}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Click the map to add a stop, or drag a pin to move it. Add several stops
        for multi-location tours (e.g. self-drives); they&apos;ll be connected
        as a route. Leave empty to use the coordinates from Bokun.
      </p>

      {onGenerateStops && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Sparkles
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  Set up the route with AI
                </span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Testing
                </span>
              </div>
              <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
                Reads the stops from this tour&apos;s content and original Bokun
                data, then drops a pin on each real place. Replaces the current
                stops, so review before saving.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={onGenerateStops}
            disabled={generatingStops}
          >
            {generatingStops ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4 text-primary" />
            )}
            {generatingStops ? "Generating…" : "Generate stops"}
          </Button>
        </div>
      )}

      <div className="relative h-64 w-full overflow-hidden rounded-xl border border-border">
        <LocationPickerMap
          stops={stops}
          onAddStop={addStop}
          onMoveStop={moveCoord}
        />
      </div>

      {stops.length > 0 && (
        <ul className="flex flex-col gap-2">
          {stops.map((s, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <Input
                value={s.name}
                onChange={(e) => updateStop(i, { name: e.target.value })}
                placeholder={`Stop ${i + 1} name (optional)`}
                className="h-9 flex-1"
              />
              <Input
                inputMode="decimal"
                value={s.lat}
                onChange={(e) =>
                  updateStop(i, { lat: parseCoord(e.target.value) ?? 0 })
                }
                placeholder="Lat"
                className="h-9 w-24"
                aria-label={`Stop ${i + 1} latitude`}
              />
              <Input
                inputMode="decimal"
                value={s.lng}
                onChange={(e) =>
                  updateStop(i, { lng: parseCoord(e.target.value) ?? 0 })
                }
                placeholder="Lng"
                className="h-9 w-24"
                aria-label={`Stop ${i + 1} longitude`}
              />
              <div className="flex shrink-0 items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={() => reorder(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move stop ${i + 1} up`}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={() => reorder(i, 1)}
                  disabled={i === stops.length - 1}
                  aria-label={`Move stop ${i + 1} down`}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeStop(i)}
                  aria-label={`Remove stop ${i + 1}`}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {onAddAddress && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stopAddress" className="text-xs text-muted-foreground">
            Add a stop by address or place name
          </Label>
          <div className="flex items-start gap-2">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="stopAddress"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value)
                  if (addError) setAddError(null)
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.nativeEvent.isComposing &&
                    e.keyCode !== 229
                  ) {
                    e.preventDefault()
                    void submitAddress()
                  }
                }}
                placeholder="e.g. Gullfoss, or Laugavegur 1, Reykjavík"
                className="h-9 pl-9"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => void submitAddress()}
              disabled={adding || !address.trim()}
            >
              {adding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MapPin className="size-4" />
              )}
              Add
            </Button>
          </div>
          {addError && (
            <p className="text-xs text-destructive">{addError}</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addStop(64.9631, -19.0208)}
        >
          <Plus className="size-4" />
          Add stop
        </Button>
        {stops.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChangeStops([])}
            className="text-muted-foreground"
          >
            <X className="size-4" />
            Clear all
          </Button>
        )}
      </div>
    </div>
  )
}
