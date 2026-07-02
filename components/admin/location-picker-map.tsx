"use client"

import "leaflet/dist/leaflet.css"
import { useEffect } from "react"
import L from "leaflet"
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet"
import type { MapStop } from "@/lib/db/schema"

/** Numbered red pin used for each stop on the route. */
function stopIcon(index: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:#ec4647;color:#fff;border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.45);font-weight:800;font-size:12px;">${index + 1}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

/** Center of Iceland, used when no stops are set yet. */
const ICELAND_CENTER: [number, number] = [64.9631, -19.0208]

/** Capture map clicks and append a new stop at the clicked point. */
function ClickCapture({ onAdd }: { onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onAdd(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/** Recenter the map on the last-added stop when the count grows. */
function Recenter({ stops }: { stops: MapStop[] }) {
  const map = useMap()
  useEffect(() => {
    const last = stops[stops.length - 1]
    if (!last) return
    map.setView([last.lat, last.lng], Math.max(map.getZoom(), 7))
    // Only recenter when the number of stops changes, not on every drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.length])
  return null
}

export default function LocationPickerMap({
  stops,
  onAddStop,
  onMoveStop,
}: {
  stops: MapStop[]
  onAddStop: (lat: number, lng: number) => void
  onMoveStop: (index: number, lat: number, lng: number) => void
}) {
  const first = stops[0]

  return (
    <MapContainer
      center={first ? [first.lat, first.lng] : ICELAND_CENTER}
      zoom={first ? 8 : 5}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      {/* Satellite imagery by default, with a place-label overlay for context. */}
      <TileLayer
        attribution='&copy; <a href="https://www.esri.com">Esri</a>, Maxar, Earthstar Geographics'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
      <ClickCapture onAdd={onAddStop} />
      <Recenter stops={stops} />
      {stops.length > 1 && (
        <Polyline
          positions={stops.map((s) => [s.lat, s.lng])}
          pathOptions={{ color: "#ec4647", weight: 3, opacity: 0.9, dashArray: "6 6" }}
        />
      )}
      {stops.map((s, i) => (
        <Marker
          key={i}
          position={[s.lat, s.lng]}
          icon={stopIcon(i)}
          draggable
          eventHandlers={{
            dragend(e) {
              const p = e.target.getLatLng()
              onMoveStop(i, p.lat, p.lng)
            },
          }}
        />
      ))}
    </MapContainer>
  )
}
