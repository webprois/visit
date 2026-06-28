import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import {
  getMergedTours,
  getCategories,
  getStartingLocations,
} from "@/lib/tours"
import { AdminShell } from "@/components/admin/admin-shell"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

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
    />
  )
}
