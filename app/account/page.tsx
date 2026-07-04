import type { Metadata } from "next"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { isAdminEmail } from "@/lib/roles"
import { getLocale } from "@/lib/get-locale"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { AccountHeader } from "@/components/account/account-header"
import { TripsSection, TripsSkeleton } from "@/components/account/trips-section"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "My Trips | Visit Iceland",
  description: "View and manage the tours you have booked with Visit Iceland.",
}

export default async function AccountPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  // Admins belong in the admin workspace, not the customer account area.
  if (isAdminEmail(session.user.email)) redirect("/admin/dashboard")

  const locale = await getLocale()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-10 md:px-6 md:py-14">
          <AccountHeader
            name={session.user.name || session.user.email}
            email={session.user.email}
          />
          <Suspense fallback={<TripsSkeleton />}>
            <TripsSection
              userId={session.user.id}
              email={session.user.email}
              locale={locale}
            />
          </Suspense>
        </section>
      </main>
      <SiteFooter hideNewsletter />
    </div>
  )
}
