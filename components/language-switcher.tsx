"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Globe, Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { setLocale } from "@/app/actions/locale"
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, type Locale } from "@/lib/i18n"

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function onChange(value: string | null) {
    if (!value || value === locale) return
    startTransition(async () => {
      await setLocale(value)
      router.refresh()
    })
  }

  return (
    <Select value={locale} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Select language"
        className="h-9 w-auto gap-1.5 border-border bg-transparent px-2.5"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Globe className="size-4" aria-hidden="true" />
        )}
        <span className="text-sm font-medium">{LOCALE_SHORT[locale]}</span>
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((l) => (
          <SelectItem key={l} value={l}>
            {LOCALE_LABELS[l]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
