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
 * Animated loading indicator built from the visit.is monogram. The two icon
 * strokes repeatedly draw on, fill in, then fade back out — a seamless,
 * GIF-style loop rendered as a crisp, theme-aware SVG (no image asset needed).
 *
 * Colour follows `currentColor`, so wrap it in a `text-*` class (defaults to
 * the brand primary) to recolour it.
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
      className={cn(
        "inline-flex flex-col items-center gap-3 text-primary",
        className,
      )}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 180 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g style={{ transform: "scale(0.95)", transformOrigin: "center" }}>
          <path
            className="brand-loader-path"
            pathLength={1}
            d="M101.141 53H136.632C151.023 53 162.689 64.6662 162.689 79.0573V112.904H148.112V79.0573C148.112 78.7105 148.098 78.3662 148.072 78.0251L112.581 112.898C112.701 112.902 112.821 112.904 112.941 112.904H148.112V126.672H112.941C98.5504 126.672 86.5638 114.891 86.5638 100.5V66.7434H101.141V100.5C101.141 101.15 101.191 101.792 101.289 102.422L137.56 66.7816C137.255 66.7563 136.945 66.7434 136.632 66.7434H101.141V53Z"
          />
          <path
            className="brand-loader-path brand-loader-path--delayed"
            pathLength={1}
            d="M65.2926 124.136L14 66.7372H34.6355L64.7495 100.436V66.7372H80.1365V118.47C80.1365 126.278 70.4953 129.958 65.2926 124.136Z"
          />
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
