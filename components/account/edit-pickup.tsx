"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Check, Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { updateBookingPickup } from "@/app/actions/manage-booking"
import type { EditablePickup } from "@/lib/my-trips"

const SELECT_CLASS =
  "h-11 rounded-xl border border-border bg-background px-3.5 text-sm text-foreground shadow-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-[3px] focus:ring-primary/25"

export function EditPickup({
  bookingId,
  pickup,
}: {
  bookingId: string
  pickup: EditablePickup
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pickupId, setPickupId] = useState(
    pickup.current.pickupId != null ? String(pickup.current.pickupId) : "",
  )
  const [dropoffId, setDropoffId] = useState(
    pickup.current.dropoffId != null ? String(pickup.current.dropoffId) : "",
  )
  const [roomNumber, setRoomNumber] = useState(pickup.current.roomNumber ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dropoffOptions =
    pickup.dropoffPlaces.length > 0 ? pickup.dropoffPlaces : pickup.pickupPlaces
  const selectedPickup = pickup.pickupPlaces.find(
    (p) => String(p.id) === pickupId,
  )
  const needsRoomNumber = Boolean(selectedPickup?.askForRoomNumber)

  async function onSave() {
    setError(null)
    if (pickup.required && !selectedPickup) {
      setError("Please choose a pickup location.")
      return
    }
    if (needsRoomNumber && !roomNumber.trim()) {
      setError("Please add your room or house number.")
      return
    }
    setSaving(true)
    const res = await updateBookingPickup({
      bookingId,
      pickupId: selectedPickup ? selectedPickup.id : null,
      dropoffId: dropoffId ? Number(dropoffId) : null,
      roomNumber: needsRoomNumber ? roomNumber.trim() : null,
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSaved(true)
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setSaved(false)
        }}
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <MapPin className="size-4" aria-hidden="true" />
        {saved ? "Pickup updated" : "Edit pickup"}
      </button>
    )
  }

  return (
    <div className="mt-4 flex w-full flex-col gap-3 rounded-xl border border-border bg-background/50 p-4">
      <p className="text-sm font-semibold text-foreground">Pickup location</p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`pickup-${bookingId}`}>
          Where should we pick you up?
          {pickup.required && (
            <span className="ml-0.5 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>
        <select
          id={`pickup-${bookingId}`}
          value={pickupId}
          onChange={(e) => {
            setPickupId(e.target.value)
            setRoomNumber("")
          }}
          className={SELECT_CLASS}
        >
          <option value="">
            {pickup.required ? "Select a pickup point" : "I'll meet at the start"}
          </option>
          {pickup.pickupPlaces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {needsRoomNumber && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`room-${bookingId}`}>Room / house number</Label>
          <Input
            id={`room-${bookingId}`}
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            placeholder="e.g. 204"
          />
        </div>
      )}

      {dropoffOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`dropoff-${bookingId}`}>Drop-off location</Label>
          <select
            id={`dropoff-${bookingId}`}
            value={dropoffId}
            onChange={(e) => setDropoffId(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Same as pickup</option>
            {dropoffOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className={cn(buttonVariants({ size: "sm" }), "min-w-24")}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-4" aria-hidden="true" />
          )}
          Save
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError(null)
          }}
          disabled={saving}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
