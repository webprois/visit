import Image from "next/image"
import { buttonVariants } from "@/components/ui/button"
import { featuredTours, type Tour } from "@/lib/data"
import { tourBlurb } from "@/lib/tour-blurb"
import { Price } from "@/components/price"
import { Clock, MapPin, Star } from "lucide-react"

type FeaturedTour = Tour & {
  tourType?: "day" | "multi-day"
  excerpt?: string | null
  categoryName?: string | null
}


export function FeaturedTours({ tours }: { tours?: FeaturedTour[] }) {
  const list: FeaturedTour[] =
    tours && tours.length > 0 ? tours.slice(0, 6) : featuredTours
  return (
    <section id="tours" className="bg-secondary/50 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-10 flex flex-col gap-3 md:mb-12 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-heading text-sm font-bold uppercase tracking-wider text-primary">
              Discover our tours
            </p>
            <h2 className="mt-2 max-w-xl text-balance font-heading text-3xl font-extrabold text-foreground md:text-4xl">
              Handpicked adventures
            </h2>
          </div>
          <a
            href="/tours"
            className={buttonVariants({
              variant: "outline",
              className: "rounded-full md:self-end",
            })}
          >
            View all tours
          </a>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((tour) => (
            <a
              key={tour.id ?? tour.title}
              href={tour.id ? `/tours/${tour.id}` : "/tours"}
              className="card-lift group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={tour.image || "/placeholder.svg"}
                  alt={tour.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>

              <div className="flex flex-1 flex-col p-5">
                {tour.rating > 0 && (
                  <div className="mb-2 flex items-center gap-1 text-sm font-semibold text-foreground">
                    <Star className="size-4 fill-accent text-accent" aria-hidden="true" />
                    {tour.rating.toFixed(1)}
                  </div>
                )}
                <h3 className="text-balance font-heading text-lg font-bold leading-snug text-foreground">
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

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <div>
                    <span className="text-xs text-muted-foreground">From</span>
                    <p className="font-heading text-xl font-extrabold text-foreground">
                      <Price isk={tour.price} />
                    </p>
                  </div>
                  <span
                    className={buttonVariants({
                      size: "sm",
                      className: "rounded-full",
                    })}
                  >
                    View tour
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
