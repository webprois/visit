"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Check, Loader2, Mail } from "lucide-react"
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
    <div className="w-full md:max-w-md">
      <form
        onSubmit={handleSubmit}
        className="group flex items-center gap-1.5 rounded-full border border-border bg-background/60 p-1.5 shadow-sm ring-1 ring-inset ring-transparent transition-all focus-within:border-primary/40 focus-within:ring-primary/30 focus-within:shadow-md"
      >
        <div className="flex flex-1 items-center gap-2.5 pl-3.5">
          <Mail
            className="size-4 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary"
            aria-hidden="true"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            className="w-full min-w-0 bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
            disabled={isPending}
          />
        </div>
        <Button
          type="submit"
          className="shrink-0 rounded-full px-5 shadow-sm transition-transform active:scale-95"
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
          className={`mt-3 flex items-center gap-1.5 pl-1 text-sm ${
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
