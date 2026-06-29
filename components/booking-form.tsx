"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import {
  CalendarDays,
  Clock,
  Compass,
  Loader2,
  Lock,
  Minus,
  Phone,
  Plus,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react"
import { Price } from "@/components/price"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { startBooking, type BookingInput } from "@/app/actions/booking"

/** Phone area codes (Iceland first, then common visitor origins). */
const PHONE_CODES: { code: string; label: string }[] = [
  { code: "+354", label: "Iceland (+354)" },
  { code: "+1", label: "USA / Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+34", label: "Spain (+34)" },
  { code: "+39", label: "Italy (+39)" },
  { code: "+31", label: "Netherlands (+31)" },
  { code: "+45", label: "Denmark (+45)" },
  { code: "+46", label: "Sweden (+46)" },
  { code: "+47", label: "Norway (+47)" },
  { code: "+358", label: "Finland (+358)" },
  { code: "+41", label: "Switzerland (+41)" },
  { code: "+43", label: "Austria (+43)" },
  { code: "+32", label: "Belgium (+32)" },
  { code: "+353", label: "Ireland (+353)" },
  { code: "+351", label: "Portugal (+351)" },
  { code: "+48", label: "Poland (+48)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+64", label: "New Zealand (+64)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+82", label: "South Korea (+82)" },
  { code: "+86", label: "China (+86)" },
  { code: "+91", label: "India (+91)" },
  { code: "+55", label: "Brazil (+55)" },
]

/** Mirror of the server's BookableSlot, kept structural to avoid importing server code. */
type Tier = { unitIsk: number; minPax: number; maxPax: number }
type PriceLine = { id: number; title: string; minAge: number; tiers: Tier[] }
export type BookingSlot = {
  id: string
  date: string
  startTime: string
  startTimeId: number
  seats: number
  unlimited: boolean
  minPax: number
  maxPax: number
  pricedPerPerson: boolean
  flatPriceIsk: number
  lines: PriceLine[]
  cancellation: string
}

/** Mirror of the server's TourExtra (paid add-on). */
export type BookingExtra = {
  id: number
  title: string
  information: string
  pricedPerPerson: boolean
  unitIsk: number
  maxPerBooking: number
  limitByPax: boolean
}

/** Clamp an add-on quantity given the current participant count. */
function clampAddon(extra: BookingExtra, totalPax: number): number {
  const caps = [99]
  if (extra.maxPerBooking > 0) caps.push(extra.maxPerBooking)
  if (extra.limitByPax) caps.push(Math.max(1, totalPax))
  return Math.max(0, Math.min(...caps))
}

/** Mirror of the server's PickupPlace / TourPickup. */
export type BookingPickupPlace = {
  id: number
  title: string
  type: string
  askForRoomNumber: boolean
  address: string
}
export type BookingPickup = {
  meetingType: string
  required: boolean
  pickupPlaces: BookingPickupPlace[]
  dropoffPlaces: BookingPickupPlace[]
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/**
 * Teya SecurePay requires a top-level POST (not a GET redirect). Build a hidden
 * form from the signed fields and submit it, sending the customer to the hosted
 * payment page.
 */
function submitToSecurePay(form: { url: string; fields: Record<string, string> }) {
  const el = document.createElement("form")
  el.method = "POST"
  el.action = form.url
  el.style.display = "none"
  for (const [name, value] of Object.entries(form.fields)) {
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = name
    input.value = value
    el.appendChild(input)
  }
  document.body.appendChild(el)
  el.submit()
}

/** Client-side mirror of priceSlotIsk (server recomputes authoritatively). */
function computeTotal(
  slot: BookingSlot,
  qtyByLine: Record<number, number>,
  totalPax: number,
): number {
  if (!slot.pricedPerPerson) return slot.flatPriceIsk
  if (totalPax <= 0) return 0
  let total = 0
  for (const line of slot.lines) {
    const qty = qtyByLine[line.id] ?? 0
    if (qty <= 0) continue
    const tier =
      line.tiers.find((t) => totalPax >= t.minPax && totalPax <= t.maxPax) ??
      line.tiers[0]
    total += (tier?.unitIsk ?? 0) * qty
  }
  return Math.round(total)
}

export function BookingForm({
  bokunId,
  slots,
  extras = [],
  pickup = null,
  fallbackPhone,
  startingPriceIsk = 0,
  cancellationHours = null,
}: {
  bokunId: string
  slots: BookingSlot[]
  extras?: BookingExtra[]
  pickup?: BookingPickup | null
  fallbackPhone: string
  /** "From" price shown before any participants are selected. */
  startingPriceIsk?: number
  /** Free-cancellation window, used for the trust badge copy. */
  cancellationHours?: number | null
}) {
  const pickupPlaces = pickup?.pickupPlaces ?? []
  const dropoffPlaces = pickup?.dropoffPlaces ?? []
  const pickupRequired = Boolean(pickup?.required) && pickupPlaces.length > 0
  // Unique sorted dates that have at least one slot.
  const dates = useMemo(() => {
    return Array.from(new Set(slots.map((s) => s.date))).sort()
  }, [slots])

  const [date, setDate] = useState<string>(dates[0] ?? "")
  const slotsForDate = useMemo(
    () => slots.filter((s) => s.date === date),
    [slots, date],
  )
  const [slotId, setSlotId] = useState<string>(slotsForDate[0]?.id ?? "")

  const slot = useMemo(
    () => slotsForDate.find((s) => s.id === slotId) ?? slotsForDate[0],
    [slotsForDate, slotId],
  )

  // For flat-price tours, present a single synthetic "Participants" line.
  const lines: PriceLine[] = useMemo(() => {
    if (!slot) return []
    if (slot.pricedPerPerson) return slot.lines
    return [{ id: 0, title: "Participants", minAge: 0, tiers: [] }]
  }, [slot])

  const [qtyByLine, setQtyByLine] = useState<Record<number, number>>({})
  const [qtyByAddon, setQtyByAddon] = useState<Record<number, number>>({})
  const [firstByGuest, setFirstByGuest] = useState<Record<string, string>>({})
  const [lastByGuest, setLastByGuest] = useState<Record<string, string>>({})
  const [pickupId, setPickupId] = useState<string>("")
  const [dropoffId, setDropoffId] = useState<string>("")
  const [roomNumber, setRoomNumber] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phoneCode, setPhoneCode] = useState("+354")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const totalPax = lines.reduce((n, l) => n + (qtyByLine[l.id] ?? 0), 0)
  const baseTotal = slot ? computeTotal(slot, qtyByLine, totalPax) : 0
  const addonsTotal = extras.reduce(
    (n, e) => n + (qtyByAddon[e.id] ?? 0) * e.unitIsk,
    0,
  )
  const total = baseTotal + addonsTotal

  // One named slot per seat, labeled by pricing category (e.g. "Adult 1").
  const guestSlots = useMemo(() => {
    const slotsOut: { key: string; label: string }[] = []
    for (const line of lines) {
      const qty = qtyByLine[line.id] ?? 0
      for (let i = 0; i < qty; i++) {
        slotsOut.push({
          key: `${line.id}-${i}`,
          label: qty > 1 ? `${line.title} ${i + 1}` : line.title,
        })
      }
    }
    return slotsOut
  }, [lines, qtyByLine])

  const selectedPickup = pickupPlaces.find((p) => String(p.id) === pickupId)
  const needsRoomNumber = Boolean(selectedPickup?.askForRoomNumber)

  // Remaining seats for the active slot (Infinity when unlimited).
  const seatsLeft =
    !slot || slot.unlimited ? Number.POSITIVE_INFINITY : slot.seats - totalPax
  const atCapacity = seatsLeft <= 0

  // Lock body scroll while the checkout overlay is open.
  useEffect(() => {
    if (!checkoutOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCheckoutOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [checkoutOpen])

  // Functional delta update so rapid clicks accumulate correctly.
  function bumpQty(lineId: number, delta: number) {
    setQtyByLine((prev) => ({
      ...prev,
      [lineId]: Math.max(0, (prev[lineId] ?? 0) + delta),
    }))
  }

  function setAddonQty(extra: BookingExtra, next: number) {
    const max = clampAddon(extra, totalPax)
    setQtyByAddon((prev) => ({
      ...prev,
      [extra.id]: Math.max(0, Math.min(next, max)),
    }))
  }

  // When the date changes, default to its first slot and clear quantities.
  function onDateChange(next: string) {
    setDate(next)
    const first = slots.find((s) => s.date === next)
    setSlotId(first?.id ?? "")
    setQtyByLine({})
    setQtyByAddon({})
    setFirstByGuest({})
    setLastByGuest({})
    setError(null)
  }

  /** Validate the date + participant selection, then open the checkout step. */
  function openCheckout() {
    setError(null)
    if (!slot) {
      setError("Please choose a date.")
      return
    }
    if (totalPax <= 0) {
      setError("Please add at least one participant.")
      return
    }
    if (totalPax < slot.minPax) {
      setError(`This tour requires at least ${slot.minPax} participants.`)
      return
    }
    if (!slot.unlimited && totalPax > slot.seats) {
      setError(`Only ${slot.seats} seats left for this date.`)
      return
    }
    setCheckoutOpen(true)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!slot) {
      setError("Please choose a date.")
      return
    }
    if (totalPax <= 0) {
      setError("Please add at least one participant.")
      return
    }
    if (totalPax < slot.minPax) {
      setError(`This tour requires at least ${slot.minPax} participants.`)
      return
    }
    if (!slot.unlimited && totalPax > slot.seats) {
      setError(`Only ${slot.seats} seats left for this date.`)
      return
    }
    if (pickupRequired && !selectedPickup) {
      setError("Please choose a pickup location.")
      return
    }
    if (needsRoomNumber && !roomNumber.trim()) {
      setError("Please enter your room number for the pickup.")
      return
    }
    if (
      guestSlots.some(
        (g) =>
          !(firstByGuest[g.key] ?? "").trim() ||
          !(lastByGuest[g.key] ?? "").trim(),
      )
    ) {
      setError("Please enter a first and last name for each participant.")
      return
    }

    const selections = slot.pricedPerPerson
      ? slot.lines
          .map((l) => ({ lineId: l.id, qty: qtyByLine[l.id] ?? 0 }))
          .filter((s) => s.qty > 0)
      : [{ lineId: 0, qty: totalPax }]

    const addons = extras
      .map((e) => ({ extraId: e.id, qty: qtyByAddon[e.id] ?? 0 }))
      .filter((a) => a.qty > 0)

    const participants = guestSlots.map((g) => ({
      category: g.label,
      name: `${(firstByGuest[g.key] ?? "").trim()} ${(lastByGuest[g.key] ?? "").trim()}`.trim(),
    }))

    const payload: BookingInput = {
      bokunId,
      slotId: slot.id,
      date: slot.date,
      startTime: slot.startTime,
      startTimeId: slot.startTimeId,
      selections,
      addons,
      participants,
      pickupId: selectedPickup ? selectedPickup.id : undefined,
      dropoffId: dropoffId ? Number(dropoffId) : undefined,
      roomNumber: needsRoomNumber ? roomNumber.trim() : undefined,
      customerName: `${firstName.trim()} ${lastName.trim()}`.trim(),
      customerEmail: email,
      customerPhone: phone.trim() ? `${phoneCode} ${phone.trim()}` : undefined,
    }

    startTransition(async () => {
      const res = await startBooking(payload)
      if (res.ok) {
        submitToSecurePay(res.form)
      } else {
        setError(res.error)
      }
    })
  }

  // No availability at all → contact fallback (desktop card + mobile bar).
  if (slots.length === 0) {
    return (
      <>
        <div className="hidden rounded-2xl border border-border bg-card p-6 shadow-sm lg:block">
          <p className="font-heading text-lg font-bold text-foreground">
            Online booking isn&apos;t available
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Contact us and we&apos;ll arrange your booking directly.
          </p>
          <a
            href={`tel:${fallbackPhone.replace(/\s/g, "")}`}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            <Phone className="size-4" aria-hidden="true" />
            {fallbackPhone}
          </a>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <a
            href={`tel:${fallbackPhone.replace(/\s/g, "")}`}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            <Phone className="size-4" aria-hidden="true" />
            Call to book — {fallbackPhone}
          </a>
        </div>
      </>
    )
  }

  const headlinePriceIsk = totalPax > 0 ? total : startingPriceIsk
  const showFrom = totalPax <= 0 && startingPriceIsk > 0

  const trust: { icon: typeof Zap; text: string }[] = [
    { icon: Zap, text: "Instant confirmation" },
    {
      icon: ShieldCheck,
      text: cancellationHours
        ? `Free cancellation up to ${cancellationHours}h before`
        : "Free cancellation",
    },
    { icon: Compass, text: "Local expert guide" },
    { icon: Lock, text: "Secure booking" },
  ]

  /** Date + departure + participant steppers — reused in card and overlay. */
  function renderSelection() {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-date" className="flex items-center gap-1.5">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            Date
          </Label>
          <select
            id="booking-date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {dates.map((d) => (
              <option key={d} value={d}>
                {formatDate(d)}
              </option>
            ))}
          </select>
        </div>

        {slotsForDate.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-time" className="flex items-center gap-1.5">
              <Clock className="size-4 text-primary" aria-hidden="true" />
              Departure
            </Label>
            <select
              id="booking-time"
              value={slotId}
              onChange={(e) => {
                setSlotId(e.target.value)
                setQtyByLine({})
              }}
              className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {slotsForDate.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.startTime || "Flexible"}
                </option>
              ))}
            </select>
          </div>
        )}

        {slot && (
          <div className="flex flex-col gap-3">
            <Label className="flex items-center gap-1.5">
              <Compass className="size-4 text-primary" aria-hidden="true" />
              Participants
            </Label>
            {lines.map((line) => {
              const qty = qtyByLine[line.id] ?? 0
              const tier =
                line.tiers.find(
                  (t) => totalPax >= t.minPax && totalPax <= t.maxPax,
                ) ?? line.tiers[0]
              return (
                <div
                  key={line.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {line.title}
                      {line.minAge > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (age {line.minAge}+)
                        </span>
                      )}
                    </p>
                    {slot.pricedPerPerson && tier && (
                      <p className="text-xs text-muted-foreground">
                        <Price isk={tier.unitIsk} /> each
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => bumpQty(line.id, -1)}
                      disabled={qty <= 0}
                      aria-label={`Decrease ${line.title}`}
                      className="flex size-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold text-foreground">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => bumpQty(line.id, 1)}
                      disabled={atCapacity}
                      aria-label={`Increase ${line.title}`}
                      className="flex size-9 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )
            })}
            {!slot.unlimited && seatsLeft <= 5 && (
              <p
                className={`text-xs ${atCapacity ? "text-destructive" : "text-muted-foreground"}`}
              >
                {atCapacity
                  ? "No more seats available for this departure."
                  : `${seatsLeft} ${seatsLeft === 1 ? "seat" : "seats"} left for this departure.`}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* ---------- Desktop sticky panel (step 1) ---------- */}
      <div className="hidden rounded-2xl border border-border bg-card p-6 shadow-sm lg:block">
        <div className="flex items-end justify-between gap-3">
          <div>
            {showFrom && (
              <span className="text-xs text-muted-foreground">From</span>
            )}
            <p className="font-heading text-3xl font-extrabold text-foreground">
              <Price
                isk={headlinePriceIsk}
                fallback="Select participants"
              />
            </p>
            <span className="text-xs text-muted-foreground">
              {totalPax > 0 ? "total price" : "per person"}
            </span>
          </div>
        </div>

        <div className="mt-5">{renderSelection()}</div>

        {totalPax <= 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Select participants to see final pricing.
          </p>
        )}

        {error && !checkoutOpen && (
          <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="button"
          size="lg"
          onClick={openCheckout}
          disabled={totalPax <= 0}
          className="mt-4 w-full rounded-full"
        >
          {totalPax <= 0 ? "Select participants to continue" : "Book now"}
        </Button>

        <ul className="mt-5 grid grid-cols-1 gap-2.5 border-t border-border pt-5 text-sm text-muted-foreground">
          {trust.map((t) => (
            <li key={t.text} className="flex items-center gap-2">
              <t.icon className="size-4 text-primary" aria-hidden="true" />
              {t.text}
            </li>
          ))}
        </ul>
      </div>

      {/* ---------- Mobile fixed booking bar ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0">
          {showFrom && (
            <span className="block text-[11px] leading-none text-muted-foreground">
              From
            </span>
          )}
          <span className="font-heading text-lg font-extrabold text-foreground">
            <Price isk={headlinePriceIsk} fallback="Select dates" />
          </span>
        </div>
        <Button
          type="button"
          size="lg"
          onClick={() => setCheckoutOpen(true)}
          className="shrink-0 rounded-full"
        >
          Book now
        </Button>
      </div>

      {/* ---------- Checkout overlay (step 2) ---------- */}
      {checkoutOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Complete your booking"
          className="fixed inset-0 z-[90] flex justify-center overflow-y-auto bg-background/80 backdrop-blur-sm sm:items-start sm:p-6"
          onClick={() => setCheckoutOpen(false)}
        >
          <form
            onSubmit={onSubmit}
            onClick={(e) => e.stopPropagation()}
            className="relative flex w-full max-w-lg flex-col gap-5 rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:my-auto sm:rounded-2xl sm:p-6"
          >
            <div className="sticky -top-5 z-10 -mx-5 -mt-5 flex items-start justify-between gap-3 rounded-t-2xl border-b border-border bg-card px-5 pb-4 pt-5 sm:-top-6 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
              <div>
                <h2 className="font-heading text-xl font-extrabold text-foreground">
                  Complete your booking
                </h2>
                {slot && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(slot.date)}
                    {slot.startTime ? ` · ${slot.startTime}` : ""}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Close"
                className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* Date + participants — only on mobile, where step 1 lives here. */}
            <div className="lg:hidden">{renderSelection()}</div>

            {/* Add-ons */}
            {extras.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground">Add-ons</p>
                {extras.map((extra) => {
                  const qty = qtyByAddon[extra.id] ?? 0
                  return (
                    <div
                      key={extra.id}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {extra.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <Price isk={extra.unitIsk} />
                          {extra.pricedPerPerson ? " per person" : " each"}
                        </p>
                        {extra.information && (
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {extra.information}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAddonQty(extra, qty - 1)}
                          disabled={qty <= 0}
                          aria-label={`Decrease ${extra.title}`}
                          className="flex size-8 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-40"
                        >
                          <Minus className="size-4" aria-hidden="true" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-foreground">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAddonQty(extra, qty + 1)}
                          aria-label={`Increase ${extra.title}`}
                          className="flex size-8 items-center justify-center rounded-full border border-border text-foreground"
                        >
                          <Plus className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pickup / drop-off */}
            {pickupPlaces.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Pick-up</p>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Included in price
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="booking-pickup">
                    Where should we pick you up?
                    {pickupRequired && (
                      <span className="ml-0.5 text-destructive" aria-hidden="true">
                        *
                      </span>
                    )}
                  </Label>
                  <select
                    id="booking-pickup"
                    value={pickupId}
                    onChange={(e) => {
                      setPickupId(e.target.value)
                      setRoomNumber("")
                    }}
                    required={pickupRequired}
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">
                      {pickupRequired
                        ? "Select a pickup location"
                        : "I'll meet at the starting location"}
                    </option>
                    {pickupPlaces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                {needsRoomNumber && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="booking-room">Room number</Label>
                    <Input
                      id="booking-room"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="e.g. 204"
                    />
                  </div>
                )}

                {dropoffPlaces.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="booking-dropoff">
                      Where should we drop you off?
                    </Label>
                    <select
                      id="booking-dropoff"
                      value={dropoffId}
                      onChange={(e) => setDropoffId(e.target.value)}
                      className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">I don&apos;t need drop-off</option>
                      {dropoffPlaces.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Participant names */}
            {guestSlots.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground">
                  {guestSlots.length === 1
                    ? "Participant name"
                    : "Participant names"}
                </p>
                {guestSlots.map((g) => (
                  <div key={g.key} className="flex flex-col gap-1.5">
                    <Label>{g.label}</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Input
                        id={`guest-${g.key}-first`}
                        value={firstByGuest[g.key] ?? ""}
                        onChange={(e) =>
                          setFirstByGuest((prev) => ({
                            ...prev,
                            [g.key]: e.target.value,
                          }))
                        }
                        required
                        autoComplete="off"
                        placeholder="First name"
                        aria-label={`${g.label} first name`}
                      />
                      <Input
                        id={`guest-${g.key}-last`}
                        value={lastByGuest[g.key] ?? ""}
                        onChange={(e) =>
                          setLastByGuest((prev) => ({
                            ...prev,
                            [g.key]: e.target.value,
                          }))
                        }
                        required
                        autoComplete="off"
                        placeholder="Last name"
                        aria-label={`${g.label} last name`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Contact details */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground">
                Contact details
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="booking-first-name">First name</Label>
                  <Input
                    id="booking-first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoComplete="given-name"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="booking-last-name">Last name</Label>
                  <Input
                    id="booking-last-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="booking-email">Email</Label>
                <Input
                  id="booking-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="booking-phone">Phone (optional)</Label>
                <div className="flex gap-2">
                  <select
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    aria-label="Phone area code"
                    className="h-11 shrink-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {PHONE_CODES.map((c) => (
                      <option key={c.code + c.label} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    id="booking-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel-national"
                    placeholder="Phone number"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            {/* Order summary */}
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              {totalPax > 0 && (
                <div className="flex flex-col gap-1.5">
                  {lines.map((line) => {
                    const qty = qtyByLine[line.id] ?? 0
                    if (qty <= 0) return null
                    const tier =
                      line.tiers.find(
                        (t) => totalPax >= t.minPax && totalPax <= t.maxPax,
                      ) ?? line.tiers[0]
                    const lineTotal = slot?.pricedPerPerson
                      ? (tier?.unitIsk ?? 0) * qty
                      : (slot?.flatPriceIsk ?? 0)
                    return (
                      <div
                        key={line.id}
                        className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
                      >
                        <span>
                          {line.title}
                          {slot?.pricedPerPerson && ` × ${qty}`}
                        </span>
                        <span className="text-foreground">
                          <Price isk={lineTotal} />
                        </span>
                      </div>
                    )
                  })}
                  {extras.map((extra) => {
                    const qty = qtyByAddon[extra.id] ?? 0
                    if (qty <= 0) return null
                    return (
                      <div
                        key={extra.id}
                        className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
                      >
                        <span>
                          {extra.title} × {qty}
                        </span>
                        <span className="text-foreground">
                          <Price isk={extra.unitIsk * qty} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-heading text-2xl font-extrabold text-foreground">
                  <Price isk={total} />
                </span>
              </div>
            </div>

            {slot?.cancellation && (
              <p className="text-xs text-muted-foreground">{slot.cancellation}</p>
            )}

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={pending || totalPax <= 0}
              className="w-full rounded-full"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Redirecting to payment…
                </>
              ) : (
                "Confirm & pay"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Secure payment via Teya. You won&apos;t be charged until you
              confirm.
            </p>
          </form>
        </div>
      )}
    </>
  )
}
