"use client"

import { useState, useTransition } from "react"
import { Check, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useDict, useLocale } from "@/components/i18n-provider"
import { submitContactMessage } from "@/app/actions/contact"

const FIELD_CLASS =
  "h-11 rounded-xl border-border bg-background/60 px-3.5 text-sm shadow-sm transition-all focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/25"

export function ContactForm() {
  const dict = useDict()
  const locale = useLocale()
  const t = dict.contact
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorText, setErrorText] = useState("")

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("idle")
    startTransition(async () => {
      const res = await submitContactMessage({ fullName, email, phone, message, locale })
      if (res.ok) {
        setStatus("success")
      } else {
        setStatus("error")
        setErrorText(res.error === "invalid" ? t.invalidText : t.errorText)
      }
    })
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-10 text-center shadow-sm">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Check className="size-7" aria-hidden="true" />
        </span>
        <h3 className="font-heading text-2xl font-bold text-foreground">
          {t.successTitle}
        </h3>
        <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
          {t.successText}
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="ct-name">
          {t.fullName} <span className="text-primary">*</span>
        </Label>
        <Input
          id="ct-name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder={t.fullNamePlaceholder}
          autoComplete="name"
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ct-email">
          {t.emailField} <span className="text-primary">*</span>
        </Label>
        <Input
          id="ct-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder={t.emailPlaceholder}
          autoComplete="email"
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ct-phone">{t.phoneField}</Label>
        <Input
          id="ct-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder={t.phoneFieldPlaceholder}
          autoComplete="tel"
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ct-message">
          {t.message} <span className="text-primary">*</span>
        </Label>
        <Textarea
          id="ct-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          placeholder={t.messagePlaceholder}
          rows={6}
          className="rounded-xl border-border bg-background/60 shadow-sm transition-all focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/25"
        />
      </div>

      {status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {errorText}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="glow-primary mt-1 w-full gap-2 rounded-full sm:w-auto sm:self-start sm:min-w-48"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        {isPending ? t.sending : t.submit}
      </Button>
    </form>
  )
}
