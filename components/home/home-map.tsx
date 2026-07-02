"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useState } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import L from "leaflet"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"
import { Clock, MapPin } from "lucide-react"
import Link from "next/link"
import { getCategoryIcon } from "@/lib/category-icons"
import { Price } from "@/components/price"

/** A single tour plotted on the homepage map. Fully serializable (from RSC). */
export type MapTourPoint = {
  id: number
  title: string
  lat: number
  lng: number
  image: string
  location: string
  duration: string
  price: number
  category: string | null
  /** Lucide icon name from the tour's primary category (see category-icons). */
  iconName: string | null
  /** Marker fill colour (hex), assigned per category. */
  color: string
}

type Labels = {
  from: string
  viewTour: string
  mapView: string
  satelliteView: string
}

/** Build a branded circular pin containing the category's Lucide icon. */
function markerIcon(point: MapTourPoint): L.DivIcon {
  const Icon = getCategoryIcon(point.iconName) ?? MapPin
  const svg = renderToStaticMarkup(
    <Icon width={18} height={18} color="#fff" strokeWidth={2.4} />,
  )
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:9999px;background:${point.color};border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.45);">${svg}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  })
}

/** Fit the map viewport to all markers once the container has a real size. */
function FitToPoints({ points }: { points: MapTourPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    // The map mounts inside a freshly-revealed container, so make sure Leaflet
    // has measured it before fitting the bounds (otherwise zoom is miscalculated).
    const fit = () => {
      map.invalidateSize()
      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 9 })
      }
    }
    const t = setTimeout(fit, 150)
    return () => clearTimeout(t)
  }, [map, points])
  return null
}

/** Interactive dark map of Iceland with a marker per tour. */
export default function HomeMap({
  points,
  labels,
}: {
  points: MapTourPoint[]
  labels: Labels
}) {
  const [view, setView] = useState<"map" | "satellite">("map")

  return (
    <div className="relative h-full w-full">
      {/* Map / Satellite toggle */}
      <div className="absolute left-3 top-3 z-[1000] flex overflow-hidden rounded-full bg-card/90 p-1 shadow-lg backdrop-blur">
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
            {v === "map" ? labels.mapView : labels.satelliteView}
          </button>
        ))}
      </div>

      <MapContainer
        center={[64.96, -18.6]}
        zoom={6}
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

        <FitToPoints points={points} />

        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={markerIcon(p)}>
            <Popup>
              <div className="w-56 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image || "/placeholder.svg"}
                  alt={p.title}
                  className="-mx-3 -mt-3 mb-2 h-28 w-[calc(100%+1.5rem)] max-w-none object-cover"
                />
                {p.category && (
                  <span
                    className="text-[11px] font-bold uppercase tracking-wide"
                    style={{ color: p.color }}
                  >
                    {p.category}
                  </span>
                )}
                <h3 className="font-heading text-sm font-bold leading-snug text-foreground">
                  {p.title}
                </h3>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {p.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {p.duration}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div className="leading-tight">
                    <span className="text-[10px] text-muted-foreground">
                      {labels.from}
                    </span>
                    <p className="font-heading text-base font-extrabold text-foreground">
                      <Price isk={p.price} />
                    </p>
                  </div>
                  <Link
                    href={`/tours/${p.id}`}
                    className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
                  >
                    {labels.viewTour}
                  </Link>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
