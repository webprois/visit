import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { isAdminEmail } from "@/lib/roles"

/** Returns the signed-in session, or throws if not authenticated. */
export async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session
}

/** Returns the signed-in user, or null when not authenticated. */
export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user ?? null
}

/**
 * Guard for admin-only routes and actions. Redirects unauthenticated users to
 * sign-in, and signed-in non-admin (customer) users to their account area.
 * Returns the admin session when access is allowed.
 */
export async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")
  if (!isAdminEmail(session.user.email)) redirect("/account")
  return session
}

/**
 * Admin guard for server actions/mutations. Throws instead of redirecting so a
 * non-admin call fails loudly rather than silently succeeding.
 */
export async function assertAdmin() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user || !isAdminEmail(session.user.email)) {
    throw new Error("Unauthorized")
  }
  return session
}
