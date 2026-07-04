"use client"

import { useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { toast } from "sonner"
import {
  Loader2,
  Check,
  X,
  Clock,
  Mail,
  Phone,
  User,
  CalendarDays,
  Ticket,
  Inbox,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

type CancellationRequestRow = {
  id: string
  bookingId: string
  bokunConfirmationCode: string | null
  tourTitle: string
  tourDate: string
  customerName: string
  customerEmail: string
  customerPhone: string | null
  locale: string
  reason: string | null
  hoursUntilTour: number | null
  status: "pending" | "approved" | "rejected"
  adminNote: string | null
  createdAt: string
  resolvedAt: string | null
}

const PENDING_KEY = "/api/admin/cancellation-requests?status=pending"

const fetcher = async (
  url: string,
): Promise<{ requests: CancellationRequestRow[]; pendingCount: number }> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to load cancellation requests")
  return res.json()
}

function fmtDate(value: string | null, withTime = false): string {
  if (!value) return "—"
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return value
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

const STATUS_TONE: Record<CancellationRequestRow["status"], string> = {
  pending: "bg-accent/15 text-accent-foreground border-accent/30",
  approved: "bg-chart-2/15 text-chart-2 border-chart-2/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
}

export function CancellationRequestsPanel() {
  const [showResolved, setShowResolved] = useState(false)
  const key = showResolved
    ? "/api/admin/cancellation-requests?status=all"
    : PENDING_KEY
  const { data, isLoading, isValidating, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  })
  const { mutate: globalMutate } = useSWRConfig()

  const requests = data?.requests ?? []

  function refreshAll() {
    mutate()
    globalMutate(PENDING_KEY)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h2 className="font-heading text-lg font-bold text-foreground">
            Cancellation requests
          </h2>
          <p className="text-xs text-muted-foreground">
            Customer requests to cancel within 72 hours of departure — review
            against the cancellation policy.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isValidating && (
            <Loader2
              className="size-4 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <Label
            htmlFor="show-resolved"
            className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
          >
            <Switch
              id="show-resolved"
              checked={showResolved}
              onCheckedChange={setShowResolved}
            />
            Show resolved
          </Label>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2
              className="size-6 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        ) : requests.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Inbox className="size-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              {showResolved
                ? "No cancellation requests yet."
                : "No pending cancellation requests."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {requests.map((r) => (
              <RequestCard key={r.id} request={r} onResolved={refreshAll} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function RequestCard({
  request: r,
  onResolved,
}: {
  request: CancellationRequestRow
  onResolved: () => void
}) {
  const [note, setNote] = useState("")
  const [refund, setRefund] = useState(true)
  const [pending, setPending] = useState<"approve" | "decline" | null>(null)
  const isPending = r.status === "pending"

  async function resolve(action: "approve" | "decline") {
    setPending(action)
    try {
      const res = await fetch(
        `/api/admin/cancellation-requests/${r.id}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: note.trim() || undefined,
            refund: action === "approve" ? refund : undefined,
          }),
        },
      )
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(json.error || "Could not resolve the request.")
        return
      }
      toast.success(
        action === "approve"
          ? "Booking cancelled and customer notified."
          : "Request declined and customer notified.",
      )
      onResolved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setPending(null)
    }
  }

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-base font-bold text-foreground">
              {r.tourTitle}
            </h3>
            <span
              className={
                "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize " +
                STATUS_TONE[r.status]
              }
            >
              {r.status}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              {fmtDate(r.tourDate)}
            </span>
            {r.bokunConfirmationCode && (
              <span className="flex items-center gap-1.5 font-mono">
                <Ticket className="size-3.5" aria-hidden="true" />
                {r.bokunConfirmationCode}
              </span>
            )}
            {r.hoursUntilTour !== null && (
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden="true" />
                {r.hoursUntilTour}h before departure
              </span>
            )}
          </div>
        </div>
        <span className="text-[11px] text-muted-foreground">
          Requested {fmtDate(r.createdAt, true)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground">
        <span className="flex items-center gap-1.5">
          <User className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {r.customerName}
        </span>
        <a
          href={`mailto:${r.customerEmail}`}
          className="flex items-center gap-1.5 text-primary hover:underline"
        >
          <Mail className="size-3.5" aria-hidden="true" />
          {r.customerEmail}
        </a>
        {r.customerPhone && (
          <a
            href={`tel:${r.customerPhone}`}
            className="flex items-center gap-1.5 text-primary hover:underline"
          >
            <Phone className="size-3.5" aria-hidden="true" />
            {r.customerPhone}
          </a>
        )}
      </div>

      {r.reason && (
        <p className="rounded-lg bg-secondary/50 p-3 text-sm text-foreground">
          {r.reason}
        </p>
      )}

      {isPending ? (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note to the customer (included in the email)…"
            rows={2}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={refund} onCheckedChange={setRefund} />
              Refund in Bokun on approval
            </Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pending !== null}
                onClick={() => resolve("decline")}
              >
                {pending === "decline" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <X className="size-4" />
                )}
                Decline
              </Button>
              <Button
                size="sm"
                disabled={pending !== null}
                onClick={() => resolve("approve")}
              >
                {pending === "approve" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Approve &amp; cancel
              </Button>
            </div>
          </div>
        </div>
      ) : (
        (r.adminNote || r.resolvedAt) && (
          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            Resolved {fmtDate(r.resolvedAt, true)}
            {r.adminNote ? ` — ${r.adminNote}` : ""}
          </div>
        )
      )}
    </li>
  )
}
