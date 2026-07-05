"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
  import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
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
import { es as esLocale, it as itLocale, pt as ptLocale } from "date-fns/locale"
import type { Locale as DateFnsLocale } from "date-fns"
import { Price } from "@/components/price"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { startBooking, type BookingInput } from "@/app/actions/booking"
import { useDict, useLocale } from "@/components/i18n-provider"
import { fmt } from "@/lib/translations"
import { authClient } from "@/lib/auth-client"
import { Checkbox } from "@/components/ui/checkbox"

/** Phone area codes (Iceland first, then common visitor origins). */
// Full country dialing list. `iso` is the unique select value (some countries
// share a dial code, e.g. +1), `dial` is shown in the trigger, `name` in the
// dropdown. Iceland first, then alphabetical.
const PHONE_CODES: { iso: string; dial: string; name: string }[] = [
  { iso: "IS", dial: "+354", name: "Iceland" },
  { iso: "AF", dial: "+93", name: "Afghanistan" },
  { iso: "AL", dial: "+355", name: "Albania" },
  { iso: "DZ", dial: "+213", name: "Algeria" },
  { iso: "AD", dial: "+376", name: "Andorra" },
  { iso: "AO", dial: "+244", name: "Angola" },
  { iso: "AG", dial: "+1268", name: "Antigua and Barbuda" },
  { iso: "AR", dial: "+54", name: "Argentina" },
  { iso: "AM", dial: "+374", name: "Armenia" },
  { iso: "AU", dial: "+61", name: "Australia" },
  { iso: "AT", dial: "+43", name: "Austria" },
  { iso: "AZ", dial: "+994", name: "Azerbaijan" },
  { iso: "BS", dial: "+1242", name: "Bahamas" },
  { iso: "BH", dial: "+973", name: "Bahrain" },
  { iso: "BD", dial: "+880", name: "Bangladesh" },
  { iso: "BB", dial: "+1246", name: "Barbados" },
  { iso: "BY", dial: "+375", name: "Belarus" },
  { iso: "BE", dial: "+32", name: "Belgium" },
  { iso: "BZ", dial: "+501", name: "Belize" },
  { iso: "BJ", dial: "+229", name: "Benin" },
  { iso: "BT", dial: "+975", name: "Bhutan" },
  { iso: "BO", dial: "+591", name: "Bolivia" },
  { iso: "BA", dial: "+387", name: "Bosnia and Herzegovina" },
  { iso: "BW", dial: "+267", name: "Botswana" },
  { iso: "BR", dial: "+55", name: "Brazil" },
  { iso: "BN", dial: "+673", name: "Brunei" },
  { iso: "BG", dial: "+359", name: "Bulgaria" },
  { iso: "BF", dial: "+226", name: "Burkina Faso" },
  { iso: "BI", dial: "+257", name: "Burundi" },
  { iso: "KH", dial: "+855", name: "Cambodia" },
  { iso: "CM", dial: "+237", name: "Cameroon" },
  { iso: "CA", dial: "+1", name: "Canada" },
  { iso: "CV", dial: "+238", name: "Cape Verde" },
  { iso: "CF", dial: "+236", name: "Central African Republic" },
  { iso: "TD", dial: "+235", name: "Chad" },
  { iso: "CL", dial: "+56", name: "Chile" },
  { iso: "CN", dial: "+86", name: "China" },
  { iso: "CO", dial: "+57", name: "Colombia" },
  { iso: "KM", dial: "+269", name: "Comoros" },
  { iso: "CG", dial: "+242", name: "Congo" },
  { iso: "CD", dial: "+243", name: "Congo (DRC)" },
  { iso: "CR", dial: "+506", name: "Costa Rica" },
  { iso: "CI", dial: "+225", name: "Côte d'Ivoire" },
  { iso: "HR", dial: "+385", name: "Croatia" },
  { iso: "CU", dial: "+53", name: "Cuba" },
  { iso: "CY", dial: "+357", name: "Cyprus" },
  { iso: "CZ", dial: "+420", name: "Czechia" },
  { iso: "DK", dial: "+45", name: "Denmark" },
  { iso: "DJ", dial: "+253", name: "Djibouti" },
  { iso: "DM", dial: "+1767", name: "Dominica" },
  { iso: "DO", dial: "+1809", name: "Dominican Republic" },
  { iso: "EC", dial: "+593", name: "Ecuador" },
  { iso: "EG", dial: "+20", name: "Egypt" },
  { iso: "SV", dial: "+503", name: "El Salvador" },
  { iso: "GQ", dial: "+240", name: "Equatorial Guinea" },
  { iso: "ER", dial: "+291", name: "Eritrea" },
  { iso: "EE", dial: "+372", name: "Estonia" },
  { iso: "SZ", dial: "+268", name: "Eswatini" },
  { iso: "ET", dial: "+251", name: "Ethiopia" },
  { iso: "FJ", dial: "+679", name: "Fiji" },
  { iso: "FI", dial: "+358", name: "Finland" },
  { iso: "FR", dial: "+33", name: "France" },
  { iso: "GA", dial: "+241", name: "Gabon" },
  { iso: "GM", dial: "+220", name: "Gambia" },
  { iso: "GE", dial: "+995", name: "Georgia" },
  { iso: "DE", dial: "+49", name: "Germany" },
  { iso: "GH", dial: "+233", name: "Ghana" },
  { iso: "GR", dial: "+30", name: "Greece" },
  { iso: "GD", dial: "+1473", name: "Grenada" },
  { iso: "GT", dial: "+502", name: "Guatemala" },
  { iso: "GN", dial: "+224", name: "Guinea" },
  { iso: "GW", dial: "+245", name: "Guinea-Bissau" },
  { iso: "GY", dial: "+592", name: "Guyana" },
  { iso: "HT", dial: "+509", name: "Haiti" },
  { iso: "HN", dial: "+504", name: "Honduras" },
  { iso: "HK", dial: "+852", name: "Hong Kong" },
  { iso: "HU", dial: "+36", name: "Hungary" },
  { iso: "IN", dial: "+91", name: "India" },
  { iso: "ID", dial: "+62", name: "Indonesia" },
  { iso: "IR", dial: "+98", name: "Iran" },
  { iso: "IQ", dial: "+964", name: "Iraq" },
  { iso: "IE", dial: "+353", name: "Ireland" },
  { iso: "IL", dial: "+972", name: "Israel" },
  { iso: "IT", dial: "+39", name: "Italy" },
  { iso: "JM", dial: "+1876", name: "Jamaica" },
  { iso: "JP", dial: "+81", name: "Japan" },
  { iso: "JO", dial: "+962", name: "Jordan" },
  { iso: "KZ", dial: "+7", name: "Kazakhstan" },
  { iso: "KE", dial: "+254", name: "Kenya" },
  { iso: "KI", dial: "+686", name: "Kiribati" },
  { iso: "KW", dial: "+965", name: "Kuwait" },
  { iso: "KG", dial: "+996", name: "Kyrgyzstan" },
  { iso: "LA", dial: "+856", name: "Laos" },
  { iso: "LV", dial: "+371", name: "Latvia" },
  { iso: "LB", dial: "+961", name: "Lebanon" },
  { iso: "LS", dial: "+266", name: "Lesotho" },
  { iso: "LR", dial: "+231", name: "Liberia" },
  { iso: "LY", dial: "+218", name: "Libya" },
  { iso: "LI", dial: "+423", name: "Liechtenstein" },
  { iso: "LT", dial: "+370", name: "Lithuania" },
  { iso: "LU", dial: "+352", name: "Luxembourg" },
  { iso: "MO", dial: "+853", name: "Macau" },
  { iso: "MG", dial: "+261", name: "Madagascar" },
  { iso: "MW", dial: "+265", name: "Malawi" },
  { iso: "MY", dial: "+60", name: "Malaysia" },
  { iso: "MV", dial: "+960", name: "Maldives" },
  { iso: "ML", dial: "+223", name: "Mali" },
  { iso: "MT", dial: "+356", name: "Malta" },
  { iso: "MH", dial: "+692", name: "Marshall Islands" },
  { iso: "MR", dial: "+222", name: "Mauritania" },
  { iso: "MU", dial: "+230", name: "Mauritius" },
  { iso: "MX", dial: "+52", name: "Mexico" },
  { iso: "FM", dial: "+691", name: "Micronesia" },
  { iso: "MD", dial: "+373", name: "Moldova" },
  { iso: "MC", dial: "+377", name: "Monaco" },
  { iso: "MN", dial: "+976", name: "Mongolia" },
  { iso: "ME", dial: "+382", name: "Montenegro" },
  { iso: "MA", dial: "+212", name: "Morocco" },
  { iso: "MZ", dial: "+258", name: "Mozambique" },
  { iso: "MM", dial: "+95", name: "Myanmar" },
  { iso: "NA", dial: "+264", name: "Namibia" },
  { iso: "NR", dial: "+674", name: "Nauru" },
  { iso: "NP", dial: "+977", name: "Nepal" },
  { iso: "NL", dial: "+31", name: "Netherlands" },
  { iso: "NZ", dial: "+64", name: "New Zealand" },
  { iso: "NI", dial: "+505", name: "Nicaragua" },
  { iso: "NE", dial: "+227", name: "Niger" },
  { iso: "NG", dial: "+234", name: "Nigeria" },
  { iso: "KP", dial: "+850", name: "North Korea" },
  { iso: "MK", dial: "+389", name: "North Macedonia" },
  { iso: "NO", dial: "+47", name: "Norway" },
  { iso: "OM", dial: "+968", name: "Oman" },
  { iso: "PK", dial: "+92", name: "Pakistan" },
  { iso: "PW", dial: "+680", name: "Palau" },
  { iso: "PS", dial: "+970", name: "Palestine" },
  { iso: "PA", dial: "+507", name: "Panama" },
  { iso: "PG", dial: "+675", name: "Papua New Guinea" },
  { iso: "PY", dial: "+595", name: "Paraguay" },
  { iso: "PE", dial: "+51", name: "Peru" },
  { iso: "PH", dial: "+63", name: "Philippines" },
  { iso: "PL", dial: "+48", name: "Poland" },
  { iso: "PT", dial: "+351", name: "Portugal" },
  { iso: "QA", dial: "+974", name: "Qatar" },
  { iso: "RO", dial: "+40", name: "Romania" },
  { iso: "RU", dial: "+7", name: "Russia" },
  { iso: "RW", dial: "+250", name: "Rwanda" },
  { iso: "KN", dial: "+1869", name: "Saint Kitts and Nevis" },
  { iso: "LC", dial: "+1758", name: "Saint Lucia" },
  { iso: "VC", dial: "+1784", name: "Saint Vincent and the Grenadines" },
  { iso: "WS", dial: "+685", name: "Samoa" },
  { iso: "SM", dial: "+378", name: "San Marino" },
  { iso: "ST", dial: "+239", name: "Sao Tome and Principe" },
  { iso: "SA", dial: "+966", name: "Saudi Arabia" },
  { iso: "SN", dial: "+221", name: "Senegal" },
  { iso: "RS", dial: "+381", name: "Serbia" },
  { iso: "SC", dial: "+248", name: "Seychelles" },
  { iso: "SL", dial: "+232", name: "Sierra Leone" },
  { iso: "SG", dial: "+65", name: "Singapore" },
  { iso: "SK", dial: "+421", name: "Slovakia" },
  { iso: "SI", dial: "+386", name: "Slovenia" },
  { iso: "SB", dial: "+677", name: "Solomon Islands" },
  { iso: "SO", dial: "+252", name: "Somalia" },
  { iso: "ZA", dial: "+27", name: "South Africa" },
  { iso: "KR", dial: "+82", name: "South Korea" },
  { iso: "SS", dial: "+211", name: "South Sudan" },
  { iso: "ES", dial: "+34", name: "Spain" },
  { iso: "LK", dial: "+94", name: "Sri Lanka" },
  { iso: "SD", dial: "+249", name: "Sudan" },
  { iso: "SR", dial: "+597", name: "Suriname" },
  { iso: "SE", dial: "+46", name: "Sweden" },
  { iso: "CH", dial: "+41", name: "Switzerland" },
  { iso: "SY", dial: "+963", name: "Syria" },
  { iso: "TW", dial: "+886", name: "Taiwan" },
  { iso: "TJ", dial: "+992", name: "Tajikistan" },
  { iso: "TZ", dial: "+255", name: "Tanzania" },
  { iso: "TH", dial: "+66", name: "Thailand" },
  { iso: "TL", dial: "+670", name: "Timor-Leste" },
  { iso: "TG", dial: "+228", name: "Togo" },
  { iso: "TO", dial: "+676", name: "Tonga" },
  { iso: "TT", dial: "+1868", name: "Trinidad and Tobago" },
  { iso: "TN", dial: "+216", name: "Tunisia" },
  { iso: "TR", dial: "+90", name: "Turkey" },
  { iso: "TM", dial: "+993", name: "Turkmenistan" },
  { iso: "TV", dial: "+688", name: "Tuvalu" },
  { iso: "UG", dial: "+256", name: "Uganda" },
  { iso: "UA", dial: "+380", name: "Ukraine" },
  { iso: "AE", dial: "+971", name: "United Arab Emirates" },
  { iso: "GB", dial: "+44", name: "United Kingdom" },
  { iso: "US", dial: "+1", name: "United States" },
  { iso: "UY", dial: "+598", name: "Uruguay" },
  { iso: "UZ", dial: "+998", name: "Uzbekistan" },
  { iso: "VU", dial: "+678", name: "Vanuatu" },
  { iso: "VA", dial: "+379", name: "Vatican City" },
  { iso: "VE", dial: "+58", name: "Venezuela" },
  { iso: "VN", dial: "+84", name: "Vietnam" },
  { iso: "YE", dial: "+967", name: "Yemen" },
  { iso: "ZM", dial: "+260", name: "Zambia" },
  { iso: "ZW", dial: "+263", name: "Zimbabwe" },
]

// Visit Travel Iceland's standard day-trip / activity cancellation policy
// (https://visit.is/terms-and-conditions/). Partner tours may differ per the
// operator's terms shown on the ticket.
const TERMS_URL = "https://visit.is/terms-and-conditions/"

// Shared field styling so text inputs and native selects match each other and
// the newsletter form: taller pills, soft translucent fill and a primary-tinted
// focus ring. Passed via className so tailwind-merge overrides the base Input.
const FIELD_CLASS =
  "h-11 rounded-xl border-border bg-background/60 px-3.5 text-sm shadow-sm transition-all focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/25"
const NATIVE_SELECT_CLASS =
  "h-11 rounded-xl border border-border bg-background/60 px-3.5 text-sm text-foreground shadow-sm transition-all focus:border-primary/40 focus:outline-none focus:ring-[3px] focus:ring-primary/25"

type StepKey = "tour" | "details" | "addons" | "confirm"

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

/** Mirror of the server's TourFee (mandatory, auto-applied fee). */
export type BookingFee = {
  id: number
  title: string
  pricedPerPerson: boolean
  unitIsk: number
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

function formatDate(iso: string, locale = "en-GB"): string {
  const d = parseISODate(iso)
  return d.toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Parse a `YYYY-MM-DD` availability date as local midnight. */
function parseISODate(iso: string): Date {
  return new Date(iso + "T00:00:00")
}

/** Format a Date back to `YYYY-MM-DD` in local time (avoids UTC shifting). */
function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Map the app locale to a date-fns locale for the calendar (default en). */
const DATE_FNS_LOCALES: Record<string, DateFnsLocale> = {
  es: esLocale,
  pt: ptLocale,
  it: itLocale,
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
  fees = [],
  pickup = null,
  fallbackPhone,
  startingPriceIsk = 0,
}: {
  bokunId: string
  slots: BookingSlot[]
  extras?: BookingExtra[]
  /** Mandatory fees auto-applied by Bokun (e.g. national park fee). */
  fees?: BookingFee[]
  pickup?: BookingPickup | null
  fallbackPhone: string
  /** "From" price shown before any participants are selected. */
  startingPriceIsk?: number
}) {
  const dict = useDict()
  const t = dict.booking
  const locale = useLocale()
  const dateFnsLocale = DATE_FNS_LOCALES[locale]
  const STEP_LABELS: Record<StepKey, string> = {
    tour: t.stepTour,
    details: t.stepDetails,
    addons: t.stepAddons,
    confirm: t.stepConfirm,
  }
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
  const [dateOpen, setDateOpen] = useState(false)

  // Calendar helpers: only dates with availability are selectable, and the
  // month navigation is bounded to the first/last available departures.
  const availableSet = useMemo(() => new Set(dates), [dates])
  const selectedDate = date ? parseISODate(date) : undefined
  const firstDate = dates[0] ? parseISODate(dates[0]) : undefined
  const lastDate = dates.length
    ? parseISODate(dates[dates.length - 1])
    : undefined

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
    return [{ id: 0, title: t.participants, minAge: 0, tiers: [] }]
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
  const [phoneCountry, setPhoneCountry] = useState("IS")
  const phoneDial =
    PHONE_CODES.find((c) => c.iso === phoneCountry)?.dial ?? "+354"
  const [phone, setPhone] = useState("")
  // Opt-in account creation at checkout. Hidden when already signed in.
  const { data: session } = authClient.useSession()
  // When signed in, the booking is linked to the account and the contact email
  // is locked to the account email so it reliably appears in "My Trips".
  const lockedEmail = session?.user?.email ?? null
  useEffect(() => {
    if (lockedEmail) setEmail(lockedEmail)
  }, [lockedEmail])
  const [createAccount, setCreateAccount] = useState(false)
  const [accountPassword, setAccountPassword] = useState("")
  const [promoCode, setPromoCode] = useState("")
  // After a valid promo code is applied, we hold the prepared (discounted) Teya
  // form here and show a review panel so the guest sees the discount before
  // paying. "Pay now" then submits this exact form — no second Bokun call.
  const [review, setReview] = useState<{
    form: { url: string; fields: Record<string, string> }
    amountIsk: number
    discountIsk: number
  } | null>(null)
  // True only while the "Apply" promo action is in flight. Kept separate from
  // the shared `pending` transition flag so applying a code doesn't make the
  // main pay button read "Redirecting…" (they both used to share `pending`).
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Inline, per-field errors for the confirm-step contact inputs. Shown right
  // under each field (instead of the shared banner near the total) so the guest
  // sees exactly which field needs attention.
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }>({})
  const clearFieldError = (field: keyof typeof fieldErrors) =>
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  const [step, setStep] = useState(1)
  // Wizard steps. The add-ons step only appears when the tour has extras, so a
  // tour without add-ons collapses to a 3-step flow.
  const stepKeys: StepKey[] =
    extras.length > 0
      ? ["tour", "details", "addons", "confirm"]
      : ["tour", "details", "confirm"]
  const totalSteps = stepKeys.length
  const currentKey = stepKeys[Math.min(step, totalSteps) - 1]
  const [pending, startTransition] = useTransition()

  const totalPax = lines.reduce((n, l) => n + (qtyByLine[l.id] ?? 0), 0)
  const baseTotal = slot ? computeTotal(slot, qtyByLine, totalPax) : 0
  const addonsTotal = extras.reduce(
    (n, e) => n + (qtyByAddon[e.id] ?? 0) * e.unitIsk,
    0,
  )
  // Mandatory fees are always charged: per-person fees scale with participants,
  // flat fees are added once. Included only once at least one guest is selected.
  const feesTotal =
    totalPax > 0
      ? fees.reduce(
          (n, f) => n + (f.pricedPerPerson ? f.unitIsk * totalPax : f.unitIsk),
          0,
        )
      : 0
  const total = baseTotal + feesTotal + addonsTotal

  // Any change that affects price or the reserved booking invalidates a prepared
  // (discounted) Teya form, so drop back to "Confirm & pay" and re-reserve on the
  // next attempt. Runs only when a dep actually changes, so it never clears the
  // review in the same tick it is set.
  useEffect(() => {
    setReview(null)
  }, [promoCode, total, slot?.id, firstName, lastName, email, phone])

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

  // Build a hidden form and POST it to Teya's hosted SecurePay page. We use a
  // real form submit (not fetch) because SecurePay renders its own page and the
  // browser must navigate there carrying the signed fields.
  function submitSecurePayForm(form: {
    url: string
    fields: Record<string, string>
  }) {
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

  // Validate the confirm step and build the server payload. Returns null (after
  // surfacing the relevant error) when something is missing, so both "Confirm &
  // pay" and the promo "Apply" button can share the exact same checks.
  function validateAndBuildPayload(): BookingInput | null {
    if (!slot) {
      setError(t.errChooseDate)
      return null
    }
    if (totalPax <= 0) {
      setError(t.errAddParticipant)
      return null
    }
    if (totalPax < slot.minPax) {
      setError(fmt(t.errMinParticipants, { count: slot.minPax }))
      return null
    }
    if (!slot.unlimited && totalPax > slot.seats) {
      setError(fmt(t.errSeatsLeft, { count: slot.seats }))
      return null
    }
    if (pickupRequired && !selectedPickup) {
      setError(t.errChoosePickup)
      return null
    }
    if (needsRoomNumber && !roomNumber.trim()) {
      setError(t.errRoomNumber)
      return null
    }
    if (
      guestSlots.some(
        (g) =>
          !(firstByGuest[g.key] ?? "").trim() ||
          !(lastByGuest[g.key] ?? "").trim(),
      )
    ) {
      setError(t.errGuestNames)
      return null
    }
    const contactErrors: typeof fieldErrors = {}
    if (!firstName.trim()) contactErrors.firstName = t.errYourName
    if (!lastName.trim()) contactErrors.lastName = t.errYourName
    if (!email.trim()) contactErrors.email = t.errEmail
    if (!phone.trim()) contactErrors.phone = t.errPhone
    if (Object.keys(contactErrors).length > 0) {
      setFieldErrors(contactErrors)
      // Focus + scroll the first invalid field into view so the inline message
      // is visible (the fields sit at the top of this step, the button at the
      // bottom).
      const firstInvalidId = contactErrors.firstName
        ? "booking-first-name"
        : contactErrors.lastName
          ? "booking-last-name"
          : contactErrors.email
            ? "booking-email"
            : "booking-phone"
      requestAnimationFrame(() => {
        const el = document.getElementById(firstInvalidId)
        el?.scrollIntoView({ behavior: "smooth", block: "center" })
        el?.focus({ preventScroll: true })
      })
      return null
    }
    const wantsAccount = !session && createAccount
    if (wantsAccount && accountPassword.length < 8) {
      setError(t.errPassword)
      return null
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

    return {
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
      customerPhone: `${phoneDial} ${phone.trim()}`,
      createAccount: wantsAccount,
      accountPassword: wantsAccount ? accountPassword : undefined,
      promoCode: promoCode.trim() || undefined,
    }
  }

  function focusPromoField() {
    requestAnimationFrame(() => {
      const el = document.getElementById("booking-promo")
      el?.scrollIntoView({ behavior: "smooth", block: "center" })
      el?.focus({ preventScroll: true })
    })
  }

  // "Apply" the promo code: reserve against Bokun so we can show the real
  // discounted price in the form before the guest commits to paying. The
  // prepared (discounted) Teya form is stashed in `review`, so the later "Pay
  // now" click reuses it without a second reservation.
  function onApplyPromo() {
    setError(null)
    if (!promoCode.trim()) {
      focusPromoField()
      return
    }
    const payload = validateAndBuildPayload()
    if (!payload) return

    setApplying(true)
    startTransition(async () => {
      try {
        const res = await startBooking(payload)
        if (!res.ok) {
          setError(res.error)
          if (res.promoError) focusPromoField()
          return
        }
        // TEST bypass: server confirmed without payment — go to confirmation.
        if ("redirectUrl" in res) {
          window.location.href = res.redirectUrl
          return
        }
        if (res.discountIsk > 0) {
          setReview({
            form: res.form,
            amountIsk: res.amountIsk,
            discountIsk: res.discountIsk,
          })
          requestAnimationFrame(() => {
            document
              .getElementById("booking-discount-review")
              ?.scrollIntoView({ behavior: "smooth", block: "center" })
          })
          return
        }
        // Reserved fine but Bokun applied no discount — treat as an invalid code
        // rather than silently sending the guest to pay full price.
        setError(t.promoInvalid)
        focusPromoField()
      } finally {
        setApplying(false)
      }
    })
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    // On steps 1–2 the submit button isn't shown; an Enter keypress still lands
    // here, so just advance through the wizard instead of attempting to pay.
    if (currentKey !== "confirm") {
      goNext()
      return
    }
    // Discount already previewed: pay with the prepared (discounted) form and
    // skip a second reservation.
    if (review) {
      submitSecurePayForm(review.form)
      return
    }
    const payload = validateAndBuildPayload()
    if (!payload) return

    startTransition(async () => {
      // 1. Create a pending booking and get a signed Teya SecurePay form
      //    (re-priced server-side against Bokun; the secret never leaves the
      //    server — only the resulting checkhash does).
      const res = await startBooking(payload)
      if (!res.ok) {
        setError(res.error)
        if (res.promoError) focusPromoField()
        return
      }
      // TEST bypass: server confirmed without payment — go to confirmation.
      if ("redirectUrl" in res) {
        window.location.href = res.redirectUrl
        return
      }
      // A promo discount was applied: show it for review first. The guest confirms
      // with "Pay now", which submits this same prepared form (no re-reservation).
      if (res.discountIsk > 0) {
        setReview({
          form: res.form,
          amountIsk: res.amountIsk,
          discountIsk: res.discountIsk,
        })
        requestAnimationFrame(() => {
          document
            .getElementById("booking-discount-review")
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        })
        return
      }
      // 2. Otherwise auto-submit the signed form to Teya's hosted SecurePay page.
      submitSecurePayForm(res.form)
    })
  }

  function validateStep1(): boolean {
    setError(null)
    if (!slot) {
      setError(t.errChooseDate)
      return false
    }
    if (totalPax <= 0) {
      setError(t.errAddParticipant)
      return false
    }
    if (totalPax < slot.minPax) {
      setError(fmt(t.errMinParticipants, { count: slot.minPax }))
      return false
    }
    if (!slot.unlimited && totalPax > slot.seats) {
      setError(fmt(t.errSeatsLeft, { count: slot.seats }))
      return false
    }
    return true
  }

  function validateStep2(): boolean {
    setError(null)
    if (pickupRequired && !selectedPickup) {
      setError(t.errChoosePickup)
      return false
    }
    if (needsRoomNumber && !roomNumber.trim()) {
      setError(t.errRoomNumber)
      return false
    }
    if (
      guestSlots.some(
        (g) =>
          !(firstByGuest[g.key] ?? "").trim() ||
          !(lastByGuest[g.key] ?? "").trim(),
      )
    ) {
      setError(t.errGuestNames)
      return false
    }
    return true
  }

  function goNext() {
    if (currentKey === "tour" && !validateStep1()) return
    if (currentKey === "details" && !validateStep2()) return
    setStep((s) => Math.min(totalSteps, s + 1))
  }

  function goBack() {
    setError(null)
    setFieldErrors({})
    setStep((s) => Math.max(1, s - 1))
  }

  // No availability at all → contact fallback (desktop card + mobile bar).
  if (slots.length === 0) {
    return (
      <>
        <div className="hidden rounded-2xl border border-border bg-card p-6 shadow-sm lg:block">
          <p className="font-heading text-lg font-bold text-foreground">
            {t.noOnlineTitle}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t.noOnlineText}
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
            {fmt(t.callToBook, { phone: fallbackPhone })}
          </a>
        </div>
      </>
    )
  }

  const headlinePriceIsk = totalPax > 0 ? total : startingPriceIsk
  const showFrom = totalPax <= 0 && startingPriceIsk > 0

  const trust: { icon: typeof Zap; text: string }[] = [
    { icon: Zap, text: t.instantConfirmation },
    { icon: ShieldCheck, text: t.cancellationSummary },
    { icon: Compass, text: t.localGuide },
    { icon: Lock, text: t.secureBooking },
  ]

  /** Date + departure + participant steppers — reused in card and overlay. */
  function renderSelection() {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="booking-date" className="flex items-center gap-1.5">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            {t.date}
          </Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger
              render={
                <Button
                  id="booking-date"
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-between rounded-lg border-border bg-secondary px-3 text-sm font-normal text-foreground hover:bg-secondary"
                >
                  {date ? formatDate(date, locale) : t.selectDates}
                  <ChevronDown
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={dateFnsLocale}
                selected={selectedDate}
                defaultMonth={selectedDate ?? firstDate}
                startMonth={firstDate}
                endMonth={lastDate}
                disabled={(day) => !availableSet.has(toISODate(day))}
                onSelect={(day) => {
                  if (!day) return
                  onDateChange(toISODate(day))
                  setDateOpen(false)
                }}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {slotsForDate.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="booking-time" className="flex items-center gap-1.5">
              <Clock className="size-4 text-primary" aria-hidden="true" />
              {t.departure}
            </Label>
            <select
              id="booking-time"
              value={slotId}
              onChange={(e) => {
                setSlotId(e.target.value)
                setQtyByLine({})
              }}
              className="h-11 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {slotsForDate.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.startTime || t.flexible}
                </option>
              ))}
            </select>
          </div>
        )}

        {slot && (
          <div className="flex flex-col gap-3">
            <Label className="flex items-center gap-1.5">
              <Compass className="size-4 text-primary" aria-hidden="true" />
              {t.participants}
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
                          {fmt(t.age, { age: line.minAge })}
                        </span>
                      )}
                    </p>
                    {slot.pricedPerPerson && tier && (
                      <p className="text-xs text-muted-foreground">
                        <Price isk={tier.unitIsk} /> {t.each}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => bumpQty(line.id, -1)}
                      disabled={qty <= 0}
                      aria-label={fmt(t.decrease, { label: line.title })}
                      className="flex size-10 items-center justify-center rounded-full bg-foreground/10 text-foreground transition-colors hover:bg-foreground/20 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Minus className="size-5" strokeWidth={2.5} aria-hidden="true" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold text-foreground">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => bumpQty(line.id, 1)}
                      disabled={atCapacity}
                      aria-label={fmt(t.increase, { label: line.title })}
                      className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Plus className="size-5" strokeWidth={2.5} aria-hidden="true" />
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
                  ? t.noSeats
                  : fmt(seatsLeft === 1 ? t.seatLeft : t.seatsLeft, {
                      count: seatsLeft,
                    })}
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
              {t.from}
            </span>
          )}
          <span className="font-heading text-lg font-extrabold text-foreground">
            <Price isk={headlinePriceIsk} fallback={t.selectDates} />
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
          {t.bookNow}
        </Button>
      </div>

      {/* ---------- Booking form (inline, 3-step wizard) ---------- */}
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex w-full flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
            <div>
              <p className="font-heading text-xl font-extrabold text-foreground">
                {t.completeBooking}
              </p>

              {/* Step indicator */}
              <ol className="mt-3 flex items-center gap-1.5 text-xs">
                {stepKeys.map((stepKey, i) => {
                  const n = i + 1
                  const label = STEP_LABELS[stepKey]
                  const active = n === step
                  const done = n < step
                  return (
                    <li
                      key={stepKey}
                      className={
                        "flex min-w-0 items-center gap-1.5 " +
                        (active ? "shrink-0" : "")
                      }
                    >
                      <span
                        className={
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors " +
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
                          "truncate " +
                          (active ? "inline" : "hidden sm:inline") +
                          " " +
                          (active
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground")
                        }
                      >
                        {label}
                      </span>
                      {n < stepKeys.length && (
                        <span
                          className="ml-0.5 hidden h-px w-3 shrink-0 bg-border sm:inline-block"
                          aria-hidden="true"
                        />
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>

            {/* Step: tour — date & participants */}
            {currentKey === "tour" && (
              <>
                {renderSelection()}

                {totalPax <= 0 && (
                  <p className="-mt-1 text-xs text-muted-foreground">
                    {t.selectToSeePricing}
                  </p>
                )}
              </>
            )}

            {/* Step: add-ons */}
            {currentKey === "addons" && (
              <>
                {/* Add-ons */}
            {extras.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground">{t.addons}</p>
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
                          {extra.pricedPerPerson ? t.perPerson : t.eachSuffix}
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
                          aria-label={fmt(t.decrease, { label: extra.title })}
                          className="flex size-9 items-center justify-center rounded-full bg-foreground/10 text-foreground transition-colors hover:bg-foreground/20 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Minus className="size-5" strokeWidth={2.5} aria-hidden="true" />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-foreground">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAddonQty(extra, qty + 1)}
                          aria-label={fmt(t.increase, { label: extra.title })}
                          className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
                        >
                          <Plus className="size-5" strokeWidth={2.5} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
              </>
            )}

            {/* Step: details — pickup & participant names */}
            {currentKey === "details" && (
              <>
            {/* Pickup / drop-off */}
            {pickupPlaces.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{t.pickup}</p>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {t.includedInPrice}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="booking-pickup">
                    {t.pickupWhere}
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
                    className={NATIVE_SELECT_CLASS}
                  >
                    <option value="">
                      {pickupRequired ? t.selectPickup : t.meetAtStart}
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
                    <Label htmlFor="booking-room">{t.roomNumber}</Label>
                    <Input
                      id="booking-room"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder={t.roomPlaceholder}
                      className={FIELD_CLASS}
                    />
                  </div>
                )}

                {dropoffOptions.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="booking-dropoff">
                      {t.dropoffWhere}
                    </Label>
                    <select
                      id="booking-dropoff"
                      value={dropoffId}
                      onChange={(e) => setDropoffId(e.target.value)}
                      className={NATIVE_SELECT_CLASS}
                    >
                      <option value="">{t.sameAsPickup}</option>
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
                    ? t.participantName
                    : t.participantNames}
                </p>
                {guestSlots.map((g) => (
                  <div key={g.key} className="flex flex-col gap-1.5">
                    <Label>{g.label}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        id={`guest-${g.key}-first`}
                        value={firstByGuest[g.key] ?? ""}
                        onChange={(e) => {
                          setError(null)
                          setFirstByGuest((prev) => ({
                            ...prev,
                            [g.key]: e.target.value,
                          }))
                        }}
                        required
                        autoComplete="off"
                        placeholder={t.firstName}
                        aria-label={fmt(t.guestFirstName, { label: g.label })}
                        className={FIELD_CLASS}
                      />
                      <Input
                        id={`guest-${g.key}-last`}
                        value={lastByGuest[g.key] ?? ""}
                        onChange={(e) => {
                          setError(null)
                          setLastByGuest((prev) => ({
                            ...prev,
                            [g.key]: e.target.value,
                          }))
                        }}
                        required
                        autoComplete="off"
                        placeholder={t.lastName}
                        aria-label={fmt(t.guestLastName, { label: g.label })}
                        className={FIELD_CLASS}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
              </>
            )}

            {/* Step: confirm — contact, summary & pay */}
            {currentKey === "confirm" && (
              <>
            {/* Contact details */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground">
                {t.contactDetails}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="booking-first-name">{t.firstName}</Label>
                  <Input
                    id="booking-first-name"
                    value={firstName}
                    onChange={(e) => {
                      clearFieldError("firstName")
                      setFirstName(e.target.value)
                    }}
                    required
                    autoComplete="given-name"
                    aria-invalid={!!fieldErrors.firstName}
                    className={FIELD_CLASS}
                  />
                  {fieldErrors.firstName && (
                    <p className="text-xs text-destructive">
                      {fieldErrors.firstName}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="booking-last-name">{t.lastName}</Label>
                  <Input
                    id="booking-last-name"
                    value={lastName}
                    onChange={(e) => {
                      clearFieldError("lastName")
                      setLastName(e.target.value)
                    }}
                    required
                    autoComplete="family-name"
                    aria-invalid={!!fieldErrors.lastName}
                    className={FIELD_CLASS}
                  />
                  {fieldErrors.lastName && (
                    <p className="text-xs text-destructive">
                      {fieldErrors.lastName}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="booking-email">{t.email}</Label>
                <Input
                  id="booking-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    clearFieldError("email")
                    setEmail(e.target.value)
                  }}
                  required
                  autoComplete="email"
                  readOnly={!!lockedEmail}
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={lockedEmail ? "booking-email-hint" : undefined}
                  className={FIELD_CLASS}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-destructive">{fieldErrors.email}</p>
                )}
                {lockedEmail && (
                  <p
                    id="booking-email-hint"
                    className="text-xs text-muted-foreground"
                  >
                    {t.emailLockedHint}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="booking-phone">{t.phone}</Label>
                <div className="flex gap-2">
                  <Select
                    value={phoneCountry}
                    onValueChange={(v) => v && setPhoneCountry(v)}
                  >
                    <SelectTrigger
                      aria-label={t.phoneCountryCode}
                      className="h-11 w-[5.25rem] shrink-0 justify-center gap-1 rounded-xl border-border bg-background/60 px-2 shadow-sm transition-all data-[size=default]:h-11 focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/25"
                    >
                      <span className="text-sm font-medium tabular-nums">
                        {phoneDial}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {PHONE_CODES.map((c) => (
                        <SelectItem key={c.iso} value={c.iso}>
                          {c.dial} {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    id="booking-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      clearFieldError("phone")
                      setPhone(e.target.value)
                    }}
                    required
                    autoComplete="tel-national"
                    placeholder={t.phoneNumber}
                    aria-invalid={!!fieldErrors.phone}
                    className={`${FIELD_CLASS} flex-1`}
                  />
                </div>
                {fieldErrors.phone && (
                  <p className="text-xs text-destructive">{fieldErrors.phone}</p>
                )}
              </div>
            </div>

            {/* Optional account creation */}
            {!session && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={createAccount}
                    onCheckedChange={(v) => setCreateAccount(v === true)}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {t.createAccountLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t.createAccountHint}
                    </span>
                  </span>
                </label>

                {createAccount && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="booking-password">{t.passwordLabel}</Label>
                    <Input
                      id="booking-password"
                      type="password"
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder={t.passwordPlaceholder}
                      className={FIELD_CLASS}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Order summary */}
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground">
                {t.orderSummary}
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
                  {fees.map((fee) => {
                    const qty = fee.pricedPerPerson ? totalPax : 1
                    const feeTotal = fee.unitIsk * qty
                    return (
                      <div
                        key={fee.id}
                        className="flex items-center justify-between gap-3 text-sm text-muted-foreground"
                      >
                        <span>
                          {fee.title}
                          {fee.pricedPerPerson && ` × ${qty}`}
                        </span>
                        <span className="text-foreground">
                          <Price isk={feeTotal} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              <p>{t.cancellationPolicy}</p>
              <a
                href={TERMS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                {t.seeFullTerms}
              </a>
            </div>
              </>
            )}

            {step === totalSteps && totalPax > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-border pt-4">
                <Label htmlFor="booking-promo">{t.promoLabel}</Label>
                <div className="flex items-start gap-2">
                  <Input
                    id="booking-promo"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      // Enter applies the code instead of submitting the whole
                      // form, but not while an IME is composing.
                      if (
                        e.key === "Enter" &&
                        !e.nativeEvent.isComposing &&
                        e.keyCode !== 229
                      ) {
                        e.preventDefault()
                        onApplyPromo()
                      }
                    }}
                    placeholder={t.promoPlaceholder}
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onApplyPromo}
                    disabled={pending || !promoCode.trim() || Boolean(review)}
                    className="shrink-0"
                  >
                    {applying ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      t.promoApply
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t.promoHint}</p>
              </div>
            )}

            {review && (
              <div
                id="booking-discount-review"
                className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-4"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Check className="size-4" aria-hidden="true" />
                  {promoCode
                    ? `${t.discountApplied} (${promoCode})`
                    : t.discountApplied}
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{t.promoLabel}</span>
                  <span className="font-medium text-foreground">
                    {"\u2212"}
                    <Price isk={review.discountIsk} />
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-sm font-medium text-foreground">
                    {t.newTotal}
                  </span>
                  <span className="font-heading text-xl font-extrabold text-foreground">
                    <Price isk={review.amountIsk} />
                  </span>
                </div>
              </div>
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
                  {totalPax > 0 ? t.total : t.from}
                </span>
                <span className="font-heading text-2xl font-extrabold text-foreground">
                  {totalPax > 0 ? (
                    <Price
                      isk={review ? review.amountIsk : total}
                      showIskBelow={step === totalSteps}
                    />
                  ) : startingPriceIsk > 0 ? (
                    <>
                      <Price isk={startingPriceIsk} />
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        {t.perPersonSuffix}
                      </span>
                    </>
                  ) : (
                    <span className="text-base font-semibold text-muted-foreground">
                      {t.selectParticipants}
                    </span>
                  )}
                </span>
              </div>

              <div className="flex gap-3">
                {step > 1 && (
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={goBack}
                    className="flex-1 gap-1.5 rounded-full"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    {t.back}
                  </Button>
                )}
                {step < totalSteps ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={goNext}
                    disabled={step === 1 && totalPax <= 0}
                    className="flex-1 rounded-full"
                  >
                    {t.continue}
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    size="lg"
                    disabled={pending || totalPax <= 0}
                    className="flex-1 rounded-full"
                  >
                    {pending && !applying ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        {t.redirecting}
                      </>
                    ) : review ? (
                      t.payNow
                    ) : (
                      t.confirmPay
                    )}
                  </Button>
                )}
              </div>

              {step === totalSteps && (
                <p className="text-center text-xs text-muted-foreground">
                  {t.securePayment}
                </p>
              )}
            </div>

            {/* Trust badges */}
            <ul className="grid grid-cols-1 gap-2.5 border-t border-border pt-5 text-sm text-muted-foreground">
              {trust.map((badge) => (
                <li key={badge.text} className="flex items-center gap-2">
                  <badge.icon className="size-4 text-primary" aria-hidden="true" />
                  {badge.text}
                </li>
              ))}
            </ul>
      </form>
    </>
  )
}
