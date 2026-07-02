import Image from "next/image"
import { Star } from "lucide-react"
import type { GooglePlaceReviews } from "@/lib/google-reviews"
import { getServerDict } from "@/lib/get-dictionary"
import { fmt } from "@/lib/translations"

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={
            i < Math.round(rating)
              ? "size-4 fill-primary text-primary"
              : "size-4 text-muted-foreground/40"
          }
        />
      ))}
    </div>
  )
}

export async function GoogleReviews({ data }: { data: GooglePlaceReviews }) {
  const dict = await getServerDict()
  return (
    <section id="reviews" className="bg-secondary/50 py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mb-10 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-heading text-sm font-bold uppercase tracking-wider text-primary">
              {dict.reviews.eyebrow}
            </p>
            <h2 className="mt-2 max-w-xl text-balance font-heading text-3xl font-extrabold text-foreground md:text-4xl">
              {dict.reviews.title}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <Image
              src="/brand/google.svg"
              alt="Google"
              width={28}
              height={28}
              className="size-7"
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-heading text-2xl font-extrabold text-foreground">
                  {data.rating.toFixed(1)}
                </span>
                <Stars rating={data.rating} />
              </div>
              <span className="text-sm text-muted-foreground">
                {fmt(dict.reviews.count, { count: data.total.toLocaleString() })}
              </span>
            </div>
          </div>
        </div>

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {data.reviews.map((review, i) => (
            <li
              key={i}
              className="flex flex-col gap-4 rounded-2xl bg-[#1E2738] p-6 shadow-sm"
            >
              <Stars rating={review.rating} />
              <p className="flex-1 text-pretty leading-relaxed text-muted-foreground">
                {review.text}
              </p>
              <div className="flex items-center gap-3">
                {review.authorPhotoUrl ? (
                  <Image
                    src={review.authorPhotoUrl || "/placeholder.svg"}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/20 font-heading text-sm font-bold text-primary">
                    {review.authorName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {review.authorName}
                  </span>
                  {review.relativeTime ? (
                    <span className="text-sm text-muted-foreground">
                      {review.relativeTime}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>

        {data.url ? (
          <div className="mt-10 flex justify-center">
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#1E2738] px-6 py-3 font-medium text-foreground transition-colors hover:bg-[#242f44]"
            >
              <Image
                src="/brand/google.svg"
                alt=""
                width={20}
                height={20}
                className="size-5"
              />
              Read all reviews on Google
            </a>
          </div>
        ) : null}
      </div>
    </section>
  )
}
