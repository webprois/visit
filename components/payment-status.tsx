"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { getBookingStatus, type BookingSummary } from "@/app/actions/booking"
import { Price } from "@/components/price"

const SETTLED = ["confirmed", "failed", "cancelled", "paid"]

/**
 * Reflects the booking's payment status on the success page. Confirmation comes
 * from the Teya webhook (server-side), so we poll the booking until it settles
 * rather than trusting the redirect.
 */
export function PaymentStatus({ bookingId }: { bookingId: string }) {
  const [summary, setSummary] = useState<BookingSummary | null>(null)
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    let active = true
    let tries = 0
    async function poll() {
      try {
        const s = await getBookingStatus(bookingId)
        if (!active) return
        setSummary(s)
        setPhase("ready")
        tries += 1
        const settled = s && SETTLED.includes(s.status)
        if (!settled && tries < 20) setTimeout(poll, 2500)
      } catch {
        if (active) setPhase("error")
      }
    }
    poll()
    return () => {
      active = false
    }
  }, [bookingId])

  if (phase === "loading") {
    return (
      <Shell>
        <Loader2 className="size-10 animate-spin text-primary" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-extrabold text-foreground">
          Checking your payment…
        </h1>
      </Shell>
    )
  }

  if (phase === "error" || !summary) {
    return (
      <Shell>
        <XCircle className="size-10 text-destructive" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-extrabold text-foreground">
          We couldn&apos;t load your booking
        </h1>
        <p className="text-sm text-muted-foreground">
          If you were charged, contact us and we&apos;ll sort it out right away.
        </p>
        <ContactActions />
      </Shell>
    )
  }

  const status = summary.status

  if (status === "confirmed" || status === "paid") {
    return (
      <Shell>
        <CheckCircle2 className="size-12 text-emerald-500" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-extrabold text-foreground">
          Booking confirmed!
        </h1>
        <p className="text-sm text-muted-foreground">
          A confirmation has been sent to{" "}
          <span className="text-foreground">{summary.email}</span>.
        </p>
        <BookingCard summary={summary} />
        <Link
          href="/tours"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Browse more tours
        </Link>
      </Shell>
    )
  }

  if (status === "failed" || status === "cancelled") {
    return (
      <Shell>
        <XCircle className="size-10 text-destructive" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-extrabold text-foreground">
          Payment didn&apos;t go through
        </h1>
        <p className="text-sm text-muted-foreground">
          You haven&apos;t been charged. You can try booking again.
        </p>
        <ContactActions />
      </Shell>
    )
  }

  // Still pending_payment → webhook hasn't arrived yet.
  return (
    <Shell>
      <Loader2 className="size-10 animate-spin text-primary" aria-hidden="true" />
      <h1 className="font-heading text-2xl font-extrabold text-foreground">
        Payment received — confirming your booking…
      </h1>
      <p className="text-sm text-muted-foreground">
        This usually takes a few seconds. You can keep this page open.
      </p>
      <BookingCard summary={summary} />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      {children}
    </div>
  )
}

function BookingCard({ summary }: { summary: BookingSummary }) {
  return (
    <div className="mt-2 w-full rounded-2xl border border-border bg-card p-5 text-left">
      <p className="font-heading text-lg font-bold text-foreground">
        {summary.tourTitle}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {summary.date} · {summary.totalPax}{" "}
        {summary.totalPax === 1 ? "traveller" : "travellers"}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="font-heading text-lg font-extrabold text-foreground">
          <Price isk={summary.amountIsk} />
        </span>
      </div>
    </div>
  )
}

function ContactActions() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Link
        href="/tours"
        className="text-sm font-semibold text-primary hover:underline"
      >
        Browse tours
      </Link>
      <a
        href="tel:+3544191600"
        className="text-sm font-semibold text-primary hover:underline"
      >
        Call +354 419 1600
      </a>
    </div>
  )
}
