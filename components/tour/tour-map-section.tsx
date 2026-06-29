"use client"

import dynamic from "next/dynamic"
import { MapPin } from "lucide-react"

// Leaflet touches `window`, so the map itself must never render on the server.
const TourMap = dynamic(() => import("./tour-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-secondary/60" />,
})

/** Section wrapper: heading + framed dark map of the tour's starting region. */
export function TourMapSection({
  lat,
  lng,
  location,
}: {
  lat: number
  lng: number
  location: string
}) {
  return (
    <section aria-labelledby="tour-map-heading">
      <h2
        id="tour-map-heading"
        className="font-heading text-2xl font-extrabold text-foreground"
      >
        Tour route &amp; location
      </h2>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPin className="size-4 text-primary" aria-hidden="true" />
        {location}
      </p>
      <div className="relative mt-4 h-72 overflow-hidden rounded-2xl border border-border md:h-96">
        <TourMap lat={lat} lng={lng} label={location} />
      </div>
    </section>
  )
}
