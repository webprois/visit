import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth-form"
import { isAdminEmail } from "@/lib/roles"

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) {
    redirect(isAdminEmail(session.user.email) ? "/admin/dashboard" : "/account")
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <AuthForm mode="sign-up" />
    </main>
  )
}
