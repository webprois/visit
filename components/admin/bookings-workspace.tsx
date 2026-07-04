"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  Phone,
  Mail,
  MapPin,
  Ticket,
  CalendarDays,
  Tag,
  Ban,
  AlertTriangle,
} from "lucide-react"
import type { BokunBooking, BokunBookingResult } from "@/lib/bokun"
import type { BookingFiltersState } from "./bookings-shell"

const STATUS_OPTIONS = [
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ARRIVED", label: "Arrived" },
  { value: "NO_SHOW", label: "No-show" },
  { value: "ALL", label: "All statuses" },
]

function statusTone(status: string): string {
  switch (status) {
    case "CONFIRMED":
      return "bg-chart-2/15 text-chart-2 border-chart-2/30"
    case "CANCELLED":
    case "REJECTED":
      return "bg-destructive/15 text-destructive border-destructive/30"
    case "ARRIVED":
      return "bg-primary/15 text-primary border-primary/30"
    default:
      return "bg-secondary text-muted-foreground border-border"
  }
}

function fmtDate(ms: number | null, withTime = false): string {
  if (!ms) return "—"
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${amount.toLocaleString("en-GB")} ${currency}`
  }
}

export function BookingsWorkspace({
  result,
  loading,
  validating,
  filters,
  onFiltersChange,
  pageSize,
  onCancelled,
}: {
  result: BokunBookingResult
  loading: boolean
  validating: boolean
  filters: BookingFiltersState
  onFiltersChange: (next: BookingFiltersState) => void
  pageSize: number
  onCancelled: () => void
}) {
  // Free-text filter runs on the client over the current page (Bokun's search
  // has no fuzzy name/product search — only exact confirmation code).
  const [text, setText] = useState("")
  const [selected, setSelected] = useState<BokunBooking | null>(null)

  const items = result.items
  const visible = useMemo(() => {
    const q = text.trim().toLowerCase()
    if (!q) return items
    return items.filter((b) =>
      [b.customerName, b.customerEmail, b.productTitle, b.confirmationCode, b.channel]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    )
  }, [items, text])

  const totalPages = Math.max(1, Math.ceil(result.totalHits / pageSize))
  const revenue = useMemo(
    () => items.reduce((sum, b) => (b.status === "CONFIRMED" ? sum + b.totalPrice : sum), 0),
    [items],
  )
  const pax = useMemo(
    () => items.reduce((sum, b) => (b.status === "CONFIRMED" ? sum + b.totalParticipants : sum), 0),
    [items],
  )
  const currency = items[0]?.currency ?? "ISK"

  function update(patch: Partial<BookingFiltersState>) {
    onFiltersChange({ ...filters, page: 1, ...patch })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-heading text-xl font-bold text-foreground">Bookings</h1>
            <p className="text-xs text-muted-foreground">
              {result.totalHits.toLocaleString("en-GB")} reservations from Bokun (all sales channels)
            </p>
          </div>
          {validating && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryChip label="On this page" value={items.length.toString()} />
          <SummaryChip label="Participants" value={pax.toLocaleString("en-GB")} />
          <SummaryChip label="Revenue (confirmed)" value={fmtMoney(revenue, currency)} tone="primary" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-6 py-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filter this page by name, email, tour..."
            className="pl-9"
          />
        </div>
        <Input
          value={filters.confirmationCode}
          onChange={(e) => update({ confirmationCode: e.target.value })}
          placeholder="Confirmation code"
          className="w-[180px]"
        />
        <Select value={filters.status} onValueChange={(v) => update({ status: v ?? "CONFIRMED" })}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">Travel</label>
          <Input
            type="date"
            value={filters.travelFrom}
            onChange={(e) => update({ travelFrom: e.target.value })}
            className="w-[150px]"
            aria-label="Travel date from"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            value={filters.travelTo}
            onChange={(e) => update({ travelTo: e.target.value })}
            className="w-[150px]"
            aria-label="Travel date to"
          />
        </div>
        {(filters.confirmationCode || filters.travelFrom || filters.travelTo || filters.status !== "CONFIRMED" || text) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setText("")
              onFiltersChange({
                status: "CONFIRMED",
                confirmationCode: "",
                travelFrom: "",
                travelTo: "",
                page: 1,
              })
            }}
          >
            <X className="mr-1 size-4" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <CalendarDays className="size-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No bookings match these filters.</p>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-3 font-semibold">Confirmation</th>
                <th className="px-3 py-3 font-semibold">Tour</th>
                <th className="px-3 py-3 font-semibold">Customer</th>
                <th className="px-3 py-3 font-semibold">Travel date</th>
                <th className="px-3 py-3 font-semibold">Pax</th>
                <th className="px-3 py-3 font-semibold">Channel</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                <th className="px-6 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => setSelected(b)}
                  className="cursor-pointer border-b border-border/60 transition-colors hover:bg-secondary/50"
                >
                  <td className="px-6 py-3">
                    <span className="font-mono text-xs font-medium text-foreground">
                      {b.confirmationCode}
                    </span>
                  </td>
                  <td className="max-w-[220px] px-3 py-3">
                    <span className="line-clamp-1 text-foreground">{b.productTitle}</span>
                    {b.startTime && (
                      <span className="text-xs text-muted-foreground">{b.startTime}</span>
                    )}
                  </td>
                  <td className="max-w-[180px] px-3 py-3">
                    <span className="line-clamp-1 text-foreground">{b.customerName}</span>
                    {b.customerEmail && (
                      <span className="line-clamp-1 text-xs text-muted-foreground">{b.customerEmail}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                    {fmtDate(b.travelDateTime ?? b.travelDate)}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{b.totalParticipants}</td>
                  <td className="max-w-[120px] px-3 py-3">
                    <span className="line-clamp-1 text-xs text-muted-foreground">{b.channel ?? "—"}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-foreground">
                    {fmtMoney(b.totalPrice, b.currency)}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={
                        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
                        statusTone(b.status)
                      }
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex shrink-0 items-center justify-between border-t border-border px-6 py-3 text-sm">
        <span className="text-muted-foreground">
          Page {filters.page} of {totalPages}
          {text && ` · ${visible.length} shown after filter`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page <= 1 || loading}
            onClick={() => onFiltersChange({ ...filters, page: filters.page - 1 })}
          >
            <ChevronLeft className="mr-1 size-4" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={filters.page >= totalPages || loading}
            onClick={() => onFiltersChange({ ...filters, page: filters.page + 1 })}
          >
            Next <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <BookingDetail
          booking={selected}
          onClose={() => setSelected(null)}
          onCancelled={() => {
            onCancelled()
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

function SummaryChip({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "primary"
}) {
  return (
    <div
      className={
        "flex flex-col rounded-lg border px-3 py-1.5 " +
        (tone === "primary"
          ? "border-primary/30 bg-primary/10"
          : "border-border bg-card")
      }
    >
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
  )
}

function BookingDetail({
  booking: b,
  onClose,
  onCancelled,
}: {
  booking: BokunBooking
  onClose: () => void
  onCancelled: () => void
}) {
  const isCancelled = b.status === "CANCELLED" || b.status === "REJECTED"
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
      />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <span
              className={
                "mb-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
                statusTone(b.status)
              }
            >
              {b.status}
            </span>
            <h2 className="font-heading text-lg font-bold text-foreground">{b.productTitle}</h2>
            <p className="font-mono text-xs text-muted-foreground">{b.confirmationCode}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-5">
          {/* Travel */}
          <Section title="Travel">
            <Row icon={CalendarDays} label="Date">
              {fmtDate(b.travelDateTime ?? b.travelDate, Boolean(b.travelDateTime))}
              {b.startTime ? ` · ${b.startTime}` : ""}
            </Row>
            <Row icon={Users} label="Participants">
              {b.totalParticipants}
              {b.participants.length > 0 &&
                ` (${b.participants.map((p) => `${p.quantity}× ${p.title}`).join(", ")})`}
            </Row>
            {b.rateTitle && <Row icon={Ticket} label="Rate">{b.rateTitle}</Row>}
            {(b.pickup || b.dropoff) && (
              <Row icon={MapPin} label="Pickup">
                {b.pickup ? "Pickup" : ""}
                {b.pickup && b.dropoff ? " & " : ""}
                {b.dropoff ? "Drop-off" : ""}
                {b.pickupDescription ? ` · ${b.pickupDescription}` : ""}
              </Row>
            )}
          </Section>

          {/* Customer */}
          <Section title="Customer">
            <Row icon={Users} label="Name">{b.customerName}</Row>
            {b.customerEmail && (
              <Row icon={Mail} label="Email">
                <a href={`mailto:${b.customerEmail}`} className="text-primary hover:underline">
                  {b.customerEmail}
                </a>
              </Row>
            )}
            {b.customerPhone && (
              <Row icon={Phone} label="Phone">
                <a href={`tel:${b.customerPhone}`} className="text-primary hover:underline">
                  {b.customerPhone}
                </a>
              </Row>
            )}
            {b.customerNationality && (
              <Row icon={MapPin} label="Nationality">{b.customerNationality}</Row>
            )}
          </Section>

          {/* Extras */}
          {b.extras.length > 0 && (
            <Section title="Extras">
              {b.extras.map((e) => (
                <Row key={e.title} icon={Tag} label={e.title}>
                  {e.quantity}×
                </Row>
              ))}
            </Section>
          )}

          {/* Payment */}
          <Section title="Payment">
            <Row label="Total">{fmtMoney(b.totalPrice, b.currency)}</Row>
            <Row label="Paid">
              {fmtMoney(b.paidAmount, b.currency)}
              {b.paidType ? ` (${b.paidType})` : ""}
            </Row>
            {b.discountAmount > 0 && (
              <Row label="Discount">
                {fmtMoney(b.discountAmount, b.currency)} ({b.discountPercentage}%)
              </Row>
            )}
            {b.sellerCommission > 0 && (
              <Row label="Commission">{fmtMoney(b.sellerCommission, b.commissionCurrency)}</Row>
            )}
            <Row label="Prepaid">{b.prepaid ? "Yes" : "No"}</Row>
          </Section>

          {/* Source */}
          <Section title="Source">
            {b.channel && <Row label="Channel">{b.channel}</Row>}
            {b.vendor && <Row label="Operator">{b.vendor}</Row>}
            {b.seller && <Row label="Seller">{b.seller}</Row>}
            {b.productConfirmationCode && (
              <Row label="Product ref">
                <span className="font-mono text-xs">{b.productConfirmationCode}</span>
              </Row>
            )}
            <Row label="Booked">{fmtDate(b.bookedAt, true)}</Row>
          </Section>

          {/* Notes / cancellation */}
          {(b.specialRequests || b.cancelledAt || b.labels.length > 0) && (
            <Section title="Notes">
              {b.labels.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {b.labels.map((l) => (
                    <span
                      key={l}
                      className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              )}
              {b.specialRequests && (
                <p className="text-sm text-foreground">{b.specialRequests}</p>
              )}
              {b.cancelledAt && (
                <p className="text-sm text-destructive">
                  Cancelled {fmtDate(b.cancelledAt, true)}
                  {b.cancelNote ? ` — ${b.cancelNote}` : ""}
                </p>
              )}
            </Section>
          )}

          {/* Cancel action */}
          {!isCancelled && (
            <div className="border-t border-border pt-4">
              <Button
                variant="outline"
                className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirming(true)}
              >
                <Ban className="mr-2 size-4" /> Cancel booking
              </Button>
            </div>
          )}
        </div>
      </div>

      {confirming && (
        <CancelDialog
          booking={b}
          onDismiss={() => setConfirming(false)}
          onCancelled={onCancelled}
        />
      )}
    </div>
  )
}

function CancelDialog({
  booking: b,
  onDismiss,
  onCancelled,
}: {
  booking: BokunBooking
  onDismiss: () => void
  onCancelled: () => void
}) {
  const [note, setNote] = useState("")
  const [notify, setNotify] = useState(false)
  const [refund, setRefund] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setSubmitting(true)
    try {
      const res = await fetch("/api/admin/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationCode: b.confirmationCode,
          note: note.trim() || undefined,
          notify,
          refund,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || "Could not cancel this booking.")
        return
      }
      toast.success(`Booking ${b.confirmationCode} cancelled.`)
      onCancelled()
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-heading text-base font-bold text-foreground">Cancel booking?</h3>
            <p className="text-sm text-muted-foreground">
              This cancels{" "}
              <span className="font-mono text-foreground">{b.confirmationCode}</span> in Bokun.
              This cannot be undone here.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cancel-note" className="text-xs text-muted-foreground">
              Reason (optional)
            </Label>
            <Textarea
              id="cancel-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Shown in Bokun's cancellation record"
              rows={2}
            />
          </div>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <span className="flex flex-col">
              <span className="text-sm text-foreground">Notify customer</span>
              <span className="text-xs text-muted-foreground">Email the traveller about the cancellation</span>
            </span>
            <Switch checked={notify} onCheckedChange={setNotify} />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
            <span className="flex flex-col">
              <span className="text-sm text-foreground">Refund payment</span>
              <span className="text-xs text-muted-foreground">Attempt an automatic refund in Bokun</span>
            </span>
            <Switch checked={refund} onCheckedChange={setRefund} />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onDismiss} disabled={submitting}>
            Keep booking
          </Button>
          <Button
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Cancelling...
              </>
            ) : (
              <>
                <Ban className="mr-2 size-4" /> Cancel booking
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {Icon && <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-foreground">{children}</span>
    </div>
  )
}
