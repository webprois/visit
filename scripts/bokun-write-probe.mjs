/**
 * Step 0 (definitive): confirm the Bokun key can create bookings, and learn the
 * exact checkout options, by calling the READ-ONLY options endpoint against a
 * REAL bookable slot. This holds NO inventory.
 *
 *   POST /checkout.json/options/booking-request   (quote/validate only)
 *
 * A 200 with checkout options + RESERVE_FOR_EXTERNAL_PAYMENT in allowedMethods
 * proves we can run the reserve->confirm flow. A 401/403 means read-only key.
 *
 * Run: node --env-file=/vercel/share/.env.project scripts/bokun-write-probe.mjs
 */
import crypto from "node:crypto"

const DOMAIN = "api.bokun.io"
const accessKey = process.env.BOKUN_ACCESS_KEY
const secret = process.env.BOKUN_SECRET_KEY

const bokunDate = () => new Date().toISOString().replace("T", " ").substring(0, 19)
const sign = (date, method, path) =>
  crypto.createHmac("sha1", secret).update(date + accessKey + method + path).digest("base64")

async function call(method, path, body) {
  const date = bokunDate()
  const res = await fetch(`https://${DOMAIN}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Bokun-Date": date,
      "X-Bokun-AccessKey": accessKey,
      "X-Bokun-Signature": sign(date, method, path),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, text, json }
}

function ymd(d) { return d.toISOString().slice(0, 10) }

async function main() {
  if (!accessKey || !secret) {
    console.log("[probe] Missing keys"); process.exit(1)
  }

  // 1) Find activities, then scan for the first one with a real bookable slot.
  const search = await call("POST", "/activity.json/search?lang=en", { page: 1, pageSize: 30 })
  const items = search.json?.items ?? []
  if (!items.length) { console.log("[probe] No activities found:", search.status, search.text.slice(0,200)); return }

  const start = ymd(new Date(Date.now() + 3 * 864e5))
  const end = ymd(new Date(Date.now() + 90 * 864e5))

  let activityId, slot, rate
  for (const activity of items) {
    const id = Number(activity.id)
    const avail = await call(
      "GET",
      `/activity.json/${id}/availabilities?start=${start}&end=${end}&lang=EN&currency=ISK&includeSoldOut=false`,
    )
    const found = (avail.json ?? []).find(
      (a) => !a.soldOut && !a.unavailable && (a.unlimitedAvailability || (a.availabilityCount ?? 0) > 0),
    )
    if (found) {
      activityId = id
      slot = found
      rate = found.rates?.find((r) => r.id === found.defaultRateId) ?? found.rates?.[0]
      console.log(`[probe] Using activity ${id} - ${activity.title}`)
      break
    }
  }
  if (!slot) { console.log("[probe] No bookable slot across scanned activities"); return }

  const date = new Date(slot.date).toISOString().slice(0, 10)
  console.log(`[probe] Slot date=${date} startTimeId=${slot.startTimeId} rateId=${rate?.id}`)

  // 3) Inspect the activity for pricing categories + pickup/dropoff config.
  const act = await call("GET", `/activity.json/${activityId}?lang=EN&currency=ISK`)
  const a = act.json ?? {}
  const priceRow =
    slot.pricesByRate?.find((p) => p.activityRateId === rate?.id) ?? slot.pricesByRate?.[0]
  const pricingCategoryId =
    priceRow?.pricePerCategoryUnit?.[0]?.id ??
    rate?.pricingCategoryIds?.[0] ??
    rate?.allPricingCategories?.[0]?.id ??
    a.pricingCategories?.[0]?.id
  console.log(`[probe] pricingCategoryId=${pricingCategoryId}`)
  console.log(`[probe] rate config: pickupSel=${rate?.pickupSelectionType} dropoffSel=${rate?.dropoffSelectionType}`)
  console.log(`[probe] activity keys: ${Object.keys(a).join(", ")}`)
  console.log(`[probe] activity.pricingCategories: ${JSON.stringify(a.pricingCategories)?.slice(0, 400)}`)
  console.log(`[probe] slot.pricesByRate[0]: ${JSON.stringify(slot.pricesByRate?.[0])?.slice(0, 500)}`)
  console.log(`[probe] rate keys: ${rate ? Object.keys(rate).join(", ") : "none"}`)

  // Pickup / dropoff places (needed when a rate PRESELECTS them).
  const places = await call("GET", `/activity.json/${activityId}/pickup-places`)
  const pickupPlaceId = places.json?.pickupPlaces?.[0]?.id ?? places.json?.[0]?.id
  const dropoffPlaceId = places.json?.dropoffPlaces?.[0]?.id ?? pickupPlaceId
  console.log(`[probe] pickupPlaceId=${pickupPlaceId} dropoffPlaceId=${dropoffPlaceId}`)

  // 4) Build a Booking Request and ask for checkout options (holds no inventory).
  const booking = {
    activityId,
    rateId: rate?.id,
    date,
    ...(slot.startTimeId ? { startTimeId: slot.startTimeId } : {}),
    passengers: [{ pricingCategoryId }],
  }
  // Only attach pickup/dropoff when the rate wants it, using a valid place.
  if (rate?.pickupSelectionType && rate.pickupSelectionType !== "UNAVAILABLE" && pickupPlaceId) {
    booking.pickup = true
    booking.pickupPlaceId = pickupPlaceId
  }
  if (rate?.dropoffSelectionType && rate.dropoffSelectionType !== "UNAVAILABLE" && dropoffPlaceId) {
    booking.dropoff = true
    booking.dropoffPlaceId = dropoffPlaceId
  }
  const bookingRequest = { activityBookings: [booking] }
  const opts = await call("POST", "/checkout.json/options/booking-request?currency=ISK", bookingRequest)
  console.log(`\n[probe] options -> ${opts.status}`)
  if (opts.json) {
    const arr = opts.json.options ?? opts.json.checkoutOptions ?? []
    console.log("[probe] checkoutOptions:")
    for (const o of arr) {
      console.log(`  - type=${o.type} amount=${o.formattedAmount}`)
      console.log(`    option keys: ${Object.keys(o).join(", ")}`)
      console.log(`    allowedMethods=${JSON.stringify(o.allowedMethods)}`)
      console.log(`    paymentMethods=${JSON.stringify(o.paymentMethods)?.slice(0, 300)}`)
    }
    console.log(`\n[probe] top-level keys: ${Object.keys(opts.json).join(", ")}`)
  } else {
    console.log("[probe] body:", opts.text.slice(0, 500))
  }
}

main()
