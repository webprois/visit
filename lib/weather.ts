import "server-only"

/**
 * Weather + aurora forecast data for the /weather page.
 *
 * Sources (both free, no API key):
 *  - Open-Meteo (api.open-meteo.com) — daily weather and hourly cloud cover.
 *  - NOAA SWPC (services.swpc.noaa.gov) — planetary Kp-index forecast, the
 *    standard measure of geomagnetic (aurora) activity.
 *
 * All requests go through Next's fetch cache (revalidate below) so page views
 * never hit the upstream APIs directly, mirroring the Bokun availability cache.
 */

/** How long fetched forecasts are served from cache, in seconds. */
const REVALIDATE_WEATHER = 1800 // 30 min
const REVALIDATE_AURORA = 900 // 15 min — Kp updates more often

/** Spots travellers actually ask about, keyed for translation. */
export const FORECAST_LOCATIONS = [
  { key: "reykjavik", lat: 64.1466, lng: -21.9426 },
  { key: "goldenCircle", lat: 64.2559, lng: -21.1291 }, // Þingvellir
  { key: "southCoast", lat: 63.4194, lng: -19.006 }, // Vík í Mýrdal
  { key: "jokulsarlon", lat: 64.0784, lng: -16.2306 },
  { key: "snaefellsnes", lat: 64.7681, lng: -23.6208 }, // Arnarstapi
  { key: "akureyri", lat: 65.6826, lng: -18.0907 },
] as const

export type ForecastLocationKey = (typeof FORECAST_LOCATIONS)[number]["key"]

export type DailyForecast = {
  /** ISO date (Atlantic/Reykjavik). */
  date: string
  /** WMO weather code from Open-Meteo. */
  weatherCode: number
  tempMaxC: number
  tempMinC: number
  /** Max sustained wind, m/s. */
  windMaxMs: number
  /** Max precipitation probability, %. */
  precipChance: number
}

/**
 * Seven-day daily forecast for a coordinate. Returns null when the upstream
 * API fails so the page can degrade gracefully instead of erroring.
 */
export async function fetchDailyForecast(
  lat: number,
  lng: number,
): Promise<DailyForecast[] | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,precipitation_probability_max",
    wind_speed_unit: "ms",
    timezone: "Atlantic/Reykjavik",
    forecast_days: "7",
  })
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: REVALIDATE_WEATHER },
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      daily?: {
        time?: string[]
        weather_code?: number[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        wind_speed_10m_max?: number[]
        precipitation_probability_max?: (number | null)[]
      }
    }
    const d = json.daily
    if (!d?.time?.length) return null
    return d.time.map((date, i) => ({
      date,
      weatherCode: d.weather_code?.[i] ?? 0,
      tempMaxC: Math.round(d.temperature_2m_max?.[i] ?? 0),
      tempMinC: Math.round(d.temperature_2m_min?.[i] ?? 0),
      windMaxMs: Math.round(d.wind_speed_10m_max?.[i] ?? 0),
      precipChance: Math.round(d.precipitation_probability_max?.[i] ?? 0),
    }))
  } catch {
    return null
  }
}

/**
 * Bucket a WMO weather code into a translatable condition key. Buckets follow
 * the official WMO groups Open-Meteo documents.
 */
export type ConditionKey =
  | "clear"
  | "partlyCloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "freezingRain"
  | "snow"
  | "showers"
  | "snowShowers"
  | "thunderstorm"

export function conditionForCode(code: number): ConditionKey {
  if (code <= 1) return "clear"
  if (code === 2) return "partlyCloudy"
  if (code === 3) return "cloudy"
  if (code === 45 || code === 48) return "fog"
  if (code >= 51 && code <= 57) return "drizzle"
  if (code === 66 || code === 67) return "freezingRain"
  if (code >= 61 && code <= 65) return "rain"
  if (code >= 71 && code <= 77) return "snow"
  if (code >= 80 && code <= 82) return "showers"
  if (code === 85 || code === 86) return "snowShowers"
  if (code >= 95) return "thunderstorm"
  return "cloudy"
}

export type AuroraLevel = "excellent" | "good" | "fair" | "low"

export type AuroraForecast = {
  /** Highest predicted planetary Kp over the coming night. */
  kp: number
  /** Average cloud cover (%) over Iceland tonight, null when unavailable. */
  cloudCover: number | null
  level: AuroraLevel
  /**
   * Aurora hunting needs dark skies: roughly 20 Aug – 15 Apr in Iceland.
   * Outside that window nights are too bright regardless of Kp.
   */
  inSeason: boolean
}

function isAuroraSeason(now: Date): boolean {
  const month = now.getUTCMonth() + 1
  const day = now.getUTCDate()
  if (month >= 9 || month <= 3) return true
  if (month === 4) return day <= 15
  if (month === 8) return day >= 20
  return false
}

/** Max predicted Kp within the next 24 hours from NOAA's 3-day forecast. */
async function fetchMaxKp(): Promise<number | null> {
  try {
    const res = await fetch(
      "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
      { next: { revalidate: REVALIDATE_AURORA } },
    )
    if (!res.ok) return null
    // Array of { time_tag: "2026-06-30T03:00:00" (UTC, no suffix), kp: 0.67, ... }
    const rows = (await res.json()) as { time_tag?: string; kp?: number }[]
    const now = Date.now()
    const cutoff = now + 24 * 60 * 60 * 1000
    let max: number | null = null
    for (const row of rows) {
      if (!row.time_tag || typeof row.kp !== "number") continue
      const t = Date.parse(`${row.time_tag}Z`)
      if (Number.isNaN(t) || t < now - 3 * 60 * 60 * 1000 || t > cutoff) continue
      if (max === null || row.kp > max) max = row.kp
    }
    return max
  } catch {
    return null
  }
}

/** Average cloud cover over Iceland tonight (21:00–03:00 local). */
async function fetchNightCloudCover(): Promise<number | null> {
  const params = new URLSearchParams({
    latitude: "64.9", // mid-Iceland — tonight's viewing is island-wide guidance
    longitude: "-19.0",
    hourly: "cloud_cover",
    timezone: "Atlantic/Reykjavik",
    forecast_days: "2",
  })
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: REVALIDATE_WEATHER },
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      hourly?: { time?: string[]; cloud_cover?: (number | null)[] }
    }
    const times = json.hourly?.time
    const cover = json.hourly?.cloud_cover
    if (!times?.length || !cover?.length) return null
    // Tonight = hours 21–23 of day one plus 0–3 of day two.
    const values: number[] = []
    for (let i = 0; i < times.length; i++) {
      const hour = Number(times[i].slice(11, 13))
      const isDayOne = i < 24
      if ((isDayOne && hour >= 21) || (!isDayOne && hour <= 3)) {
        const v = cover[i]
        if (typeof v === "number") values.push(v)
      }
    }
    if (!values.length) return null
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  } catch {
    return null
  }
}

function auroraLevel(kp: number, cloudCover: number | null): AuroraLevel {
  // Clouds veto everything — you can't see through an overcast sky.
  if (cloudCover !== null && cloudCover >= 80) return "low"
  if (kp >= 5 && (cloudCover === null || cloudCover < 40)) return "excellent"
  if (kp >= 4 && (cloudCover === null || cloudCover < 55)) return "good"
  if (kp >= 3 && (cloudCover === null || cloudCover < 70)) return "fair"
  return "low"
}

/** Tonight's aurora outlook, or null when NOAA is unreachable. */
export async function fetchAuroraForecast(): Promise<AuroraForecast | null> {
  const [kp, cloudCover] = await Promise.all([
    fetchMaxKp(),
    fetchNightCloudCover(),
  ])
  if (kp === null) return null
  return {
    kp: Math.round(kp * 10) / 10,
    cloudCover,
    level: auroraLevel(kp, cloudCover),
    inSeason: isAuroraSeason(new Date()),
  }
}
