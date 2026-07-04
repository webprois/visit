"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CalendarClock,
  Users,
  Ticket,
  ArrowUpRight,
  Compass,
} from "lucide-react"
import {
  convertFromIsk,
  formatMoney,
  type Currency,
  type IskRates,
} from "@/lib/currency"
import type { DashboardData } from "@/lib/dashboard"

export function DashboardWorkspace({ data }: { data: DashboardData }) {
  const { kpis, rates, currency } = data

  const money = useMemo(
    () => (isk: number) => formatMoney(convertFromIsk(isk, currency, rates), currency),
    [currency, rates],
  )

  const generated = new Date(data.generatedAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">Overview</h1>
          <p className="text-xs text-muted-foreground">
            {kpis.totalBookings.toLocaleString("en-GB")} bookings from Bokun · updated {generated}
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-xs text-muted-foreground">Total revenue (all time)</p>
          <p className="font-heading text-lg font-bold text-foreground">{money(kpis.totalRevenueIsk)}</p>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Revenue this month"
              value={money(kpis.revenueThisMonthIsk)}
              delta={kpis.revenueDeltaPct}
              sub={`vs ${money(kpis.revenueLastMonthIsk)} last month`}
              icon={Wallet}
              tone="primary"
            />
            <KpiCard
              label="Bookings this month"
              value={kpis.bookingsThisMonth.toLocaleString("en-GB")}
              delta={kpis.bookingsDeltaPct}
              sub={`vs ${kpis.bookingsLastMonth.toLocaleString("en-GB")} last month`}
              icon={Ticket}
            />
            <KpiCard
              label="Guests next 30 days"
              value={kpis.upcomingGuests.toLocaleString("en-GB")}
              sub="travellers with upcoming departures"
              icon={Users}
            />
            <KpiCard
              label="Departures next 7 days"
              value={kpis.upcomingDepartures.toLocaleString("en-GB")}
              sub={`avg booking ${money(kpis.avgBookingValueIsk)}`}
              icon={CalendarClock}
            />
          </div>

          {/* Revenue trend */}
          <RevenueChart data={data} money={money} currency={currency} rates={rates} />

          {/* Top tours + channels */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TopToursCard data={data} money={money} />
            <ChannelsCard data={data} money={money} />
          </div>

          {/* Recent bookings + upcoming departures */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RecentBookingsCard data={data} money={money} />
            <UpcomingDeparturesCard data={data} />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------------- KPI card ---------------- */

function KpiCard({
  label,
  value,
  delta,
  sub,
  icon: Icon,
  tone = "default",
}: {
  label: string
  value: string
  delta?: number | null
  sub?: string
  icon: typeof Wallet
  tone?: "default" | "primary"
}) {
  const up = typeof delta === "number" && delta >= 0
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={
            "flex size-8 items-center justify-center rounded-lg " +
            (tone === "primary" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")
          }
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="font-heading text-2xl font-bold text-foreground">{value}</p>
        {typeof delta === "number" && (
          <span
            className={
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold " +
              (up ? "bg-chart-3/15 text-chart-3" : "bg-primary/15 text-primary")
            }
          >
            {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

/* ---------------- Revenue chart ---------------- */

function RevenueChart({
  data,
  money,
  currency,
  rates,
}: {
  data: DashboardData
  money: (isk: number) => string
  currency: Currency
  rates: IskRates
}) {
  const chartData = data.revenueByMonth.map((p) => ({
    label: p.label,
    revenue: Math.round(convertFromIsk(p.revenueIsk, currency, rates)),
    bookings: p.bookings,
  }))

  const config: ChartConfig = {
    revenue: { label: `Revenue (${currency})`, color: "var(--chart-1)" },
  }

  const total = data.revenueByMonth.reduce((s, p) => s + p.revenueIsk, 0)

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-base font-bold text-foreground">Revenue trend</h2>
          <p className="text-xs text-muted-foreground">Bookings created, last 12 months</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">12-month total</p>
          <p className="font-heading text-base font-bold text-foreground">{money(total)}</p>
        </div>
      </div>

      <ChartContainer config={config} className="h-[240px] w-full">
        <AreaChart data={chartData} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            className="text-xs"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
            }
            className="text-xs"
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                indicator="line"
                formatter={(value) => formatMoney(Number(value), currency)}
              />
            }
          />
          <Area
            dataKey="revenue"
            type="monotone"
            stroke="var(--color-revenue)"
            strokeWidth={2}
            fill="url(#fillRevenue)"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

/* ---------------- Top tours ---------------- */

function TopToursCard({
  data,
  money,
}: {
  data: DashboardData
  money: (isk: number) => string
}) {
  const max = data.topTours[0]?.revenueIsk ?? 1
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Compass className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-base font-bold text-foreground">Top tours by revenue</h2>
      </div>
      {data.topTours.length === 0 ? (
        <EmptyRow label="No tour revenue yet" />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.topTours.map((tour) => (
            <li key={tour.title} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-foreground">{tour.title}</span>
                <span className="shrink-0 font-semibold text-foreground">{money(tour.revenueIsk)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(4, (tour.revenueIsk / max) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {tour.bookings.toLocaleString("en-GB")} bookings · {tour.guests.toLocaleString("en-GB")} guests
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------------- Sales channels ---------------- */

const CHANNEL_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function ChannelsCard({
  data,
  money,
}: {
  data: DashboardData
  money: (isk: number) => string
}) {
  const total = data.channels.reduce((s, c) => s + c.revenueIsk, 0) || 1
  const top = data.channels.slice(0, 5)
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <ArrowUpRight className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-base font-bold text-foreground">Sales channels</h2>
      </div>
      {top.length === 0 ? (
        <EmptyRow label="No channel data yet" />
      ) : (
        <>
          {/* Stacked share bar */}
          <div className="flex h-2.5 overflow-hidden rounded-full bg-secondary">
            {top.map((c, i) => (
              <div
                key={c.name}
                style={{
                  width: `${(c.revenueIsk / total) * 100}%`,
                  backgroundColor: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
                }}
              />
            ))}
          </div>
          <ul className="flex flex-col gap-2.5">
            {top.map((c, i) => (
              <li key={c.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CHANNEL_COLORS[i % CHANNEL_COLORS.length] }}
                  />
                  <span className="truncate text-foreground">{c.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {((c.revenueIsk / total) * 100).toFixed(0)}%
                  </span>
                  <span className="font-semibold text-foreground">{money(c.revenueIsk)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/* ---------------- Recent bookings ---------------- */

function RecentBookingsCard({
  data,
  money,
}: {
  data: DashboardData
  money: (isk: number) => string
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-base font-bold text-foreground">Recent bookings</h2>
        <Link
          href="/admin/bookings"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View all <ArrowUpRight className="size-3" />
        </Link>
      </div>
      {data.recentBookings.length === 0 ? (
        <EmptyRow label="No bookings yet" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {data.recentBookings.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{b.productTitle}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {b.customerName || "Guest"} · {shortDate(b.bookedAt)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-foreground">
                {money(toIskLike(b.totalPrice, b.currency, data.rates))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------------- Upcoming departures ---------------- */

function UpcomingDeparturesCard({ data }: { data: DashboardData }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-foreground" />
        <h2 className="font-heading text-base font-bold text-foreground">Upcoming departures</h2>
      </div>
      {data.upcomingDeparturesList.length === 0 ? (
        <EmptyRow label="No upcoming departures" />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {data.upcomingDeparturesList.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{b.productTitle}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {b.customerName || "Guest"}
                  {b.startTime ? ` · ${b.startTime}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-foreground">
                  {shortDate(b.travelDateTime ?? b.travelDate)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {b.totalParticipants} {b.totalParticipants === 1 ? "guest" : "guests"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ---------------- helpers ---------------- */

function EmptyRow({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>
}

function shortDate(ms: number | null): string {
  if (!ms) return "—"
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Mirror of the server-side toIsk so per-row amounts convert consistently. */
function toIskLike(amount: number, currency: string, rates: IskRates): number {
  if (!amount) return 0
  if (currency === "ISK") return amount
  const rate = rates[currency as Currency]
  if (!rate) return amount
  return amount / rate
}
