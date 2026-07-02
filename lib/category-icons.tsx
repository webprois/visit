import type { LucideIcon } from "lucide-react"
import {
  Sparkles,
  Fish,
  Waves,
  Snowflake,
  Mountain,
  MountainSnow,
  Flame,
  Footprints,
  Bike,
  Bus,
  Car,
  Ship,
  Sailboat,
  Anchor,
  Camera,
  Droplets,
  TreePine,
  Tent,
  Compass,
  MapPin,
  Sunrise,
  Sunset,
  Moon,
  Stars,
  CloudSnow,
  Utensils,
  Wine,
  Landmark,
  Bird,
  Shell,
  TreePalm,
  Route,
  Navigation,
  Backpack,
  Caravan,
  Plane,
  Train,
  Ticket,
  Gem,
  Binoculars,
  Zap,
  Snail,
  Rabbit,
  Bath,
  Waypoints,
  Telescope,
} from "lucide-react"

/**
 * Curated set of Lucide icons an admin can assign to a tour category. Keyed by
 * a stable string name that is what we persist in the database (`tour_category.icon`).
 * Keep this list focused on travel / activity themes so the picker stays useful.
 */
export const CATEGORY_ICONS = {
  Sparkles,
  Fish,
  Waves,
  Snowflake,
  Mountain,
  MountainSnow,
  Flame,
  Footprints,
  Bike,
  Bus,
  Car,
  Ship,
  Sailboat,
  Anchor,
  Camera,
  Droplets,
  TreePine,
  Tent,
  Compass,
  MapPin,
  Sunrise,
  Sunset,
  Moon,
  Stars,
  CloudSnow,
  Utensils,
  Wine,
  Landmark,
  Bird,
  Shell,
  TreePalm,
  Route,
  Navigation,
  Backpack,
  Caravan,
  Plane,
  Train,
  Ticket,
  Gem,
  Binoculars,
  Zap,
  Snail,
  Rabbit,
  Bath,
  Waypoints,
  Telescope,
} satisfies Record<string, LucideIcon>

export type CategoryIconName = keyof typeof CATEGORY_ICONS

/** The ordered list of icon names, for rendering the picker grid. */
export const CATEGORY_ICON_NAMES = Object.keys(
  CATEGORY_ICONS,
) as CategoryIconName[]

/** Resolve a stored icon name to its Lucide component, or null if unknown/empty. */
export function getCategoryIcon(name?: string | null): LucideIcon | null {
  if (!name) return null
  return CATEGORY_ICONS[name as CategoryIconName] ?? null
}
