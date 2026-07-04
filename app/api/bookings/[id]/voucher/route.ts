import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { booking } from "@/lib/db/schema"
import { fetchBokunVoucherPdf } from "@/lib/bokun"

/**
 * Voucher download for a booking made on the site, keyed by our internal
 * (unguessable UUID) booking id. Used on the post-payment confirmation page,
 * where the customer may be a guest — the random id is the access capability,
 * matching how the return page already reveals booking details by that id.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return new Response("Not found", { status: 404 })

  const [row] = await db
    .select({
      status: booking.status,
      bokunBookingId: booking.bokunBookingId,
      code: booking.bokunConfirmationCode,
    })
    .from(booking)
    .where(eq(booking.id, id))
    .limit(1)

  if (!row) return new Response("Not found", { status: 404 })
  if (row.status !== "paid" && row.status !== "confirmed") {
    return new Response("Voucher not available yet", { status: 409 })
  }
  if (!row.bokunBookingId) {
    return new Response("Voucher not available", { status: 404 })
  }

  const pdf = await fetchBokunVoucherPdf(row.bokunBookingId)
  if (!pdf) return new Response("Voucher not available", { status: 502 })

  const filename = `voucher-${row.code ?? row.bokunBookingId}.pdf`
  return new Response(pdf.bytes, {
    headers: {
      "Content-Type": pdf.contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
