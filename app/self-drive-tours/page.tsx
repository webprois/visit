import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { getLocale } from "@/lib/get-locale"
import { getServerDict } from "@/lib/get-dictionary"
import { SELF_DRIVE_TIERS, formatEur, type SelfDriveTierKey } from "@/lib/self-drive"
import { Check, X, ArrowUpRight } from "lucide-react"

export const metadata: Metadata = {
  title: "Self Drive Tours | Visit Iceland",
  description:
    "Explore Iceland at your own pace with our Basic, Standard and Premium self-drive packages. Tours, hotels and rental car included across 5, 7 or 10 day itineraries.",
}

/**
 * Heuristic to flag "not included" / limited services so they render with a
 * muted cross instead of a check, matching the reference. Kept locale-aware
 * with a small set of negative keywords across the supported languages.
 */
const NEGATIVE = /\b(not included|no incluido|não incluído|non inclusa|shared|solo baño|apenas banheiro|solo bagno|NOT)\b/i

export default async function SelfDriveToursPage() {
  const locale = await getLocale()
  const dict = await getServerDict()
  const t = dict.selfDrive

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        {/* Hero + intro with shared background */}
        <section className="relative isolate">
          <Image
            src="/images/self-drive-hero.png"
            alt="A car driving along an open road through dramatic Icelandic mountain scenery"
            fill
            priority
            className="-z-10 object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/70 via-background/60 to-background" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_70%_at_50%_0%,transparent_30%,var(--background)_100%)]" />
          <div className="mx-auto max-w-7xl px-4 pb-14 pt-20 md:px-6 md:pb-20 md:pt-28">
            <h1 className="max-w-3xl text-balance font-heading text-4xl font-extrabold leading-tight text-foreground drop-shadow-lg md:text-6xl">
              {t.heroLine1} {t.heroLine2}
            </h1>
            <div className="mt-8">
              <p className="text-pretty text-base leading-relaxed text-foreground/85 md:text-lg">
                {t.heroSubtitle} {t.heroBody}
              </p>
              <p className="mt-8 border-l-4 border-primary pl-5 font-heading text-xl font-bold text-foreground md:text-2xl">
                {t.includedNote}
              </p>
            </div>
          </div>
        </section>

        {/* Package selection */}
        <section className="bg-secondary/30 py-14 md:py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="mx-auto mb-12 max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
                {t.selectTitle}
              </h2>
              <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                {t.selectText}
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {SELF_DRIVE_TIERS.map((tier) => {
                const tierCopy = t.tiers[tier.key as SelfDriveTierKey]
                return (
                  <div
                    key={tier.key}
                    className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
                  >
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-heading text-2xl font-extrabold text-foreground">
                        {tierCopy.name}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {tierCopy.description}
                      </p>
                      <p className="mt-4 font-heading text-base font-bold text-primary">
                        {t.choosePackage}
                      </p>

                      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {t.servicesLabel}
                      </p>
                      <ul className="mt-3 flex flex-col gap-2.5">
                        {tierCopy.services.map((service) => {
                          const excluded = NEGATIVE.test(service)
                          return (
                            <li
                              key={service}
                              className="flex items-start gap-2.5 text-sm text-foreground"
                            >
                              {excluded ? (
                                <X
                                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Check
                                  className="mt-0.5 size-4 shrink-0 text-primary"
                                  aria-hidden="true"
                                />
                              )}
                              <span className={excluded ? "text-muted-foreground" : ""}>
                                {service}
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>

                    {/* Package durations */}
                    <div className="flex flex-col gap-3 border-t border-border p-6">
                      {tier.packages.map((pkg) => {
                        const name = `${tierCopy.name.split(" ")[0]} ${pkg.days} ${t.dayLabel} ${
                          pkg.ringRoad ? t.ringRoad : ""
                        }${t.tourName}`.replace(/\s+/g, " ").trim()
                        return (
                          <div
                            key={pkg.days}
                            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 p-4"
                          >
                            <div className="min-w-0">
                              <p className="text-pretty text-sm font-semibold leading-snug text-foreground">
                                {name}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                <span>{t.estimate} </span>
                                <span className="font-heading text-sm font-extrabold text-foreground">
                                  {formatEur(pkg.priceEur)}
                                </span>{" "}
                                <span>{t.forTwo}</span>
                              </p>
                            </div>
                          </div>
                        )
                      })}
                      <Link
                        href="/tailor-made#request"
                        className="mt-1 inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        {t.requestCta}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Safety recommendations */}
        <section className="mx-auto max-w-5xl px-4 py-14 md:px-6 md:py-20">
          <div className="mb-8 text-center">
            <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
              {t.safetyTitle}
            </h2>
            <p className="mt-3 text-muted-foreground">{t.safetyText}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="https://safetravel.is"
              target="_blank"
              rel="noopener noreferrer"
              className="card-lift group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6"
            >
              <div>
                <p className="font-heading text-lg font-bold text-foreground">
                  {t.safeTravelName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.safeTravelDesc}
                </p>
              </div>
              <ArrowUpRight
                className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </a>
            <a
              href="https://island.is/en/road-conditions-and-weather"
              target="_blank"
              rel="noopener noreferrer"
              className="card-lift group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6"
            >
              <div>
                <p className="font-heading text-lg font-bold text-foreground">
                  {t.roadName}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t.roadDesc}</p>
              </div>
              <ArrowUpRight
                className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
