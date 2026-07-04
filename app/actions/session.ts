"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { isAdminEmail } from "@/lib/roles"

/**
 * Where a freshly authenticated user should land, based on role. Admins go to
 * the dashboard; customers go to their account area. Read server-side because
 * ADMIN_EMAILS is never exposed to the client.
 */
export async function getPostLoginPath(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user && isAdminEmail(session.user.email)) {
    return "/admin/dashboard"
  }
  return "/account"
}
