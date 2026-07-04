import { getMyTrips } from "@/lib/my-trips"
import { MyTrips } from "@/components/account/my-trips"

/**
 * Async server component that loads the customer's trips. Rendered inside a
 * Suspense boundary so the account page shell paints immediately while the
 * (potentially slow) Bokun lookup streams in.
 */
export async function TripsSection({
  userId,
  email,
}: {
  userId: string
  email: string
}) {
  const trips = await getMyTrips({ userId, email })
  return <MyTrips trips={trips} />
}

/** Skeleton placeholder shown while trips are loading. */
export function TripsSkeleton() {
  return (
    <div className="flex flex-col gap-10" aria-hidden="true">
      <section>
        <div className="mb-4 h-6 w-32 animate-pulse rounded-md bg-muted" />
        <ul className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <li
              key={i}
              className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-3">
                <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
                <div className="flex flex-wrap gap-3">
                  <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
                  <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <div className="h-7 w-24 animate-pulse rounded-md bg-muted" />
                <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
