import Link from "next/link"
import { ArrowUpRight, Car, CalendarRange, Compass, Sparkles } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { getServerDict } from "@/lib/get-dictionary"

type TourType = {
  title: string
  text: string
  href: string
  color: string
  Icon: LucideIcon
}

export async function TourTypes() {
  const dict = await getServerDict()
  const t = dict.tourTypes

  const cards: TourType[] = [
    {
      title: t.selfDriveTitle,
      text: t.selfDriveText,
      href: "/self-drive-tours",
      color: "#34456b",
      Icon: Car,
    },
    {
      title: t.multiDayTitle,
      text: t.multiDayText,
      href: "/tours",
      color: "#2f6f75",
      Icon: CalendarRange,
    },
    {
      title: t.oneDayTitle,
      text: t.oneDayText,
      href: "/tours",
      color: "#4a7c6f",
      Icon: Compass,
    },
    {
      title: t.tailorTitle,
      text: t.tailorText,
      href: "/tailor-made",
      color: "#a3822f",
      Icon: Sparkles,
    },
  ]

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-4 md:px-6 md:pb-24 md:pt-6">
      <div className="mb-10 flex flex-col gap-3 md:mb-12">
        <p className="font-heading text-sm font-bold uppercase tracking-wider text-primary">
          {t.eyebrow}
        </p>
        <h2 className="max-w-2xl text-balance font-heading text-3xl font-extrabold text-foreground md:text-4xl">
          {t.title}
        </h2>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          {t.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const { Icon } = card
          return (
            <Link
              key={card.title}
              href={card.href}
              aria-label={card.title}
              className="card-lift group relative flex min-h-64 flex-col justify-between overflow-hidden rounded-3xl p-6 text-white transition-[filter] duration-300 hover:brightness-110"
              style={{ backgroundColor: card.color }}
            >
              {/* Notch + arrow button in the top-right corner */}
              <span className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full border border-white/40 bg-white/5 transition-colors duration-300 group-hover:border-primary group-hover:bg-primary">
                <ArrowUpRight className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>

              <Icon className="h-8 w-8 text-white" strokeWidth={1.5} aria-hidden="true" />

              <div className="mt-8">
                <h3 className="max-w-[85%] text-balance font-heading text-xl font-bold leading-tight">
                  {card.title}
                </h3>
                <p className="mt-3 text-pretty text-sm leading-relaxed text-white/80">
                  {card.text}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
