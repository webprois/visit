import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Image from "next/image"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { BookingForm } from "@/components/booking-form"
import { TourGallery } from "@/components/tour/tour-gallery"
import { TourMapSection } from "@/components/tour/tour-map-section"
import { getFullTour, getRelatedTours } from "@/lib/tours"
import {
  fetchBookableSlots,
  fetchTourExtras,
  fetchTourFees,
  fetchTourPickup,
} from "@/lib/bokun"
import { getLocale } from "@/lib/get-locale"
import { getDictionary, fmt } from "@/lib/translations"
import { translateTexts } from "@/lib/translate"
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
  Wallet,
  Headphones,
  Star,
  Compass,
  Phone,
  Mail,
} from "lucide-react"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const locale = await getLocale()
  const tour = await getFullTour(id, locale)
  if (!tour) return { title: "Tour not found | Visit.is" }
  return {
    title: `${tour.title} | Visit.is`,
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
  const dict = getDictionary(locale)
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

  // Mandatory fees Bokun auto-applies (e.g. national park fee). Always charged,
  // so they're shown in the order summary and included in the total.
  let fees: Awaited<ReturnType<typeof fetchTourFees>> = []
  try {
    fees = await fetchTourFees(tour.bokunId)
  } catch {
    fees = []
  }

  // Pickup/drop-off options (no places → the pickup section is hidden).
  let pickup: Awaited<ReturnType<typeof fetchTourPickup>> | null = null
  try {
    pickup = await fetchTourPickup(tour.bokunId)
  } catch {
    pickup = null
  }

  // Auto-translate dynamic booking content (add-on names/descriptions and
  // participant category labels) coming straight from Bokun in English into the
  // active language. All strings are batched into one cached call; English is a
  // no-op. On failure the original English text is used.
  if (locale !== "en") {
    const extraStrings = extras.flatMap((e) => [e.title, e.information])
    const feeTitles = fees.map((f) => f.title)
    const lineTitles = slots.flatMap((s) => s.lines.map((l) => l.title))
    const sources = [...extraStrings, ...feeTitles, ...lineTitles]

    if (sources.length > 0) {
      const translated = await translateTexts(sources, locale)
      const map = new Map<string, string>()
      sources.forEach((src, i) => map.set(src, translated[i] ?? src))
      const tr = (s: string) => map.get(s) ?? s

      extras = extras.map((e) => ({
        ...e,
        title: tr(e.title),
        information: tr(e.information),
      }))
      fees = fees.map((f) => ({ ...f, title: tr(f.title) }))
      slots = slots.map((s) => ({
        ...s,
        lines: s.lines.map((l) => ({ ...l, title: tr(l.title) })),
      }))
    }
  }

  // Resolved display values (admin override → Bokun → fallback).
  const durationText = tour.duration || detail?.durationText || dict.detail.flexible
  const locationText = tour.location || detail?.location || dict.detail.iceland
  const priceAmount = tour.price > 0 ? tour.price : (detail?.priceAmount ?? 0)

  const paragraphs = tour.fullDescription
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  // Hero facts — compact, scannable tour basics, all consolidated into the
  // header (the separate quick-facts strip was dropped to avoid duplication).
  const typeLabel =
    tour.tourType === "multi-day" ? dict.detail.multiDayTour : dict.detail.dayTour
  const heroFacts = [
    { icon: CalendarDays, text: typeLabel },
    { icon: Clock, text: durationText },
    { icon: MapPin, text: locationText },
    tour.groupSizeLabel ? { icon: Users, text: tour.groupSizeLabel } : null,
    tour.difficultyLabel ? { icon: Gauge, text: tour.difficultyLabel } : null,
    detail?.hasPickup ? { icon: Bus, text: dict.detail.hotelPickup } : null,
    detail?.minAge
      ? { icon: Baby, text: fmt(dict.detail.minAge, { age: detail.minAge }) }
      : null,
  ].filter((x): x is { icon: typeof Clock; text: string } => Boolean(x))

  // Prefer the admin-curated gallery; fall back to Bokun photos, then the hero.
  const gallery = tour.gallery.length
    ? tour.gallery.map((g) => g.url)
    : detail?.gallery?.length
      ? detail.gallery
      : [tour.image].filter(Boolean)

  const galleryAlts = tour.gallery.length
    ? tour.gallery.map((g) => g.alt)
    : undefined

  const heroImage = gallery[0] || tour.image || "/placeholder.svg"

  const hasKnowBefore =
    tour.goodToKnowItems.length > 0 ||
    Boolean(detail?.requirements) ||
    Boolean(detail?.attention)

  return (
    <div className="theme-light relative flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1 pb-24 lg:pb-0">
        {/* Hero */}
        <section className="relative isolate flex min-h-[52vh] flex-col justify-between overflow-hidden md:min-h-[60vh] lg:justify-end">
          {/* Background image + overlays fill the whole section so the content
              can grow (e.g. long titles on mobile) without hiding behind the
              sticky header. */}
          <div className="absolute inset-0 -z-10">
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

          {/* Mobile only: breadcrumb pinned to the top, just under the header. */}
          <div className="mx-auto w-full max-w-7xl px-4 pt-6 md:pt-20 lg:hidden">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1 text-sm text-muted-foreground"
            >
              <a href="/" className="transition-colors hover:text-foreground">
                {dict.detail.home}
              </a>
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              <a
                href="/tours"
                className="transition-colors hover:text-foreground"
              >
                {dict.detail.tours}
              </a>
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate text-foreground">{tour.title}</span>
            </nav>
          </div>

          <div className="w-full">
            {/* pb keeps content off the section edge. */}
            <div className="mx-auto max-w-7xl px-4 pb-4 pt-6 md:px-6 md:pb-12">
              <div className="lg:relative">
                {/* Left: title + subtitle + facts */}
                <div className="lg:max-w-[calc(100%-18rem)]">
                  {/* Desktop only: breadcrumb grouped above the title. */}
                  <nav
                    aria-label="Breadcrumb"
                    className="mb-4 hidden items-center gap-1 text-sm text-muted-foreground lg:flex"
                  >
                    <a
                      href="/"
                      className="transition-colors hover:text-foreground"
                    >
                      {dict.detail.home}
                    </a>
                    <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                    <a
                      href="/tours"
                      className="transition-colors hover:text-foreground"
                    >
                      {dict.detail.tours}
                    </a>
                    <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate text-foreground">
                      {tour.title}
                    </span>
                  </nav>

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

                {/* Right: starting price + CTA. On desktop it's bottom-aligned
                    with the facts (absolute) so the spacing below the hero stays
                    constant regardless of how tall the title is. */}
                <div className="mt-6 rounded-2xl border border-border bg-card/80 p-5 backdrop-blur lg:absolute lg:bottom-0 lg:right-0 lg:mt-0 lg:w-64">
                  <span className="text-xs text-muted-foreground">{dict.detail.from}</span>
                  <p className="font-heading text-3xl font-extrabold text-foreground">
                    <Price isk={priceAmount} fallback={dict.detail.contactUs} />
                  </p>
                  {priceAmount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {dict.detail.perPerson}
                    </span>
                  )}
                  <a
                    href="#book"
                    className="mt-4 flex w-full items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    {dict.detail.bookNow}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Body */}
        <section className="mx-auto max-w-7xl px-4 pb-10 pt-6 md:px-6 md:py-14">
          <div className="flex flex-col gap-12 lg:grid lg:grid-cols-[1fr_380px]">
            {/* Left: content */}
            <div className="flex flex-col gap-12">
              {/* Gallery */}
              {gallery.length > 0 && (
                <TourGallery
                  images={gallery}
                  alts={galleryAlts}
                  title={tour.title}
                />
              )}

              {/* About */}
              <section aria-labelledby="about-heading">
                <h2
                  id="about-heading"
                  className="font-heading text-2xl font-extrabold text-foreground md:text-3xl"
                >
                  {dict.detail.about}
                </h2>
                {paragraphs.length > 0 ? (
                  <div className="mt-4 flex flex-col gap-4 text-pretty text-base leading-relaxed text-muted-foreground">
                    {paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                    {tour.excerpt?.trim() || dict.detail.aboutFallback}
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
                    {dict.detail.whatsIncluded}
                  </h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    {tour.includedItems.length > 0 && (
                      <div className="rounded-2xl border border-border bg-card p-5">
                        <p className="font-heading text-sm font-bold text-foreground">
                          {dict.detail.included}
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
                          {dict.detail.notIncluded}
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
                    {dict.detail.itinerary}
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
                    {dict.detail.knowBefore}
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
                            {dict.detail.whatToBring}
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
                            {dict.detail.goodToKnow}
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
                            {dict.detail.importantInfo}
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
              {tour.lat != null && tour.lng != null && (
                <TourMapSection
                  lat={tour.lat}
                  lng={tour.lng}
                  location={locationText}
                  stops={tour.mapStops}
                  heading={dict.map.routeLocation}
                  mapLabel={dict.map.mapView}
                  satelliteLabel={dict.map.satelliteView}
                />
              )}
            </div>

            {/* Right: booking panel + reassurance cards */}
            <aside id="book" className="flex scroll-mt-24 flex-col gap-6">
              <BookingForm
                  bokunId={tour.bokunId}
                  slots={slots}
                  extras={extras}
                  fees={fees}
                  pickup={pickup}
                fallbackPhone="+354 419 1600"
                startingPriceIsk={priceAmount}
              />

              {/* Why book with us */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h3 className="font-heading text-lg font-bold text-foreground">
                  {dict.detail.whyBookTitle}
                </h3>
                <ul className="mt-5 flex flex-col gap-4">
                  {[
                    { icon: Wallet, text: dict.detail.whyBestPrice },
                    { icon: Headphones, text: dict.detail.whyFriendly },
                    { icon: Star, text: dict.detail.whyHandPicked },
                    { icon: Compass, text: dict.detail.whyFlexible },
                  ].map((item) => (
                    <li key={item.text} className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <item.icon className="size-[18px]" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-medium text-foreground">
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Still have doubts */}
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <h3 className="font-heading text-lg font-bold text-foreground">
                  {dict.detail.doubtsTitle}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {dict.detail.doubtsText}
                </p>
                <div className="mt-5 flex flex-col gap-3">
                  <a
                    href="tel:+3544191600"
                    className="flex items-center gap-3 text-sm font-medium text-foreground transition-colors hover:text-primary"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Phone className="size-[18px]" aria-hidden="true" />
                    </span>
                    +354 419 1600
                  </a>
                  <a
                    href="mailto:info@visit.is"
                    className="flex items-center gap-3 text-sm font-medium text-foreground transition-colors hover:text-primary"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Mail className="size-[18px]" aria-hidden="true" />
                    </span>
                    info@visit.is
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* Related tours */}
        {related.length > 0 && (
          <section className="bg-secondary/40 py-14">
            <div className="mx-auto max-w-7xl px-4 md:px-6">
              <h2 className="font-heading text-2xl font-extrabold text-foreground md:text-3xl">
                {dict.detail.relatedTitle}
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
                        <span className="text-xs text-muted-foreground">{dict.detail.from}</span>
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
