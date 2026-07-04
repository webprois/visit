"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { authClient } from "@/lib/auth-client"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Loader2, MailCheck } from "lucide-react"

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Better Auth returns success even when the email is unknown (to avoid
      // leaking which addresses exist), so we always show the same result.
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      })
      if (error) throw new Error(error.message || "Something went wrong")
      setSent(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <Card className="w-full max-w-sm p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src="/images/visit-logo.webp"
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
              If an account exists for{" "}
              <span className="font-medium text-foreground">{email}</span>,
              we&apos;ve sent a link to reset your password.
            </p>
          </div>
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
          src="/images/visit-logo.webp"
          alt="Visit.is"
          width={120}
          height={32}
          className="h-8 w-auto"
        />
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">
            Forgot password?
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading} className="mt-2">
          {loading && <Loader2 className="size-4 animate-spin" />}
          Send reset link
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link href="/sign-in" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  )
}
