import Image from "next/image"
import { buttonVariants } from "@/components/ui/button"
import { featuredTours, type Tour } from "@/lib/data"
import { tourBlurb } from "@/lib/tour-blurb"
import { Price } from "@/components/price"
import { getServerDict } from "@/lib/get-dictionary"
import { Clock, MapPin, Star } from "lucide-react"

type FeaturedTour = Tour & {
  tourType?: "day" | "multi-day" | "admission" | "transfer"
  excerpt?: string | null
  categoryName?: string | null
}


export async function FeaturedTours({ tours }: { tours?: FeaturedTour[] }) {
  const list: FeaturedTour[] =
    tours && tours.length > 0 ? tours.slice(0, 6) : featuredTours
  const dict = await getServerDict()
  return (
    <section id="tours" className="bg-surface-alt py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-10 flex flex-col gap-3 md:mb-14 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-heading text-sm font-bold uppercase tracking-wider text-brand">
              {dict.featured.eyebrow}
            </p>
            <h2 className="mt-3 max-w-xl text-balance font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-5xl">
              {dict.featured.title}
            </h2>
          </div>
          <a
            href="/tours"
            className={buttonVariants({
              variant: "outline",
              className: "rounded-full md:self-end",
            })}
          >
            {dict.featured.viewAll}
          </a>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((tour) => (
            <a
              key={tour.id ?? tour.title}
              href={tour.id ? `/tours/${tour.id}` : "/tours"}
              className="card-lift group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={tour.image || "/placeholder.svg"}
                  alt={tour.title}
                  fill
                  className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                {tour.categoryName ? (
                  <span className="absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/15 backdrop-blur">
                    {tour.categoryName}
                  </span>
                ) : null}
                {tour.rating > 0 && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-foreground shadow-sm">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
                    {tour.rating.toFixed(1)}
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-balance font-heading text-lg font-bold leading-snug text-foreground transition-colors group-hover:text-brand">
                  {tour.title}
                </h3>

                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {tourBlurb(tour)}
                </p>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="size-4" aria-hidden="true" />
                    {tour.duration}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4" aria-hidden="true" />
                    {tour.location}
                  </span>
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-border pt-5">
                  <div>
                    <span className="text-xs text-muted-foreground">{dict.featured.from}</span>
                    <p className="font-heading text-xl font-extrabold text-foreground">
                      <Price isk={tour.price} />
                    </p>
                  </div>
                  <span
                    className={buttonVariants({
                      size: "sm",
                      className: "rounded-full transition-transform group-hover:-translate-y-0.5",
                    })}
                  >
                    {dict.featured.viewTour}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
