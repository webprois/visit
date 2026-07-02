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
import { getDictionary, fmt } from "@/lib/translations"
import { CalendarDays, Users, X } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "All Tours — Visit.is",
  description:
    "Browse all our tours across Iceland. Search and filter by category to find your perfect adventure.",
}

const DATE_LOCALES: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  pt: "pt-PT",
  it: "it-IT",
}

/** Format a YYYY-MM-DD string into a short readable label, e.g. "Jul 7, 2026". */
function formatDate(ymd: string, locale: string): string {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(DATE_LOCALES[locale] ?? "en-US", {
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
  const dict = getDictionary(locale)
  const [params, allTours, categories] = await Promise.all([
    searchParams,
    getVisibleTours(locale),
    getCategories(),
  ])

  // Resolve categories from either ?experience= (search widget, may be a
  // comma-separated list) or ?category= (single). Multi-select is supported.
  const slugs = (params.experience || params.category || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const activeCategories = slugs
    .map((slug) => categories.find((c) => c.slug === slug))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
  const activeCategoryIds = activeCategories.map((c) => c.id)
  // A single category drives the page title/description; multiple shows a count.
  const activeCategory =
    activeCategories.length === 1 ? activeCategories[0] : undefined
  const activeName =
    activeCategories.length === 1
      ? categoryName(activeCategories[0], locale)
      : activeCategories.length > 1
        ? fmt(dict.toursPage.experiencesSelected, {
            count: activeCategories.length,
          })
        : null

  // Parse date + traveler search context.
  const from = params.from?.match(/^\d{4}-\d{2}-\d{2}$/) ? params.from : null
  const to = params.to?.match(/^\d{4}-\d{2}-\d{2}$/) ? params.to : from
  const adults = Math.max(1, Number(params.adults) || 1)
  const children = Math.max(0, Number(params.children) || 0)
  const pax = adults + children
  const hasDateSearch = Boolean(from)

  // Start from tours matching ANY of the chosen experiences, then narrow by
  // date availability when a date was selected.
  let tours =
    activeCategoryIds.length > 0
      ? allTours.filter((t) =>
          t.categoryIds.some((id) => activeCategoryIds.includes(id)),
        )
      : allTours
  if (hasDateSearch && from && to) {
    tours = await filterToursByAvailability(tours, from, to, pax)
  }

  const travelerLabel = fmt(
    pax === 1 ? dict.toursPage.traveler : dict.toursPage.travelers,
    { count: pax },
  )
  const dateLabel =
    from && to && from !== to
      ? `${formatDate(from, locale)} – ${formatDate(to, locale)}`
      : from
        ? formatDate(from, locale)
        : null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        <section className="bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
            <p className="font-heading text-sm font-bold uppercase tracking-wider text-primary">
              {dict.toursPage.eyebrow}
            </p>
            <h1 className="mt-2 text-balance font-heading text-3xl font-extrabold text-foreground md:text-5xl">
              {activeName ?? dict.toursPage.allTours}
            </h1>
            {activeCategory?.description ? (
              <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
                {activeCategory.description}
              </p>
            ) : (
              <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
                {fmt(dict.toursPage.description, { count: tours.length })}
              </p>
            )}

            {/* Active search summary */}
            {hasDateSearch && (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-foreground">
                  {fmt(
                    tours.length === 1
                      ? dict.toursPage.availableOne
                      : dict.toursPage.available,
                    { count: tours.length },
                  )}
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
                  {dict.toursPage.clearSearch}
                </Link>
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
          {hasDateSearch && tours.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center">
              <p className="font-heading text-xl font-bold text-foreground">
                {dict.toursPage.noDatesTitle}
              </p>
              <p className="mt-2 text-muted-foreground">
                {dict.toursPage.noDatesText}
              </p>
              <Link
                href="/tours"
                className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline"
              >
                {dict.toursPage.browseAll}
              </Link>
            </div>
          ) : (
            <ToursBrowser
              tours={tours}
              categories={categories}
              initialCategoryIds={activeCategoryIds}
            />
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
