export type Category = {
  title: string
  image: string
  count: string
}

export type Tour = {
  id?: number
  title: string
  image: string
  duration: string
  location: string
  price: number
  rating: number
  tag: string
  /** Bokun vendor/operator that runs the tour. */
  operatorId?: number | null
  operator?: string | null
  /** Raw Bokun activity category codes, e.g. ["NATURE", "GLACIER_HIKING"]. */
  bokunCategories?: string[]
  /** Starting-point coordinates from Bokun's Google place (null when unknown). */
  lat?: number | null
  lng?: number | null
}

export type Transfer = {
  title: string
  route: string
  maxPeople: number
  price: number
}

export const categories: Category[] = [
  { title: "Northern Lights", image: "/images/northern-lights.png", count: "8 tours" },
  { title: "Glacier Tours", image: "/images/glacier.png", count: "12 tours" },
  { title: "Blue Lagoon", image: "/images/blue-lagoon.png", count: "6 tours" },
  { title: "Golden Circle", image: "/images/golden-circle.png", count: "9 tours" },
  { title: "Whale Watching", image: "/images/whale-watching.png", count: "5 tours" },
  { title: "Horse Riding", image: "/images/horse-riding.png", count: "4 tours" },
  { title: "Ice Caves", image: "/images/ice-cave.png", count: "7 tours" },
  { title: "Waterfalls & More", image: "/images/hero-iceland.png", count: "14 tours" },
]

export const featuredTours: Tour[] = [
  {
    title: "Golden Circle Classic Day Tour from Reykjavik",
    image: "/images/golden-circle.png",
    duration: "8 hours",
    location: "Reykjavik",
    price: 89,
    rating: 4.9,
    tag: "Day Tour",
  },
  {
    title: "Northern Lights Hunt with Hot Cocoa & Guide",
    image: "/images/northern-lights.png",
    duration: "4 hours",
    location: "Reykjavik",
    price: 75,
    rating: 4.8,
    tag: "Evening",
  },
  {
    title: "Glacier Hike & Ice Cave Adventure from Skaftafell",
    image: "/images/ice-cave.png",
    duration: "5.5 hours",
    location: "Skaftafell",
    price: 140,
    rating: 5.0,
    tag: "Adventure",
  },
  {
    title: "Whale Watching & Puffin Tour from Husavik",
    image: "/images/whale-watching.png",
    duration: "3 hours",
    location: "Husavik",
    price: 95,
    rating: 4.7,
    tag: "Wildlife",
  },
  {
    title: "Blue Lagoon Comfort Admission with Transfer",
    image: "/images/blue-lagoon.png",
    duration: "Flexible",
    location: "Grindavik",
    price: 120,
    rating: 4.9,
    tag: "Relax",
  },
  {
    title: "Icelandic Horse Riding in Volcanic Landscapes",
    image: "/images/horse-riding.png",
    duration: "2 hours",
    location: "Reykjavik",
    price: 110,
    rating: 4.8,
    tag: "Family",
  },
]

export const transfers: Transfer[] = [
  { title: "Keflavik Airport → Blue Lagoon", route: "Airport Transfer", maxPeople: 19, price: 29 },
  { title: "Reykjavik → Blue Lagoon", route: "City Transfer", maxPeople: 19, price: 29 },
  { title: "Hotel → Keflavik Airport", route: "Airport Transfer", maxPeople: 19, price: 35 },
  { title: "Landmannalaugar → Hella", route: "Highland Bus", maxPeople: 19, price: 60 },
]
