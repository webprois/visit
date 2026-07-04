import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { fetchBokunBookingsByEmail, fetchBokunVoucherPdf } from "@/lib/bokun"

/**
 * Voucher download for a trip shown on the customer's "My Trips" page, keyed by
 * Bokun's numeric booking id. Requires an authenticated session, and verifies
 * the booking actually belongs to the signed-in user (by matching it against
 * the bookings Bokun returns for their email) before streaming the PDF.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ bokunBookingId: string }> },
) {
  const { bokunBookingId } = await params
  const bokunId = Number(bokunBookingId)
  if (!Number.isFinite(bokunId) || bokunId <= 0) {
    return new Response("Not found", { status: 404 })
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Ownership check: the booking must be one of this customer's bookings.
  const mine = await fetchBokunBookingsByEmail(
    session.user.email.trim().toLowerCase(),
  ).catch(() => [])
  const owned = mine.find((b) => b.id === bokunId)
  if (!owned) return new Response("Not found", { status: 404 })

  const pdf = await fetchBokunVoucherPdf(bokunId)
  if (!pdf) return new Response("Voucher not available", { status: 502 })

  const filename = `voucher-${owned.confirmationCode ?? bokunId}.pdf`
  return new Response(pdf.bytes, {
    headers: {
      "Content-Type": pdf.contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
