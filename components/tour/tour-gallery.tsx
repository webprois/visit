"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react"

/**
 * Premium tour gallery: one large featured image with up to four supporting
 * thumbnails, plus a full-screen lightbox with keyboard arrows and mobile
 * swipe support. Falls back gracefully when only a single image exists.
 */
export function TourGallery({
  images,
  alts,
  title,
}: {
  images: string[]
  /** Optional per-image alt text, parallel to `images`. */
  alts?: (string | null)[]
  title: string
}) {
  const photos = images.filter(Boolean)
  // Resolve alt text for a photo: curated alt → a sensible generated default.
  const altFor = (i: number) =>
    alts?.[i]?.trim() || `${title} photo ${i + 1}`
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const show = useCallback(
    (i: number) => {
      setIndex((i + photos.length) % photos.length)
    },
    [photos.length],
  )

  const openAt = useCallback((i: number) => {
    setIndex(i)
    setOpen(true)
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
      if (e.key === "ArrowRight") show(index + 1)
      if (e.key === "ArrowLeft") show(index - 1)
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, index, show])

  if (photos.length === 0) return null

  const featured = photos[0]
  const thumbs = photos.slice(1, 5)
  const remaining = photos.length - 5

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        {/* Featured */}
        <button
          type="button"
          onClick={() => openAt(0)}
          className="group relative aspect-[4/3] overflow-hidden rounded-2xl sm:aspect-[16/11]"
          aria-label={`Open ${title} photo 1 in full screen`}
        >
          <Image
            src={featured || "/placeholder.svg"}
            alt={altFor(0)}
            fill
            priority
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, 66vw"
          />
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground backdrop-blur">
            <Expand className="size-3.5" aria-hidden="true" />
            {photos.length} photos
          </span>
        </button>

        {/* Thumbnails */}
        {thumbs.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
            {thumbs.map((src, i) => {
              const photoIndex = i + 1
              const isLast = i === thumbs.length - 1 && remaining > 0
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => openAt(photoIndex)}
                  className="group relative aspect-[4/3] overflow-hidden rounded-xl sm:aspect-auto sm:h-full"
                  aria-label={`Open ${title} photo ${photoIndex + 1} in full screen`}
                >
                  <Image
                    src={src || "/placeholder.svg"}
                    alt={altFor(photoIndex)}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                  {isLast && (
                    <span className="absolute inset-0 flex items-center justify-center bg-background/70 text-base font-bold text-foreground backdrop-blur-sm">
                      +{remaining} more
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} photo gallery`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur"
          onClick={() => setOpen(false)}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0]?.clientX ?? null
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return
            const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current
            if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1))
            touchStartX.current = null
          }}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close gallery"
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary"
          >
            <X className="size-5" aria-hidden="true" />
          </button>

          <div
            className="relative mx-auto flex h-full w-full max-w-5xl items-center justify-center px-4 py-16"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-full w-full">
              <Image
                src={photos[index] || "/placeholder.svg"}
                alt={altFor(index)}
                fill
                className="object-contain"
                sizes="100vw"
              />
            </div>

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => show(index - 1)}
                  aria-label="Previous photo"
                  className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary"
                >
                  <ChevronLeft className="size-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => show(index + 1)}
                  aria-label="Next photo"
                  className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:bg-secondary"
                >
                  <ChevronRight className="size-5" aria-hidden="true" />
                </button>
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-card px-3 py-1 text-sm font-medium text-muted-foreground">
                  {index + 1} / {photos.length}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
