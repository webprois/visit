import { ShieldCheck, Heart, BadgeDollarSign, Users } from "lucide-react"

const reasons = [
  {
    icon: ShieldCheck,
    title: "Carefully picked",
    text: "Every tour and activity is handpicked by our travel professionals.",
  },
  {
    icon: BadgeDollarSign,
    title: "Great value",
    text: "A trusted blend of fair pricing and genuine quality service.",
  },
  {
    icon: Heart,
    title: "Personal service",
    text: "Tailor-made private tours designed around your wishes.",
  },
  {
    icon: Users,
    title: "Trusted by 500+",
    text: "Hundreds of happy travellers have explored Iceland with us.",
  },
]

export function WhyBook() {
  return (
    <section id="why" className="bg-card text-card-foreground">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance font-heading text-3xl font-extrabold md:text-4xl">
            Why book with us?
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            We organise private tours that aren&apos;t available as standard
            options — tailor-made to the needs and wishes of every client.
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
