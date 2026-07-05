import Image from "next/image"
import { ArrowUpRight } from "lucide-react"
import type { HomeCategory } from "@/lib/tours"
import { getServerDict } from "@/lib/get-dictionary"
import { fmt } from "@/lib/translations"

export async function TourCategories({
  categories,
}: {
  categories: HomeCategory[]
}) {
  if (categories.length === 0) return null
  const dict = await getServerDict()

  return (
    <section id="categories" className="mx-auto max-w-7xl px-4 py-20 md:px-6 md:py-28">
      <div className="mb-10 flex flex-col gap-3 md:mb-14 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-heading text-sm font-bold uppercase tracking-wider text-brand">
            {dict.categories.eyebrow}
          </p>
          <h2 className="mt-3 max-w-xl text-balance font-heading text-3xl font-extrabold tracking-tight text-foreground md:text-5xl">
            {dict.categories.title}
          </h2>
        </div>
        <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
          {dict.categories.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {categories.map((cat) => (
          <a
            key={cat.id}
            href={`/tours?category=${encodeURIComponent(cat.slug)}`}
            className="card-lift group relative aspect-[4/5] overflow-hidden rounded-3xl shadow-sm ring-1 ring-black/5 ring-inset"
          >
            <Image
              src={cat.image || "/placeholder.svg"}
              alt={cat.name}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
            {/* Fixed dark gradient (not theme background) keeps labels readable
                over every photo in both themes. */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-5 transition-transform duration-300 group-hover:-translate-y-1">
              <div>
                <h3 className="font-heading text-lg font-bold leading-tight text-white">
                  {cat.name}
                </h3>
                <p className="text-sm text-white/80">
                  {fmt(cat.count === 1 ? dict.categories.tour : dict.categories.tours, {
                    count: cat.count,
                  })}
                </p>
              </div>
              <span className="flex size-9 shrink-0 translate-y-1 items-center justify-center rounded-full bg-white/15 text-white opacity-0 ring-1 ring-inset ring-white/25 backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
