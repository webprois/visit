import { auth } from "@/lib/auth"
import { headers } from "next/headers"

/** Returns the signed-in admin session, or throws if not authenticated. */
export async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session
}
