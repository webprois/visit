"use client"

import { useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { refreshBokun } from "@/app/actions/admin"
import { AdminSidebar, type AdminSection } from "./admin-sidebar"
import { DashboardWorkspace } from "./dashboard-workspace"
import type { DashboardData } from "@/lib/dashboard"

export function DashboardShell({
  data,
  userName,
}: {
  data: DashboardData
  userName: string
}) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()

  // Match the other admin surfaces: lock document scroll so each column
  // scrolls independently.
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

  function handleNavigate(next: AdminSection) {
    if (next === "overview") return
    if (next === "bookings") {
      router.push("/admin/bookings")
      return
    }
    router.push(`/admin?section=${next}`)
  }

  function handleRefresh() {
    startRefresh(async () => {
      await refreshBokun()
      toast.success("Synced from Bokun")
      router.refresh()
    })
  }

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <div className="admin-surface flex h-svh overflow-hidden bg-background">
      <AdminSidebar
        active="overview"
        onNavigate={handleNavigate}
        userName={userName}
        onRefresh={handleRefresh}
        onSignOut={handleSignOut}
        refreshing={refreshing}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardWorkspace data={data} />
      </main>
    </div>
  )
}
