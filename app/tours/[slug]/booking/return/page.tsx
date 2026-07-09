import Link from "next/link"
import { notFound } from "next/navigation"
import {
  CheckCircle2,
  Clock,
  XCircle,
  CalendarDays,
  Users,
  Download,
} from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Price } from "@/components/price"
import { buttonVariants } from "@/components/ui/button"
import { confirmBookingFromReturn } from "@/app/actions/booking"
import { getLocale } from "@/lib/get-locale"
import { getServerDict } from "@/lib/get-dictionary"
import { fmt } from "@/lib/translations"

export const dynamic = "force-dynamic"

export default async function BookingReturnPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams
  const [locale, dict] = await Promise.all([getLocale(), getServerDict()])
  const t = dict.payment
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
    locale,
    { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  )

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
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
            {paid && t.returnConfirmed}
            {failed && t.returnFailed}
            {pending && t.returnPending}
          </h1>

          <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
            {paid && fmt(t.returnConfirmedText, { email: result.email })}
            {failed && t.returnFailedText}
            {pending && t.returnPendingText}
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
                {result.totalPax === 1 ? t.participant : t.participants}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="text-sm font-medium text-foreground">{t.total}</span>
              <span className="text-lg font-semibold text-foreground">
                <Price isk={result.amountIsk} />
              </span>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {failed && (
              <Link
                href={`/tours/${slug}`}
                className={buttonVariants({ size: "lg" })}
              >
                {t.tryAgain}
              </Link>
            )}
            {paid && (
              <a
                href={`/api/bookings/${bookingId}/voucher`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "lg" })}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {t.downloadVoucher}
              </a>
            )}
            <Link
              href="/tours"
              className={buttonVariants({
                variant: paid || failed ? "outline" : "default",
                size: "lg",
              })}
            >
              {t.browseMore}
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
