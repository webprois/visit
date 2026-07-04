import { betterAuth } from "better-auth"
import { Pool } from "pg"
import {
  sendAccountVerificationEmail,
  sendPasswordResetEmail,
} from "@/lib/email/service"
import { asLocale, LOCALE_COOKIE } from "@/lib/i18n"

/**
 * Best-effort read of the visitor's language from the `locale` cookie on the
 * raw request that triggered an auth email, so verification / reset emails are
 * sent in the same language as the site. Falls back to the default locale.
 */
function localeFromRequest(request?: Request): string {
  const cookieHeader = request?.headers.get("cookie")
  if (!cookieHeader) return asLocale(undefined)
  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rest] = part.trim().split("=")
    if (rawName === LOCALE_COOKIE) {
      return asLocale(decodeURIComponent(rest.join("=")))
    }
  }
  return asLocale(undefined)
}

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
    // Users must confirm their email before they can sign in.
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }, request) => {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        url,
        locale: localeFromRequest(request),
      })
    },
  },
  emailVerification: {
    // Send the verification link automatically on sign-up, and re-send it if an
    // unverified user tries to sign in.
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }, request) => {
      await sendAccountVerificationEmail({
        to: user.email,
        name: user.name,
        url,
        locale: localeFromRequest(request),
      })
    },
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
