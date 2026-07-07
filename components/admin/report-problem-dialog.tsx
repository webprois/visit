"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { toast } from "sonner"
import { MessageSquareWarning, ImagePlus, Loader2, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { reportProblem } from "@/app/actions/report-problem"

const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB

/**
 * Admin "Report a problem" button + dialog. Lets an admin describe an issue and
 * optionally attach one screenshot. The image is uploaded to Blob first, then
 * the report is emailed to the support inbox via the `reportProblem` action.
 */
export function ReportProblemDialog({
  className,
}: {
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetForm() {
    setMessage("")
    clearImage()
  }

  function clearImage() {
    setFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (!picked) return
    if (!picked.type.startsWith("image/")) {
      toast.error("Please choose an image file.")
      return
    }
    if (picked.size > MAX_IMAGE_BYTES) {
      toast.error("Image is too large (max 8 MB).")
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(picked)
    setPreviewUrl(URL.createObjectURL(picked))
  }

  async function uploadImage(picked: File): Promise<string> {
    const form = new FormData()
    form.append("file", picked)
    form.append("folder", "reports")
    const res = await fetch("/api/admin/upload", { method: "POST", body: form })
    if (!res.ok) throw new Error("Image upload failed")
    const { url } = await res.json()
    return url as string
  }

  async function handleSubmit() {
    const trimmed = message.trim()
    if (!trimmed) {
      toast.error("Please describe the problem.")
      return
    }
    setSubmitting(true)
    try {
      let imageUrl: string | null = null
      if (file) imageUrl = await uploadImage(file)

      const result = await reportProblem({
        message: trimmed,
        imageUrl,
        imageName: file?.name ?? null,
        pageUrl: typeof window !== "undefined" ? window.location.href : null,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Thanks! Your report was sent.")
      resetForm()
      setOpen(false)
    } catch (err) {
      toast.error((err as Error).message || "Something went wrong.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return
        setOpen(next)
        if (!next) resetForm()
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground " +
          (className ?? "")
        }
      >
        <MessageSquareWarning className="size-5 shrink-0" aria-hidden="true" />
        Report a problem
      </button>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
          <DialogDescription>
            {
              "Describe what went wrong and optionally attach a screenshot. This goes straight to the Visit Iceland team."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What happened? Include any steps to reproduce it."
            rows={5}
            className="resize-none"
            disabled={submitting}
            autoFocus
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePickImage}
            className="hidden"
          />

          {previewUrl ? (
            <div className="relative overflow-hidden rounded-lg border border-border">
              {/* Local object-URL preview; Image with unoptimized to skip the loader. */}
              <Image
                src={previewUrl || "/placeholder.svg"}
                alt="Selected screenshot preview"
                width={640}
                height={360}
                unoptimized
                className="h-auto max-h-56 w-full object-contain bg-secondary"
              />
              <button
                type="button"
                onClick={clearImage}
                disabled={submitting}
                aria-label="Remove image"
                className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 text-foreground shadow-sm transition-colors hover:bg-background"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="justify-start"
            >
              <ImagePlus className="size-4" aria-hidden="true" />
              Attach screenshot
              <span className="ml-auto text-xs text-muted-foreground">
                Optional
              </span>
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            {submitting ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
