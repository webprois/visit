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
  return `${r.status} ${t.slice(0, 170)}`
}

const P = "/checkout.json/submit?currency=ISK"
const base = {
  source: "DIRECT_REQUEST",
  checkoutOption: "CUSTOMER_FULL_PAYMENT",
  paymentMethod: "RESERVE_FOR_EXTERNAL_PAYMENT",
}
// valid activity booking (pickup/dropoff supplied for the PRESELECTED rate)
const ab = {
  activityId: 94050,
  rateId: 165541,
  date: "2026-07-07",
  startTimeId: 182076,
  passengers: [{ pricingCategoryId: 7713 }],
  pickup: true,
  pickupPlaceId: 2680794,
  dropoff: true,
  dropoffPlaceId: 2680794,
}
const wrap = (mc) => ({ ...base, directBooking: { ...(mc ? { mainContactDetails: mc } : {}), activityBookings: [ab] } })

const cases = {
  "1_noMC": wrap(null),
  "2_emptyMC": wrap({}),
  "3_flat": wrap({ firstName: "Test", lastName: "Probe", email: "probe@example.com" }),
  "4_withTitle": wrap({ title: "Mr", firstName: "Test", lastName: "Probe", email: "probe@example.com" }),
  "5_answersArray": { ...base, directBooking: { mainContactDetails: { answers: [{ questionId: "firstName", values: ["Test"] }, { questionId: "lastName", values: ["Probe"] }, { questionId: "email", values: ["probe@example.com"] }] }, activityBookings: [ab] } },
  "6_customerField": { ...base, directBooking: { customer: { firstName: "Test", lastName: "Probe", email: "probe@example.com" }, activityBookings: [ab] } },
}

const only = process.argv[2]
for (const [name, body] of Object.entries(cases)) {
  if (only && !name.startsWith(only)) continue
  console.log(name, "->", await call("POST", P, body))
}
