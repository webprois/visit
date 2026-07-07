"use client"

import { useMemo, useRef, useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Search,
  Plus,
  Tag,
  ImageIcon,
  Upload,
  Loader2,
  Trash2,
  Save,
  X,
  Languages,
  ArrowLeft,
} from "lucide-react"
import { toast } from "sonner"
import {
  createCategory,
  updateCategory,
  deleteCategory,
  translateCategoryName,
} from "@/app/actions/admin"
import {
  CATEGORY_ICON_NAMES,
  getCategoryIcon,
} from "@/lib/category-icons"
import type { TourCategory } from "@/lib/db/schema"

const LANGS = [
  { key: "nameEn", label: "English" },
  { key: "nameEs", label: "Español" },
  { key: "namePt", label: "Português" },
  { key: "nameIt", label: "Italiano" },
] as const

type LangKey = (typeof LANGS)[number]["key"]

// English is the source language (the main "Name" field), so it's not shown in
// the translated-names grid — only the languages we translate into.
const TRANSLATION_LANGS = LANGS.filter((l) => l.key !== "nameEn")

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export function CategoriesWorkspace({
  categories,
  tourCountByCategory,
}: {
  categories: TourCategory[]
  tourCountByCategory: Record<number, number>
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<number | null>(
    categories[0]?.id ?? null,
  )
  // On small screens the list and editor are shown one at a time.
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState("")
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, query])

  const selected = categories.find((c) => c.id === selectedId) ?? null

  function addCategory() {
    const name = newName.trim()
    if (!name) return
    setNewName("")
    setAdding(false)
    startTransition(async () => {
      await createCategory(name)
      toast.success("Category created")
      router.refresh()
    })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">
            Categories
          </h1>
          <p className="text-xs text-muted-foreground">
            {categories.length} categories
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left: list panel (hidden on mobile while the editor is open) */}
        <div
          className={`w-full shrink-0 flex-col border-b border-border lg:h-full lg:w-[380px] lg:border-b-0 lg:border-r ${
            mobileEditorOpen ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="flex flex-col gap-3 border-b border-border p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories..."
                className="pl-9"
              />
            </div>
            {adding ? (
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  placeholder="Category name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addCategory()
                    } else if (e.key === "Escape") {
                      setAdding(false)
                      setNewName("")
                    }
                  }}
                />
                <Button onClick={addCategory} disabled={!newName.trim() || isPending}>
                  Add
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setAdding(false)
                    setNewName("")
                  }}
                  aria-label="Cancel"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <Button onClick={() => setAdding(true)} className="w-full">
                <Plus className="size-4" />
                Add category
              </Button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                <Tag className="size-8 text-muted-foreground/40" aria-hidden="true" />
                <p className="text-sm font-medium text-foreground">
                  {categories.length === 0
                    ? "No categories yet"
                    : "No categories found"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {categories.length === 0
                    ? "Create your first category to get started."
                    : "Try a different search."}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {filtered.map((c) => {
                  const isActive = c.id === selectedId
                  const count = tourCountByCategory[c.id] ?? 0
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(c.id)
                          setMobileEditorOpen(true)
                        }}
                        aria-current={isActive ? "true" : undefined}
                        className={
                          "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors " +
                          (isActive
                            ? "border-primary bg-secondary"
                            : "border-transparent hover:border-border hover:bg-secondary/50")
                        }
                      >
                        <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                          {c.imageUrl ? (
                            <Image
                              src={c.imageUrl || "/placeholder.svg"}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="44px"
                            />
                          ) : (
                            <Tag
                              className="size-4 text-muted-foreground"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold text-foreground">
                            {c.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {count} {count === 1 ? "tour" : "tours"}
                          </p>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: editor (full screen on mobile, opened from the list) */}
        <div
          className={`min-h-0 min-w-0 flex-1 flex-col ${
            mobileEditorOpen ? "flex" : "hidden lg:flex"
          }`}
        >
          {selected && (
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileEditorOpen(false)}
                className="inline-flex items-center gap-1.5 rounded-lg py-1 pr-2 text-sm font-semibold text-foreground hover:text-primary"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                All categories
              </button>
              <span className="min-w-0 flex-1 truncate text-right text-xs text-muted-foreground">
                {selected.name}
              </span>
            </div>
          )}
          {selected ? (
            <CategoryEditor
              key={selected.id}
              category={selected}
              tourCount={tourCountByCategory[selected.id] ?? 0}
              onDeleted={() => {
                setSelectedId(null)
                setMobileEditorOpen(false)
                router.refresh()
              }}
              onSaved={() => router.refresh()}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary">
                <Tag className="size-7 text-muted-foreground" aria-hidden="true" />
              </div>
              <h2 className="font-heading text-lg font-bold text-foreground">
                Select a category
              </h2>
              <p className="max-w-xs text-sm text-muted-foreground">
                Choose a category to edit its image, name, description and display
                order, or create a new one.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CategoryEditor({
  category,
  tourCount,
  onSaved,
  onDeleted,
}: {
  category: TourCategory
  tourCount: number
  onSaved: () => void
  onDeleted: () => void
}) {
  const [name, setName] = useState(category.name)
  const [slug, setSlug] = useState(category.slug)
  const [slugEdited, setSlugEdited] = useState(false)
  const [description, setDescription] = useState(category.description ?? "")
  const [sortOrder, setSortOrder] = useState<string>(String(category.sortOrder))
  const [imageUrl, setImageUrl] = useState(category.imageUrl ?? "")
  const [icon, setIcon] = useState<string>(category.icon ?? "")
  const [iconSearch, setIconSearch] = useState("")
  const [names, setNames] = useState<Record<LangKey, string>>({
    nameEn: category.nameEn ?? "",
    nameEs: category.nameEs ?? "",
    namePt: category.namePt ?? "",
    nameIt: category.nameIt ?? "",
  })

  const [uploading, setUploading] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deleting, startDelete] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleNameChange(value: string) {
    setName(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  async function autoTranslate() {
    const source = name.trim()
    if (!source) {
      toast.error("Enter a name first")
      return
    }
    setTranslating(true)
    try {
      const { es, pt, it } = await translateCategoryName(source)
      setNames((prev) => ({ ...prev, nameEs: es, namePt: pt, nameIt: it }))
      toast.success("Names translated")
    } catch {
      toast.error("Translation failed")
    } finally {
      setTranslating(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("folder", "categories")
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd })
      if (!res.ok) throw new Error("Upload failed")
      const { url } = await res.json()
      setImageUrl(url)
      toast.success("Image uploaded")
    } catch {
      toast.error("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  function save() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    startTransition(async () => {
      await updateCategory(category.id, {
        name,
        slug,
        description,
        sortOrder: Number(sortOrder),
        imageUrl,
        icon,
        ...names,
        // English is the source language: keep it in sync with the main name.
        nameEn: name.trim(),
      })
      toast.success("Category saved")
      onSaved()
    })
  }

  function remove() {
    startDelete(async () => {
      await deleteCategory(category.id)
      toast.success("Category deleted")
      onDeleted()
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
          {/* Image */}
          <div className="flex flex-col gap-2">
            <Label>Category image / icon</Label>
            <div className="flex items-center gap-4">
              <div className="relative flex aspect-[16/10] w-40 items-center justify-center overflow-hidden rounded-xl bg-muted">
                {imageUrl ? (
                  <Image
                    src={imageUrl || "/placeholder.svg"}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="160px"
                  />
                ) : (
                  <ImageIcon
                    className="size-6 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Upload image
                </Button>
                {imageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setImageUrl("")}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Filter icon (shown next to the category in the tours filter list) */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Filter icon</Label>
              {icon && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIcon("")}
                >
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Shown next to this category in the activities filter on the tours
              page.
            </p>
            <Input
              value={iconSearch}
              onChange={(e) => setIconSearch(e.target.value)}
              placeholder="Search icons…"
              className="h-10"
            />
            <div className="grid grid-cols-8 gap-2 sm:grid-cols-12">
              {CATEGORY_ICON_NAMES.filter((n) =>
                n.toLowerCase().includes(iconSearch.trim().toLowerCase()),
              ).map((n) => {
                const Ico = getCategoryIcon(n)
                if (!Ico) return null
                const selected = icon === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setIcon(selected ? "" : n)}
                    title={n}
                    aria-label={n}
                    aria-pressed={selected}
                    className={
                      "flex aspect-square items-center justify-center rounded-lg border transition-colors " +
                      (selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground")
                    }
                  >
                    <Ico className="size-5" aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </div>

          {/* Name / Slug */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-slug">Slug</Label>
              <Input
                id="cat-slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugEdited(true)
                }}
                className="h-11 font-mono text-sm"
              />
            </div>
          </div>

          {/* Short description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-desc">Short description</Label>
            <Textarea
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief description shown alongside the category"
            />
          </div>

          {/* Sort order */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cat-order">Sort order</Label>
            <Input
              id="cat-order"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="h-11 w-32"
            />
            <p className="text-xs text-muted-foreground">
              Lower numbers appear first on the site.
            </p>
          </div>

          {/* Translated names */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label>Translated names</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={autoTranslate}
                disabled={translating || !name.trim()}
              >
                {translating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Languages className="size-4" />
                )}
                Auto-translate
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {TRANSLATION_LANGS.map((l) => (
                <div key={l.key} className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {l.label}
                  </span>
                  <Input
                    value={names[l.key]}
                    onChange={(e) =>
                      setNames((prev) => ({ ...prev, [l.key]: e.target.value }))
                    }
                    placeholder={name}
                    className="h-10"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed action bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card/95 px-6 py-3 backdrop-blur">
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="ghost" className="text-destructive hover:text-destructive" />
            }
          >
            <Trash2 className="size-4" />
            Delete
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{category.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently removes the category. It will be unassigned from{" "}
                {tourCount} {tourCount === 1 ? "tour" : "tours"}. This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={remove}>
                {deleting && <Loader2 className="size-4 animate-spin" />}
                Delete category
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button onClick={save} disabled={isPending || uploading}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save category
        </Button>
      </div>
    </div>
  )
}
