"use client"

import "leaflet/dist/leaflet.css"
import { useEffect } from "react"
import L from "leaflet"
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet"

/** Simple red pin used to show the currently selected starting point. */
const pinIcon = L.divIcon({
  className: "",
  html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:#ec4647;border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.45);"><span style="width:8px;height:8px;border-radius:9999px;background:#fff;"></span></span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
})

/** Center of Iceland, used when no coordinates are set yet. */
const ICELAND_CENTER: [number, number] = [64.9631, -19.0208]

/** Capture map clicks and report the picked coordinates upward. */
function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/** Keep the map centered on the current selection when it changes externally. */
function Recenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap()
  useEffect(() => {
    if (lat == null || lng == null) return
    map.setView([lat, lng], Math.max(map.getZoom(), 8))
  }, [map, lat, lng])
  return null
}

export default function LocationPickerMap({
  lat,
  lng,
  onPick,
}: {
  lat: number | null
  lng: number | null
  onPick: (lat: number, lng: number) => void
}) {
  const hasPoint = lat != null && lng != null

  return (
    <MapContainer
      center={hasPoint ? [lat!, lng!] : ICELAND_CENTER}
      zoom={hasPoint ? 8 : 5}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <ClickCapture onPick={onPick} />
      <Recenter lat={lat} lng={lng} />
      {hasPoint && (
        <Marker
          position={[lat!, lng!]}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend(e) {
              const p = e.target.getLatLng()
              onPick(p.lat, p.lng)
            },
          }}
        />
      )}
    </MapContainer>
  )
}
