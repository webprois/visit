import crypto from "node:crypto"

const DOMAIN = "api.bokun.io"
const ak = process.env.BOKUN_ACCESS_KEY
const sk = process.env.BOKUN_SECRET_KEY
const d = () => new Date().toISOString().replace("T", " ").substring(0, 19)
const sign = (dt, m, p) => crypto.createHmac("sha1", sk).update(dt + ak + m + p).digest("base64")

async function call(m, p, body) {
  const dt = d()
  const r = await fetch(`https://${DOMAIN}${p}`, {
    method: m,
    headers: {
      "Content-Type": "application/json",
      "X-Bokun-Date": dt,
      "X-Bokun-AccessKey": ak,
      "X-Bokun-Signature": sign(dt, m, p),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const t = await r.text()
  return `${r.status} ${t.slice(0, 160)}`
}

const P = "/checkout.json/submit?currency=ISK"
const base = {
  source: "DIRECT_REQUEST",
  checkoutOption: "CUSTOMER_FULL_PAYMENT",
  paymentMethod: "RESERVE_FOR_EXTERNAL_PAYMENT",
}
const mc = { firstName: "Test", lastName: "Probe", email: "probe@example.com" }
const ab = {
  activityId: 94050,
  rateId: 165541,
  date: "2026-07-07",
  startTimeId: 182076,
}

const cases = {
  A_emptyDirect: { ...base, directBooking: {} },
  B_emptyAB: { ...base, directBooking: { activityBookings: [] } },
  C_mainContact: { ...base, directBooking: { mainContactDetails: mc, activityBookings: [] } },
  D_abIdsOnly: { ...base, directBooking: { activityBookings: [{ ...ab }] } },
  E_passengers: { ...base, directBooking: { activityBookings: [{ ...ab, passengers: [{ pricingCategoryId: 7713 }] }] } },
  F_pricingCategoryBookings: { ...base, directBooking: { activityBookings: [{ ...ab, pricingCategoryBookings: [{ pricingCategoryId: 7713 }] }] } },
  G_pickup: { ...base, directBooking: { mainContactDetails: mc, activityBookings: [{ ...ab, pricingCategoryBookings: [{ pricingCategoryId: 7713 }], pickup: true, pickupPlaceId: 2680794, dropoff: true, dropoffPlaceId: 2680794 }] } },
}

const only = process.argv[2]
for (const [name, body] of Object.entries(cases)) {
  if (only && !name.startsWith(only)) continue
  console.log(name, "->", await call("POST", P, body))
}
