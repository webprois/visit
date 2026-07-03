import Image from "next/image"
import { Phone, Mail, MapPin } from "lucide-react"
import { getServerDict } from "@/lib/get-dictionary"
import { getLocale } from "@/lib/get-locale"
import { NewsletterSignup } from "@/components/newsletter-signup"

export async function SiteFooter() {
  const dict = await getServerDict()
  const locale = await getLocale()
  return (
    <footer className="bg-background">
      {/* CTA */}
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="flex flex-col items-start gap-6 rounded-3xl bg-secondary p-8 text-foreground md:flex-row md:items-center md:justify-between md:p-12">
          <div>
            <h2 className="text-balance font-heading text-2xl font-extrabold md:text-3xl">
              {dict.footer.ctaTitle}
            </h2>
            <p className="mt-2 max-w-md text-pretty leading-relaxed text-muted-foreground">
              {dict.footer.ctaSubtitle}
            </p>
          </div>
          <NewsletterSignup
            locale={locale}
            labels={{
              placeholder: dict.footer.newsletterPlaceholder,
              button: dict.footer.newsletterButton,
              success: dict.footer.newsletterSuccess,
              invalid: dict.footer.newsletterInvalid,
              error: dict.footer.newsletterError,
            }}
          />
        </div>
      </div>

      {/* Links */}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-12 md:grid-cols-4 md:px-6">
        <div>
          <a href="#top" className="flex items-center">
            <Image
              src="/images/visit-logo.webp"
              alt="Visit.is"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
          </a>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {dict.footer.tagline}
          </p>
        </div>

        <FooterCol
          title={dict.footer.toursTitle}
          links={[
            dict.footer.dayTours,
            dict.footer.multiDayTours,
            dict.footer.privateTours,
            dict.footer.selfDrive,
          ]}
        />
        <FooterCol
          title={dict.footer.companyTitle}
          links={[
            dict.footer.aboutUs,
            dict.footer.whyBook,
            dict.footer.reviews,
            dict.footer.contact,
          ]}
        />

        <div>
          <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
            {dict.footer.getInTouch}
          </h3>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Phone className="size-4 text-primary" aria-hidden="true" />
              +354 419 1600
            </li>
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-primary" aria-hidden="true" />
              info@visit.is
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" aria-hidden="true" />
              Reykjavik, Iceland
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground md:flex-row md:px-6">
          <p>© {new Date().getFullYear()} visit.is — {dict.footer.rights}</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-foreground">{dict.footer.privacy}</a>
            <a href="#" className="hover:text-foreground">{dict.footer.terms}</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
        {title}
      </h3>
      <ul className="mt-4 space-y-3 text-sm">
        {links.map((l) => (
          <li key={l}>
            <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
              {l}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
