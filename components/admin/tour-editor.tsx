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
  FlaskConical,
  Download,
  MapPin,
  ChevronUp,
  Trash2,
  Plus,
  Search,
  Globe,
} from "lucide-react"
import { toast } from "sonner"
import {
  saveTourOverride,
  saveTourTranslations,
  setTourFeatured,
  setTourHidden,
  getTourTranslations,
  getTourTranslationContent,
  getBokunGallery,
  translateTourContent,
  generateTourExcerpt,
  generateFullTourContent,
  generateTourItinerary,
  generateTourField,
  type GeneratableField,
  type TourTranslationInput,
} from "@/app/actions/admin"
import { LocationPicker } from "@/components/admin/location-picker"
import type { MergedTour, GalleryImage } from "@/lib/tours"
import type { TourCategory, StartingLocation, MapStop } from "@/lib/db/schema"
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
  whatToBring: string
  importantInfo: string
  /** Itinerary steps, edited as structured rows. */
  itinerary: ItineraryStep[]
}

type ContentByLang = Record<Locale, LangContent>

/** Display labels for each tour type value. */
const TOUR_TYPE_LABELS: Record<string, string> = {
  day: "Day Tour",
  "multi-day": "Multi-Day Tour",
  admission: "Admission",
  transfer: "Transfer",
}

type EditorTab =
  | "content"
  | "categories"
  | "locations"
  | "images"
  | "map"
  | "seo"

const EDITOR_TABS: { id: EditorTab; label: string; soon?: boolean }[] = [
  { id: "content", label: "Content" },
  { id: "categories", label: "Categories" },
  { id: "locations", label: "Starting Location" },
  { id: "images", label: "Images" },
  { id: "map", label: "Map" },
  { id: "seo", label: "SEO", soon: true },
]

function emptyLang(): LangContent {
  return {
    title: "",
    excerpt: "",
    description: "",
    included: "",
    excluded: "",
    goodToKnow: "",
    whatToBring: "",
    importantInfo: "",
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
  onStatusChange,
}: {
  tour: MergedTour
  categories: TourCategory[]
  locations: StartingLocation[]
  /** Notifies the parent list so status changes reflect instantly, without
   *  waiting for the server round-trip from router.refresh(). */
  onStatusChange?: (
    bokunId: string,
    patch: Partial<Pick<MergedTour, "visible" | "hidden" | "featured">>,
  ) => void
}) {
  const router = useRouter()

  // Per-language editable content.
  const [content, setContent] = useState<ContentByLang>(() =>
    initialContent(tour),
  )
  const [lang, setLang] = useState<Locale>("en")
  const [loadingContent, setLoadingContent] = useState(true)
  const [translating, setTranslating] = useState(false)
  const [generatingExcerpt, setGeneratingExcerpt] = useState(false)
  const [generatingFull, setGeneratingFull] = useState(false)
  const [generatingItinerary, setGeneratingItinerary] = useState(false)
  // Which individual content field is currently generating with AI, if any.
  const [generatingField, setGeneratingField] = useState<GeneratableField | null>(
    null,
  )

  // Shared (language-independent) settings.
  const [duration, setDuration] = useState(tour.duration)
  const [difficulty, setDifficulty] = useState(tour.difficulty ?? "")
  const [groupSize, setGroupSize] = useState(tour.groupSize ?? "")
  const [imageUrl] = useState(tour.image)
  // Curated gallery (first item is the hero used on cards/gallery).
  const [gallery, setGallery] = useState<GalleryImage[]>(tour.gallery ?? [])
  const [galleryUploading, setGalleryUploading] = useState(false)
  // Original Bokun photos, loaded lazily when the Images tab is first opened.
  const [bokunGallery, setBokunGallery] = useState<string[] | null>(null)
  const [loadingBokun, setLoadingBokun] = useState(false)
  const [categoryIds, setCategoryIds] = useState<number[]>(tour.categoryIds ?? [])
  const [locationIds, setLocationIds] = useState<number[]>(
    tour.locationIds ?? [],
  )
  const [tourType, setTourType] = useState<string>(tour.tourType)
  const [featured, setFeatured] = useState(tour.featured)
  const [hidden, setHidden] = useState(tour.hidden)
  // Publish state kept locally so the badge/button update instantly on save.
  const [visible, setVisible] = useState(tour.visible)
  // Map: ordered route stops (single stop = simple location) and visibility.
  // Seed from stored stops, falling back to a single legacy coordinate.
  const [mapStops, setMapStops] = useState<MapStop[]>(() => {
    if (tour.mapStops && tour.mapStops.length > 0) return tour.mapStops
    if (tour.mapLat != null && tour.mapLng != null)
      return [{ name: "", lat: tour.mapLat, lng: tour.mapLng }]
    return []
  })
  const [showOnMap, setShowOnMap] = useState<boolean>(tour.showOnMap ?? true)

  const [uploading] = useState(false)
  const [pendingAction, setPendingAction] = useState<
    "save" | "publish" | "unpublish" | null
  >(null)
  const [isPending, startTransition] = useTransition()
  const galleryFileRef = useRef<HTMLInputElement>(null)

  // Editor chrome: active tab, dirty tracking, last-saved time, category search.
  const [tab, setTab] = useState<EditorTab>("content")
  const [dirty, setDirty] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [categorySearch, setCategorySearch] = useState("")
  const markDirty = () => setDirty(true)

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
              whatToBring: row.whatToBring ?? "",
              importantInfo: row.importantInfo ?? "",
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

  // Lazily load the original Bokun photos the first time the Images tab opens.
  // We key the request to the tour id via a ref so it runs once per tour and
  // — crucially — does NOT depend on the loading/result state, which would
  // otherwise make the effect cancel the very request it just started.
  const loadedBokunFor = useRef<string | null>(null)
  useEffect(() => {
    if (tab !== "images") return
    if (loadedBokunFor.current === tour.bokunId) return
    loadedBokunFor.current = tour.bokunId
    setLoadingBokun(true)
    getBokunGallery(tour.bokunId)
      .then((urls) => setBokunGallery(urls))
      .catch(() => setBokunGallery([]))
      .finally(() => setLoadingBokun(false))
  }, [tab, tour.bokunId])

  function setField(
    field:
      | "title"
      | "excerpt"
      | "description"
      | "included"
      | "excluded"
      | "goodToKnow"
      | "whatToBring"
      | "importantInfo",
    value: string,
  ) {
    markDirty()
    setContent((prev) => ({
      ...prev,
      [lang]: { ...prev[lang], [field]: value },
    }))
  }

  function setItinerary(steps: ItineraryStep[]) {
    markDirty()
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
      markDirty()
      setContent((prev) => ({
        ...prev,
        [lang]: {
          title: result.title ?? "",
          excerpt: result.excerpt ?? "",
          description: result.description ?? "",
          included: result.included ?? "",
          excluded: result.excluded ?? "",
          goodToKnow: result.goodToKnow ?? "",
          whatToBring: result.whatToBring ?? "",
          importantInfo: result.importantInfo ?? "",
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

  async function handleGenerateExcerpt() {
    const source = content[lang]
    // Fall back to English content/title so we still have something to work from
    // when editing an empty translation.
    const title = source.title || content.en.title || tour.title
    const description =
      source.description || content.en.description || tour.description || ""
    const categoryNames = categories
      .filter((c) => categoryIds.includes(c.id))
      .map((c) => c.name)
    const locationName =
      locations.find((l) => l.id === locationIds[0])?.name ||
      tour.location ||
      ""

    if (!title && !description && categoryNames.length === 0) {
      toast.error("Add a title or description first, then generate.")
      return
    }

    setGeneratingExcerpt(true)
    try {
      const excerpt = await generateTourExcerpt(
        {
          title,
          description,
          duration,
          difficulty,
          groupSize,
          location: locationName,
          categories: categoryNames,
        },
        lang,
      )
      if (!excerpt) {
        toast.error("Couldn't generate a description. Try again.")
        return
      }
      markDirty()
      setContent((prev) => ({
        ...prev,
        [lang]: { ...prev[lang], excerpt },
      }))
      toast.success("Short description generated. Review, then save.")
    } catch {
      toast.error("Generation failed. Please try again.")
    } finally {
      setGeneratingExcerpt(false)
    }
  }

  /**
   * TESTING FEATURE: fill in every content field for the active language with an
   * AI-generated draft based on the tour's basic details. Overwrites the current
   * language's content, so it must be reviewed before publishing.
   */
  /** Build the basic tour details AI uses as its source, or null when there's
   *  not enough to work with. */
  function buildAiSource() {
    const source = content[lang]
    const title = source.title || content.en.title || tour.title
    const description =
      source.description || content.en.description || tour.description || ""
    const categoryNames = categories
      .filter((c) => categoryIds.includes(c.id))
      .map((c) => c.name)
    const locationName =
      locations.find((l) => l.id === locationIds[0])?.name || tour.location || ""

    if (!title && !description && categoryNames.length === 0) return null

    return {
      title,
      description,
      duration,
      difficulty,
      groupSize,
      location: locationName,
      categories: categoryNames,
    }
  }

  async function handleGenerateAllContent() {
    const source = buildAiSource()
    if (!source) {
      toast.error("Add a title or some details first, then generate.")
      return
    }

    setGeneratingFull(true)
    try {
      const result = await generateFullTourContent(source, lang)
      markDirty()
      setContent((prev) => ({
        ...prev,
        [lang]: {
          title: result.title ?? "",
          excerpt: result.excerpt ?? "",
          description: result.description ?? "",
          included: result.included ?? "",
          excluded: result.excluded ?? "",
          goodToKnow: result.goodToKnow ?? "",
          whatToBring: result.whatToBring ?? "",
          importantInfo: result.importantInfo ?? "",
          itinerary: parseItinerary(result.itinerary),
        },
      }))
      toast.success(
        `Draft content generated for ${LOCALE_LABELS[lang]}. Review, then save.`,
      )
    } catch (err) {
      console.log("[v0] generate all content error:", err)
      toast.error(
        err instanceof Error && err.message
          ? `Generation failed: ${err.message}`
          : "Generation failed. Please try again.",
      )
    } finally {
      setGeneratingFull(false)
    }
  }

  /**
   * TESTING FEATURE: generate just the itinerary steps for the active language
   * from the tour's basic details. Overwrites the current itinerary, so it must
   * be reviewed before publishing.
   */
  async function handleGenerateItinerary() {
    const source = buildAiSource()
    if (!source) {
      toast.error("Add a title or some details first, then generate.")
      return
    }

    setGeneratingItinerary(true)
    try {
      const result = await generateTourItinerary(source, lang)
      const steps = parseItinerary(result)
      if (steps.length === 0) {
        toast.error("No itinerary could be generated. Please try again.")
        return
      }
      setItinerary(steps)
      toast.success(
        `Itinerary generated for ${LOCALE_LABELS[lang]}. Review, then save.`,
      )
    } catch (err) {
      console.log("[v0] generate itinerary error:", err)
      toast.error(
        err instanceof Error && err.message
          ? `Generation failed: ${err.message}`
          : "Generation failed. Please try again.",
      )
    } finally {
      setGeneratingItinerary(false)
    }
  }

  /**
   * TESTING FEATURE: generate a single content field (description, list, or
   * important info) for the active language from the tour's basic details.
   * Overwrites just that field, so it must be reviewed before publishing.
   */
  async function handleGenerateField(field: GeneratableField, label: string) {
    const source = buildAiSource()
    if (!source) {
      toast.error("Add a title or some details first, then generate.")
      return
    }

    setGeneratingField(field)
    try {
      const value = await generateTourField(source, field, lang)
      if (!value) {
        toast.error("Couldn't generate content. Try again.")
        return
      }
      markDirty()
      setContent((prev) => ({
        ...prev,
        [lang]: { ...prev[lang], [field]: value },
      }))
      toast.success(`${label} generated for ${LOCALE_LABELS[lang]}. Review, then save.`)
    } catch (err) {
      console.log("[v0] generate field error:", err)
      toast.error(
        err instanceof Error && err.message
          ? `Generation failed: ${err.message}`
          : "Generation failed. Please try again.",
      )
    } finally {
      setGeneratingField(null)
    }
  }

  function toggleCategory(id: number) {
    markDirty()
    setCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  function toggleLocation(id: number) {
    markDirty()
    // Single-select: choosing a location replaces the current one; tapping the
    // selected one again clears it.
    setLocationIds((prev) => (prev[0] === id ? [] : [id]))
  }

  /* ---------------- Gallery management ---------------- */

  /** Append photo URLs that aren't already in the gallery. */
  function addToGallery(urls: string[]) {
    const have = new Set(gallery.map((g) => g.url))
    const additions = urls
      .filter((u) => u && !have.has(u))
      .map((url) => ({ url, alt: null as string | null }))
    if (additions.length === 0) return
    markDirty()
    setGallery((prev) => [...prev, ...additions])
  }

  /** Upload one or more custom images and append them to the gallery. */
  async function handleGalleryUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (files.length === 0) return
    setGalleryUploading(true)
    try {
      const urls: string[] = []
      for (const file of files) {
        const form = new FormData()
        form.append("file", file)
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: form,
        })
        if (!res.ok) throw new Error("Upload failed")
        const { url } = await res.json()
        urls.push(url)
      }
      addToGallery(urls)
      toast.success(
        files.length > 1 ? `${files.length} images uploaded` : "Image uploaded",
      )
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setGalleryUploading(false)
    }
  }

  function moveImage(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= gallery.length) return
    markDirty()
    setGallery((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function makeHero(index: number) {
    if (index === 0) return
    markDirty()
    setGallery((prev) => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.unshift(item)
      return next
    })
  }

  function removeImage(index: number) {
    markDirty()
    setGallery((prev) => prev.filter((_, i) => i !== index))
  }

  function setAlt(index: number, alt: string) {
    markDirty()
    setGallery((prev) =>
      prev.map((g, i) => (i === index ? { ...g, alt: alt || null } : g)),
    )
  }

  function save(visible: boolean, action: "save" | "publish" | "unpublish") {
    setPendingAction(action)
    // Reflect the new publish state immediately in the editor + parent list.
    setVisible(visible)
    onStatusChange?.(tour.bokunId, { visible })
    const en = content.en
    const byLang: Partial<Record<Locale, TourTranslationInput>> = {}
    for (const l of LOCALES) byLang[l] = toInput(content[l])

    // The first gallery image is the hero used on cards and the gallery.
    const heroUrl = gallery[0]?.url || imageUrl

    startTransition(async () => {
      // Shared settings + English text mirrored onto the override for cards.
      await saveTourOverride(tour.bokunId, {
        title: en.title,
        excerpt: en.excerpt,
        description: en.description,
        // Location label is driven by the selected starting location, falling
        // back to the tour's existing value when none is assigned.
        location:
          locations.find((l) => l.id === locationIds[0])?.name ?? tour.location,
        duration,
        difficulty,
        groupSize,
        imageUrl: heroUrl,
        gallery,
        categoryIds,
        locationIds,
        tourType,
        visible,
        mapStops,
        showOnMap,
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
      setDirty(false)
      setLastSaved(new Date())
      router.refresh()
    })
  }

  function toggleFeatured() {
    const next = !featured
    setFeatured(next)
    onStatusChange?.(tour.bokunId, { featured: next })
    startTransition(async () => {
      await setTourFeatured(tour.bokunId, next)
      toast.success(next ? "Marked as featured" : "Removed from featured")
      router.refresh()
    })
  }

  function toggleHidden() {
    const next = !hidden
    setHidden(next)
    onStatusChange?.(tour.bokunId, { hidden: next })
    startTransition(async () => {
      await setTourHidden(tour.bokunId, next)
      toast.success(next ? "Tour hidden" : "Tour restored")
      router.refresh()
    })
  }

  const current = content[lang]

  // Language selector shown on content-editing tabs.
  const languageBar = (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Content language"
        className="flex flex-wrap items-center gap-2"
      >
        {LOCALES.map((l) => {
          const complete = isLangComplete(content[l])
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              title={
                complete
                  ? "All content filled in"
                  : "Missing content for this language"
              }
              className={
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors " +
                (lang === l
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground")
              }
            >
              {LOCALE_LABELS[l]}
              <span
                className={
                  "size-2 rounded-full ring-1 ring-inset ring-black/10 " +
                  (complete ? "bg-emerald-500" : "bg-red-500")
                }
                aria-hidden="true"
              />
            </button>
          )
        })}
        {loadingContent && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {lang !== "en" && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Editing the {LOCALE_LABELS[lang]} version only. Translating fills in
            just this language from the English content. Empty fields fall back
            to English (or the original Bokun text) on the live site.
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
            Translate {LOCALE_LABELS[lang]} from English
          </Button>
        </div>
      )}
    </div>
  )

  // Categories tab: searchable category + starting-location selection.
  const lowerSearch = categorySearch.trim().toLowerCase()
  const filteredCategories = lowerSearch
    ? categories.filter((c) => c.name.toLowerCase().includes(lowerSearch))
    : categories
  const categoriesNode = (
    <div className="flex flex-col gap-6">
      <Field label="Categories">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No categories yet. Create some first.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search categories"
                className="h-10 pl-9"
              />
            </div>
            {filteredCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No categories match &ldquo;{categorySearch}&rdquo;.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredCategories.map((c) => {
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
          </div>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          {categoryIds.length === 0
            ? "Tap to assign one or more categories."
            : `${categoryIds.length} selected. The first one is shown as the badge.`}
        </p>
      </Field>
    </div>
  )

  // Starting location tab: single-select location that also drives the label.
  const locationsNode = (
    <div className="flex flex-col gap-6">
      <Field label="Starting location">
        {locations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No starting locations yet. Create them in the Starting Locations
            section.
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
            ? "No starting location set. Tap one to assign it. This also sets the tour's location label."
            : "This location is also shown as the tour's location label."}
        </p>
      </Field>
    </div>
  )

  // Import original texts from Bokun into the active language (English by
  // default). Shown at the bottom of the Content tab.
  const bokunImportNode = (
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
        markDirty()
        toast.success("Applied")
      }}
      onImportAll={(t) => {
        setContent((prev) => ({
          ...prev,
          [lang]: {
            title: t.title,
            excerpt: t.excerpt,
            description: t.description,
            included: t.included,
            excluded: t.excluded,
            goodToKnow: t.goodToKnow,
            whatToBring: t.requirements,
            importantInfo: t.attention,
            itinerary: t.itinerary ?? [],
          },
        }))
        markDirty()
        toast.success(`Imported all ${t.lang} texts from Bokun`)
      }}
      onApplyItinerary={(steps) => {
        setItinerary(steps)
        toast.success("Itinerary applied")
      }}
    />
  )

  // Sticky settings panel (right rail on desktop, inline on mobile).
  const settingsPanel = (
    <div className="flex flex-col gap-5 p-5">
      <span className="text-sm font-semibold text-foreground">Tour settings</span>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Status
        </span>
        <div className="flex items-center justify-between gap-2">
          <StatusBadge visible={visible} />
          <div className="flex items-center gap-2">
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
            <Button
              type="button"
              variant={hidden ? "default" : "outline"}
              size="sm"
              onClick={toggleHidden}
              disabled={isPending}
            >
              <EyeOff className="size-4" />
              {hidden ? "Hidden" : "Hide"}
            </Button>
          </div>
        </div>
      </div>

      <Field label="Tour type">
        <Select
          value={tourType}
          onValueChange={(v) => {
            markDirty()
            setTourType(v ?? "day")
          }}
        >
          <SelectTrigger className="h-11 w-full">
            <SelectValue>
              {(value: string) => TOUR_TYPE_LABELS[value] ?? "Day Tour"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Day Tour</SelectItem>
            <SelectItem value="multi-day">Multi-Day Tour</SelectItem>
            <SelectItem value="admission">Admission</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Difficulty">
        <Select
          value={difficulty || undefined}
          onValueChange={(v) => {
            markDirty()
            setDifficulty(v ?? "")
          }}
        >
          <SelectTrigger className="h-11 w-full">
            <SelectValue placeholder="Select difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Easy">Easy</SelectItem>
            <SelectItem value="Moderate">Moderate</SelectItem>
            <SelectItem value="Challenging">Challenging</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Duration" htmlFor="duration">
        <Input
          id="duration"
          value={duration}
          onChange={(e) => {
            markDirty()
            setDuration(e.target.value)
          }}
          className="h-11"
        />
      </Field>

      <Field label="Group size" htmlFor="groupSize">
        <Input
          id="groupSize"
          value={groupSize}
          onChange={(e) => {
            markDirty()
            setGroupSize(e.target.value)
          }}
          placeholder="e.g. Up to 16 people"
          className="h-11"
        />
      </Field>

      <div className="flex flex-col gap-1.5 border-t border-border pt-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Categories
        </span>
        <p className="text-sm text-muted-foreground">
          {categoryIds.length === 0
            ? "None selected"
            : `${categoryIds.length} selected`}
        </p>
        <button
          type="button"
          onClick={() => setTab("categories")}
          className="self-start text-xs font-semibold text-primary hover:underline"
        >
          Edit categories
        </button>
      </div>
    </div>
  )

  let tabContent: React.ReactNode = null
  switch (tab) {
    case "map":
      tabContent = (
        <LocationPicker
          stops={mapStops}
          showOnMap={showOnMap}
          onChangeStops={(next) => {
            markDirty()
            setMapStops(next)
          }}
          onToggleShow={(value) => {
            markDirty()
            setShowOnMap(value)
          }}
        />
      )
      break
    case "content":
      tabContent = (
        <>
          {languageBar}
          <Field label="Title" htmlFor="title">
            <Input
              id="title"
              value={current.title}
              onChange={(e) => setField("title", e.target.value)}
              className="h-11 text-base"
              placeholder={`Title (${LOCALE_SHORT[lang]})`}
            />
          </Field>
          <Field
            label="Short description"
            htmlFor="excerpt"
            action={
              <GenerateAiButton
                onClick={handleGenerateExcerpt}
                generating={generatingExcerpt}
                disabled={isPending}
              />
            }
          >
            <Textarea
              id="excerpt"
              value={current.excerpt}
              onChange={(e) => setField("excerpt", e.target.value)}
              rows={2}
              placeholder="One or two lines shown on the tour card"
            />
          </Field>
          <div className="flex flex-col gap-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <FlaskConical className="size-4.5" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    Fill all content with AI
                  </span>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Testing
                  </span>
                </div>
                <p className="max-w-prose text-xs leading-relaxed text-muted-foreground">
                  {`Generates a full draft (description, lists, and itinerary) in ${LOCALE_LABELS[lang]} from this tour's details. It may make assumptions and overwrites the current content, so always review before publishing.`}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={handleGenerateAllContent}
              disabled={generatingFull}
            >
              {generatingFull ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4 text-primary" />
              )}
              {generatingFull ? "Generating…" : "Generate all content"}
            </Button>
          </div>
          <Field
            label="Full description"
            htmlFor="description"
            action={
              <GenerateAiButton
                onClick={() =>
                  handleGenerateField("description", "Full description")
                }
                generating={generatingField === "description"}
              />
            }
          >
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
            onGenerate={() => handleGenerateField("included", "What's included")}
            generating={generatingField === "included"}
          />
          <ListField
            label="Not included"
            id="excluded"
            value={current.excluded}
            onChange={(v) => setField("excluded", v)}
            onGenerate={() => handleGenerateField("excluded", "Not included")}
            generating={generatingField === "excluded"}
          />
          <ListField
            label="What to bring"
            id="whatToBring"
            value={current.whatToBring}
            onChange={(v) => setField("whatToBring", v)}
            onGenerate={() => handleGenerateField("whatToBring", "What to bring")}
            generating={generatingField === "whatToBring"}
          />
          <ListField
            label="Good to know"
            id="goodToKnow"
            value={current.goodToKnow}
            onChange={(v) => setField("goodToKnow", v)}
            onGenerate={() => handleGenerateField("goodToKnow", "Good to know")}
            generating={generatingField === "goodToKnow"}
          />
          <Field
            label="Important information"
            htmlFor="importantInfo"
            action={
              <GenerateAiButton
                onClick={() =>
                  handleGenerateField("importantInfo", "Important information")
                }
                generating={generatingField === "importantInfo"}
              />
            }
          >
            <Textarea
              id="importantInfo"
              value={current.importantInfo}
              onChange={(e) => setField("importantInfo", e.target.value)}
              rows={6}
              placeholder="Important notes travellers must read (safety, requirements, restrictions). Leave empty to use the original Bokun text. Separate distinct points with a blank line."
            />
          </Field>
              <ItineraryField
                steps={current.itinerary}
                onChange={setItinerary}
                onGenerate={handleGenerateItinerary}
                generating={generatingItinerary}
              />
          {lang === "en" && bokunImportNode}
        </>
      )
      break
    case "categories":
      tabContent = categoriesNode
      break
    case "locations":
      tabContent = locationsNode
      break
    case "images":
      tabContent = (
        <div className="flex flex-col gap-6">
          {/* Curated gallery */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Gallery
              </h3>
              <p className="text-xs text-muted-foreground">
                The first photo is the hero shown on cards and at the top of
                the gallery. Reorder with the arrows.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={galleryUploading}
              onClick={() => galleryFileRef.current?.click()}
            >
              {galleryUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Upload
            </Button>
            <input
              ref={galleryFileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleGalleryUpload}
            />
          </div>

          {gallery.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No images yet. Upload your own, or import the original photos
              from Bokun below.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {gallery.map((img, i) => (
                <li
                  key={img.url}
                  className="flex gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <Image
                      src={img.url || "/placeholder.svg"}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                    {i === 0 && (
                      <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        <Star className="size-3" aria-hidden="true" /> Hero
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Input
                      value={img.alt ?? ""}
                      onChange={(e) => setAlt(i, e.target.value)}
                      placeholder="Alt text (describe the photo for accessibility)"
                      className="h-9"
                    />
                    <div className="flex flex-wrap items-center gap-1">
                      {i !== 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => makeHero(i)}
                        >
                          <Star className="size-4" /> Make hero
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={i === 0}
                        onClick={() => moveImage(i, -1)}
                        aria-label="Move up"
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={i === gallery.length - 1}
                        onClick={() => moveImage(i, 1)}
                        aria-label="Move down"
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeImage(i)}
                        className="text-destructive hover:text-destructive"
                        aria-label="Remove image"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Import from Bokun */}
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Original photos from Bokun
              </h3>
              {bokunGallery && bokunGallery.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addToGallery(bokunGallery)}
                >
                  <Download className="size-4" /> Add all
                </Button>
              )}
            </div>
            {loadingBokun ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading Bokun
                photos…
              </div>
            ) : !bokunGallery || bokunGallery.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No photos found on Bokun for this tour.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {bokunGallery.map((url) => {
                  const used = gallery.some((g) => g.url === url)
                  return (
                    <button
                      key={url}
                      type="button"
                      disabled={used}
                      onClick={() => addToGallery([url])}
                      className={
                        "group relative aspect-square overflow-hidden rounded-lg border transition-colors " +
                        (used
                          ? "border-primary opacity-60"
                          : "border-border hover:border-primary")
                      }
                      aria-label={used ? "Already in gallery" : "Add photo"}
                    >
                      <Image
                        src={url || "/placeholder.svg"}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="120px"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-background/0 transition-colors group-hover:bg-background/30">
                        {used ? (
                          <Check className="size-5 text-primary" />
                        ) : (
                          <Plus className="size-5 text-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )
      break
    case "seo":
      tabContent = (
        <ComingSoon
          icon={Globe}
          title="SEO settings"
          desc="Custom URL slug, meta title and description, and social share previews. Coming in the next phase."
        />
      )
      break
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Editor header */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-border px-6 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusBadge visible={visible} />
            <span className="text-sm text-muted-foreground">
              Editing{" "}
              <span className="font-medium text-foreground">{tour.title}</span>
            </span>
          </div>
        </div>
        {/* Section tabs */}
        <div
          role="tablist"
          aria-label="Editor sections"
          className="-mb-px flex flex-wrap gap-1 overflow-x-auto"
        >
          {EDITOR_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors " +
                (tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
              {t.soon && (
                <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                  Soon
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Body: main editor + settings rail */}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
            {tabContent}
            {/* Settings shown inline on small screens where the rail is hidden */}
            <div className="border-t border-border lg:hidden">
              {settingsPanel}
            </div>
          </div>
        </div>
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border lg:block">
          {settingsPanel}
        </aside>
      </div>


      {/* Sticky action bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <a
            href={`/tours/${tour.bokunId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Eye className="size-4" />
            Preview
          </a>
          <SaveStatus dirty={dirty} lastSaved={lastSaved} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => save(visible, "save")}
            disabled={isPending || uploading}
          >
            {pendingAction === "save" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileText className="size-4" />
            )}
            Save
          </Button>
          {visible ? (
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
      c.whatToBring ||
      c.importantInfo ||
      c.itinerary.length > 0,
  )
}

/** True when the Overview essentials (title + short description) are present
 *  for a language, so the status dot can go green. The full description on the
 *  Content tab is not required. Missing either keeps it red. */
function isLangComplete(c: LangContent): boolean {
  return Boolean(c.title.trim() && c.excerpt.trim())
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
    whatToBring: c.whatToBring,
    importantInfo: c.importantInfo,
    itinerary: serializeItinerary(c.itinerary),
  }
}

/**
 * TESTING FEATURE: shared "Generate with AI" button used across content fields.
 * Shows a spinner while generating and a "Testing" badge to flag the feature.
 */
function GenerateAiButton({
  onClick,
  generating,
  disabled,
}: {
  onClick: () => void
  generating?: boolean
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={generating || disabled}
      className="h-7 shrink-0 px-2.5 text-xs"
    >
      {generating ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Sparkles className="size-3.5 text-primary" />
      )}
      {generating ? "Generating…" : "Generate with AI"}
      <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
        Testing
      </span>
    </Button>
  )
}

function Field({
  label,
  htmlFor,
  action,
  children,
}: {
  label: string
  htmlFor?: string
  /** Optional control (e.g. a Generate with AI button) shown next to the label. */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {action}
      </div>
      {children}
    </div>
  )
}

function ListField({
  label,
  id,
  value,
  onChange,
  onGenerate,
  generating,
}: {
  label: string
  id: string
  value: string
  onChange: (v: string) => void
  /** TESTING FEATURE: generate this list with AI. */
  onGenerate?: () => void
  generating?: boolean
}) {
  const count = value.split("\n").map((l) => l.trim()).filter(Boolean).length
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={id}>{label}</Label>
          <span className="text-xs text-muted-foreground">
            {count} {count === 1 ? "item" : "items"}
          </span>
        </div>
        {onGenerate && (
          <GenerateAiButton onClick={onGenerate} generating={generating} />
        )}
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
  onGenerate,
  generating,
}: {
  steps: ItineraryStep[]
  onChange: (steps: ItineraryStep[]) => void
  /** TESTING FEATURE: generate the itinerary with AI. */
  onGenerate?: () => void
  generating?: boolean
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label>Itinerary</Label>
          <span className="text-xs text-muted-foreground">
            {steps.length} {steps.length === 1 ? "step" : "steps"}
          </span>
        </div>
        {onGenerate && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4 text-primary" />
            )}
            {generating ? "Generating…" : "Generate with AI"}
            <span className="ml-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
              Testing
            </span>
          </Button>
        )}
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

function SaveStatus({
  dirty,
  lastSaved,
}: {
  dirty: boolean
  lastSaved: Date | null
}) {
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: "var(--chart-1)" }}
          aria-hidden="true"
        />
        Unsaved changes
      </span>
    )
  }
  if (lastSaved) {
    return (
      <span className="text-xs text-muted-foreground">
        Saved{" "}
        {lastSaved.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    )
  }
  return null
}

function ComingSoon({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="max-w-sm text-pretty text-sm text-muted-foreground">
          {desc}
        </p>
      </div>
      <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
        Coming soon
      </span>
    </div>
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
    field:
      | "title"
      | "excerpt"
      | "description"
      | "included"
      | "excluded"
      | "goodToKnow"
      | "whatToBring"
      | "importantInfo",
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
                    onUse={() =>
                      onApply("whatToBring", active.requirements, "replace")
                    }
                  />
                  <TextField
                    label="Important / attention"
                    value={active.attention}
                    onUse={() =>
                      onApply("importantInfo", active.attention, "replace")
                    }
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
