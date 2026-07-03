import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { getLocale } from "@/lib/get-locale"
import { getServerDict } from "@/lib/get-dictionary"
import { SELF_DRIVE_TIERS, formatEur, type SelfDriveTierKey } from "@/lib/self-drive"
import { Check, X, ArrowUpRight, Car, Mountain, Camera } from "lucide-react"

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
        {/* Hero */}
        <section className="relative isolate">
          <div className="absolute inset-0 -z-10 h-[62vh] min-h-[520px] overflow-hidden md:h-[72vh]">
            <Image
              src="/images/self-drive-hero.png"
              alt="A car driving along an open road through dramatic Icelandic mountain scenery"
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-transparent" />
          </div>

          <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 md:px-6 md:pb-24 md:pt-28">
            <div className="max-w-2xl">
              <h1 className="text-balance font-heading text-5xl font-extrabold leading-[1.05] text-foreground drop-shadow-lg md:text-7xl">
                {t.heroLine1}
                <span className="mt-1 block italic text-primary">{t.heroLine2}</span>
              </h1>
              <p className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-foreground/85 md:text-lg">
                {t.heroSubtitle}
              </p>

              <div className="mt-8 h-1 w-16 rounded-full bg-primary" />

              <ul className="mt-8 grid gap-6 sm:grid-cols-3">
                {[
                  { icon: Car, label: t.feature1 },
                  { icon: Mountain, label: t.feature2 },
                  { icon: Camera, label: t.feature3 },
                ].map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-background/40 text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium leading-snug text-foreground/90">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-10 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
                {t.heroBody}
              </p>

              <p className="mt-8 border-l-4 border-primary pl-5 font-heading text-lg font-bold text-foreground md:text-xl">
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
                    className="flex flex-col overflow-hidden rounded-2xl border border-border bg-[#1E2738] shadow-sm"
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
