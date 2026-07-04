import { requireAdmin } from "@/lib/require-auth"
import { fetchAllBokunBookings } from "@/lib/bokun"
import { getExchangeRates } from "@/lib/exchange-rates"
import { buildDashboardData } from "@/lib/dashboard"
import { DEFAULT_CURRENCY } from "@/lib/currency"
import { DashboardShell } from "@/components/admin/dashboard-shell"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const session = await requireAdmin()

  const [bookings, rates] = await Promise.all([
    fetchAllBokunBookings(["CONFIRMED"]),
    getExchangeRates(),
  ])

  const data = buildDashboardData(bookings, rates, DEFAULT_CURRENCY)

  return (
    <DashboardShell
      data={data}
      userName={session.user.name || session.user.email}
    />
  )
}
