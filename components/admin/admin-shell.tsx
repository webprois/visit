"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { refreshBokun } from "@/app/actions/admin"
import { AdminSidebar, type AdminSection } from "./admin-sidebar"
import { ToursWorkspace } from "./tours-workspace"
import { CategoriesWorkspace } from "./categories-workspace"
import { LocationsWorkspace } from "./locations-workspace"
import type { MergedTour } from "@/lib/tours"
import type { TourCategory, StartingLocation } from "@/lib/db/schema"

export function AdminShell({
  tours,
  categories,
  locations,
  userName,
  initialSection = "tours",
}: {
  tours: MergedTour[]
  categories: TourCategory[]
  locations: StartingLocation[]
  userName: string
  initialSection?: AdminSection
}) {
  const router = useRouter()
  const [section, setSection] = useState<AdminSection>(initialSection)
  const [refreshing, startRefresh] = useTransition()

  // Bookings and the overview dashboard live on their own routes; every other
  // section is an in-page switch.
  function handleNavigate(next: AdminSection) {
    if (next === "bookings") {
      router.push("/admin/bookings")
      return
    }
    if (next === "overview") {
      router.push("/admin/dashboard")
      return
    }
    setSection(next)
  }

  // The admin shell owns its own height (h-svh) and scrolls internally per
  // column. Lock the document scrollport while it is mounted so the whole
  // layout can't scroll as one block, then restore on unmount.
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = "hidden"
    body.style.overflow = "hidden"
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [])

  function handleRefresh() {
    startRefresh(async () => {
      const result = await refreshBokun()
      if (result && result.toursUpdated > 0) {
        toast.success(
          `Synced from Bokun: auto-categorized ${result.toursUpdated} tour${
            result.toursUpdated === 1 ? "" : "s"
          }` +
            (result.categoriesCreated > 0
              ? `, created ${result.categoriesCreated} categor${
                  result.categoriesCreated === 1 ? "y" : "ies"
                }`
              : ""),
        )
      } else {
        toast.success("Synced from Bokun")
      }
      router.refresh()
    })
  }

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  // Count how many tours reference each category (for the categories list).
  const tourCountByCategory: Record<number, number> = {}
  for (const tour of tours) {
    for (const id of tour.categoryIds) {
      tourCountByCategory[id] = (tourCountByCategory[id] ?? 0) + 1
    }
  }

  return (
    <div className="admin-surface flex h-svh flex-col overflow-hidden bg-background md:flex-row">
      <AdminSidebar
        active={section}
        onNavigate={handleNavigate}
        userName={userName}
        onRefresh={handleRefresh}
        onSignOut={handleSignOut}
        refreshing={refreshing}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {section === "tours" ? (
          <ToursWorkspace
            tours={tours}
            categories={categories}
            locations={locations}
          />
        ) : section === "categories" ? (
          <CategoriesWorkspace
            categories={categories}
            tourCountByCategory={tourCountByCategory}
          />
        ) : (
          <LocationsWorkspace tours={tours} locations={locations} />
        )}
      </main>
    </div>
  )
}
