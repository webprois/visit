"use client"

import dynamic from "next/dynamic"
import type { MapTourPoint } from "@/components/home/home-map"

// Leaflet touches `window`, so the map must never render on the server.
const HomeMap = dynamic(() => import("@/components/home/home-map"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-secondary/60" />
  ),
})

type Content = {
  eyebrow: string
  title: string
  subtitle: string
  from: string
  viewTour: string
  mapView: string
  satelliteView: string
}

/** Homepage section: heading + framed interactive map of all tours. */
export function ToursMap({
  points,
  content,
}: {
  points: MapTourPoint[]
  content: Content
}) {
  if (points.length === 0) return null

  return (
    <section id="map" aria-labelledby="home-map-heading" className="pt-16 pb-4 md:pt-24 md:pb-6">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-8 max-w-2xl md:mb-10">
          <p className="font-heading text-sm font-bold uppercase tracking-wider text-primary">
            {content.eyebrow}
          </p>
          <h2
            id="home-map-heading"
            className="mt-2 text-balance font-heading text-3xl font-extrabold text-foreground md:text-4xl"
          >
            {content.title}
          </h2>
          <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
            {content.subtitle}
          </p>
        </div>

        <div className="relative isolate z-0 h-[28rem] overflow-hidden rounded-3xl border border-border shadow-sm md:h-[34rem]">
          <HomeMap
            points={points}
            labels={{
              from: content.from,
              viewTour: content.viewTour,
              mapView: content.mapView,
              satelliteView: content.satelliteView,
            }}
          />
        </div>
      </div>
    </section>
  )
}
