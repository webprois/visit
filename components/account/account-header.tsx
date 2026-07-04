"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Loader2, LogOut } from "lucide-react"

export function AccountHeader({ name, email }: { name: string; email: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-heading text-3xl font-extrabold text-foreground md:text-4xl">
          My Trips
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Signed in as <span className="text-foreground">{name}</span>
          {name !== email && <span className="text-muted-foreground"> ({email})</span>}
        </p>
      </div>
      <Button
        variant="outline"
        onClick={handleSignOut}
        disabled={loading}
        className="self-start sm:self-auto"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LogOut className="size-4" />
        )}
        Sign out
      </Button>
    </div>
  )
}
