import { Button } from "@/components/ui/button"
import { transfers } from "@/lib/data"
import { Bus, Users, ArrowRight } from "lucide-react"

export function Transportation() {
  return (
    <section id="transfers" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="font-heading text-sm font-bold uppercase tracking-wider text-primary">
            Services &amp; Transportation
          </p>
          <h2 className="mt-2 text-balance font-heading text-3xl font-extrabold text-foreground md:text-4xl">
            Get from point A to B. Hassle free.
          </h2>
          <p className="mt-4 max-w-md text-pretty leading-relaxed text-muted-foreground">
            Whether you need swift airport transfers, a convenient ride to the
            Blue Lagoon, or a journey from your hotel to key destinations,
            we&apos;ve got you covered with reliable service across Iceland.
          </p>
          <Button className="mt-6 rounded-full">See all transfers</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {transfers.map((t) => (
            <div
              key={t.title}
              className="card-lift group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <Bus className="size-5" aria-hidden="true" />
              </span>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {t.route}
                </p>
                <h3 className="mt-1 font-heading text-base font-bold leading-snug text-foreground">
                  {t.title}
                </h3>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="size-4" aria-hidden="true" />
                  Max {t.maxPeople}
                </span>
                <span className="flex items-center gap-1 font-heading text-lg font-extrabold text-foreground">
                  ${t.price}
                  <ArrowRight className="size-4 text-primary" aria-hidden="true" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
