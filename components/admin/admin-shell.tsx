"use client"

import { useState, useTransition } from "react"
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
}: {
  tours: MergedTour[]
  categories: TourCategory[]
  locations: StartingLocation[]
  userName: string
}) {
  const router = useRouter()
  const [section, setSection] = useState<AdminSection>("tours")
  const [refreshing, startRefresh] = useTransition()

  function handleRefresh() {
    startRefresh(async () => {
      const result = await refreshBokun()
      if (result && result.toursUpdated > 0) {
        toast.success(
          `Synced from Bokun — auto-categorized ${result.toursUpdated} tour${
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
    <div className="flex h-svh overflow-hidden bg-background">
      <AdminSidebar
        active={section}
        onNavigate={setSection}
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
