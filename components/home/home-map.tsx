"use client"

import "leaflet/dist/leaflet.css"
import { useEffect, useState } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import L from "leaflet"
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet"
import MarkerClusterGroup from "react-leaflet-cluster"
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Gauge,
  MapPin,
  Route,
} from "lucide-react"
import Link from "next/link"
import { getCategoryIcon } from "@/lib/category-icons"
import { Price } from "@/components/price"

/** A single tour plotted on the homepage map. Fully serializable (from RSC). */
export type MapTourPoint = {
  id: number
  /** SEO-friendly URL slug used for the tour detail link. */
  slug: string
  title: string
  lat: number
  lng: number
  /** Ordered images shown in the popup carousel (first is the primary photo). */
  images: string[]
  /** Short marketing description shown in the popup. */
  excerpt: string | null
  location: string
  duration: string
  /** Difficulty label (e.g. "Easy", "Moderate"), when known. */
  difficulty: string | null
  /** Ordered route stops for multi-location tours (empty for single-location). */
  stops: { name: string; lat: number; lng: number }[]
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

/** Small numbered dot for a secondary stop on a selected tour's route. */
function stopDotIcon(index: number, color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${color};color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.45);font-weight:700;font-size:11px;">${index + 1}</span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

/** Build a branded circular cluster bubble showing how many tours it holds. */
function clusterIcon(cluster: { getChildCount: () => number }): L.DivIcon {
  const count = cluster.getChildCount()
  // Grow the bubble slightly for denser clusters.
  const size = count < 10 ? 40 : count < 50 ? 48 : 56
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:var(--primary, #ec4647);color:#fff;border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,0.45);font-weight:800;font-size:14px;">${count}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
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

/** Popup card with a swipeable image carousel, short description and CTA. */
function TourPopupCard({ point, labels }: { point: MapTourPoint; labels: Labels }) {
  const images = point.images.length > 0 ? point.images : ["/placeholder.svg"]
  const [index, setIndex] = useState(0)
  const hasMultiple = images.length > 1

  const go = (delta: number) => (e: React.MouseEvent) => {
    // Keep the click from bubbling to the map / closing the popup.
    e.preventDefault()
    e.stopPropagation()
    setIndex((i) => (i + delta + images.length) % images.length)
  }

  return (
    <div className="w-64">
      <div className="group relative h-32 w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[index] || "/placeholder.svg"}
          alt={point.title}
          className="h-full w-full object-cover"
        />
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={go(-1)}
              aria-label="Previous photo"
              className="absolute left-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={go(1)}
              aria-label="Next photo"
              className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
            <div className="absolute inset-x-0 bottom-1.5 flex items-center justify-center gap-1">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-4 bg-white" : "w-1.5 bg-white/55"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <h3 className="font-heading text-sm font-bold leading-snug text-card-foreground">
          {point.title}
        </h3>
        {point.excerpt && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {point.excerpt}
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {point.location}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            {point.duration}
          </span>
          {point.difficulty && (
            <span className="flex items-center gap-1">
              <Gauge className="size-3.5 shrink-0" aria-hidden="true" />
              {point.difficulty}
            </span>
          )}
          {point.stops.length > 1 && (
            <span className="flex items-center gap-1">
              <Route className="size-3.5 shrink-0" aria-hidden="true" />
              {`${point.stops.length} stops`}
            </span>
          )}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {labels.from}
            </span>
            <span className="font-heading text-lg font-extrabold leading-none text-card-foreground">
              <Price isk={point.price} />
            </span>
          </div>
          <Link
            href={`/tours/${point.slug}`}
            className="shrink-0 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
          >
            {labels.viewTour}
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Interactive dark map of Iceland with a marker per tour. */
export default function HomeMap({
  points,
  labels,
}: {
  points: MapTourPoint[]
  labels: Labels
}) {
  const [view, setView] = useState<"map" | "satellite">("satellite")
  // The tour whose popup is currently open — used to draw its route, if any.
  const [activeId, setActiveId] = useState<number | null>(null)

  const activePoint = points.find((p) => p.id === activeId) ?? null
  const activeRoute =
    activePoint && activePoint.stops.length > 1 ? activePoint.stops : null

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

        <MarkerClusterGroup
          iconCreateFunction={clusterIcon}
          showCoverageOnHover={false}
          maxClusterRadius={45}
          spiderfyOnMaxZoom
          chunkedLoading
        >
          {points.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            icon={markerIcon(p)}
            eventHandlers={{
              popupopen: () => setActiveId(p.id),
              popupclose: () =>
                setActiveId((cur) => (cur === p.id ? null : cur)),
            }}
          >
            <Popup>
              <TourPopupCard point={p} labels={labels} />
            </Popup>
          </Marker>
          ))}
        </MarkerClusterGroup>

        {/* Route for the selected multi-location tour: a dashed line plus a
            numbered dot at each stop beyond the (already-shown) first one. */}
        {activeRoute && activePoint && (
          <>
            <Polyline
              positions={activeRoute.map((s) => [s.lat, s.lng])}
              pathOptions={{
                color: activePoint.color,
                weight: 3,
                opacity: 0.9,
                dashArray: "6 8",
              }}
            />
            {activeRoute.slice(1).map((s, i) => (
              <Marker
                key={`${activePoint.id}-stop-${i}`}
                position={[s.lat, s.lng]}
                icon={stopDotIcon(i + 1, activePoint.color)}
                interactive={false}
              />
            ))}
          </>
        )}
      </MapContainer>
    </div>
  )
}
