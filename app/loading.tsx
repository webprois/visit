import { BrandLoader } from "@/components/brand-loader"

/**
 * Full-screen branded loading state shown during route transitions. Uses the
 * animated visit.is monogram loader so navigation feels on-brand and alive.
 */
export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <BrandLoader size={72} caption="Loading" label="Loading" />
    </div>
  )
}
