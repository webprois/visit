import {
  pgTable,
  text,
  timestamp,
  boolean,
  serial,
  integer,
  jsonb,
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
  categoryId: integer("categoryId"),
  sortOrder: integer("sortOrder").notNull().default(0),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

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

export type Booking = typeof booking.$inferSelect
export type NewBooking = typeof booking.$inferInsert

export type TourCategory = typeof tourCategory.$inferSelect
export type TourOverride = typeof tourOverride.$inferSelect
export type TourCategoryLink = typeof tourCategoryLink.$inferSelect
export type TourTranslation = typeof tourTranslation.$inferSelect
export type StartingLocation = typeof startingLocation.$inferSelect
export type TourStartingLocation = typeof tourStartingLocation.$inferSelect
