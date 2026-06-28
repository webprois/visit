"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Upload,
  Loader2,
  Languages,
  ChevronDown,
  Check,
  Star,
  Eye,
  EyeOff,
  Send,
  FileText,
  Sparkles,
  Download,
  MapPin,
  ChevronUp,
  Trash2,
  Plus,
} from "lucide-react"
import { toast } from "sonner"
import {
  saveTourOverride,
  saveTourTranslations,
  setTourFeatured,
  getTourTranslations,
  getTourTranslationContent,
  translateTourContent,
  type TourTranslationInput,
} from "@/app/actions/admin"
import type { MergedTour } from "@/lib/tours"
import type { TourCategory, StartingLocation } from "@/lib/db/schema"
import type { TourTranslation } from "@/lib/bokun"
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, type Locale } from "@/lib/i18n"

type ItineraryStep = { title: string; body: string }

type LangContent = {
  title: string
  excerpt: string
  description: string
  included: string
  excluded: string
  goodToKnow: string
  /** Itinerary steps, edited as structured rows. */
  itinerary: ItineraryStep[]
}

type ContentByLang = Record<Locale, LangContent>

function emptyLang(): LangContent {
  return {
    title: "",
    excerpt: "",
    description: "",
    included: "",
    excluded: "",
    goodToKnow: "",
    itinerary: [],
  }
}

/** Parse a stored itinerary JSON string into clean step rows. */
function parseItinerary(value?: string | null): ItineraryStep[] {
  if (!value?.trim()) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((s) => ({
        title: typeof s?.title === "string" ? s.title : "",
        body: typeof s?.body === "string" ? s.body : "",
      }))
      .filter((s) => s.title || s.body)
  } catch {
    return []
  }
}

/** Serialize itinerary rows to a JSON string, or null when empty. */
function serializeItinerary(steps: ItineraryStep[]): string | null {
  const clean = steps
    .map((s) => ({ title: s.title.trim(), body: s.body.trim() }))
    .filter((s) => s.title || s.body)
  return clean.length > 0 ? JSON.stringify(clean) : null
}

function initialContent(tour: MergedTour): ContentByLang {
  const base = LOCALES.reduce((acc, l) => {
    acc[l] = emptyLang()
    return acc
  }, {} as ContentByLang)
  // Seed English from the existing single-language override values.
  base.en.title = tour.title
  base.en.excerpt = tour.excerpt ?? ""
  base.en.description = tour.description ?? ""
  return base
}

export function TourEditor({
  tour,
  categories,
  locations,
}: {
  tour: MergedTour
  categories: TourCategory[]
  locations: StartingLocation[]
}) {
  const router = useRouter()

  // Per-language editable content.
  const [content, setContent] = useState<ContentByLang>(() =>
    initialContent(tour),
  )
  const [lang, setLang] = useState<Locale>("en")
  const [loadingContent, setLoadingContent] = useState(true)
  const [translating, setTranslating] = useState(false)

  // Shared (language-independent) settings.
  const [location, setLocation] = useState(tour.location)
  const [duration, setDuration] = useState(tour.duration)
  const [difficulty, setDifficulty] = useState(tour.difficulty ?? "")
  const [groupSize, setGroupSize] = useState(tour.groupSize ?? "")
  const [imageUrl, setImageUrl] = useState(tour.image)
  const [categoryIds, setCategoryIds] = useState<number[]>(tour.categoryIds ?? [])
  const [locationIds, setLocationIds] = useState<number[]>(
    tour.locationIds ?? [],
  )
  const [tourType, setTourType] = useState<string>(tour.tourType)
  const [featured, setFeatured] = useState(tour.featured)

  const [uploading, setUploading] = useState(false)
  const [pendingAction, setPendingAction] = useState<
    "save" | "publish" | "unpublish" | null
  >(null)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  // Load any saved per-language content for this tour.
  useEffect(() => {
    let cancelled = false
    setLoadingContent(true)
    getTourTranslationContent(tour.bokunId)
      .then((saved) => {
        if (cancelled) return
        setContent((prev) => {
          const next = { ...prev }
          for (const l of LOCALES) {
            const row = saved[l]
            if (!row) continue
            next[l] = {
              title: row.title ?? next[l].title,
              excerpt: row.excerpt ?? next[l].excerpt,
              description: row.description ?? next[l].description,
              included: row.included ?? "",
              excluded: row.excluded ?? "",
              goodToKnow: row.goodToKnow ?? "",
              itinerary: parseItinerary(row.itinerary),
            }
          }
          return next
        })
      })
      .catch(() => toast.error("Failed to load saved translations"))
      .finally(() => {
        if (!cancelled) setLoadingContent(false)
      })
    return () => {
      cancelled = true
    }
  }, [tour.bokunId])

  function setField(
    field: "title" | "excerpt" | "description" | "included" | "excluded" | "goodToKnow",
    value: string,
  ) {
    setContent((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], [field]: value },
    }))
  }

  function setItinerary(steps: ItineraryStep[]) {
    setContent((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], itinerary: steps },
    }))
  }

  async function handleTranslate() {
    if (lang === "en") return
    const en = content.en
    if (!isLangFilled(en)) {
      toast.error("Add English content first, then translate.")
      return
    }
    setTranslating(true)
    try {
      const result = await translateTourContent(toInput(en), lang)
      setContent((prev) => ({
        ...prev,
        [lang]: {
          title: result.title ?? "",
          excerpt: result.excerpt ?? "",
          description: result.description ?? "",
          included: result.included ?? "",
          excluded: result.excluded ?? "",
          goodToKnow: result.goodToKnow ?? "",
          itinerary: parseItinerary(result.itinerary),
        },
      }))
      toast.success(`Translated to ${LOCALE_LABELS[lang]}. Review, then publish.`)
    } catch {
      toast.error("Translation failed. Please try again.")
    } finally {
      setTranslating(false)
    }
  }

  function toggleCategory(id: number) {
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  function toggleLocation(id: number) {
    setLocationIds((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id],
    )
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/admin/upload", { method: "POST", body: form })
      if (!res.ok) throw new Error("Upload failed")
      const { url } = await res.json()
      setImageUrl(url)
      toast.success("Image uploaded")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  function save(visible: boolean, action: "save" | "publish" | "unpublish") {
    setPendingAction(action)
    const en = content.en
    const byLang: Partial<Record<Locale, TourTranslationInput>> = {}
    for (const l of LOCALES) byLang[l] = toInput(content[l])

    startTransition(async () => {
      // Shared settings + English text mirrored onto the override for cards.
      await saveTourOverride(tour.bokunId, {
        title: en.title,
        excerpt: en.excerpt,
        description: en.description,
        location,
        duration,
        difficulty,
        groupSize,
        imageUrl,
        categoryIds,
        locationIds,
        tourType,
        visible,
      })
      // Full per-language content.
      await saveTourTranslations(tour.bokunId, byLang)
      toast.success(
        action === "publish"
          ? "Tour published"
          : action === "unpublish"
            ? "Tour unpublished"
            : "Changes saved",
      )
      setPendingAction(null)
      router.refresh()
    })
  }

  function toggleFeatured() {
    const next = !featured
    setFeatured(next)
    startTransition(async () => {
      await setTourFeatured(tour.bokunId, next)
      toast.success(next ? "Marked as featured" : "Removed from featured")
      router.refresh()
    })
  }

  const current = content[lang]

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Editor header */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <StatusBadge visible={tour.visible} />
          <span className="text-sm text-muted-foreground">
            Editing <span className="font-medium text-foreground">{tour.title}</span>
          </span>
        </div>
        <Button
          type="button"
          variant={featured ? "default" : "outline"}
          size="sm"
          onClick={toggleFeatured}
          disabled={isPending}
        >
          <Star className={featured ? "size-4 fill-current" : "size-4"} />
          {featured ? "Featured" : "Feature"}
        </Button>
      </div>

      {/* Scrollable editor body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
          {/* Hero image (shared across languages) */}
          <div className="flex flex-col gap-2">
            <Label>Tour image</Label>
            <div className="group relative aspect-[16/7] w-full overflow-hidden rounded-2xl bg-muted">
              <Image
                src={imageUrl || "/placeholder.svg"}
                alt={content.en.title || tour.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 768px"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 transition-opacity group-hover:opacity-100">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Replace image
                </Button>
              </div>
            </div>
          </div>

          {/* Per-language content */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Languages className="size-4 text-primary" aria-hidden="true" />
                Content & translations
              </span>
              {loadingContent && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Language tabs */}
            <div
              role="tablist"
              aria-label="Content language"
              className="flex flex-wrap gap-2"
            >
              {LOCALES.map((l) => {
                const filled = isLangFilled(content[l])
                return (
                  <button
                    key={l}
                    type="button"
                    role="tab"
                    aria-selected={lang === l}
                    onClick={() => setLang(l)}
                    className={
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                      (lang === l
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground")
                    }
                  >
                    {LOCALE_LABELS[l]}
                    {filled && (
                      <span
                        className={
                          "size-1.5 rounded-full " +
                          (lang === l ? "bg-primary-foreground" : "bg-primary")
                        }
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {lang !== "en" && (
              <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Editing the {LOCALE_LABELS[lang]} version. Empty fields fall
                  back to English (or the original Bokun text) on the live site.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTranslate}
                  disabled={translating || isPending}
                  className="shrink-0"
                >
                  {translating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4 text-primary" />
                  )}
                  Translate from English
                </Button>
              </div>
            )}

            {/* Text fields for the active language */}
            <Field label="Title" htmlFor="title">
              <Input
                id="title"
                value={current.title}
                onChange={(e) => setField("title", e.target.value)}
                className="h-11 text-base"
                placeholder={`Title (${LOCALE_SHORT[lang]})`}
              />
            </Field>

            <Field label="Short description" htmlFor="excerpt">
              <Textarea
                id="excerpt"
                value={current.excerpt}
                onChange={(e) => setField("excerpt", e.target.value)}
                rows={2}
                placeholder="One or two lines shown on the tour card"
              />
            </Field>

            <Field label="Full description" htmlFor="description">
              <Textarea
                id="description"
                value={current.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={6}
                placeholder="Detailed description shown on the tour page"
              />
            </Field>

            <ListField
              label="What's included"
              id="included"
              value={current.included}
              onChange={(v) => setField("included", v)}
            />
            <ListField
              label="Not included"
              id="excluded"
              value={current.excluded}
              onChange={(v) => setField("excluded", v)}
            />
            <ListField
              label="Good to know"
              id="goodToKnow"
              value={current.goodToKnow}
              onChange={(v) => setField("goodToKnow", v)}
            />

            <ItineraryField
              steps={current.itinerary}
              onChange={setItinerary}
            />

            {/* Bokun original texts (reference) */}
            <BokunTexts
              bokunId={tour.bokunId}
              activeLangLabel={LOCALE_LABELS[lang]}
              onApply={(field, value, mode) => {
                setContent((prev) => {
                  const existing = prev[lang][field]
                  const next =
                    mode === "append" && existing.trim()
                      ? `${existing.trimEnd()}\n${value}`
                      : value
                  return {
                    ...prev,
                    [lang]: { ...prev[lang], [field]: next },
                  }
                })
                toast.success("Applied")
              }}
              onImportAll={(t) => {
                // Combine Requirements + Important/attention into "good to know".
                const goodToKnow = [t.goodToKnow, t.requirements, t.attention]
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .join("\n")
                setContent((prev) => ({
                  ...prev,
                  [lang]: {
                    title: t.title,
                    excerpt: t.excerpt,
                    description: t.description,
                    included: t.included,
                    excluded: t.excluded,
                    goodToKnow,
                    itinerary: t.itinerary ?? [],
                  },
                }))
                toast.success(`Imported all ${t.lang} texts from Bokun`)
              }}
              onApplyItinerary={(steps) => {
                setItinerary(steps)
                toast.success("Itinerary applied")
              }}
            />
          </div>

          {/* Shared settings */}
          <div className="flex flex-col gap-6 rounded-2xl border border-border p-4">
            <span className="text-sm font-semibold text-foreground">
              Tour settings
            </span>

            {/* Location / Duration */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Location" htmlFor="location">
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="h-11"
                />
              </Field>
              <Field label="Duration" htmlFor="duration">
                <Input
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="h-11"
                />
              </Field>
            </div>

            {/* Difficulty / Group size */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Difficulty" htmlFor="difficulty">
                <Input
                  id="difficulty"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  placeholder="e.g. Easy, Moderate, Challenging"
                  className="h-11"
                />
              </Field>
              <Field label="Group size" htmlFor="groupSize">
                <Input
                  id="groupSize"
                  value={groupSize}
                  onChange={(e) => setGroupSize(e.target.value)}
                  placeholder="e.g. Up to 16 people"
                  className="h-11"
                />
              </Field>
            </div>

            {/* Tour type */}
            <Field label="Tour type">
              <Select value={tourType} onValueChange={(v) => setTourType(v ?? "day")}>
                <SelectTrigger className="h-11">
                  <SelectValue>
                    {(value: string) =>
                      value === "multi-day" ? "Multi-Day Tour" : "Day Tour"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day Tour</SelectItem>
                  <SelectItem value="multi-day">Multi-Day Tour</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {/* Categories */}
            <Field label="Categories">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No categories yet. Create some first.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => {
                    const selected = categoryIds.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCategory(c.id)}
                        aria-pressed={selected}
                        className={
                          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                          (selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground")
                        }
                      >
                        {selected && <Check className="size-3.5" aria-hidden="true" />}
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {categoryIds.length === 0
                  ? "Tap to assign one or more categories."
                  : `${categoryIds.length} selected. The first one is shown as the badge.`}
              </p>
            </Field>

            {/* Starting location */}
            <Field label="Starting location">
              {locations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No starting locations yet. Create them in the Starting
                  Locations section.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {locations.map((loc) => {
                    const selected = locationIds.includes(loc.id)
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => toggleLocation(loc.id)}
                        aria-pressed={selected}
                        className={
                          "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                          (selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground")
                        }
                      >
                        {selected ? (
                          <Check className="size-3.5" aria-hidden="true" />
                        ) : (
                          <MapPin className="size-3.5" aria-hidden="true" />
                        )}
                        {loc.name}
                      </button>
                    )
                  })}
                </div>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {locationIds.length === 0
                  ? "No starting location set. Tap to assign one or more."
                  : `${locationIds.length} selected.`}
              </p>
            </Field>
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card/95 px-6 py-3 backdrop-blur">
        <a
          href={`/tours/${tour.bokunId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Eye className="size-4" />
          Preview
        </a>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => save(tour.visible, "save")}
            disabled={isPending || uploading}
          >
            {pendingAction === "save" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Save
          </Button>
          {tour.visible ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => save(false, "unpublish")}
              disabled={isPending || uploading}
            >
              {pendingAction === "unpublish" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <EyeOff className="size-4" />
              )}
              Unpublish
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => save(true, "publish")}
              disabled={isPending || uploading}
            >
              {pendingAction === "publish" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              Publish
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function isLangFilled(c: LangContent): boolean {
  return Boolean(
    c.title ||
      c.excerpt ||
      c.description ||
      c.included ||
      c.excluded ||
      c.goodToKnow ||
      c.itinerary.length > 0,
  )
}

/** Convert editor state into the server action's input shape. */
function toInput(c: LangContent): TourTranslationInput {
  return {
    title: c.title,
    excerpt: c.excerpt,
    description: c.description,
    included: c.included,
    excluded: c.excluded,
    goodToKnow: c.goodToKnow,
    itinerary: serializeItinerary(c.itinerary),
  }
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function ListField({
  label,
  id,
  value,
  onChange,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
}) {
  const count = value.split("\n").map((l) => l.trim()).filter(Boolean).length
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-xs text-muted-foreground">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder="One item per line"
      />
    </div>
  )
}

function ItineraryField({
  steps,
  onChange,
}: {
  steps: ItineraryStep[]
  onChange: (steps: ItineraryStep[]) => void
}) {
  function update(index: number, patch: Partial<ItineraryStep>) {
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }
  function add() {
    onChange([...steps, { title: "", body: "" }])
  }
  function remove(index: number) {
    onChange(steps.filter((_, i) => i !== index))
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= steps.length) return
    const next = [...steps]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>Itinerary</Label>
        <span className="text-xs text-muted-foreground">
          {steps.length} {steps.length === 1 ? "step" : "steps"}
        </span>
      </div>

      {steps.length > 0 && (
        <div className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <Input
                  value={step.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  placeholder="Step title"
                  className="h-9 flex-1"
                  aria-label={`Itinerary step ${i + 1} title`}
                />
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label="Move step up"
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => move(i, 1)}
                    disabled={i === steps.length - 1}
                    aria-label="Move step down"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => remove(i)}
                    aria-label="Remove step"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                value={step.body}
                onChange={(e) => update(i, { body: e.target.value })}
                rows={2}
                placeholder="Step description"
                aria-label={`Itinerary step ${i + 1} description`}
              />
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="self-start"
      >
        <Plus className="size-4" />
        Add step
      </Button>
    </div>
  )
}

function StatusBadge({ visible }: { visible: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        borderColor: visible ? "var(--chart-3)" : "var(--border)",
        color: visible ? "var(--chart-3)" : "var(--muted-foreground)",
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: visible ? "var(--chart-3)" : "var(--muted-foreground)" }}
        aria-hidden="true"
      />
      {visible ? "Published" : "Draft"}
    </span>
  )
}

function BokunTexts({
  bokunId,
  activeLangLabel,
  onApply,
  onImportAll,
  onApplyItinerary,
}: {
  bokunId: string
  activeLangLabel: string
  onApply: (
    field: "title" | "excerpt" | "description" | "included" | "excluded" | "goodToKnow",
    value: string,
    mode: "replace" | "append",
  ) => void
  onImportAll: (t: TourTranslation) => void
  onApplyItinerary: (steps: ItineraryStep[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [translations, setTranslations] = useState<TourTranslation[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeLang, setActiveLang] = useState<string | null>(null)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && translations === null && !loading) {
      setLoading(true)
      try {
        const data = await getTourTranslations(bokunId)
        setTranslations(data)
        setActiveLang(data[0]?.lang ?? null)
        if (data.length === 0) toast.message("No texts found in Bokun")
      } catch {
        toast.error("Failed to load texts")
      } finally {
        setLoading(false)
      }
    }
  }

  const active = translations?.find((t) => t.lang === activeLang) ?? null
  const baseTranslation = translations?.[0] ?? null
  const fieldsOf = (t: TourTranslation) =>
    [
      t.title,
      t.excerpt,
      t.description,
      t.included,
      t.excluded,
      t.requirements,
      t.attention,
      t.goodToKnow,
    ]
      .map((v) => v.trim())
      .join("\u0001")
  const activeIsEmpty = active
    ? fieldsOf(active) === ["", "", "", "", "", "", "", ""].join("\u0001")
    : false
  const activeSameAsBase =
    active &&
    baseTranslation &&
    active.lang !== baseTranslation.lang &&
    fieldsOf(active) === fieldsOf(baseTranslation)

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Languages className="size-4 text-primary" aria-hidden="true" />
          Original texts from Bokun
        </span>
        <ChevronDown
          className={
            "size-4 text-muted-foreground transition-transform " +
            (open ? "rotate-180" : "")
          }
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading texts from Bokun…
            </div>
          ) : !translations || translations.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              No original texts found.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Reference only. &ldquo;Use&rdquo; copies a single field, or use{" "}
                <span className="font-medium text-foreground">Import all</span> to
                copy every text into the{" "}
                <span className="font-medium text-foreground">{activeLangLabel}</span>{" "}
                fields above.
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {translations.map((t) => (
                    <button
                      key={t.lang}
                      type="button"
                      onClick={() => setActiveLang(t.lang)}
                      className={
                        "rounded-full border px-3 py-1 text-xs font-semibold uppercase transition-colors " +
                        (activeLang === t.lang
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:bg-secondary")
                      }
                    >
                      {t.lang}
                    </button>
                  ))}
                </div>
                {active && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onImportAll(active)}
                  >
                    <Download className="size-4" />
                    Import all
                  </Button>
                )}
              </div>

              {active && (
                <div className="flex flex-col gap-3 text-sm">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                      Showing original {active.lang} texts
                    </p>
                    {activeIsEmpty ? (
                      <p className="text-xs text-muted-foreground">
                        Bokun has no text for this language on this tour.
                      </p>
                    ) : activeSameAsBase ? (
                      <p className="text-xs text-muted-foreground">
                        Identical to {baseTranslation?.lang} &mdash; this language
                        was not separately translated in Bokun.
                      </p>
                    ) : null}
                  </div>
                  <TextField
                    label="Title"
                    value={active.title}
                    onUse={() => onApply("title", active.title, "replace")}
                  />
                  <TextField
                    label="Short description"
                    value={active.excerpt}
                    onUse={() => onApply("excerpt", active.excerpt, "replace")}
                  />
                  <TextField
                    label="Full description"
                    value={active.description}
                    onUse={() => onApply("description", active.description, "replace")}
                  />
                  <TextField
                    label="What's included"
                    value={active.included}
                    onUse={() => onApply("included", active.included, "replace")}
                  />
                  <TextField
                    label="Not included"
                    value={active.excluded}
                    onUse={() => onApply("excluded", active.excluded, "replace")}
                  />
                  <TextField
                    label="Good to know"
                    value={active.goodToKnow}
                    onUse={() => onApply("goodToKnow", active.goodToKnow, "replace")}
                  />
                  <TextField
                    label="Requirements"
                    value={active.requirements}
                    useLabel="Add to good to know"
                    onUse={() =>
                      onApply("goodToKnow", active.requirements, "append")
                    }
                  />
                  <TextField
                    label="Important / attention"
                    value={active.attention}
                    useLabel="Add to good to know"
                    onUse={() => onApply("goodToKnow", active.attention, "append")}
                  />
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Itinerary ({active.itinerary.length}{" "}
                        {active.itinerary.length === 1 ? "step" : "steps"})
                      </span>
                      {active.itinerary.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onApplyItinerary(active.itinerary)}
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Use itinerary
                        </button>
                      )}
                    </div>
                    {active.itinerary.length > 0 ? (
                      <ol className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-md bg-muted px-3 py-2">
                        {active.itinerary.map((step, i) => (
                          <li key={i} className="text-foreground">
                            <span className="font-semibold">
                              {i + 1}. {step.title || "(untitled)"}
                            </span>
                            {step.body && (
                              <p className="mt-0.5 whitespace-pre-wrap leading-relaxed text-muted-foreground">
                                {step.body}
                              </p>
                            )}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="rounded-md bg-muted px-3 py-2 italic text-muted-foreground">
                        (no itinerary)
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TextField({
  label,
  value,
  onUse,
  useLabel = "Use",
}: {
  label: string
  value: string
  onUse?: () => void
  useLabel?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {onUse && value && (
          <button
            type="button"
            onClick={onUse}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {useLabel}
          </button>
        )}
      </div>
      {value ? (
        <p className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted px-3 py-2 leading-relaxed text-foreground">
          {value}
        </p>
      ) : (
        <p className="rounded-md bg-muted px-3 py-2 italic text-muted-foreground">
          (empty)
        </p>
      )}
    </div>
  )
}
