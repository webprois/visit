import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  jsonb,
  doublePrecision,
  primaryKey,
} from "drizzle-orm/pg-core"

/* ---------------- Better Auth tables ---------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

/* ---------------- App tables ---------------- */

export const tourCategory = pgTable("tour_category", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sortOrder").notNull().default(0),
  imageUrl: text("imageUrl"),
  // Optional Lucide icon name (see lib/category-icons) shown in filter chips.
  icon: text("icon"),
  description: text("description"),
  // Translated display names. English is the site default.
  nameEn: text("nameEn"),
  nameEs: text("nameEs"),
  namePt: text("namePt"),
  nameIt: text("nameIt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const tourOverride = pgTable("tour_override", {
  bokunId: text("bokunId").primaryKey(),
  visible: boolean("visible").notNull().default(false),
  featured: boolean("featured").notNull().default(false),
  // Tour type shown on the product card: "day" or "multi-day".
  tourType: text("tourType").notNull().default("day"),
  title: text("title"),
  excerpt: text("excerpt"),
  description: text("description"),
  location: text("location"),
  duration: text("duration"),
  difficulty: text("difficulty"),
  groupSize: text("groupSize"),
  imageUrl: text("imageUrl"),
  // Curated, ordered gallery as JSON: [{ url, alt }]. When set, this replaces
  // the Bokun gallery on the public tour page. The hero (imageUrl) is shown
  // first regardless of its position here.
  gallery: text("gallery"),
  categoryId: integer("categoryId"),
  sortOrder: integer("sortOrder").notNull().default(0),
  // Admin-set starting-point coordinates for the homepage map. When null we
  // fall back to Bokun's coordinates for the tour (if any). For multi-stop
  // tours this mirrors the first stop (kept for backwards compatibility).
  mapLat: doublePrecision("mapLat"),
  mapLng: doublePrecision("mapLng"),
  // Ordered list of route stops for multi-location tours (e.g. self-drives),
  // stored as JSON: [{ name, lat, lng }]. Empty for single-location tours.
  mapStops: jsonb("mapStops").$type<MapStop[]>().notNull().default([]),
  // When false, the tour is hidden from the homepage map (but can still be
  // published and listed elsewhere). Defaults to true.
  showOnMap: boolean("showOnMap").notNull().default(true),
  // When true, the tour is hidden from the admin workspace list and excluded
  // from the "Total" count (surfaced under its own "Hidden" stat instead).
  hidden: boolean("hidden").notNull().default(false),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

/** A single stop on a multi-location tour route. */
export type MapStop = {
  name: string
  lat: number
  lng: number
}

/**
 * Per-tour, per-language editable content. One row per (tour, language).
 * Languages: "en" | "es" | "pt" | "it". List fields (included, excluded,
 * goodToKnow) are stored as newline-separated text, one item per line.
 */
export const tourTranslation = pgTable(
  "tour_translation",
  {
    bokunId: text("bokunId").notNull(),
    lang: text("lang").notNull(),
    title: text("title"),
    excerpt: text("excerpt"),
    description: text("description"),
    included: text("included"),
    excluded: text("excluded"),
    goodToKnow: text("goodToKnow"),
    // Itinerary steps stored as a JSON array of { title, body }.
    itinerary: text("itinerary"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.bokunId, t.lang] }),
  }),
)

/**
 * Many-to-many link between a Bokun tour and its categories.
 * A tour can belong to several categories at once.
 */
export const tourCategoryLink = pgTable(
  "tour_category_link",
  {
    bokunId: text("bokunId").notNull(),
    categoryId: integer("categoryId")
      .notNull()
      .references(() => tourCategory.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.bokunId, t.categoryId] }),
  }),
)

/**
 * Editable starting locations (e.g. "Capital Region", "South Coast"). These
 * are fully managed in the admin (create/rename/delete/reorder), like
 * categories.
 */
export const startingLocation = pgTable("starting_location", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

/**
 * Many-to-many link between a Bokun tour and its starting locations.
 * A tour can be assigned to several locations at once.
 */
export const tourStartingLocation = pgTable(
  "tour_starting_location",
  {
    bokunId: text("bokunId").notNull(),
    locationId: integer("locationId")
      .notNull()
      .references(() => startingLocation.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.bokunId, t.locationId] }),
  }),
)

/**
 * Guest tour bookings created through our own booking form. Availability and
 * pricing come from Bokun, payment is taken via Teya, and the confirmed
 * booking is recorded here (Bokun booking-write is not available on this key).
 * These are guest bookings, so there is no userId scoping.
 */
export const booking = pgTable("booking", {
  id: text("id").primaryKey(),
  bokunId: text("bokun_id").notNull(),
  tourTitle: text("tour_title").notNull(),
  tourDate: text("tour_date").notNull(),
  startTime: text("start_time"),
  startTimeId: integer("start_time_id"),
  // Quantity per pricing category: [{ id, title, quantity, unitAmountMinor }]
  pax: jsonb("pax").notNull(),
  // Selected add-ons: [{ extraId, title, qty, unitIsk }]
  addons: jsonb("addons").notNull().default([]),
  // Per-participant names: [{ category, name }]
  participants: jsonb("participants").notNull().default([]),
  // Pickup/drop-off selection: { pickupId, pickupTitle, roomNumber, dropoffId, dropoffTitle }
  pickup: jsonb("pickup"),
  totalPax: integer("total_pax").notNull(),
  currency: text("currency").notNull(),
  // Total in minor units (e.g. cents) to avoid float rounding.
  amountMinor: integer("amount_minor").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  notes: text("notes"),
  // Legacy SecurePay flow: "pending" | "paid" | "failed" | "cancelled".
  // Teya Hosted Checkout flow: "pending_payment" | "confirmed" | "cancelled".
  status: text("status").notNull().default("pending"),
  teyaSessionId: text("teya_session_id"),
  teyaReference: text("teya_reference"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * Server-side cache of Bokun availability, one row per (tour, day). Refreshed
 * on a schedule by a cron job so tour search can filter by availability with a
 * single fast DB query instead of calling Bokun for every tour on each search.
 */
export const tourAvailability = pgTable(
  "tour_availability",
  {
    bokunId: text("bokunId").notNull(),
    // Local day in YYYY-MM-DD form.
    date: text("date").notNull(),
    // Seats left for the day (ignore when `unlimited`).
    seats: integer("seats").notNull().default(0),
    unlimited: boolean("unlimited").notNull().default(false),
    minPax: integer("minPax").notNull().default(1),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.bokunId, t.date] }),
  }),
)

/**
 * Machine-translation cache for dynamic Bokun content (add-on names, participant
 * category labels, etc.) that has no admin-managed translation. Keyed by a hash
 * of the source English text plus the target language, so each unique string is
 * only sent to the translation model once per language.
 */
export const translationCache = pgTable(
  "translation_cache",
  {
    // sha-256 hex of the trimmed source text.
    hash: text("hash").notNull(),
    lang: text("lang").notNull(),
    sourceText: text("source_text").notNull(),
    translated: text("translated").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.hash, t.lang] }),
  }),
)

/**
 * Newsletter signups collected from the footer signup form. Guest data (like
 * bookings), so there is no userId scoping. Email is unique so re-subscribing
 * is idempotent.
 */
export const newsletterSubscriber = pgTable("newsletter_subscriber", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  locale: text("locale"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * Tailor-made / private trip requests submitted from the public /tailor-made
 * page. Guest data (like bookings and newsletter signups), so there is no
 * userId scoping. Reviewed by the team out-of-band via email/admin.
 */
export const tailorMadeRequest = pgTable("tailor_made_request", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  adults: integer("adults"),
  children: integer("children"),
  tripDuration: text("trip_duration"),
  travelDate: text("travel_date"),
  wantsActivities: boolean("wants_activities"),
  wantsGuided: boolean("wants_guided"),
  wantsRentalCar: boolean("wants_rental_car"),
  accommodation: text("accommodation"),
  tourType: text("tour_type"),
  interests: text("interests"),
  otherInfo: text("other_info"),
  howFound: text("how_found"),
  locale: text("locale"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type NewsletterSubscriber = typeof newsletterSubscriber.$inferSelect
export type NewNewsletterSubscriber = typeof newsletterSubscriber.$inferInsert

export type TailorMadeRequest = typeof tailorMadeRequest.$inferSelect
export type NewTailorMadeRequest = typeof tailorMadeRequest.$inferInsert

/**
 * Contact form messages submitted from the public /contact page. Guest data,
 * so there is no userId scoping. Reviewed by the team out-of-band.
 */
export const contactMessage = pgTable("contact_message", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  locale: text("locale"),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type ContactMessage = typeof contactMessage.$inferSelect
export type NewContactMessage = typeof contactMessage.$inferInsert

export type TranslationCache = typeof translationCache.$inferSelect
export type NewTranslationCache = typeof translationCache.$inferInsert

export type TourAvailability = typeof tourAvailability.$inferSelect
export type NewTourAvailability = typeof tourAvailability.$inferInsert

export type Booking = typeof booking.$inferSelect
export type NewBooking = typeof booking.$inferInsert

export type TourCategory = typeof tourCategory.$inferSelect
export type TourOverride = typeof tourOverride.$inferSelect
export type TourCategoryLink = typeof tourCategoryLink.$inferSelect
export type TourTranslation = typeof tourTranslation.$inferSelect
export type StartingLocation = typeof startingLocation.$inferSelect
export type TourStartingLocation = typeof tourStartingLocation.$inferSelect
