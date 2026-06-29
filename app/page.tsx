import { SiteHeader } from "@/components/site-header"
import { Hero } from "@/components/hero"
import { TourCategories } from "@/components/tour-categories"
import { FeaturedTours } from "@/components/featured-tours"
import { Transportation } from "@/components/transportation"
import { WhyBook } from "@/components/why-book"
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        <Hero experiences={experiences} />
        <TourCategories categories={categories} />
        <FeaturedTours tours={handpicked} />
        <Transportation />
        <WhyBook />
        {googleReviews ? <GoogleReviews data={googleReviews} /> : null}
      </main>
      <SiteFooter />
    </div>
  )
}
