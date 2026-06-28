import Image from "next/image"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Star } from "lucide-react"
import { TourSearch, type Experience } from "@/components/tour-search"

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

      <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 pb-16 pt-20 md:px-6 md:pb-24 md:pt-32">
        <span className="inline-flex items-center gap-2 rounded-full bg-foreground/10 px-4 py-1.5 text-sm font-medium text-foreground ring-1 ring-foreground/25 backdrop-blur">
          <Star className="size-4 fill-accent text-accent" aria-hidden="true" />
          Trusted by 500+ travellers
        </span>

        <h1 className="max-w-3xl text-balance font-heading text-4xl font-extrabold leading-tight text-foreground drop-shadow-md md:text-6xl">
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
            className={buttonVariants({ size: "lg", className: "rounded-full" })}
          >
            Explore Tours
          </Link>
          <Button
            size="lg"
            variant="secondary"
            className="rounded-full bg-foreground/10 text-foreground ring-1 ring-foreground/25 backdrop-blur hover:bg-foreground/20"
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
