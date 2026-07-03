import { Skeleton } from "@/components/ui/skeleton"
import { BrandLoader } from "@/components/brand-loader"
import { getServerDict } from "@/lib/get-dictionary"

/**
 * Instant loading UI for the tours route. Because `/tours` is force-dynamic and
 * may block on live Bokun availability lookups, this skeleton renders the moment
 * the user hits "Search", so the transition feels responsive instead of frozen.
 */
export default async function ToursLoading() {
  const dict = await getServerDict()
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero */}
      <section className="bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-10 w-72 md:h-14 md:w-96" />
          <Skeleton className="mt-4 h-5 w-full max-w-2xl" />

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BrandLoader size={22} label={dict.toursLoading.checking} />
              {dict.toursLoading.checking}
            </span>
            <Skeleton className="h-8 w-40 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
        </div>
      </section>

      {/* Tour grid */}
      <section className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6 md:py-14">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <Skeleton className="aspect-[4/3] w-full rounded-none" />
              <div className="flex flex-col gap-3 p-4">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="mt-2 h-6 w-24" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
