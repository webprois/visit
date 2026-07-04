import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/require-auth"
import {
  getMergedTours,
  getCategories,
  getStartingLocations,
} from "@/lib/tours"
import { AdminShell } from "@/components/admin/admin-shell"
import type { AdminSection } from "@/components/admin/admin-sidebar"

export const dynamic = "force-dynamic"

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>
}) {
  const session = await requireAdmin()

  const { section } = await searchParams
  // The overview dashboard is the landing page; bare /admin sends you there.
  if (!["tours", "categories", "locations"].includes(section ?? "")) {
    redirect("/admin/dashboard")
  }
  const initialSection = section as AdminSection

  const [tours, categories, locations] = await Promise.all([
    getMergedTours(),
    getCategories(),
    getStartingLocations(),
  ])

  return (
    <AdminShell
      tours={tours}
      categories={categories}
      locations={locations}
      userName={session.user.name || session.user.email}
      initialSection={initialSection}
    />
  )
}
