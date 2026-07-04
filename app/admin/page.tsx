import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
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
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const { section } = await searchParams
  const initialSection: AdminSection = (
    ["tours", "categories", "locations"].includes(section ?? "")
      ? section
      : "tours"
  ) as AdminSection

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
