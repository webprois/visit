import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { BookingForm } from "@/components/booking-form"
import { TourGallery } from "@/components/tour/tour-gallery"
import { TourMapSection } from "@/components/tour/tour-map-section"
import { getFullTour, getRelatedTours } from "@/lib/tours"
import { fetchBookableSlots, fetchTourExtras, fetchTourPickup } from "@/lib/bokun"
import { getLocale } from "@/lib/get-locale"
import { Price } from "@/components/price"
import {
  Clock,
  MapPin,
  Users,
  Gauge,
  CalendarDays,
  Check,
  X,
  ChevronRight,
  Baby,
  Bus,
  Info,
  Backpack,
  HeartPulse,
} from "lucide-react"

export const dynamic = "force-dynamic"

const TYPE_LABELS: Record<"day" | "multi-day", string> = {
  day: "Day Tour",
  "multi-day": "Multi-Day Tour",
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const locale = await getLocale()
  const tour = await getFullTour(id, locale)
  if (!tour) return { title: "Tour not found — Visit.is" }
  return {
    title: `${tour.title} — Visit.is`,
    description:
      tour.excerpt?.trim() ||
      tour.fullDescription.slice(0, 155) ||
      `Book ${tour.title} in ${tour.location}. ${tour.duration} adventure with Visit.is.`,
  }
}

export default async function TourPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const locale = await getLocale()
  const tour = await getFullTour(id, locale)
  if (!tour) notFound()

  const related = await getRelatedTours(tour, 3, locale)
  const detail = tour.detail

  // Bookable departures for the next 90 days (empty array → contact fallback).
  const today = new Date()
  const end = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
  const toISO = (d: Date) => d.toISOString().slice(0, 10)
  let slots: Awaited<ReturnType<typeof fetchBookableSlots>> = []
  try {
    slots = await fetchBookableSlots(tour.bokunId, toISO(today), toISO(end))
  } catch {
    slots = []
  }

  // Paid add-ons (empty array → the add-ons section is hidden).
  let extras: Awaited<ReturnType<typeof fetchTourExtras>> = []
  try {
    extras = await fetchTourExtras(tour.bokunId)
  } catch {
    extras = []
  }

  // Pickup/drop-off options (no places → the pickup section is hidden).
  let pickup: Awaited<ReturnType<typeof fetchTourPickup>> | null = null
  try {
    pickup = await fetchTourPickup(tour.bokunId)
  } catch {
    pickup = null
  }

  // Resolved display values (admin override → Bokun → fallback).
  const durationText = tour.duration || detail?.durationText || "Flexible"
  const locationText = tour.location || detail?.location || "Iceland"
  const priceAmount = tour.price > 0 ? tour.price : (detail?.priceAmount ?? 0)

  const paragraphs = tour.fullDescription
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  // Hero facts — compact, scannable tour basics.
  const heroFacts = [
    { icon: CalendarDays, text: TYPE_LABELS[tour.tourType] },
    { icon: Clock, text: durationText },
    { icon: MapPin, text: locationText },
    tour.groupSizeLabel
      ? { icon: Users, text: tour.groupSizeLabel }
      : null,
  ].filter((x): x is { icon: typeof Clock; text: string } => Boolean(x))

  // Quick-facts strip.
  const quickFacts = [
    { icon: Clock, label: "Duration", value: durationText },
    { icon: CalendarDays, label: "Type", value: TYPE_LABELS[tour.tourType] },
    tour.difficultyLabel
      ? { icon: Gauge, label: "Difficulty", value: tour.difficultyLabel }
      : null,
    detail?.hasPickup
      ? { icon: Bus, label: "Pickup", value: "Hotel pickup included" }
      : { icon: MapPin, label: "Meeting point", value: locationText },
    tour.groupSizeLabel
      ? { icon: Users, label: "Group size", value: tour.groupSizeLabel }
      : null,
    detail?.minAge
      ? { icon: Baby, label: "Minimum age", value: `${detail.minAge} years` }
      : null,
  ].filter(
    (x): x is { icon: typeof Clock; label: string; value: string } => Boolean(x),
  )

  const gallery = detail?.gallery?.length
    ? detail.gallery
    : [tour.image].filter(Boolean)

  const heroImage = gallery[0] || tour.image || "/placeholder.svg"

  const hasKnowBefore =
    tour.goodToKnowItems.length > 0 ||
    Boolean(detail?.requirements) ||
    Boolean(detail?.attention)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1 pb-24 lg:pb-0">
        {/* Hero */}
        <section className="relative">
          <div className="relative h-[52vh] min-h-[26rem] w-full overflow-hidden md:h-[60vh]">
            <Image
              src={heroImage || "/placeholder.svg"}
              alt={tour.title}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
            {/* Stronger overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />
            <div className="absolute inset-0 bg-background/20" />
          </div>

          <div className="absolute inset-x-0 bottom-0">
            <div className="mx-auto max-w-7xl px-4 pb-8 md:px-6 md:pb-12">
              <nav
                aria-label="Breadcrumb"
                className="mb-4 flex items-center gap-1 text-sm text-muted-foreground"
              >
                <a href="/" className="transition-colors hover:text-foreground">
                  Home
                </a>
                <ChevronRight className="size-4" aria-hidden="true" />
                <a
                  href="/tours"
                  className="transition-colors hover:text-foreground"
                >
                  Tours
                </a>
                <ChevronRight className="size-4" aria-hidden="true" />
                <span className="truncate text-foreground">{tour.title}</span>
              </nav>

              <div className="grid items-end gap-6 lg:grid-cols-[1fr_auto]">
                {/* Left: title + subtitle + facts */}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(tour.categoryNames.length > 0
                      ? tour.categoryNames
                      : [tour.tag]
                    ).map((name) => (
                      <span
                        key={name}
                        className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground"
                      >
                        {name}
                      </span>
                    ))}
                  </div>

                  <h1 className="mt-3 max-w-3xl text-balance font-heading text-3xl font-extrabold text-foreground md:text-5xl">
                    {tour.title}
                  </h1>

                  {tour.excerpt?.trim() && (
                    <p className="mt-3 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
                      {tour.excerpt.trim()}
                    </p>
                  )}

                  <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground">
                    {heroFacts.map((f) => (
                      <li key={f.text} className="flex items-center gap-1.5">
                        <f.icon className="size-4 text-primary" aria-hidden="true" />
                        {f.text}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Right: starting price + CTA */}
                <div className="rounded-2xl border border-border bg-card/80 p-5 backdrop-blur md:min-w-64">
                  <span className="text-xs text-muted-foreground">From</span>
                  <p className="font-heading text-3xl font-extrabold text-foreground">
                    <Price isk={priceAmount} fallback="Contact us" />
                  </p>
                  {priceAmount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      per person
                    </span>
                  )}
                  <a
                    href="#book"
                    className="mt-4 flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Book now
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Body */}
        <section className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
          <div className="lg:grid lg:grid-cols-[1fr_380px] lg:gap-12">
            {/* Left: content */}
            <div className="flex flex-col gap-12">
              {/* Gallery */}
              {gallery.length > 0 && (
                <TourGallery images={gallery} title={tour.title} />
              )}

              {/* Quick facts strip */}
              {quickFacts.length > 0 && (
                <section aria-label="Tour facts">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {quickFacts.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl border border-border bg-card p-4"
                      >
                        <item.icon
                          className="size-5 text-primary"
                          aria-hidden="true"
                        />
                        <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="font-heading text-sm font-bold text-foreground">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* About */}
              <section aria-labelledby="about-heading">
                <h2
                  id="about-heading"
                  className="font-heading text-2xl font-extrabold text-foreground md:text-3xl"
                >
                  About this tour
                </h2>
                {paragraphs.length > 0 ? (
                  <div className="mt-4 flex max-w-prose flex-col gap-4 text-pretty text-base leading-relaxed text-muted-foreground">
                    {paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 max-w-prose text-base leading-relaxed text-muted-foreground">
                    {tour.excerpt?.trim() ||
                      "Contact us for full details about this experience."}
                  </p>
                )}
              </section>

              {/* What's included */}
              {(tour.includedItems.length || tour.excludedItems.length) ? (
                <section aria-labelledby="included-heading">
                  <h2
                    id="included-heading"
                    className="font-heading text-2xl font-extrabold text-foreground"
                  >
                    What&apos;s included
                  </h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {tour.includedItems.length > 0 && (
                      <div className="rounded-2xl border border-border bg-card p-5">
                        <p className="font-heading text-sm font-bold text-foreground">
                          Included
                        </p>
                        <ul className="mt-3 flex flex-col gap-2.5">
                          {tour.includedItems.map((item, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
                            >
                              <Check
                                className="mt-0.5 size-4 shrink-0 text-primary"
                                aria-hidden="true"
                              />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {tour.excludedItems.length > 0 && (
                      <div className="rounded-2xl border border-border bg-card p-5">
                        <p className="font-heading text-sm font-bold text-foreground">
                          Not included
                        </p>
                        <ul className="mt-3 flex flex-col gap-2.5">
                          {tour.excludedItems.map((item, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
                            >
                              <X
                                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </section>
              ) : null}

              {/* Itinerary timeline */}
              {tour.itinerary.length > 0 && (
                <section aria-labelledby="itinerary-heading">
                  <h2
                    id="itinerary-heading"
                    className="font-heading text-2xl font-extrabold text-foreground"
                  >
                    Itinerary
                  </h2>
                  <ol className="relative mt-6 flex flex-col gap-7 border-l border-border pl-7">
                    {tour.itinerary.map((step, i) => (
                      <li key={i} className="relative">
                        <span
                          className="absolute -left-[35px] top-1 flex size-4 items-center justify-center rounded-full bg-primary ring-4 ring-background"
                          aria-hidden="true"
                        />
                        {step.title && (
                          <p className="font-heading font-bold text-foreground">
                            {step.title}
                          </p>
                        )}
                        {step.body && (
                          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            {step.body}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {/* Know before you go */}
              {hasKnowBefore && (
                <section aria-labelledby="know-heading">
                  <h2
                    id="know-heading"
                    className="font-heading text-2xl font-extrabold text-foreground"
                  >
                    Know before you go
                  </h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {detail?.requirements && (
                      <div
                        className={
                          "rounded-2xl border border-border bg-card p-5" +
                          (tour.goodToKnowItems.length === 0
                            ? " sm:col-span-2"
                            : "")
                        }
                      >
                        <div className="flex items-center gap-2">
                          <Backpack
                            className="size-5 text-primary"
                            aria-hidden="true"
                          />
                          <p className="font-heading text-sm font-bold text-foreground">
                            What to bring
                          </p>
                        </div>
                        <p className="mt-3 whitespace-pre-line text-pretty text-sm leading-relaxed text-muted-foreground">
                          {detail.requirements}
                        </p>
                      </div>
                    )}
                    {tour.goodToKnowItems.length > 0 && (
                      <div
                        className={
                          "rounded-2xl border border-border bg-card p-5" +
                          (!detail?.requirements ? " sm:col-span-2" : "")
                        }
                      >
                        <div className="flex items-center gap-2">
                          <Info
                            className="size-5 text-primary"
                            aria-hidden="true"
                          />
                          <p className="font-heading text-sm font-bold text-foreground">
                            Good to know
                          </p>
                        </div>
                        <ul className="mt-3 flex flex-col gap-2.5">
                          {tour.goodToKnowItems.map((item, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
                            >
                              <Check
                                className="mt-0.5 size-4 shrink-0 text-primary"
                                aria-hidden="true"
                              />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {detail?.attention && (
                      <div className="rounded-2xl border border-border bg-secondary/40 p-5 sm:col-span-2">
                        <div className="flex items-center gap-2">
                          <HeartPulse
                            className="size-5 text-primary"
                            aria-hidden="true"
                          />
                          <p className="font-heading text-sm font-bold text-foreground">
                            Important information
                          </p>
                        </div>
                        <p className="mt-3 whitespace-pre-line text-pretty text-sm leading-relaxed text-muted-foreground">
                          {detail.attention}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Route map */}
              {detail?.lat != null && detail?.lng != null && (
                <TourMapSection
                  lat={detail.lat}
                  lng={detail.lng}
                  location={locationText}
                />
              )}
            </div>

            {/* Right: booking panel */}
            <aside
              id="book"
              className="scroll-mt-24 pb-24 lg:self-start lg:pb-0"
            >
              <BookingForm
                bokunId={tour.bokunId}
                slots={slots}
                extras={extras}
                pickup={pickup}
                fallbackPhone="+354 419 1600"
                startingPriceIsk={priceAmount}
              />
            </aside>
          </div>
        </section>

        {/* Related tours */}
        {related.length > 0 && (
          <section className="border-t border-border bg-secondary/40 py-14">
            <div className="mx-auto max-w-7xl px-4 md:px-6">
              <h2 className="font-heading text-2xl font-extrabold text-foreground md:text-3xl">
                Explore similar adventures
              </h2>
              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((t) => (
                  <a
                    key={t.bokunId}
                    href={`/tours/${t.bokunId}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={t.image || "/placeholder.svg"}
                        alt={t.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                      <span className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                        {t.categoryName ?? t.tag}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="text-balance font-heading text-lg font-bold leading-snug text-foreground">
                        {t.title}
                      </h3>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Clock className="size-4" aria-hidden="true" />
                          {t.duration}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-4" aria-hidden="true" />
                          {t.location}
                        </span>
                      </div>
                      <div className="mt-5 border-t border-border pt-4">
                        <span className="text-xs text-muted-foreground">From</span>
                        <p className="font-heading text-xl font-extrabold text-foreground">
                          <Price isk={t.price} />
                        </p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
