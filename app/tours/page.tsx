import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ToursBrowser } from "@/components/tours-browser"
import {
  getVisibleTours,
  getCategories,
  categoryName,
  filterToursByAvailability,
} from "@/lib/tours"
import { getLocale } from "@/lib/get-locale"
import { CalendarDays, Users, X } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "All Tours — Visit.is",
  description:
    "Browse all our tours across Iceland. Search and filter by category to find your perfect adventure.",
}

/** Format a YYYY-MM-DD string into a short readable label, e.g. "Jul 7, 2026". */
function formatDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

type SearchParams = {
  category?: string
  experience?: string
  from?: string
  to?: string
  adults?: string
  children?: string
}

export default async function ToursPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const locale = await getLocale()
  const [params, allTours, categories] = await Promise.all([
    searchParams,
    getVisibleTours(locale),
    getCategories(),
  ])

  // Resolve the category from either ?experience= (search widget) or ?category=.
  const slug = params.experience || params.category
  const activeCategory = slug
    ? categories.find((c) => c.slug === slug)
    : undefined
  const activeName = activeCategory ? categoryName(activeCategory, locale) : null

  // Parse date + traveler search context.
  const from = params.from?.match(/^\d{4}-\d{2}-\d{2}$/) ? params.from : null
  const to = params.to?.match(/^\d{4}-\d{2}-\d{2}$/) ? params.to : from
  const adults = Math.max(1, Number(params.adults) || 1)
  const children = Math.max(0, Number(params.children) || 0)
  const pax = adults + children
  const hasDateSearch = Boolean(from)

  // Start from tours matching the chosen experience, then narrow by date
  // availability when a date was selected.
  let tours = activeCategory
    ? allTours.filter((t) => t.categoryIds.includes(activeCategory.id))
    : allTours
  if (hasDateSearch && from && to) {
    tours = await filterToursByAvailability(tours, from, to, pax)
  }

  const travelerLabel = `${pax} ${pax === 1 ? "traveler" : "travelers"}`
  const dateLabel =
    from && to && from !== to
      ? `${formatDate(from)} – ${formatDate(to)}`
      : from
        ? formatDate(from)
        : null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        <section className="border-b border-border bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
            <p className="font-heading text-sm font-bold uppercase tracking-wider text-primary">
              Tours & adventures
            </p>
            <h1 className="mt-2 text-balance font-heading text-3xl font-extrabold text-foreground md:text-5xl">
              {activeName ?? "All tours"}
            </h1>
            {activeCategory?.description ? (
              <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
                {activeCategory.description}
              </p>
            ) : (
              <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
                {tours.length} handpicked tours across Iceland. Search or filter
                by category to find your next experience.
              </p>
            )}

            {/* Active search summary */}
            {hasDateSearch && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-foreground">
                  {tours.length} {tours.length === 1 ? "tour" : "tours"} available
                </span>
                {dateLabel && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground">
                    <CalendarDays className="size-4 text-primary" aria-hidden="true" />
                    {dateLabel}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground">
                  <Users className="size-4 text-primary" aria-hidden="true" />
                  {travelerLabel}
                </span>
                <Link
                  href="/tours"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <X className="size-4" aria-hidden="true" />
                  Clear search
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
          {hasDateSearch && tours.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <p className="font-heading text-xl font-bold text-foreground">
                No tours available for these dates
              </p>
              <p className="mt-2 text-muted-foreground">
                Try different dates, fewer travelers, or browse all tours.
              </p>
              <Link
                href="/tours"
                className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline"
              >
                Browse all tours
              </Link>
            </div>
          ) : (
            <ToursBrowser
              tours={tours}
              categories={categories}
              initialCategoryId={activeCategory?.id ?? null}
            />
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
