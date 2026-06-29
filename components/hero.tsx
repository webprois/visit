import Image from "next/image"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Star } from "lucide-react"
import { TourSearch, type Experience } from "@/components/tour-search"
import { cn } from "@/lib/utils"

export function Hero({ experiences }: { experiences: Experience[] }) {
  return (
    <section id="top" className="relative isolate z-30">
      <Image
        src="/images/hero-iceland.png"
        alt="Powerful Icelandic waterfall over volcanic cliffs at golden hour"
        fill
        priority
        className="-z-10 object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background/70 via-background/45 to-background/95" />
      {/* Vignette + corner glow to focus the eye on the copy and blend into the page. */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_0%,transparent_40%,var(--background)_100%)]" />

      <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 pb-16 pt-20 md:px-6 md:pb-24 md:pt-32">
        <span className="inline-flex items-center gap-2 rounded-full bg-foreground/10 px-4 py-1.5 text-sm font-medium text-foreground backdrop-blur">
          <Star className="size-4 fill-accent text-accent" aria-hidden="true" />
          Trusted by 500+ travellers
        </span>

        <h1 className="max-w-3xl text-balance font-heading text-4xl font-extrabold leading-tight text-foreground drop-shadow-lg md:text-6xl">
          Ready for adventure in the land of fire and ice?
        </h1>
        <p className="max-w-xl text-pretty text-base leading-relaxed text-foreground/85 md:text-lg">
          Explore over 70 handpicked tours across Iceland — from glacier hikes
          and northern lights to the Golden Circle. Let&apos;s create
          unforgettable memories together.
        </p>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/tours"
            className={cn(
              buttonVariants({
                size: "lg",
                className:
                  "glow-primary rounded-full transition-transform hover:-translate-y-0.5",
              }),
            )}
          >
            Explore Tours
          </Link>
          <Button
            size="lg"
            variant="secondary"
            className="rounded-full bg-foreground/10 text-foreground backdrop-blur hover:bg-foreground/20"
          >
            Plan a Private Trip
          </Button>
        </div>

        {/* Search widget */}
        <div className="mt-6 w-full">
          <TourSearch experiences={experiences} />
        </div>
      </div>
    </section>
  )
}
