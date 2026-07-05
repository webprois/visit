"use client"

import { useState } from "react"
import Image from "next/image"
import { Menu, X, UserRound } from "lucide-react"
import { LanguageSwitcher } from "@/components/language-switcher"
import { CurrencySwitcher } from "@/components/currency-switcher"
import { useDict } from "@/components/i18n-provider"
import { authClient } from "@/lib/auth-client"
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n"

export function SiteHeader({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
  const [open, setOpen] = useState(false)
  const dict = useDict()
  const { data: session } = authClient.useSession()
  // Signed-in customers get "My Trips"; everyone else gets a sign-in link.
  const accountLink = session
    ? { label: dict.nav.myTrips, href: "/account" }
    : { label: dict.nav.signIn, href: "/sign-in" }

  const navLinks = [
    { label: dict.nav.allTours, href: "/tours" },
    { label: dict.nav.selfDrive, href: "/self-drive-tours" },
    { label: dict.nav.tailorMade, href: "/tailor-made" },
    { label: dict.nav.contact, href: "/contact" },
  ]

  return (
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <a href="/" className="flex items-center">
          <Image
            src="/images/visit-logo-dark.webp"
            alt="Visit.is"
            width={120}
            height={32}
            priority
            className="h-7 w-auto md:h-8"
          />
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <CurrencySwitcher />
          <LanguageSwitcher locale={locale} />
          <a
            href={accountLink.href}
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <UserRound className="size-4" aria-hidden="true" />
            {accountLink.label}
          </a>
        </div>

        <button
          className="flex size-11 items-center justify-center rounded-md text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3" aria-label="Mobile">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium text-foreground hover:bg-secondary"
              >
                {link.label}
              </a>
            ))}
            <a
              href={accountLink.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-3 text-base font-medium text-foreground hover:bg-secondary"
            >
              <UserRound className="size-5" aria-hidden="true" />
              {accountLink.label}
            </a>
            <div className="flex items-center gap-3 px-3 py-2">
              <CurrencySwitcher />
              <LanguageSwitcher locale={locale} />
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
