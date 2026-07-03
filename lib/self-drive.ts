/**
 * Static self-drive package data (the tiers are curated, fixed packages rather
 * than live Bokun tours). Copy/labels live in `translations.ts` under
 * `selfDrive`; this file holds the locale-neutral structure: tier keys, images,
 * and the EUR estimate per duration.
 */

export type SelfDriveTierKey = "basic" | "standard" | "premium"

export type SelfDrivePackage = {
  /** Trip length in days. */
  days: number
  /** Whether this package follows the full Ring Road (10-day trips). */
  ringRoad: boolean
  /** Estimated price in EUR for 2 adults. */
  priceEur: number
}

export type SelfDriveTier = {
  key: SelfDriveTierKey
  image: string
  /** The three duration options offered for every tier. */
  packages: SelfDrivePackage[]
}

export const SELF_DRIVE_TIERS: SelfDriveTier[] = [
  {
    key: "basic",
    image: "/images/golden-circle.png",
    packages: [
      { days: 5, ringRoad: false, priceEur: 2990 },
      { days: 7, ringRoad: false, priceEur: 3990 },
      { days: 10, ringRoad: true, priceEur: 5490 },
    ],
  },
  {
    key: "standard",
    image: "/images/glacier.png",
    packages: [
      { days: 5, ringRoad: false, priceEur: 3990 },
      { days: 7, ringRoad: false, priceEur: 5490 },
      { days: 10, ringRoad: true, priceEur: 7490 },
    ],
  },
  {
    key: "premium",
    image: "/images/ice-cave.png",
    packages: [
      { days: 5, ringRoad: false, priceEur: 5990 },
      { days: 7, ringRoad: false, priceEur: 7990 },
      { days: 10, ringRoad: true, priceEur: 10990 },
    ],
  },
]

/** Format an EUR estimate the same way as the reference: "2.990 €". */
export function formatEur(amount: number): string {
  return `${amount.toLocaleString("de-DE")} €`
}
