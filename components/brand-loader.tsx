import { cn } from "@/lib/utils"

interface BrandLoaderProps {
  /** Pixel size of the animated mark. Defaults to 56. */
  size?: number
  /** Accessible status text announced to screen readers. */
  label?: string
  /** Optional visible caption rendered under the mark. */
  caption?: string
  className?: string
}

/**
 * Animated loading indicator built from the visit.is pin/bird mark. The eye
 * winks in a continuous double-blink loop, rendered as a crisp, theme-aware
 * SVG (no image asset needed). Colours use the app's design tokens so the mark
 * stays on-brand in any theme.
 */
export function BrandLoader({
  size = 56,
  label = "Loading",
  caption,
  className,
}: BrandLoaderProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex flex-col items-center gap-3", className)}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 1000 1000"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* White pin/bird body: head circle + bottom-left tail (same fill,
            so they union into a seamless teardrop). */}
        <circle cx="490" cy="430" r="325" fill="var(--foreground)" />
        <path
          d="M241 639 Q 255 790 315 850 Q 440 800 546 750 Z"
          fill="var(--foreground)"
        />

        {/* Red beak */}
        <path
          d="M745 258 L888 360 L758 478 Z"
          fill="var(--primary)"
        />

        {/* Eye group — blinks via a vertical scale. When it collapses the
            white body shows through, reading as a closed eyelid. */}
        <g className="brand-loader-eye">
          <circle cx="468" cy="440" r="210" fill="var(--background)" />
          <circle cx="520" cy="340" r="33" fill="var(--foreground)" />
          <circle cx="520" cy="340" r="9" fill="var(--background)" />
        </g>
      </svg>
      {caption ? (
        <span className="text-sm font-medium text-muted-foreground">
          {caption}
        </span>
      ) : null}
      <span className="sr-only">{label}</span>
    </span>
  )
}
