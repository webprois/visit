import { NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { assertAdmin } from "@/lib/require-auth"
import { db } from "@/lib/db"
import { cancellationRequest } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

/**
 * Admin-only list of customer cancellation requests (the under-72h review
 * queue). `?status=pending` (default) returns the open queue; `?status=all`
 * returns every request, most recent first.
 */
export async function GET(request: Request) {
  try {
    await assertAdmin()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const status = new URL(request.url).searchParams.get("status") ?? "pending"

  try {
    const base = db.select().from(cancellationRequest)
    const rows =
      status === "all"
        ? await base.orderBy(desc(cancellationRequest.createdAt))
        : await base
            .where(eq(cancellationRequest.status, "pending"))
            .orderBy(desc(cancellationRequest.createdAt))

    const pendingCount =
      status === "all"
        ? rows.filter((r) => r.status === "pending").length
        : rows.length

    return NextResponse.json({ requests: rows, pendingCount })
  } catch (err) {
    console.error("[v0] list cancellation requests failed:", err)
    return NextResponse.json(
      { error: "Could not load cancellation requests." },
      { status: 500 },
    )
  }
}
