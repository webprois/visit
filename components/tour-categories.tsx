import Image from "next/image"
import type { HomeCategory } from "@/lib/tours"

export function TourCategories({ categories }: { categories: HomeCategory[] }) {
  if (categories.length === 0) return null

  return (
    <section id="categories" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
      <div className="mb-10 flex flex-col gap-3 md:mb-12 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-heading text-sm font-bold uppercase tracking-wider text-primary">
            Choose your activity
          </p>
          <h2 className="mt-2 max-w-xl text-balance font-heading text-3xl font-extrabold text-foreground md:text-4xl">
            Explore Iceland by adventure
          </h2>
        </div>
        <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
          Browse our most popular categories and dive into unforgettable
          experiences across the whole island.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {categories.map((cat) => (
          <a
            key={cat.id}
            href={`/tours?category=${encodeURIComponent(cat.slug)}`}
            className="group relative aspect-[4/5] overflow-hidden rounded-2xl"
          >
            <Image
              src={cat.image || "/placeholder.svg"}
              alt={cat.name}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <h3 className="font-heading text-lg font-bold leading-tight text-foreground">
                {cat.name}
              </h3>
              <p className="text-sm text-foreground/80">
                {cat.count} {cat.count === 1 ? "tour" : "tours"}
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  )
}
