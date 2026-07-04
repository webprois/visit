import { requireAdmin } from "@/lib/require-auth"
import { fetchBokunBookings } from "@/lib/bokun"
import { BookingsShell } from "@/components/admin/bookings-shell"

export const dynamic = "force-dynamic"

export default async function AdminBookingsPage() {
  const session = await requireAdmin()

  // Initial page: confirmed bookings, most recent first (Bokun default order).
  const initial = await fetchBokunBookings({ statuses: ["CONFIRMED"], pageSize: 50 })

  return (
    <BookingsShell
      initial={initial}
      userName={session.user.name || session.user.email}
    />
  )
}
