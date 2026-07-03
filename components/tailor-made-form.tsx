"use client"

import { useState, useTransition } from "react"
import { Check, Loader2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useDict, useLocale } from "@/components/i18n-provider"
import { cn } from "@/lib/utils"
import { submitTailorMadeRequest } from "@/app/actions/tailor-made"

const FIELD_CLASS =
  "h-11 rounded-xl border-border bg-background/60 px-3.5 text-sm shadow-sm transition-all focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/25"

/** A group of mutually-exclusive pill buttons (our styled radio group). */
function OptionGroup({
  label,
  options,
  value,
  onChange,
  name,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  name: string
}) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-sm font-medium text-foreground">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((opt) => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              name={name}
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                active
                  ? "border-primary bg-primary/15 text-foreground shadow-sm"
                  : "border-border bg-background/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function TailorMadeForm() {
  const dict = useDict()
  const locale = useLocale()
  const t = dict.tailorMade
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [errorText, setErrorText] = useState("")

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [adults, setAdults] = useState("")
  const [children, setChildren] = useState("")
  const [tripDuration, setTripDuration] = useState("")
  const [travelDate, setTravelDate] = useState("")
  const [wantsActivities, setWantsActivities] = useState("")
  const [wantsGuided, setWantsGuided] = useState("")
  const [wantsRentalCar, setWantsRentalCar] = useState("")
  const [accommodation, setAccommodation] = useState("")
  const [tourType, setTourType] = useState("")
  const [interests, setInterests] = useState("")
  const [otherInfo, setOtherInfo] = useState("")
  const [howFound, setHowFound] = useState("")

  const yesNo = [
    { value: "yes", label: t.yes },
    { value: "no", label: t.no },
  ]

  function toBool(v: string): boolean | null {
    if (v === "yes") return true
    if (v === "no") return false
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("idle")
    startTransition(async () => {
      const res = await submitTailorMadeRequest({
        fullName,
        email,
        phone,
        adults: adults ? Number(adults) : null,
        children: children ? Number(children) : null,
        tripDuration,
        travelDate,
        wantsActivities: toBool(wantsActivities),
        wantsGuided: toBool(wantsGuided),
        wantsRentalCar: toBool(wantsRentalCar),
        accommodation,
        tourType,
        interests,
        otherInfo,
        howFound,
        locale,
      })
      if (res.ok) {
        setStatus("success")
        window.scrollTo({ top: 0, behavior: "smooth" })
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
      className="flex flex-col gap-8 rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8"
    >
      {/* Contact row */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tm-name">
            {t.fullName} <span className="text-primary">*</span>
          </Label>
          <Input
            id="tm-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder={t.fullNamePlaceholder}
            autoComplete="name"
            className={FIELD_CLASS}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tm-email">
            {t.email} <span className="text-primary">*</span>
          </Label>
          <Input
            id="tm-email"
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
          <Label htmlFor="tm-phone">{t.phone}</Label>
          <Input
            id="tm-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.phonePlaceholder}
            autoComplete="tel"
            className={FIELD_CLASS}
          />
        </div>
      </div>

      {/* Trip basics row */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tm-adults">{t.adults}</Label>
          <Input
            id="tm-adults"
            type="number"
            min={0}
            inputMode="numeric"
            value={adults}
            onChange={(e) => setAdults(e.target.value)}
            placeholder="2"
            className={FIELD_CLASS}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tm-children">{t.children}</Label>
          <Input
            id="tm-children"
            type="number"
            min={0}
            inputMode="numeric"
            value={children}
            onChange={(e) => setChildren(e.target.value)}
            placeholder="0"
            className={FIELD_CLASS}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tm-duration">{t.tripDuration}</Label>
          <Input
            id="tm-duration"
            value={tripDuration}
            onChange={(e) => setTripDuration(e.target.value)}
            placeholder={t.tripDurationPlaceholder}
            className={FIELD_CLASS}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tm-date">{t.travelDate}</Label>
          <Input
            id="tm-date"
            type="date"
            value={travelDate}
            onChange={(e) => setTravelDate(e.target.value)}
            className={cn(FIELD_CLASS, "[color-scheme:dark]")}
          />
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Preference toggles */}
      <div className="grid gap-6 md:grid-cols-2">
        <OptionGroup
          name="activities"
          label={t.activitiesQ}
          options={yesNo}
          value={wantsActivities}
          onChange={setWantsActivities}
        />
        <OptionGroup
          name="guided"
          label={t.guidedQ}
          options={yesNo}
          value={wantsGuided}
          onChange={setWantsGuided}
        />
        <OptionGroup
          name="rentalCar"
          label={t.rentalCarQ}
          options={yesNo}
          value={wantsRentalCar}
          onChange={setWantsRentalCar}
        />
        <OptionGroup
          name="accommodation"
          label={t.accommodationQ}
          value={accommodation}
          onChange={setAccommodation}
          options={[
            { value: "hostels", label: t.hostels },
            { value: "3-stars", label: t.star3 },
            { value: "4-stars", label: t.star4 },
            { value: "5-stars", label: t.star5 },
          ]}
        />
      </div>

      <OptionGroup
        name="tourType"
        label={t.tourTypeQ}
        value={tourType}
        onChange={setTourType}
        options={[
          { value: "self-drive", label: t.selfDrive },
          { value: "private", label: t.private },
          { value: "group", label: t.group },
        ]}
      />

      <div className="h-px bg-border" />

      {/* Free text */}
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="tm-interests">{t.interests}</Label>
          <Textarea
            id="tm-interests"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder={t.interestsPlaceholder}
            rows={4}
            className="rounded-xl border-border bg-background/60 shadow-sm transition-all focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/25"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tm-other">{t.otherInfo}</Label>
          <Textarea
            id="tm-other"
            value={otherInfo}
            onChange={(e) => setOtherInfo(e.target.value)}
            placeholder={t.otherInfoPlaceholder}
            rows={4}
            className="rounded-xl border-border bg-background/60 shadow-sm transition-all focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/25"
          />
        </div>
      </div>

      <OptionGroup
        name="howFound"
        label={t.howFound}
        value={howFound}
        onChange={setHowFound}
        options={[
          { value: "friend", label: t.friend },
          { value: "online", label: t.online },
          { value: "social", label: t.social },
          { value: "other", label: t.other },
        ]}
      />

      {status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {errorText}
        </p>
      ) : null}

      <div className="flex justify-center">
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="glow-primary min-w-56 gap-2 rounded-full"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
          {isPending ? t.sending : t.submit}
        </Button>
      </div>
    </form>
  )
}
