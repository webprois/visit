"use client"

import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { MapContainer, Marker, TileLayer } from "react-leaflet"

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

/** Interactive dark-themed map centred on the tour's starting location. */
export default function TourMap({
  lat,
  lng,
  label,
}: {
  lat: number
  lng: number
  label: string
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={9}
      scrollWheelZoom={false}
      className="h-full w-full"
      style={{ background: "#0c1320" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={20}
      />
      <Marker position={[lat, lng]} icon={pin} title={label} />
    </MapContainer>
  )
}
