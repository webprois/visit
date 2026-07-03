import Image from "next/image"
import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { TailorMadeForm } from "@/components/tailor-made-form"
import { getLocale } from "@/lib/get-locale"
import { getServerDict } from "@/lib/get-dictionary"

export const metadata: Metadata = {
  title: "Tailor Made & Private Tours | Visit Iceland",
  description:
    "Plan a fully customised Icelandic adventure for individuals, private groups, families and incentive trips. Submit a request and our seasoned agents will craft your perfect trip.",
}

export default async function TailorMadePage() {
  const locale = await getLocale()
  const dict = await getServerDict()
  const t = dict.tailorMade

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        {/* Hero + intro with shared background */}
        <section className="relative isolate">
          <Image
            src="/images/tailor-made-hero.png"
            alt="Remote gravel road winding through an Icelandic valley toward snow-capped mountains at golden hour"
            fill
            priority
            className="-z-10 object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/70 via-background/60 to-background" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_70%_at_50%_0%,transparent_30%,var(--background)_100%)]" />
          <div className="mx-auto max-w-7xl px-4 pb-14 pt-20 md:px-6 md:pb-20 md:pt-28">
            <h1 className="max-w-3xl text-balance font-heading text-4xl font-extrabold leading-tight text-foreground drop-shadow-lg md:text-6xl">
              {t.title}
            </h1>
            <div className="mt-8 flex max-w-3xl flex-col gap-5 text-pretty text-base leading-relaxed text-foreground/85 md:text-lg">
              <p>{t.subtitle}</p>
              <p>{t.intro1}</p>
              <p>{t.intro2}</p>
              <p>{t.intro3}</p>
            </div>
          </div>
        </section>

        {/* Request form */}
        <section id="request" className="scroll-mt-24 bg-secondary/30 py-14 md:py-20">
          <div className="mx-auto max-w-5xl px-4 md:px-6">
            <div className="mb-8 text-center">
              <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
                {t.formTitle}
              </h2>
              <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
                {t.formSubtitle}
              </p>
            </div>
            <TailorMadeForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
