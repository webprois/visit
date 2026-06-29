import type { Metadata } from "next"
import Link from "next/link"
import { XCircle } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { getLocale } from "@/lib/get-locale"
import { markBookingCancelled } from "@/app/actions/booking"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Payment cancelled — Visit.is",
  robots: { index: false },
}

export default async function PaymentCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>
}) {
  const [{ bookingId }, locale] = await Promise.all([searchParams, getLocale()])

  // Release the unpaid hold. No-op unless still "pending_payment", so this never
  // touches a booking the webhook has already confirmed.
  if (bookingId) await markBookingCancelled(bookingId)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
          <XCircle className="size-10 text-destructive" aria-hidden="true" />
          <h1 className="font-heading text-2xl font-extrabold text-foreground">
            Payment cancelled
          </h1>
          <p className="text-sm text-muted-foreground">
            You haven&apos;t been charged and your booking wasn&apos;t completed.
            You&apos;re welcome to try again whenever you&apos;re ready.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/tours"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Browse tours
            </Link>
            <a
              href="tel:+3544191600"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Call +354 419 1600
            </a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
