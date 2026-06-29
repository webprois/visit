import { AdminShell } from "@/components/admin/admin-shell"
import type { MergedTour } from "@/lib/tours"
import type { TourCategory, StartingLocation } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

function makeTour(i: number): MergedTour {
  return {
    id: i,
    bokunId: `bokun-${i}`,
    title: `Test Tour number ${i} with a reasonably long name to wrap`,
    image: "/placeholder.svg",
    duration: "13 hours",
    location: "Iceland",
    price: 199,
    rating: 4.8,
    tag: "Adventure",
    operatorId: 1,
    operator: "Visit Iceland",
    bokunCategories: ["NATURE"],
    visible: i % 2 === 0,
    featured: i % 3 === 0,
    excerpt: i % 4 === 0 ? null : "A short description of the tour.",
    description: "Full description.",
    difficulty: "Moderate",
    groupSize: "Up to 12 people",
    categoryId: 1,
    categoryName: i % 4 === 0 ? null : "Adventure",
    categoryIds: i % 4 === 0 ? [] : [1],
    categoryNames: i % 4 === 0 ? [] : ["Adventure"],
    locationIds: [1],
    locationNames: ["Reykjavik"],
    tourType: "day",
    sortOrder: i,
    updatedAt: null,
  }
}

export default function LayoutTestPage() {
  const tours: MergedTour[] = Array.from({ length: 30 }, (_, i) => makeTour(i + 1))
  const categories: TourCategory[] = [
    { id: 1, name: "Adventure", slug: "adventure", sortOrder: 0 } as TourCategory,
    { id: 2, name: "Nature", slug: "nature", sortOrder: 1 } as TourCategory,
  ]
  const locations: StartingLocation[] = [
    { id: 1, name: "Reykjavik", sortOrder: 0 } as StartingLocation,
  ]
  return (
    <AdminShell
      tours={tours}
      categories={categories}
      locations={locations}
      userName="Admin"
    />
  )
}
