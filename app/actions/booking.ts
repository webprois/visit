"use server"

import { randomUUID } from "node:crypto"
import { headers } from "next/headers"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { booking } from "@/lib/db/schema"
import {
  fetchBookableSlots,
  fetchTourExtras,
  fetchTourPickup,
  priceSlotIsk,
  priceExtrasIsk,
  type SlotSelection,
  type AddonSelection,
} from "@/lib/bokun"
import { getTourById } from "@/lib/tours"
import { buildSecurePayForm, verifyReturnHash, type SecurePayForm } from "@/lib/teya"
import { auth } from "@/lib/auth"
import { isAdminEmail } from "@/lib/roles"

export type BookingInput = {
  bokunId: string
  slotId: string
  date: string
  startTime: string
  startTimeId: number
  /** Quantity per price line id. */
  selections: SlotSelection[]
  /** Quantity per add-on id. */
  addons?: AddonSelection[]
  /** Name of each participant, labeled by pricing category. */
  participants?: { category: string; name: string }[]
  /** Selected pickup/drop-off place ids (and room number for hotels). */
  pickupId?: number
  dropoffId?: number
  roomNumber?: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  notes?: string
  /** Opt-in: create a customer account so they can track this booking. */
  createAccount?: boolean
  /** Password for the new account (only used when createAccount is true). */
  accountPassword?: string
}

export type StartBookingResult =
  | { ok: true; form: SecurePayForm }
  | { ok: false; error: string }

/** Build an absolute origin for redirect URLs from the incoming request. */
async function getOrigin(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? "https"
  if (host) return `${proto}://${host}`
  return (
    process.env.V0_RUNTIME_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000")
  )
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Best-effort customer account creation during checkout. Never throws and never
 * blocks the booking: if the email already has an account, or sign-up fails for
 * any reason, we simply skip it. Admin emails are never created this way.
 */
async function maybeCreateCustomerAccount(input: BookingInput): Promise<void> {
  if (!input.createAccount) return
  const email = input.customerEmail.trim()
  const password = input.accountPassword ?? ""
  if (!isEmail(email) || password.length < 8) return
  if (isAdminEmail(email)) return

  try {
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: input.customerName.trim() || email,
      },
    })
  } catch (err) {
    // Email already registered, weak password, etc. — don't fail the booking.
    console.log(
      "[v0] Checkout account creation skipped:",
      (err as Error).message,
    )
  }
}

type PreparedBooking = {
  id: string
  amountIsk: number
  tourTitle: string
  date: string
  customerEmail: string
}
type PersistResult =
  | { ok: true; booking: PreparedBooking }
  | { ok: false; error: string }

/**
 * Validate the request, re-price it authoritatively against live Bokun data
 * (never trust client-supplied prices), and persist a booking with the given
 * status. Shared by the legacy SecurePay flow and the new Teya Hosted Checkout
 * flow.
 */
async function persistBooking(
  input: BookingInput,
  status: string,
): Promise<PersistResult> {
  // --- Basic validation ---
  if (!input.bokunId || !input.slotId || !input.date) {
    return { ok: false, error: "Missing booking details." }
  }
  if (!input.customerName.trim()) {
    return { ok: false, error: "Please enter your name." }
  }
  if (!isEmail(input.customerEmail)) {
    return { ok: false, error: "Please enter a valid email address." }
  }

  const totalPax = input.selections.reduce(
    (n, s) => n + Math.max(0, Math.floor(s.qty)),
    0,
  )
  if (totalPax <= 0) {
    return { ok: false, error: "Please select at least one participant." }
  }

  // --- Re-fetch the live slot and recompute the price (never trust client) ---
  const slots = await fetchBookableSlots(input.bokunId, input.date, input.date)
  const slot = slots.find((s) => s.id === input.slotId)
  if (!slot) {
    return {
      ok: false,
      error: "That departure is no longer available. Please pick another date.",
    }
  }
  if (!slot.unlimited && totalPax > slot.seats) {
    return { ok: false, error: `Only ${slot.seats} seats left for this date.` }
  }
  if (totalPax < slot.minPax) {
    return {
      ok: false,
      error: `This tour requires at least ${slot.minPax} participants.`,
    }
  }
  if (totalPax > slot.maxPax) {
    return {
      ok: false,
      error: `This tour allows at most ${slot.maxPax} participants.`,
    }
  }

  const baseIsk = priceSlotIsk(slot, input.selections)
  if (!(baseIsk > 0)) {
    return { ok: false, error: "Could not price this booking. Please call us." }
  }

  // --- Re-fetch extras and re-price add-ons (never trust client prices) ---
  const requestedAddons = (input.addons ?? []).filter((a) => a.qty > 0)
  let addonsIsk = 0
  let storedAddons: {
    extraId: number
    title: string
    qty: number
    unitIsk: number
  }[] = []
  if (requestedAddons.length) {
    const extras = await fetchTourExtras(input.bokunId)
    addonsIsk = priceExtrasIsk(extras, requestedAddons)
    storedAddons = requestedAddons
      .map((a) => {
        const ex = extras.find((e) => e.id === a.extraId)
        if (!ex) return null
        return {
          extraId: ex.id,
          title: ex.title,
          qty: Math.floor(a.qty),
          unitIsk: ex.unitIsk,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }

  const amountIsk = baseIsk + addonsIsk

  // --- Resolve pickup/drop-off against live Bokun data ---
  let storedPickup: {
    pickupId: number | null
    pickupTitle: string | null
    roomNumber: string | null
    dropoffId: number | null
    dropoffTitle: string | null
  } | null = null
  const pickupConfig = await fetchTourPickup(input.bokunId)
  if (pickupConfig.pickupPlaces.length > 0) {
    const pickupPlace = pickupConfig.pickupPlaces.find(
      (p) => p.id === input.pickupId,
    )
    if (pickupConfig.required && !pickupPlace) {
      return { ok: false, error: "Please choose a pickup location." }
    }
    const dropoffPlace = pickupConfig.dropoffPlaces.find(
      (p) => p.id === input.dropoffId,
    )
    if (pickupPlace || dropoffPlace) {
      storedPickup = {
        pickupId: pickupPlace?.id ?? null,
        pickupTitle: pickupPlace?.title ?? null,
        roomNumber:
          pickupPlace?.askForRoomNumber && input.roomNumber?.trim()
            ? input.roomNumber.trim()
            : null,
        dropoffId: dropoffPlace?.id ?? null,
        dropoffTitle: dropoffPlace?.title ?? null,
      }
    }
  }

  // --- Sanitize participant names (cap to the paid head count) ---
  const storedParticipants = (input.participants ?? [])
    .slice(0, totalPax)
    .map((p) => ({
      category: String(p.category ?? "").slice(0, 60),
      name: String(p.name ?? "").trim().slice(0, 120),
    }))
    .filter((p) => p.name.length > 0)

  const tour = await getTourById(input.bokunId)
  const tourTitle = tour?.title ?? slot.id

  // --- Persist a pending booking ---
  const id = randomUUID()
  await db.insert(booking).values({
    id,
    bokunId: input.bokunId,
    tourTitle,
    tourDate: input.date,
    startTime: input.startTime || null,
    startTimeId: input.startTimeId || null,
    pax: input.selections,
    addons: storedAddons,
    participants: storedParticipants,
    pickup: storedPickup,
    totalPax,
    currency: "ISK",
    amountMinor: amountIsk, // ISK has no minor units
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail.trim(),
    customerPhone: input.customerPhone?.trim() || null,
    notes: input.notes?.trim() || null,
    status,
  })

  return {
    ok: true,
    booking: {
      id,
      amountIsk,
      tourTitle,
      date: input.date,
      customerEmail: input.customerEmail.trim(),
    },
  }
}

/**
 * Legacy SecurePay flow: persist a pending booking and build a signed Teya
 * SecurePay form for the client to auto-submit (POST) to the hosted page.
 */
export async function startBooking(
  input: BookingInput,
): Promise<StartBookingResult> {
  const prep = await persistBooking(input, "pending")
  if (!prep.ok) return { ok: false, error: prep.error }
  const { id, amountIsk, tourTitle, date, customerEmail } = prep.booking

  // Opt-in account creation. Best-effort; never blocks the payment flow.
  await maybeCreateCustomerAccount(input)

  const origin = await getOrigin()
  const returnBase = `${origin}/tours/${input.bokunId}/booking/return?booking=${id}`
  try {
    const form = buildSecurePayForm({
      orderId: id,
      amountIsk,
      currency: "ISK",
      buyerEmail: customerEmail,
      itemDescription: `${tourTitle} - ${date}`,
      returnUrlSuccess: returnBase,
      returnUrlSuccessServer: `${origin}/api/teya/webhook`,
      returnUrlCancel: `${returnBase}&status=cancelled`,
      returnUrlError: `${returnBase}&status=failed`,
    })
    await db
      .update(booking)
      .set({ teyaSessionId: id, updatedAt: new Date() })
      .where(eq(booking.id, id))
    return { ok: true, form }
  } catch (err) {
    console.log("[v0] startBooking payment error:", (err as Error).message)
    await db
      .update(booking)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(booking.id, id))
    return {
      ok: false,
      error:
        "We couldn't start the payment. Please try again or contact us to book.",
    }
  }
}

export type CreatePendingResult =
  | { ok: true; bookingId: string; amountIsk: number; currency: "ISK" }
  | { ok: false; error: string }

/**
 * New Teya Hosted Checkout flow: validate + re-price + persist a booking with
 * status "pending_payment". Returns the booking id; the client then calls
 * POST /api/payments/teya/create-checkout to get the hosted payment URL.
 */
export async function createPendingBooking(
  input: BookingInput,
): Promise<CreatePendingResult> {
  const prep = await persistBooking(input, "pending_payment")
  if (!prep.ok) return { ok: false, error: prep.error }

  // Opt-in account creation. Best-effort; never blocks the payment flow.
  await maybeCreateCustomerAccount(input)

  return {
    ok: true,
    bookingId: prep.booking.id,
    amountIsk: prep.booking.amountIsk,
    currency: "ISK",
  }
}

/**
 * Mark a booking confirmed — ONLY from a verified Teya webhook / backend status,
 * never from the browser redirect. No-op unless still "pending_payment", so it's
 * safe to call more than once.
 */
export async function markBookingConfirmed(
  bookingId: string,
  paymentId: string | null,
): Promise<boolean> {
  const res = await db
    .update(booking)
    .set({
      status: "confirmed",
      teyaReference: paymentId,
      updatedAt: new Date(),
    })
    .where(
      and(eq(booking.id, bookingId), eq(booking.status, "pending_payment")),
    )
    .returning({ id: booking.id })
  const confirmed = res.length > 0
  if (confirmed) {
    console.log(`[v0] Booking ${bookingId} CONFIRMED (Teya ${paymentId ?? "?"})`)
  }
  return confirmed
}

/** Mark a still-unpaid booking cancelled (e.g. the customer abandoned checkout). */
export async function markBookingCancelled(bookingId: string): Promise<void> {
  await db
    .update(booking)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(eq(booking.id, bookingId), eq(booking.status, "pending_payment")),
    )
}

export type BookingSummary = {
  status: string
  tourTitle: string
  date: string
  totalPax: number
  amountIsk: number
  email: string
}

/** Read-only booking summary for display. */
export async function getBookingStatus(
  bookingId: string,
): Promise<BookingSummary | null> {
  const [row] = await db
    .select()
    .from(booking)
    .where(eq(booking.id, bookingId))
    .limit(1)
  if (!row) return null
  return {
    status: row.status,
    tourTitle: row.tourTitle,
    date: row.tourDate,
    totalPax: row.totalPax,
    amountIsk: row.amountMinor,
    email: row.customerEmail,
  }
}

/** Teya SecurePay return parameters (from redirect query or webhook POST). */
export type TeyaReturn = {
  orderId: string
  status?: string
  amount?: string
  currency?: string
  orderhash?: string
  step?: string
}

/**
 * Confirm a booking from a Teya SecurePay return. Verifies the `orderhash`
 * against our secret (so a forged redirect can't mark a booking paid), checks
 * the returned amount matches what we stored, then updates the status. Safe to
 * call repeatedly — the return page and the server-to-server webhook both use it.
 */
export async function confirmBookingFromReturn(
  bookingId: string,
  ret: TeyaReturn,
): Promise<BookingSummary | null> {
  const [row] = await db
    .select()
    .from(booking)
    .where(eq(booking.id, bookingId))
    .limit(1)
  if (!row) return null

  // Only act while still pending; never downgrade a confirmed booking.
  if (row.status === "pending") {
    const declared = (ret.status ?? "").toLowerCase()
    const looksOk = ["ok", "success", "approved", "completed"].includes(declared)

    let verified = false
    if (looksOk && ret.orderhash && ret.amount && ret.currency) {
      const hashOk = verifyReturnHash({
        orderId: bookingId,
        amount: ret.amount,
        currency: ret.currency,
        orderhash: ret.orderhash,
      })
      // Guard against amount tampering: returned amount must match ours.
      const amountOk =
        Math.round(parseFloat(ret.amount)) === row.amountMinor &&
        ret.currency.toUpperCase() === row.currency.toUpperCase()
      verified = hashOk && amountOk
    }

    if (looksOk && !verified) {
      console.log(
        `[v0] Booking ${bookingId} return FAILED verification (hash/amount mismatch)`,
      )
    }

    const nextStatus = verified
      ? "paid"
      : declared === "cancelled" || declared === "error" || declared === "failed"
        ? "failed"
        : row.status

    if (nextStatus !== row.status) {
      await db
        .update(booking)
        .set({
          status: nextStatus,
          teyaReference: ret.orderhash ?? null,
          updatedAt: new Date(),
        })
        .where(eq(booking.id, bookingId))
      row.status = nextStatus
      if (nextStatus === "paid") {
        console.log(
          `[v0] Booking ${bookingId} PAID — ${row.tourTitle} on ${row.tourDate}, ${row.totalPax} pax, ${row.amountMinor} ISK, ${row.customerEmail}`,
        )
      }
    }
  }

  return {
    status: row.status,
    tourTitle: row.tourTitle,
    date: row.tourDate,
    totalPax: row.totalPax,
    amountIsk: row.amountMinor,
    email: row.customerEmail,
  }
}
