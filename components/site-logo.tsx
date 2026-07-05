import Image from "next/image"
import { cn } from "@/lib/utils"

/**
 * Theme-aware logo. The source artwork is near-white, so we show a recolored
 * dark version on light backgrounds and the original on dark backgrounds.
 * Both are rendered and toggled with CSS to avoid a hydration flash.
 */
export function SiteLogo({
  className,
  width = 120,
  height = 32,
  priority = false,
}: {
  className?: string
  width?: number
  height?: number
  priority?: boolean
}) {
  return (
    <>
      <Image
        src="/images/visit-logo-dark.webp"
        alt="Visit.is"
        width={width}
        height={height}
        priority={priority}
        className={cn("block dark:hidden", className)}
      />
      <Image
        src="/images/visit-logo.webp"
        alt="Visit.is"
        width={width}
        height={height}
        priority={priority}
        className={cn("hidden dark:block", className)}
      />
    </>
  )
}
