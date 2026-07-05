"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { authClient } from "@/lib/auth-client"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Loader2, CircleCheck } from "lucide-react"

export function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  // Better Auth appends `?error=INVALID_TOKEN` when the link is bad/expired.
  const linkError = searchParams.get("error")

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const invalidLink = !token || Boolean(linkError)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError("Passwords don't match")
      return
    }
    if (!token) {
      setError("This reset link is invalid or has expired.")
      return
    }
    setLoading(true)
    try {
      const { error } = await authClient.resetPassword({
        newPassword: password,
        token,
      })
      if (error) throw new Error(error.message || "Could not reset password")
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
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
            <CircleCheck className="size-6 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-xl font-bold text-foreground">
              Password updated
            </h1>
            <p className="text-sm text-muted-foreground text-pretty">
              Your password has been changed. You can now sign in with your new
              password.
            </p>
          </div>
          <Button
            className="mt-2 w-full"
            onClick={() => {
              router.push("/sign-in")
              router.refresh()
            }}
          >
            Go to sign in
          </Button>
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
            Set a new password
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose a new password for your account.
          </p>
        </div>
      </div>

      {invalidLink ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm text-destructive text-pretty">
            This reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className={buttonVariants({
              variant: "outline",
              className: "w-full",
            })}
          >
            Request a new link
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} className="mt-2">
            {loading && <Loader2 className="size-4 animate-spin" />}
            Update password
          </Button>
        </form>
      )}
    </Card>
  )
}
