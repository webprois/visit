"use client"

import { useMemo, useState, useTransition } from "react"
import {
  CalendarDays,
  Check,
  Clock,
  Compass,
  Loader2,
  Lock,
  Minus,
  Phone,
  Plus,
  ShieldCheck,
  Zap,
} from "lucide-react"
import { Price } from "@/components/price"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { startBooking, type BookingInput } from "@/app/actions/booking"

/** Phone area codes (Iceland first, then common visitor origins). */
const PHONE_CODES: { code: string; label: string }[] = [
  { code: "+354", label: "+354 Iceland" },
  { code: "+1", label: "+1 USA / Canada" },
  { code: "+44", label: "+44 United Kingdom" },
  { code: "+49", label: "+49 Germany" },
  { code: "+33", label: "+33 France" },
  { code: "+34", label: "+34 Spain" },
  { code: "+39", label: "+39 Italy" },
  { code: "+31", label: "+31 Netherlands" },
  { code: "+45", label: "+45 Denmark" },
  { code: "+46", label: "+46 Sweden" },
  { code: "+47", label: "+47 Norway" },
  { code: "+358", label: "+358 Finland" },
  { code: "+41", label: "+41 Switzerland" },
  { code: "+43", label: "+43 Austria" },
  { code: "+32", label: "+32 Belgium" },
  { code: "+353", label: "+353 Ireland" },
  { code: "+351", label: "+351 Portugal" },
  { code: "+48", label: "+48 Poland" },
  { code: "+61", label: "+61 Australia" },
  { code: "+64", label: "+64 New Zealand" },
  { code: "+81", label: "+81 Japan" },
  { code: "+82", label: "+82 South Korea" },
  { code: "+86", label: "+86 China" },
  { code: "+91", label: "+91 India" },
  { code: "+55", label: "+55 Brazil" },
]

// Visit Travel Iceland's standard day-trip / activity cancellation policy
// (https://visit.is/terms-and-conditions/). Partner tours may differ per the
// operator's terms shown on the ticket.
const TERMS_URL = "https://visit.is/terms-and-conditions/"
const CANCELLATION_SUMMARY = "Free cancellation up to 72h before"

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
}: {
  bokunId: string
  slots: BookingSlot[]
  extras?: BookingExtra[]
  pickup?: BookingPickup | null
  fallbackPhone: string
  /** "From" price shown before any participants are selected. */
  startingPriceIsk?: number
}) {
  const pickupPlaces = pickup?.pickupPlaces ?? []
  const dropoffPlaces = pickup?.dropoffPlaces ?? []
  // Bokun often returns no separate drop-off list even when pickup is offered;
  // fall back to the pickup places so guests can still choose where to be
  // dropped off (defaulting to "same as pickup").
  const dropoffOptions = dropoffPlaces.length > 0 ? dropoffPlaces : pickupPlaces
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
  const [step, setStep] = useState<1 | 2 | 3>(1)
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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    // On steps 1–2 the submit button isn't shown; an Enter keypress still lands
    // here, so just advance through the wizard instead of attempting to pay.
    if (step !== 3) {
      goNext()
      return
    }
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
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your name.")
      return
    }
    if (!email.trim()) {
      setError("Please enter your email.")
      return
    }
    if (!phone.trim()) {
      setError("Please enter your phone number.")
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
      customerPhone: `${phoneCode} ${phone.trim()}`,
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

  function validateStep1(): boolean {
    setError(null)
    if (!slot) {
      setError("Please choose a date.")
      return false
    }
    if (totalPax <= 0) {
      setError("Please add at least one participant.")
      return false
    }
    if (totalPax < slot.minPax) {
      setError(`This tour requires at least ${slot.minPax} participants.`)
      return false
    }
    if (!slot.unlimited && totalPax > slot.seats) {
      setError(`Only ${slot.seats} seats left for this date.`)
      return false
    }
    return true
  }

  function validateStep2(): boolean {
    setError(null)
    if (pickupRequired && !selectedPickup) {
      setError("Please choose a pickup location.")
      return false
    }
    if (needsRoomNumber && !roomNumber.trim()) {
      setError("Please enter your room number for the pickup.")
      return false
    }
    if (
      guestSlots.some(
        (g) =>
          !(firstByGuest[g.key] ?? "").trim() ||
          !(lastByGuest[g.key] ?? "").trim(),
      )
    ) {
      setError("Please enter a first and last name for each participant.")
      return false
    }
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter your name.")
      return false
    }
    if (!email.trim()) {
      setError("Please enter your email.")
      return false
    }
    if (!phone.trim()) {
      setError("Please enter your phone number.")
      return false
    }
    return true
  }

  function goNext() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))
  }

  function goBack() {
    setError(null)
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))
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
    { icon: ShieldCheck, text: CANCELLATION_SUMMARY },
    { icon: Compass, text: "Local expert guide" },
    { icon: Lock, text: "Secure booking" },
  ]

  const STEPS = ["Tour", "Details", "Review"]

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
          onClick={() =>
            document
              .getElementById("book")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="shrink-0 rounded-full"
        >
          Book now
        </Button>
      </div>

      {/* ---------- Booking form (inline, 3-step wizard) ---------- */}
      <form
        onSubmit={onSubmit}
        className="flex w-full flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
            <div>
              <p className="font-heading text-xl font-extrabold text-foreground">
                Complete your booking
              </p>

              {/* Step indicator */}
              <ol className="mt-3 flex items-center gap-1.5 text-xs">
                {STEPS.map((label, i) => {
                  const n = i + 1
                  const active = n === step
                  const done = n < step
                  return (
                    <li key={label} className="flex items-center gap-1.5">
                      <span
                        className={
                          "flex size-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors " +
                          (active
                            ? "bg-primary text-primary-foreground"
                            : done
                              ? "bg-primary/20 text-primary"
                              : "bg-secondary text-muted-foreground")
                        }
                      >
                        {done ? (
                          <Check className="size-3.5" aria-hidden="true" />
                        ) : (
                          n
                        )}
                      </span>
                      <span
                        className={
                          active
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground"
                        }
                      >
                        {label}
                      </span>
                      {n < STEPS.length && (
                        <span
                          className="ml-0.5 h-px w-3 bg-border"
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>

            {/* Step 1 — date, participants & add-ons */}
            {step === 1 && (
              <>
                {renderSelection()}

                {totalPax <= 0 && (
                  <p className="-mt-1 text-xs text-muted-foreground">
                    Select participants to see final pricing.
                  </p>
                )}

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
              </>
            )}

            {/* Step 2 — pickup, participant names & contact */}
            {step === 2 && (
              <>
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

                {dropoffOptions.length > 0 && (
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
                      <option value="">Same as pickup location</option>
                      {dropoffOptions.map((p) => (
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
                <Label htmlFor="booking-phone">Phone</Label>
                <div className="flex gap-2">
                  <select
                    value={phoneCode}
                    onChange={(e) => setPhoneCode(e.target.value)}
                    aria-label="Phone area code"
                    className="h-11 w-36 shrink-0 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                    required
                    autoComplete="tel-national"
                    placeholder="Phone number"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
              </>
            )}

            {/* Step 3 — review & pay */}
            {step === 3 && (
              <>
            {/* Order summary */}
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground">
                Order summary
              </p>
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
            </div>

            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <p>
                Free cancellation up to 72 hours before departure. 20% fee
                within 48–72 hours; no refund within 48 hours.
              </p>
              <a
                href={TERMS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                See full cancellation terms
              </a>
            </div>
              </>
            )}

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            {/* Footer: running total + step navigation */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {totalPax > 0 ? "Total" : "From"}
                </span>
                <span className="font-heading text-2xl font-extrabold text-foreground">
                  {totalPax > 0 ? (
                    <Price isk={total} />
                  ) : startingPriceIsk > 0 ? (
                    <>
                      <Price isk={startingPriceIsk} />
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        / person
                      </span>
                    </>
                  ) : (
                    <span className="text-base font-semibold text-muted-foreground">
                      Select participants
                    </span>
                  )}
                </span>
              </div>

              <div className="flex gap-2">
                {step > 1 && (
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={goBack}
                    className="rounded-full"
                  >
                    Back
                  </Button>
                )}
                {step < 3 ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={goNext}
                    disabled={step === 1 && totalPax <= 0}
                    className="flex-1 rounded-full"
                  >
                    Continue
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="lg"
                    disabled={pending || totalPax <= 0}
                    className="flex-1 rounded-full"
                  >
                    {pending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        Redirecting…
                      </>
                    ) : (
                      "Confirm & pay"
                    )}
                  </Button>
                )}
              </div>

              {step === 3 && (
                <p className="text-center text-xs text-muted-foreground">
                  Secure payment via Teya. You won&apos;t be charged until you
                  confirm.
                </p>
              )}
            </div>

            {/* Trust badges */}
            <ul className="grid grid-cols-1 gap-2.5 border-t border-border pt-5 text-sm text-muted-foreground">
              {trust.map((t) => (
                <li key={t.text} className="flex items-center gap-2">
                  <t.icon className="size-4 text-primary" aria-hidden="true" />
                  {t.text}
                </li>
              ))}
            </ul>
      </form>
    </>
  )
}
