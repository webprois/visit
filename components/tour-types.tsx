import Link from "next/link"
import { ArrowRight, Car, CalendarRange, Compass, Sparkles } from "lucide-react"
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const { Icon } = card
          return (
            <Link
              key={card.title}
              href={card.href}
              aria-label={card.title}
              className="card-lift group relative block min-h-72"
            >
              {/* Circular arrow button nestled in the top-right notch */}
              <span
                className="absolute right-2 top-2 z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-white"
                style={{ borderColor: card.color, color: card.color }}
              >
                <ArrowRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>

              {/* Colored card body with a concave notch carved from the top-right corner */}
              <div
                className="flex h-full flex-col rounded-3xl p-6 text-white transition-[filter] duration-300 group-hover:brightness-110"
                style={{
                  backgroundColor: card.color,
                  WebkitMaskImage:
                    "radial-gradient(circle 3.25rem at top right, transparent 0 3.25rem, black calc(3.25rem + 0.5px))",
                  maskImage:
                    "radial-gradient(circle 3.25rem at top right, transparent 0 3.25rem, black calc(3.25rem + 0.5px))",
                }}
              >
                <Icon className="h-9 w-9 text-white" strokeWidth={1.75} aria-hidden="true" />

                <h3 className="mt-10 max-w-[90%] text-balance font-heading text-2xl font-bold leading-tight">
                  {card.title}
                </h3>
                <p className="mt-4 text-pretty text-sm leading-relaxed text-white/85">
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
