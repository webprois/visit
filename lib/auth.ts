import { betterAuth } from "better-auth"
import { Pool } from "pg"

const v0Url = process.env.V0_RUNTIME_URL
const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : undefined
const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined

const baseURL =
  process.env.BETTER_AUTH_URL || productionUrl || vercelUrl || v0Url || undefined

const localhostOrigins =
  process.env.NODE_ENV === "development"
    ? [
        "http://localhost:3000",
        `http://localhost:${process.env.PORT ?? 3000}`,
      ]
    : []

// v0 renders the preview inside an iframe served from these domains. Better Auth
// rejects sign-in requests whose Origin header is not trusted, so we allow the
// known v0 preview hosts via wildcards in addition to the deployment URLs.
const v0PreviewOrigins = [
  "https://*.vusercontent.net",
  "https://*.v0.dev",
  "https://*.v0.app",
  "https://*.vercel.app",
]

const trustedOrigins = [
  v0Url,
  vercelUrl,
  productionUrl,
  ...localhostOrigins,
  ...v0PreviewOrigins,
].filter((u): u is string => Boolean(u))

export const auth = betterAuth({
  baseURL,
  trustedOrigins,
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  emailAndPassword: {
    enabled: true,
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        advanced: {
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        },
      }
    : {}),
})
