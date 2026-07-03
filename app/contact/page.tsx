import type { Metadata } from "next"
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ContactForm } from "@/components/contact-form"
import { getLocale } from "@/lib/get-locale"
import { getServerDict } from "@/lib/get-dictionary"

export const metadata: Metadata = {
  title: "Contact Us | Visit Iceland",
  description:
    "Get in touch with Visit Travel Iceland. Call, WhatsApp or email us, or send a message and our team will help you plan your Icelandic adventure.",
}

export default async function ContactPage() {
  const locale = await getLocale()
  const dict = await getServerDict()
  const t = dict.contact

  const details = [
    {
      icon: Phone,
      label: t.phoneLabel,
      value: t.phone,
      href: `tel:${t.phone.replace(/\s/g, "")}`,
    },
    {
      icon: MessageCircle,
      label: t.whatsappLabel,
      value: t.whatsapp,
      href: `https://wa.me/${t.whatsapp.replace(/[^\d]/g, "")}`,
    },
    {
      icon: Mail,
      label: t.emailLabel,
      value: t.email,
      href: `mailto:${t.email}`,
    },
    {
      icon: MapPin,
      label: t.addressLabel,
      value: t.address,
      href: null,
    },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Left: intro + contact details */}
            <div>
              <h1 className="text-balance font-heading text-4xl font-extrabold leading-tight text-foreground md:text-5xl">
                {t.title}
              </h1>
              <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
                {t.intro}
              </p>

              <ul className="mt-10 flex flex-col gap-6">
                {details.map((d) => {
                  const Icon = d.icon
                  const content = (
                    <>
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-sm font-medium text-muted-foreground">
                          {d.label}
                        </span>
                        <span className="font-heading text-lg font-bold text-foreground">
                          {d.value}
                        </span>
                      </span>
                    </>
                  )
                  return (
                    <li key={d.label}>
                      {d.href ? (
                        <a
                          href={d.href}
                          className="flex items-center gap-4 transition-opacity hover:opacity-80"
                        >
                          {content}
                        </a>
                      ) : (
                        <div className="flex items-center gap-4">{content}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* Right: message form */}
            <div>
              <div className="mb-6">
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  {t.formTitle}
                </h2>
                <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
                  {t.formSubtitle}
                </p>
              </div>
              <ContactForm />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
