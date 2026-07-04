import { SiteHeader } from "@/components/site-header"
import { Hero } from "@/components/hero"
import { TourCategories } from "@/components/tour-categories"
import { FeaturedTours } from "@/components/featured-tours"
import { ToursMap } from "@/components/home/tours-map"
import type { MapTourPoint } from "@/components/home/home-map"
import { GoogleReviews } from "@/components/google-reviews"
import { SiteFooter } from "@/components/site-footer"
import { getGoogleReviews } from "@/lib/google-reviews"
import {
  getVisibleTours,
  getHomeCategories,
  getCategories,
  categoryName,
} from "@/lib/tours"
import { getLocale } from "@/lib/get-locale"
import { getServerDict } from "@/lib/get-dictionary"

export default async function Page() {
  const locale = await getLocale()
  const visible = await getVisibleTours(locale)
  // "Handpicked adventures" = the tours marked as featured in the admin.
  const featured = visible.filter((t) => t.featured)
  const handpicked = featured.length > 0 ? featured : visible.slice(0, 6)
  // Homepage category grid comes from the backend categories that have an image.
  const categories = await getHomeCategories(visible, locale)

  // Experience list for the search widget = categories that have visible tours,
  // ordered by their sortOrder, labeled in the active locale.
  const allCategories = await getCategories()
  const usedCategoryIds = new Set(visible.flatMap((t) => t.categoryIds))
  const experiences = allCategories
    .filter((c) => usedCategoryIds.has(c.id))
    .map((c) => ({ slug: c.slug, label: categoryName(c, locale) }))

  // Google reviews for the business (null when the integration isn't configured).
  const googleReviews = await getGoogleReviews()

  // Homepage map: plot every visible tour that has coordinates from Bokun.
  // Markers are coloured per category (cycling through the brand chart palette)
  // and carry the category's Lucide icon.
  const dict = await getServerDict()
  const CATEGORY_COLORS = ["#ec4647", "#4a90c2", "#56b89a", "#e2a13c", "#8a7ce0"]
  const categoryById = new Map(allCategories.map((c) => [c.id, c]))
  const colorByCategory = new Map(
    allCategories.map((c, i) => [c.id, CATEGORY_COLORS[i % CATEGORY_COLORS.length]]),
  )
  // Iceland's rough bounding box, used to drop bad/placeholder coordinates
  // (e.g. 0,0) so they don't blow out the map's fitted bounds.
  const inIceland = (lat: number, lng: number) =>
    lat >= 63 && lat <= 67 && lng >= -25 && lng <= -13
  const mapPoints: MapTourPoint[] = visible
    .filter(
      (t) =>
        t.id != null &&
        t.showOnMap !== false &&
        typeof t.lat === "number" &&
        typeof t.lng === "number" &&
        inIceland(t.lat, t.lng),
    )
    .map((t) => {
      const cat = t.categoryId != null ? categoryById.get(t.categoryId) : undefined
      // Prefer the curated admin gallery; fall back to the primary Bokun image.
      const galleryUrls = t.gallery.map((g) => g.url).filter(Boolean)
      const images =
        galleryUrls.length > 0 ? galleryUrls : t.image ? [t.image] : []
      return {
        id: t.id as number,
        title: t.title,
        lat: t.lat as number,
        lng: t.lng as number,
        images,
        excerpt: t.excerpt,
        location: t.location,
        duration: t.duration,
        difficulty: t.difficulty,
        // Route stops (kept only when inside Iceland) for multi-location tours.
        stops: (t.mapStops ?? [])
          .filter((s) => inIceland(s.lat, s.lng))
          .map((s) => ({ name: s.name, lat: s.lat, lng: s.lng })),
        price: t.price,
        category: t.categoryName,
        iconName: cat?.icon ?? null,
        color:
          (t.categoryId != null && colorByCategory.get(t.categoryId)) ||
          CATEGORY_COLORS[0],
      }
    })

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        <Hero experiences={experiences} />
        <TourCategories categories={categories} />
        <FeaturedTours tours={handpicked} />
        <ToursMap
          points={mapPoints}
          content={{
            eyebrow: dict.map.eyebrow,
            title: dict.map.title,
            subtitle: dict.map.subtitle,
            from: dict.featured.from,
            viewTour: dict.featured.viewTour,
            mapView: dict.map.mapView,
            satelliteView: dict.map.satelliteView,
          }}
        />
        {googleReviews ? <GoogleReviews data={googleReviews} /> : null}
      </main>
      <SiteFooter />
    </div>
  )
}
