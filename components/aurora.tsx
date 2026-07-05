import { cn } from "@/lib/utils"

/**
 * Decorative animated aurora borealis effect. Renders three blurred, drifting
 * light ribbons that shimmer like the northern lights. Purely decorative, so it
 * is hidden from assistive tech and disabled under reduced-motion (see globals.css).
 */
export function Aurora({ className }: { className?: string }) {
  return (
    <div className={cn("aurora", className)} aria-hidden="true">
      <div className="aurora__band aurora__band--1" />
      <div className="aurora__band aurora__band--2" />
      <div className="aurora__band aurora__band--3" />
    </div>
  )
}
