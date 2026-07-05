import Image from "next/image"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Star } from "lucide-react"
import { getServerDict } from "@/lib/get-dictionary"
import { cn } from "@/lib/utils"

export async function Hero() {
  const dict = await getServerDict()
  return (
    <section id="top" className="relative isolate z-30 overflow-hidden">
      <Image
        src="/images/hero-iceland.png"
        alt="Powerful Icelandic waterfall over volcanic cliffs at golden hour"
        fill
        priority
        className="-z-10 object-cover"
        sizes="100vw"
      />
      {/* Cinematic dark overlay so the copy stays readable over the photo in
          both light and dark themes. */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/45 to-black/70" />
      {/* Bottom fade blends the hero into the page background beneath it. */}
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-background" />

      <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 pb-32 pt-24 md:px-6 md:pb-40 md:pt-36">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white ring-1 ring-inset ring-white/20 backdrop-blur">
          <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
          {dict.hero.badge}
        </span>

        <h1 className="max-w-4xl text-balance font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.35)] md:text-6xl lg:text-7xl">
          {dict.hero.title}
        </h1>
        <p className="max-w-xl text-pretty text-base leading-relaxed text-white/90 md:text-lg">
          {dict.hero.subtitle}
        </p>

        <div className="mt-1 flex flex-wrap gap-3">
          <Link
            href="/tours"
            className={cn(
              buttonVariants({
                size: "lg",
                className:
                  "glow-primary rounded-full px-7 text-base font-semibold transition-transform hover:-translate-y-0.5",
              }),
            )}
          >
            {dict.hero.exploreTours}
          </Link>
          <Link
            href="/tailor-made"
            className={cn(
              buttonVariants({
                size: "lg",
                variant: "secondary",
                className:
                  "rounded-full border border-white/25 bg-white/10 px-7 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/20",
              }),
            )}
          >
            {dict.hero.privateTrip}
          </Link>
        </div>
      </div>
    </section>
  )
}
