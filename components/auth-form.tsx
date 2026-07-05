"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { authClient } from "@/lib/auth-client"
import { getPostLoginPath } from "@/app/actions/session"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Loader2, MailCheck } from "lucide-react"

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter()
  const isSignUp = mode === "sign-up"

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // When true, we've sent a verification email and are waiting on the user.
  const [verificationSent, setVerificationSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({
          email,
          password,
          name,
          callbackURL: "/account",
        })
        if (error) throw new Error(error.message || "Sign up failed")
        // Email verification is required, so no session is created yet.
        setVerificationSent(true)
        setLoading(false)
        return
      }

      const { error } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/account",
      })
      if (error) {
        // Unverified accounts get a fresh verification email automatically.
        if (
          error.code === "EMAIL_NOT_VERIFIED" ||
          error.status === 403
        ) {
          setVerificationSent(true)
          setLoading(false)
          return
        }
        throw new Error(error.message || "Sign in failed")
      }
      const dest = await getPostLoginPath()
      router.push(dest)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  if (verificationSent) {
    return (
      <Card className="w-full max-w-sm p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src="/images/visit-logo-dark.webp"
            alt="Visit.is"
            width={120}
            height={32}
            className="h-8 w-auto"
          />
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <MailCheck className="size-6 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-xl font-bold text-foreground">
              Check your email
            </h1>
            <p className="text-sm text-muted-foreground text-pretty">
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{email}</span>.
              Click it to activate your account, then sign in.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Didn&apos;t get it? Check your spam folder, or try signing in again
            to resend the link.
          </p>
          <Link
            href="/sign-in"
            className={buttonVariants({
              variant: "outline",
              className: "mt-2 w-full",
            })}
          >
            Back to sign in
          </Link>
        </div>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm p-6">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Image
          src="/images/visit-logo-dark.webp"
          alt="Visit.is"
          width={120}
          height={32}
          className="h-8 w-auto"
        />
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">
            {isSignUp ? "Create account" : "Sign in"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? "Track your bookings" : "Welcome back"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {isSignUp && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {!isSignUp && (
              <Link
                href="/forgot-password"
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={isSignUp ? "new-password" : "current-password"}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="mt-2">
          {loading && <Loader2 className="size-4 animate-spin" />}
          {isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {isSignUp ? (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="text-primary hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/sign-up" className="text-primary hover:underline">
              Create account
            </Link>
          </>
        )}
      </p>
    </Card>
  )
}
