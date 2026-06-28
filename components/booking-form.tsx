"use client"

import { useMemo, useState, useTransition } from "react"
import { CalendarDays, Clock, Loader2, Minus, Phone, Plus } from "lucide-react"
import { Price } from "@/components/price"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { startBooking, type BookingInput } from "@/app/actions/booking"

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
}: {
  bokunId: string
  slots: BookingSlot[]
  extras?: BookingExtra[]
  pickup?: BookingPickup | null
  fallbackPhone: string
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
  const [pickupId, setPickupId] = useState<string>("")
  const [dropoffId, setDropoffId] = useState<string>("")
  const [roomNumber, setRoomNumber] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const totalPax = lines.reduce((n, l) => n + (qtyByLine[l.id] ?? 0), 0)
  const baseTotal = slot ? computeTotal(slot, qtyByLine, totalPax) : 0
  const addonsTotal = extras.reduce(
    (n, e) => n + (qtyByAddon[e.id] ?? 0) * e.unitIsk,
    0,
  )
  const total = baseTotal + addonsTotal

  const selectedPickup = pickupPlaces.find((p) => String(p.id) === pickupId)
  const needsRoomNumber = Boolean(selectedPickup?.askForRoomNumber)

  // Remaining seats for the active slot (Infinity when unlimited).
  const seatsLeft =
    !slot || slot.unlimited ? Number.POSITIVE_INFINITY : slot.seats - totalPax
  const atCapacity = seatsLeft <= 0

  function setQty(lineId: number, next: number) {
    setQtyByLine((prev) => ({ ...prev, [lineId]: Math.max(0, next) }))
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
    setError(null)
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

    const selections = slot.pricedPerPerson
      ? slot.lines
          .map((l) => ({ lineId: l.id, qty: qtyByLine[l.id] ?? 0 }))
          .filter((s) => s.qty > 0)
      : [{ lineId: 0, qty: totalPax }]

    const addons = extras
      .map((e) => ({ extraId: e.id, qty: qtyByAddon[e.id] ?? 0 }))
      .filter((a) => a.qty > 0)

    const payload: BookingInput = {
      bokunId,
      slotId: slot.id,
      date: slot.date,
      startTime: slot.startTime,
      startTimeId: slot.startTimeId,
      selections,
      addons,
      pickupId: selectedPickup ? selectedPickup.id : undefined,
      dropoffId: dropoffId ? Number(dropoffId) : undefined,
      roomNumber: needsRoomNumber ? roomNumber.trim() : undefined,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
      notes,
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

  // No availability at all → contact fallback.
  if (slots.length === 0) {
    return (
      <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">
          Online booking isn&apos;t available for this tour.
        </p>
        <p className="mt-1">
          Contact us and we&apos;ll arrange your booking directly.
        </p>
        <a
          href={`tel:${fallbackPhone.replace(/\s/g, "")}`}
          className="mt-3 inline-flex items-center gap-2 font-medium text-primary"
        >
          <Phone className="size-4" aria-hidden="true" />
          {fallbackPhone}
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="booking-date" className="flex items-center gap-1.5">
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          Date
        </Label>
        <select
          id="booking-date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {dates.map((d) => (
            <option key={d} value={d}>
              {formatDate(d)}
            </option>
          ))}
        </select>
      </div>

      {/* Time (only when the date has more than one departure) */}
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
            className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {slotsForDate.map((s) => (
              <option key={s.id} value={s.id}>
                {s.startTime || "Flexible"}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Participants / price lines */}
      {slot && (
        <div className="flex flex-col gap-3">
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
                    onClick={() => setQty(line.id, qty - 1)}
                    disabled={qty <= 0}
                    aria-label={`Decrease ${line.title}`}
                    className="flex size-8 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-40"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold text-foreground">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(line.id, qty + 1)}
                    disabled={atCapacity}
                    aria-label={`Increase ${line.title}`}
                    className="flex size-8 items-center justify-center rounded-full border border-border text-foreground disabled:opacity-40"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )
          })}
          {!slot.unlimited && seatsLeft <= 5 && (
            <p
              className={`text-xs ${
                atCapacity ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {atCapacity
                ? "No more seats available for this departure."
                : `${seatsLeft} ${seatsLeft === 1 ? "seat" : "seats"} left for this departure.`}
            </p>
          )}
        </div>
      )}

      {/* Add-ons (hidden when none loaded) */}
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

      {/* Pickup / drop-off (hidden when no places are configured) */}
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
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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

      {/* Customer details */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-name">Full name</Label>
          <Input
            id="booking-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
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
          <Input
            id="booking-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-notes">Notes (optional)</Label>
          <Textarea
            id="booking-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Dietary needs, accessibility, special requests, etc."
          />
        </div>
      </div>

      {/* Itemized order summary + total */}
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
          "Book now"
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Secure payment via Teya. You won&apos;t be charged until you confirm.
      </p>
    </form>
  )
}
