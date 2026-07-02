"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useState } from "react"
import L from "leaflet"
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
} from "react-leaflet"

export type TourStop = { name: string; lat: number; lng: number }

/**
 * Brand-coloured location pin built as a divIcon so we avoid Leaflet's default
 * marker asset (which 404s under bundlers) and match the site's red accent.
 */
const pin = L.divIcon({
  className: "",
  html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:#ec4647;box-shadow:0 0 0 6px rgba(236,70,71,0.25);border:2px solid #fff5f5;"></span>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

/** Small numbered dot for a secondary stop on the tour's route. */
function stopDotIcon(index: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:#ec4647;color:#fff;border:2px solid #fff5f5;box-shadow:0 2px 6px rgba(0,0,0,0.45);font-weight:700;font-size:12px;">${index + 1}</span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

/** Fit the viewport to all route points once the container has a real size. */
function FitToStops({ stops }: { stops: TourStop[] }) {
  const map = useMap()
  useEffect(() => {
    if (stops.length === 0) return
    const t = setTimeout(() => {
      map.invalidateSize()
      if (stops.length === 1) {
        map.setView([stops[0].lat, stops[0].lng], 9)
        return
      }
      const bounds = L.latLngBounds(stops.map((s) => [s.lat, s.lng]))
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [56, 56], maxZoom: 11 })
    }, 150)
    return () => clearTimeout(t)
  }, [map, stops])
  return null
}

/**
 * Interactive map centred on the tour's starting location, matching the
 * homepage map: satellite by default with a Map/Satellite toggle, plus a
 * dashed route line and numbered stops for multi-location tours.
 */
export default function TourMap({
  lat,
  lng,
  label,
  stops = [],
  mapLabel,
  satelliteLabel,
}: {
  lat: number
  lng: number
  label: string
  stops?: TourStop[]
  mapLabel: string
  satelliteLabel: string
}) {
  const [view, setView] = useState<"map" | "satellite">("satellite")

  // Use the stored route when present, otherwise a single primary point.
  const route: TourStop[] =
    stops.length > 0 ? stops : [{ name: label, lat, lng }]
  const hasRoute = route.length > 1

  return (
    <div className="relative h-full w-full">
      {/* Map / Satellite toggle */}
      <div className="absolute right-3 top-3 z-[1000] flex overflow-hidden rounded-full bg-card/90 p-1 shadow-lg backdrop-blur">
        {(["map", "satellite"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              view === v
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v === "map" ? mapLabel : satelliteLabel}
          </button>
        ))}
      </div>

      <MapContainer
        center={[route[0].lat, route[0].lng]}
        zoom={9}
        scrollWheelZoom={false}
        className="h-full w-full"
        style={{ background: "#0c1320" }}
      >
        {view === "map" ? (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={20}
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        )}

        <FitToStops stops={route} />

        {hasRoute && (
          <Polyline
            positions={route.map((s) => [s.lat, s.lng])}
            pathOptions={{
              color: "#ec4647",
              weight: 3,
              opacity: 0.9,
              dashArray: "6 8",
            }}
          />
        )}

        {/* Primary starting-point marker. */}
        <Marker position={[route[0].lat, route[0].lng]} icon={pin} title={label} />

        {/* Numbered dots for the remaining stops. */}
        {hasRoute &&
          route.slice(1).map((s, i) => (
            <Marker
              key={`stop-${i}`}
              position={[s.lat, s.lng]}
              icon={stopDotIcon(i + 1)}
              title={s.name}
              interactive={false}
            />
          ))}
      </MapContainer>
    </div>
  )
}
