import Link from "next/link"
import { notFound } from "next/navigation"
import { CheckCircle2, Clock, XCircle, CalendarDays, Users } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Price } from "@/components/price"
import { buttonVariants } from "@/components/ui/button"
import { confirmBookingFromReturn } from "@/app/actions/booking"

export const dynamic = "force-dynamic"

export default async function BookingReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { id } = await params
  const sp = await searchParams
  const bookingId = sp.booking
  if (!bookingId) notFound()

  const result = await confirmBookingFromReturn(bookingId, {
    orderId: bookingId,
    status: sp.status,
    amount: sp.amount,
    currency: sp.currency,
    orderhash: sp.orderhash,
    step: sp.step,
  })
  if (!result) notFound()

  const paid = result.status === "paid"
  const failed = result.status === "failed"
  const pending = !paid && !failed

  const dateLabel = new Date(`${result.date}T00:00:00`).toLocaleDateString(
    "en-GB",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center px-4 py-16">
        <div className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          {paid && (
            <CheckCircle2
              className="mx-auto mb-4 h-14 w-14 text-primary"
              aria-hidden="true"
            />
          )}
          {failed && (
            <XCircle
              className="mx-auto mb-4 h-14 w-14 text-destructive"
              aria-hidden="true"
            />
          )}
          {pending && (
            <Clock
              className="mx-auto mb-4 h-14 w-14 text-muted-foreground"
              aria-hidden="true"
            />
          )}

          <h1 className="text-balance text-2xl font-semibold text-foreground">
            {paid && "Booking confirmed"}
            {failed && "Payment unsuccessful"}
            {pending && "Payment processing"}
          </h1>

          <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
            {paid &&
              `Thank you! Your booking is confirmed and a confirmation has been sent to ${result.email}.`}
            {failed &&
              "Your payment didn't go through and you have not been charged. Please try again or contact us to book."}
            {pending &&
              "We're confirming your payment. This can take a moment — refresh this page shortly."}
          </p>

          <div className="mt-6 rounded-xl bg-muted/50 p-5 text-left">
            <h2 className="text-base font-medium text-foreground">
              {result.tourTitle}
            </h2>
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              <span>{dateLabel}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>
                {result.totalPax}{" "}
                {result.totalPax === 1 ? "participant" : "participants"}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm font-medium text-foreground">Total</span>
              <span className="text-lg font-semibold text-foreground">
                <Price isk={result.amountIsk} />
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {failed && (
              <Link
                href={`/tours/${id}`}
                className={buttonVariants({ size: "lg" })}
              >
                Try again
              </Link>
            )}
            <Link
              href="/tours"
              className={buttonVariants({
                variant: failed ? "outline" : "default",
                size: "lg",
              })}
            >
              Browse more tours
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
