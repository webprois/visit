"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, Loader2 } from "lucide-react"
import { subscribeToNewsletter } from "@/app/actions/newsletter"

type Labels = {
  placeholder: string
  button: string
  success: string
  invalid: string
  error: string
}

export function NewsletterSignup({
  labels,
  locale,
}: {
  labels: Labels
  locale?: string
}) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [message, setMessage] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("idle")
    setMessage("")
    startTransition(async () => {
      const res = await subscribeToNewsletter(email, locale)
      if (res.ok) {
        setStatus("success")
        setMessage(labels.success)
        setEmail("")
      } else {
        setStatus("error")
        setMessage(res.error === "invalid" ? labels.invalid : labels.error)
      }
    })
  }

  return (
    <div className="w-full md:max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={labels.placeholder}
          aria-label={labels.placeholder}
          className="rounded-full bg-background"
          disabled={isPending}
        />
        <Button
          type="submit"
          size="lg"
          className="rounded-full"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {labels.button}
        </Button>
      </form>
      {message ? (
        <p
          role="status"
          className={`mt-3 flex items-center gap-1.5 text-sm ${
            status === "success" ? "text-primary" : "text-destructive"
          }`}
        >
          {status === "success" ? (
            <Check className="size-4" aria-hidden="true" />
          ) : null}
          {message}
        </p>
      ) : null}
    </div>
  )
}
