import "server-only"

/**
 * Lightweight geocoding via OpenStreetMap's Nominatim service. Keyless and
 * free; results are restricted to Iceland so admins can turn a place name or
 * address into map coordinates for a tour stop.
 *
 * Nominatim's usage policy asks for an identifying User-Agent and a maximum of
 * one request per second, so callers that geocode several places should do so
 * sequentially with a small delay (see geocodeIcelandSequential).
 */

export type GeocodeHit = {
  /** Latitude in decimal degrees. */
  lat: number
  /** Longitude in decimal degrees. */
  lng: number
  /** Human-readable place label returned by the geocoder. */
  displayName: string
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
const USER_AGENT = "VisitIceland-Admin/1.0 (tour map stop geocoder)"

/** Geocode a single free-text place/address within Iceland, or null if none. */
export async function geocodeIceland(query: string): Promise<GeocodeHit | null> {
  const q = query.trim()
  if (!q) return null

  const url = new URL(NOMINATIM_URL)
  url.searchParams.set("q", q)
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("countrycodes", "is")
  url.searchParams.set("limit", "1")
  url.searchParams.set("accept-language", "en")

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    // Coordinates for a place are stable; let the platform cache them.
    next: { revalidate: 60 * 60 * 24 * 30 },
  })

  if (!res.ok) {
    throw new Error(`Geocoding failed (${res.status})`)
  }

  const hits = (await res.json()) as Array<{
    lat: string
    lon: string
    display_name: string
  }>

  const hit = hits[0]
  if (!hit) return null

  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return { lat, lng, displayName: hit.display_name }
}

/**
 * Geocode a list of place names in order, respecting Nominatim's ~1 req/sec
 * limit. Returns one entry per input: the hit, or null when nothing matched.
 */
export async function geocodeIcelandSequential(
  queries: string[],
): Promise<(GeocodeHit | null)[]> {
  const out: (GeocodeHit | null)[] = []
  for (let i = 0; i < queries.length; i++) {
    try {
      out.push(await geocodeIceland(queries[i]))
    } catch (err) {
      console.error("[v0] geocodeIcelandSequential failed for", queries[i], err)
      out.push(null)
    }
    // Space out requests to stay within the public rate limit.
    if (i < queries.length - 1) {
      await new Promise((r) => setTimeout(r, 1100))
    }
  }
  return out
}
