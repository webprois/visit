import "server-only"

export type GoogleReview = {
  authorName: string
  authorPhotoUrl: string | null
  authorUrl: string | null
  rating: number
  text: string
  relativeTime: string
}

export type GooglePlaceReviews = {
  rating: number
  total: number
  reviews: GoogleReview[]
  /** Link to the place's profile so users can read every review on Google. */
  url: string | null
}

type PlacesApiResponse = {
  rating?: number
  userRatingCount?: number
  googleMapsUri?: string
  reviews?: Array<{
    rating?: number
    text?: { text?: string }
    originalText?: { text?: string }
    relativePublishTimeDescription?: string
    authorAttribution?: {
      displayName?: string
      uri?: string
      photoUri?: string
    }
  }>
}

/**
 * Fetch up to 5 of the "most relevant" reviews for a single Google Place
 * (your business profile). Uses the Places API (New). Returns null when the
 * integration isn't configured or the request fails, so the UI can simply hide
 * the section instead of breaking the page.
 *
 * Requires two environment variables:
 *  - GOOGLE_PLACES_API_KEY  (a key with the Places API (New) enabled)
 *  - GOOGLE_PLACE_ID        (the Place ID of your business)
 */
export async function getGoogleReviews(): Promise<GooglePlaceReviews | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  const placeId = process.env.GOOGLE_PLACE_ID

  if (!apiKey || !placeId) return null

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "rating,userRatingCount,googleMapsUri,reviews",
        },
        // Reviews change slowly; cache for 12h with stale-while-revalidate.
        next: { revalidate: 60 * 60 * 12, tags: ["google-reviews"] },
      },
    )

    if (!res.ok) {
      console.log(
        "[v0] Google reviews fetch failed:",
        res.status,
        await res.text().catch(() => ""),
      )
      return null
    }

    const data = (await res.json()) as PlacesApiResponse

    const reviews: GoogleReview[] = (data.reviews ?? [])
      .map((r) => ({
        authorName: r.authorAttribution?.displayName ?? "Google user",
        authorPhotoUrl: r.authorAttribution?.photoUri ?? null,
        authorUrl: r.authorAttribution?.uri ?? null,
        rating: r.rating ?? 0,
        text: r.text?.text ?? r.originalText?.text ?? "",
        relativeTime: r.relativePublishTimeDescription ?? "",
      }))
      .filter((r) => r.text.trim().length > 0)

    if (reviews.length === 0) return null

    return {
      rating: data.rating ?? 0,
      total: data.userRatingCount ?? 0,
      reviews,
      url: data.googleMapsUri ?? null,
    }
  } catch (err) {
    console.log("[v0] Google reviews error:", (err as Error).message)
    return null
  }
}
