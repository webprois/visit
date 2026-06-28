/**
 * A short description for a tour card. Prefers the real excerpt (from admin
 * overrides) and otherwise synthesizes a clean one-liner from the tour's
 * category and location, since Bokun search results carry no description text.
 *
 * This lives in its own module (with no server-only dependencies) so it can be
 * safely imported by client components like the tours browser.
 */
export function tourBlurb(t: {
  excerpt?: string | null
  categoryName?: string | null
  tag?: string | null
  location?: string | null
}): string {
  const clean = t.excerpt?.trim()
  if (clean) return clean
  const theme = (t.categoryName ?? t.tag ?? "")
    .replace(/\s*tours?$/i, "")
    .trim()
    .toLowerCase()
  const place = t.location?.trim() || "Iceland"
  return `Experience the beauty of ${place} on this unforgettable ${theme ? `${theme} ` : ""}tour with our expert local guides.`
}
