import "server-only"
import type { BokunBooking } from "@/lib/bokun"
import { type Currency, type IskRates } from "@/lib/currency"

/** A single point in the 12-month revenue trend. */
export type RevenuePoint = {
  /** Sort/lookup key, e.g. "2026-03". */
  key: string
  /** Short display label, e.g. "Mar". */
  label: string
  /** Revenue for the month in ISK base units. */
  revenueIsk: number
  /** Number of bookings created that month. */
  bookings: number
}

export type TopTour = {
  title: string
  revenueIsk: number
  bookings: number
  guests: number
}

export type ChannelSlice = {
  name: string
  revenueIsk: number
  bookings: number
}

export type DashboardData = {
  /** Display currency for the client (site default). */
  currency: Currency
  /** ISK -> currency rates so the client can format any ISK figure. */
  rates: IskRates
  generatedAt: number
  kpis: {
    revenueThisMonthIsk: number
    revenueLastMonthIsk: number
    /** Percentage change vs last month; null when last month was zero. */
    revenueDeltaPct: number | null
    bookingsThisMonth: number
    bookingsLastMonth: number
    bookingsDeltaPct: number | null
    /** Guests travelling in the next 30 days. */
    upcomingGuests: number
    /** Departures in the next 7 days. */
    upcomingDepartures: number
    /** Average booking value across all bookings, ISK. */
    avgBookingValueIsk: number
    totalBookings: number
    totalRevenueIsk: number
  }
  revenueByMonth: RevenuePoint[]
  topTours: TopTour[]
  channels: ChannelSlice[]
  recentBookings: BokunBooking[]
  upcomingDeparturesList: BokunBooking[]
}

/** Convert an amount in an arbitrary currency into ISK base units. */
function toIsk(amount: number, currency: string, rates: IskRates): number {
  if (!amount) return 0
  if (currency === "ISK") return amount
  const rate = rates[currency as Currency]
  // rate is "target per 1 ISK", so ISK = amount / rate.
  if (!rate) return amount
  return amount / rate
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

/**
 * Aggregate raw Bokun bookings into everything the overview dashboard needs.
 * All monetary values are normalised to ISK base units; the client converts to
 * the display currency using the provided rates. Revenue trend is bucketed by
 * booking-creation date (sales activity); departures use travel date.
 */
export function buildDashboardData(
  bookings: BokunBooking[],
  rates: IskRates,
  currency: Currency,
): DashboardData {
  const now = new Date()
  const nowMs = now.getTime()
  const thisMonth = monthKey(now)
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonth = monthKey(lastMonthDate)

  const in7Days = nowMs + 7 * 86_400_000
  const in30Days = nowMs + 30 * 86_400_000

  // Build the ordered list of the last 12 month buckets.
  const monthBuckets: RevenuePoint[] = []
  const bucketIndex = new Map<string, RevenuePoint>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const point: RevenuePoint = {
      key: monthKey(d),
      label: MONTH_LABELS[d.getMonth()],
      revenueIsk: 0,
      bookings: 0,
    }
    monthBuckets.push(point)
    bucketIndex.set(point.key, point)
  }

  let revenueThisMonthIsk = 0
  let revenueLastMonthIsk = 0
  let bookingsThisMonth = 0
  let bookingsLastMonth = 0
  let upcomingGuests = 0
  let upcomingDepartures = 0
  let totalRevenueIsk = 0

  const tourMap = new Map<string, TopTour>()
  const channelMap = new Map<string, ChannelSlice>()

  for (const b of bookings) {
    const revenueIsk = toIsk(b.totalPrice, b.currency, rates)
    totalRevenueIsk += revenueIsk

    // Sales activity is bucketed by booking creation date.
    const created = b.bookedAt ? new Date(b.bookedAt) : null
    if (created) {
      const key = monthKey(created)
      const bucket = bucketIndex.get(key)
      if (bucket) {
        bucket.revenueIsk += revenueIsk
        bucket.bookings += 1
      }
      if (key === thisMonth) {
        revenueThisMonthIsk += revenueIsk
        bookingsThisMonth += 1
      } else if (key === lastMonth) {
        revenueLastMonthIsk += revenueIsk
        bookingsLastMonth += 1
      }
    }

    // Upcoming departures / guests by travel date.
    const travel = b.travelDateTime ?? b.travelDate
    if (travel && travel >= nowMs) {
      if (travel <= in7Days) upcomingDepartures += 1
      if (travel <= in30Days) upcomingGuests += b.totalParticipants
    }

    // Top tours by revenue.
    const tourTitle = b.productTitle || "Unknown tour"
    const tour = tourMap.get(tourTitle) ?? { title: tourTitle, revenueIsk: 0, bookings: 0, guests: 0 }
    tour.revenueIsk += revenueIsk
    tour.bookings += 1
    tour.guests += b.totalParticipants
    tourMap.set(tourTitle, tour)

    // Sales channels.
    const channelName = b.channel || "Direct"
    const channel = channelMap.get(channelName) ?? { name: channelName, revenueIsk: 0, bookings: 0 }
    channel.revenueIsk += revenueIsk
    channel.bookings += 1
    channelMap.set(channelName, channel)
  }

  const topTours = [...tourMap.values()]
    .sort((a, b) => b.revenueIsk - a.revenueIsk)
    .slice(0, 6)

  const channels = [...channelMap.values()].sort((a, b) => b.revenueIsk - a.revenueIsk)

  const recentBookings = [...bookings]
    .filter((b) => b.bookedAt)
    .sort((a, b) => (b.bookedAt ?? 0) - (a.bookedAt ?? 0))
    .slice(0, 8)

  const upcomingDeparturesList = [...bookings]
    .filter((b) => {
      const travel = b.travelDateTime ?? b.travelDate
      return travel != null && travel >= nowMs
    })
    .sort((a, b) => (a.travelDateTime ?? a.travelDate ?? 0) - (b.travelDateTime ?? b.travelDate ?? 0))
    .slice(0, 8)

  return {
    currency,
    rates,
    generatedAt: nowMs,
    kpis: {
      revenueThisMonthIsk,
      revenueLastMonthIsk,
      revenueDeltaPct: pctChange(revenueThisMonthIsk, revenueLastMonthIsk),
      bookingsThisMonth,
      bookingsLastMonth,
      bookingsDeltaPct: pctChange(bookingsThisMonth, bookingsLastMonth),
      upcomingGuests,
      upcomingDepartures,
      avgBookingValueIsk: bookings.length ? totalRevenueIsk / bookings.length : 0,
      totalBookings: bookings.length,
      totalRevenueIsk,
    },
    revenueByMonth: monthBuckets,
    topTours,
    channels,
    recentBookings,
    upcomingDeparturesList,
  }
}
