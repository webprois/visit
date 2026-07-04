import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { fetchBokunBookings } from "@/lib/bokun"
import { BookingsShell } from "@/components/admin/bookings-shell"

export const dynamic = "force-dynamic"

export default async function AdminBookingsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  // Initial page: confirmed bookings, most recent first (Bokun default order).
  const initial = await fetchBokunBookings({ statuses: ["CONFIRMED"], pageSize: 50 })

  return (
    <BookingsShell
      initial={initial}
      userName={session.user.name || session.user.email}
    />
  )
}
