"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { getBookingStatus, type BookingSummary } from "@/app/actions/booking"
import { Price } from "@/components/price"
import { useDict } from "@/components/i18n-provider"
import { fmt } from "@/lib/translations"

const SETTLED = ["confirmed", "failed", "cancelled", "paid"]

/**
 * Reflects the booking's payment status on the success page. Confirmation comes
 * from the Teya webhook (server-side), so we poll the booking until it settles
 * rather than trusting the redirect.
 */
export function PaymentStatus({ bookingId }: { bookingId: string }) {
  const t = useDict().payment
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
          {t.checking}
        </h1>
      </Shell>
    )
  }

  if (phase === "error" || !summary) {
    return (
      <Shell>
        <XCircle className="size-10 text-destructive" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-extrabold text-foreground">
          {t.loadError}
        </h1>
        <p className="text-sm text-muted-foreground">{t.loadErrorText}</p>
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
          {t.confirmed}
        </h1>
        <p className="text-sm text-muted-foreground">
          {fmt(t.confirmedSentTo, { email: summary.email })}
        </p>
        <BookingCard summary={summary} />
        <Link
          href="/tours"
          className="text-sm font-semibold text-primary hover:underline"
        >
          {t.browseMore}
        </Link>
      </Shell>
    )
  }

  if (status === "failed" || status === "cancelled") {
    return (
      <Shell>
        <XCircle className="size-10 text-destructive" aria-hidden="true" />
        <h1 className="font-heading text-2xl font-extrabold text-foreground">
          {t.failed}
        </h1>
        <p className="text-sm text-muted-foreground">{t.failedText}</p>
        <ContactActions />
      </Shell>
    )
  }

  // Still pending_payment → webhook hasn't arrived yet.
  return (
    <Shell>
      <Loader2 className="size-10 animate-spin text-primary" aria-hidden="true" />
      <h1 className="font-heading text-2xl font-extrabold text-foreground">
        {t.receivedConfirming}
      </h1>
      <p className="text-sm text-muted-foreground">{t.receivedText}</p>
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
  const t = useDict().payment
  return (
    <div className="mt-2 w-full rounded-2xl border border-border bg-card p-5 text-left">
      <p className="font-heading text-lg font-bold text-foreground">
        {summary.tourTitle}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {summary.date} · {summary.totalPax}{" "}
        {summary.totalPax === 1 ? t.traveller : t.travellers}
      </p>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">{t.total}</span>
        <span className="font-heading text-lg font-extrabold text-foreground">
          <Price isk={summary.amountIsk} />
        </span>
      </div>
    </div>
  )
}

function ContactActions() {
  const t = useDict().payment
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Link
        href="/tours"
        className="text-sm font-semibold text-primary hover:underline"
      >
        {t.browseTours}
      </Link>
      <a
        href="tel:+3544191600"
        className="text-sm font-semibold text-primary hover:underline"
      >
        {fmt(t.callToBook, { phone: "+354 419 1600" })}
      </a>
    </div>
  )
}
