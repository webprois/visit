import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/require-auth"

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Optional folder, e.g. "categories". Defaults to "tours".
    const rawFolder = (formData.get("folder") as string | null) ?? "tours"
    const folder = /^[a-z0-9-]+$/i.test(rawFolder) ? rawFolder : "tours"

    const blob = await put(`${folder}/${Date.now()}-${file.name}`, file, {
      access: "public",
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error("[v0] Upload error:", error)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
