"use client"

import dynamic from "next/dynamic"
import { MapPin, Loader2, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"

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
  lat,
  lng,
  showOnMap,
  onChangeCoords,
  onToggleShow,
}: {
  lat: number | null
  lng: number | null
  showOnMap: boolean
  onChangeCoords: (lat: number | null, lng: number | null) => void
  onToggleShow: (value: boolean) => void
}) {
  const hasPoint = lat != null && lng != null

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="size-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">
            Map location
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
        Click the map to set the tour&apos;s starting point, or drag the pin.
        Leave empty to use the coordinates from Bokun.
      </p>

      <div className="relative h-64 w-full overflow-hidden rounded-xl border border-border">
        <LocationPickerMap
          lat={lat}
          lng={lng}
          onPick={(newLat, newLng) => onChangeCoords(newLat, newLng)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mapLat">Latitude</Label>
          <Input
            id="mapLat"
            inputMode="decimal"
            value={lat ?? ""}
            onChange={(e) => onChangeCoords(parseCoord(e.target.value), lng)}
            placeholder="e.g. 64.1466"
            className="h-11"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mapLng">Longitude</Label>
          <Input
            id="mapLng"
            inputMode="decimal"
            value={lng ?? ""}
            onChange={(e) => onChangeCoords(lat, parseCoord(e.target.value))}
            placeholder="e.g. -21.9426"
            className="h-11"
          />
        </div>
      </div>

      {hasPoint && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChangeCoords(null, null)}
          className="self-start text-muted-foreground"
        >
          <X className="size-4" />
          Clear coordinates
        </Button>
      )}
    </div>
  )
}
