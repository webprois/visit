import Link from "next/link"
import { Calendar, Users, Clock, Ticket, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { formatMoney } from "@/lib/currency"
import type { MyTrip } from "@/lib/my-trips"
import { EditPickup } from "@/components/account/edit-pickup"

const STATUS_LABELS: Record<MyTrip["status"], string> = {
  upcoming: "Upcoming",
  completed: "Completed",
  cancelled: "Cancelled",
  pending: "Pending payment",
}

const STATUS_STYLES: Record<MyTrip["status"], string> = {
  upcoming: "bg-primary/15 text-primary",
  completed: "bg-secondary text-secondary-foreground",
  cancelled: "bg-destructive/15 text-destructive",
  pending: "bg-accent/15 text-accent-foreground",
}

function formatDate(ms: number | null): string {
  if (!ms) return "Date to be confirmed"
  return new Date(ms).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function TripCard({ trip }: { trip: MyTrip }) {
  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-lg font-bold text-foreground">
            {trip.tourTitle}
          </h3>
          <Badge className={STATUS_STYLES[trip.status]}>
            {STATUS_LABELS[trip.status]}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="size-4" aria-hidden="true" />
            {formatDate(trip.travelDate)}
          </span>
          {trip.startTime && (
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden="true" />
              {trip.startTime}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Users className="size-4" aria-hidden="true" />
            {trip.totalPax} {trip.totalPax === 1 ? "guest" : "guests"}
          </span>
          {trip.confirmationCode && (
            <span className="flex items-center gap-1.5">
              <Ticket className="size-4" aria-hidden="true" />
              {trip.confirmationCode}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
        <span className="font-heading text-xl font-bold text-foreground">
          {formatMoney(trip.amount, trip.currency)}
        </span>
        {trip.bokunId && trip.status !== "cancelled" && (
          <Link
            href={`/tours/${trip.bokunId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <MapPin className="size-4" aria-hidden="true" />
            View tour
          </Link>
        )}
      </div>
      </div>
      {trip.siteId && trip.editablePickup && (
        <div className="border-t border-border/60 pt-4">
          <EditPickup bookingId={trip.siteId} pickup={trip.editablePickup} />
        </div>
      )}
    </li>
  )
}

export function MyTrips({ trips }: { trips: MyTrip[] }) {
  if (trips.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
        <h2 className="font-heading text-xl font-bold text-foreground">
          No trips yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-pretty text-muted-foreground">
          When you book a tour with the email address on your account, it will
          show up here so you can keep track of your adventures.
        </p>
        <Link href="/tours" className={buttonVariants({ className: "mt-6" })}>
          Browse tours
        </Link>
      </div>
    )
  }

  const upcoming = trips.filter((t) => t.status === "upcoming" || t.status === "pending")
  const past = trips.filter((t) => t.status === "completed" || t.status === "cancelled")

  return (
    <div className="flex flex-col gap-10">
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
            Upcoming
          </h2>
          <ul className="flex flex-col gap-4">
            {upcoming.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="mb-4 font-heading text-lg font-bold text-foreground">
            Past trips
          </h2>
          <ul className="flex flex-col gap-4">
            {past.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
