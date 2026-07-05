import { Star, Award, ShieldCheck, CalendarCheck } from "lucide-react"
import { getServerDict } from "@/lib/get-dictionary"

export async function SocialProof() {
  const dict = await getServerDict()
  const items = [
    { icon: Star, title: dict.trust.ratingTitle, text: dict.trust.ratingText },
    { icon: Award, title: dict.trust.expertsTitle, text: dict.trust.expertsText },
    { icon: ShieldCheck, title: dict.trust.secureTitle, text: dict.trust.secureText },
    {
      icon: CalendarCheck,
      title: dict.trust.flexibleTitle,
      text: dict.trust.flexibleText,
    },
  ]
  return (
    <section aria-label="Why travellers trust us" className="border-b border-border bg-card">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-10 md:grid-cols-4 md:divide-x md:divide-border md:px-6 md:py-12">
        {items.map((item) => (
          <div
            key={item.title}
            className="flex flex-col items-center gap-3 text-center md:flex-row md:gap-4 md:px-6 md:text-left"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <item.icon className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading text-base font-bold text-foreground">
                {item.title}
              </p>
              <p className="text-sm text-muted-foreground">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
