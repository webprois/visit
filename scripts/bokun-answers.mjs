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
  return `${r.status} ${t.slice(0, 400)}`
}

const P = "/checkout.json/submit?currency=ISK"
const base = {
  source: "DIRECT_REQUEST",
  checkoutOption: "CUSTOMER_FULL_PAYMENT",
  paymentMethod: "RESERVE_FOR_EXTERNAL_PAYMENT",
}
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
const wrap = (mc) => ({ ...base, directBooking: { mainContactDetails: mc, activityBookings: [ab] } })

const cases = {
  "10_emptyArray": wrap([]),
  "11_questionIdValues": wrap([
    { questionId: "firstName", values: ["Test"] },
    { questionId: "lastName", values: ["Probe"] },
    { questionId: "email", values: ["probe@example.com"] },
  ]),
  "12_answersFieldName": wrap([
    { answersFieldName: "firstName", answer: "Test" },
    { answersFieldName: "lastName", answer: "Probe" },
    { answersFieldName: "email", answer: "probe@example.com" },
  ]),
  "13_questionIdAnswer": wrap([
    { questionId: "firstName", answer: "Test" },
    { questionId: "lastName", answer: "Probe" },
    { questionId: "email", answer: "probe@example.com" },
  ]),
}

const only = process.argv[2]
for (const [name, body] of Object.entries(cases)) {
  if (only && !name.startsWith(only)) continue
  console.log(name, "->", await call("POST", P, body))
  console.log("")
}
