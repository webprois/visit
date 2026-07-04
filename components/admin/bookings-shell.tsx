"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { authClient } from "@/lib/auth-client"
import { AdminSidebar, type AdminSection } from "./admin-sidebar"
import { BookingsWorkspace } from "./bookings-workspace"
import type { BokunBookingResult } from "@/lib/bokun"

export type BookingFiltersState = {
  status: string // "ALL" | "CONFIRMED" | "CANCELLED" | ...
  confirmationCode: string
  travelFrom: string
  travelTo: string
  page: number
}

const PAGE_SIZE = 50

const fetcher = async (url: string): Promise<BokunBookingResult> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to load bookings")
  return res.json()
}

export function BookingsShell({
  initial,
  userName,
}: {
  initial: BokunBookingResult
  userName: string
}) {
  const router = useRouter()

  // Lock document scroll like the main admin shell so each column scrolls on its own.
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

  const [filters, setFilters] = useState<BookingFiltersState>({
    status: "CONFIRMED",
    confirmationCode: "",
    travelFrom: "",
    travelTo: "",
    page: 1,
  })

  const query = useMemo(() => {
    const p = new URLSearchParams()
    p.set("page", String(filters.page))
    p.set("pageSize", String(PAGE_SIZE))
    if (filters.status !== "ALL") p.set("statuses", filters.status)
    if (filters.confirmationCode.trim()) p.set("confirmationCode", filters.confirmationCode.trim())
    if (filters.travelFrom) p.set("travelFrom", filters.travelFrom)
    if (filters.travelTo) p.set("travelTo", filters.travelTo)
    return p.toString()
  }, [filters])

  // Only use the server-rendered `initial` for the exact default filter/page.
  const isDefault =
    filters.status === "CONFIRMED" &&
    !filters.confirmationCode.trim() &&
    !filters.travelFrom &&
    !filters.travelTo &&
    filters.page === 1

  const { data, isLoading, isValidating, mutate } = useSWR(
    `/api/admin/bookings?${query}`,
    fetcher,
    {
      fallbackData: isDefault ? initial : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  )

  function handleNavigate(next: AdminSection) {
    if (next === "bookings") return
    if (next === "overview") {
      router.push("/admin/dashboard")
      return
    }
    router.push(`/admin?section=${next}`)
  }

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <div className="admin-surface flex h-svh overflow-hidden bg-background">
      <AdminSidebar
        active="bookings"
        onNavigate={handleNavigate}
        userName={userName}
        onRefresh={() => mutate()}
        onSignOut={handleSignOut}
        refreshing={isValidating}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <BookingsWorkspace
          result={data ?? initial}
          loading={isLoading}
          validating={isValidating}
          filters={filters}
          onFiltersChange={setFilters}
          pageSize={PAGE_SIZE}
          onCancelled={() => mutate()}
        />
      </main>
    </div>
  )
}
