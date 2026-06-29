// Dump the raw Bokun cancellation policy for a tour, so we can see exactly what
// the API returns (vs. the single number lib/bokun.ts currently summarises).
//
// Usage:
//   BOKUN_ACCESS_KEY=... BOKUN_SECRET_KEY=... node scripts/inspect-cancellation.mjs <activityId> [days]
//
// <activityId>  Bokun activity id (the same id used in /tours/<id>)
// [days]        availability window to scan, default 60
//
// Tip: if your keys live in .env.local, run with:
//   node --env-file=.env.local scripts/inspect-cancellation.mjs <activityId>

import crypto from "node:crypto"

const DOMAIN = "api.bokun.io"
const accessKey = process.env.BOKUN_ACCESS_KEY
const secret = process.env.BOKUN_SECRET_KEY

if (!accessKey || !secret) {
  console.error("Missing BOKUN_ACCESS_KEY / BOKUN_SECRET_KEY in the environment.")
  process.exit(1)
}

const activityId = process.argv[2]
if (!activityId) {
  console.error("Usage: node scripts/inspect-cancellation.mjs <activityId> [days]")
  process.exit(1)
}
const days = Number(process.argv[3]) || 60

function bokunDate() {
  return new Date().toISOString().replace("T", " ").substring(0, 19)
}

function sign(date, method, path) {
  return crypto
    .createHmac("sha1", secret)
    .update(date + accessKey + method + path)
    .digest("base64")
}

async function get(path) {
  const date = bokunDate()
  const res = await fetch(`https://${DOMAIN}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "X-Bokun-Date": date,
      "X-Bokun-AccessKey": accessKey,
      "X-Bokun-Signature": sign(date, "GET", path),
    },
  })
  if (!res.ok) {
    throw new Error(`Bokun ${res.status} for ${path}`)
  }
  return res.json()
}

function ymd(d) {
  return d.toISOString().slice(0, 10)
}

const start = ymd(new Date())
const end = ymd(new Date(Date.now() + days * 86400_000))

console.log(`\n=== Activity ${activityId} — detail.cancellationPolicy ===`)
const detail = await get(`/activity.json/${activityId}?lang=EN&currency=ISK`)
console.log(JSON.stringify(detail?.cancellationPolicy ?? null, null, 2))

console.log(`\n=== Availabilities ${start} → ${end} — rates[].cancellationPolicy ===`)
const rows = await get(
  `/activity.json/${activityId}/availabilities?start=${start}&end=${end}&lang=EN&currency=ISK&includeSoldOut=false`,
)

const seen = new Set()
for (const row of Array.isArray(rows) ? rows : []) {
  for (const rate of row.rates ?? []) {
    const key = JSON.stringify(rate.cancellationPolicy ?? null)
    if (seen.has(key)) continue
    seen.add(key)
    console.log(`\n— rate ${rate.id} (${rate.title ?? "untitled"}):`)
    console.log(JSON.stringify(rate.cancellationPolicy ?? null, null, 2))
  }
}
if (seen.size === 0) console.log("(no rates / no availabilities in this window)")
