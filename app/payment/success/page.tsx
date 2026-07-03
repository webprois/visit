import type { Metadata } from "next"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { PaymentStatus } from "@/components/payment-status"
import { getLocale } from "@/lib/get-locale"
import { getServerDict } from "@/lib/get-dictionary"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Payment | Visit.is",
  robots: { index: false },
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ bookingId?: string }>
}) {
  const [{ bookingId }, locale, dict] = await Promise.all([
    searchParams,
    getLocale(),
    getServerDict(),
  ])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        {bookingId ? (
          <PaymentStatus bookingId={bookingId} />
        ) : (
          <div className="mx-auto max-w-md px-4 py-20 text-center text-muted-foreground">
            {dict.payment.missingRef}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
