import { ShieldCheck, Heart, BadgeDollarSign, Users } from "lucide-react"
import { getServerDict } from "@/lib/get-dictionary"

export async function WhyBook() {
  const dict = await getServerDict()
  const reasons = [
    {
      icon: ShieldCheck,
      title: dict.why.pickedTitle,
      text: dict.why.pickedText,
    },
    {
      icon: BadgeDollarSign,
      title: dict.why.valueTitle,
      text: dict.why.valueText,
    },
    {
      icon: Heart,
      title: dict.why.serviceTitle,
      text: dict.why.serviceText,
    },
    {
      icon: Users,
      title: dict.why.trustedTitle,
      text: dict.why.trustedText,
    },
  ]
  return (
    <section id="why" className="bg-card text-card-foreground">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance font-heading text-3xl font-extrabold md:text-4xl">
            {dict.why.title}
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            {dict.why.subtitle}
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map((r) => (
            <div
              key={r.title}
              className="card-lift rounded-2xl border border-border bg-secondary p-6"
            >
              <span className="glow-primary flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-primary text-accent-foreground">
                <r.icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-heading text-lg font-bold">{r.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {r.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
