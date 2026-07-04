import { headers } from "next/headers"
import { and, eq, or, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { booking } from "@/lib/db/schema"
import { fetchBokunVoucherPdf } from "@/lib/bokun"

/**
 * Voucher download for a trip shown on the customer's "My Trips" page, keyed by
 * Bokun's numeric booking id. Requires an authenticated session, and verifies
 * the booking actually belongs to the signed-in user by matching it against our
 * own booking records (linked by account id, or email for guest bookings)
 * before streaming the PDF.
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

  // Ownership check: the booking must be one of this customer's bookings in our
  // records, matched by account id or (for guest bookings) email.
  const email = session.user.email.trim().toLowerCase()
  const matchEmail = sql`lower(${booking.customerEmail}) = ${email}`
  const owned = await db.query.booking
    .findFirst({
      where: and(
        eq(booking.bokunBookingId, bokunId),
        or(eq(booking.userId, session.user.id), matchEmail),
      ),
    })
    .catch(() => null)
  if (!owned) return new Response("Not found", { status: 404 })

  const pdf = await fetchBokunVoucherPdf(bokunId)
  if (!pdf) return new Response("Voucher not available", { status: 502 })

  const filename = `voucher-${owned.bokunConfirmationCode ?? bokunId}.pdf`
  return new Response(pdf.bytes, {
    headers: {
      "Content-Type": pdf.contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
