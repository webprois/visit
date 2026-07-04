/**
 * Role helpers. Admin access is granted by email via the ADMIN_EMAILS env var
 * (comma-separated, case-insensitive). Every other signed-in user is a customer.
 * This keeps role logic out of the database while still being easy to manage.
 */

/** Parsed, lowercased set of admin emails from the ADMIN_EMAILS env var. */
function adminEmailSet(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
}

/** True when the given email is configured as an admin. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmailSet().has(email.trim().toLowerCase())
}
