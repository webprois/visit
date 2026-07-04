import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/require-auth"
import { fetchBokunBookings, type BokunBookingFilters } from "@/lib/bokun"

export const dynamic = "force-dynamic"

/**
 * Admin-only endpoint that returns Bokun reservations with optional filters.
 * Used by the bookings workspace for live filtering and pagination.
 */
export async function GET(request: Request) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const statuses = searchParams.get("statuses")

  const filters: BokunBookingFilters = {
    page: Number(searchParams.get("page")) || 1,
    pageSize: Number(searchParams.get("pageSize")) || 50,
    statuses: statuses ? statuses.split(",").filter(Boolean) : undefined,
    confirmationCode: searchParams.get("confirmationCode") || undefined,
    travelFrom: searchParams.get("travelFrom") || undefined,
    travelTo: searchParams.get("travelTo") || undefined,
  }

  const result = await fetchBokunBookings(filters)
  return NextResponse.json(result)
}
