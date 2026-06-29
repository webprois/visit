import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { PaymentStatus } from "@/components/payment-status"
import { getLocale } from "@/lib/get-locale"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Payment — Visit.is",
  robots: { index: false },
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>
}) {
  const [{ bookingId }, locale] = await Promise.all([searchParams, getLocale()])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        {bookingId ? (
          <PaymentStatus bookingId={bookingId} />
        ) : (
          <div className="mx-auto max-w-md px-4 py-20 text-center text-muted-foreground">
            Missing booking reference.
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
