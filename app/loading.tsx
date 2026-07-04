import { Loader2 } from "lucide-react"

/**
 * Full-screen loading state shown during route transitions.
 */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </div>
  )
}
