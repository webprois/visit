"use client"

import { SiteLogo } from "@/components/site-logo"
import {
  LayoutDashboard,
  Compass,
  Tag,
  MapPin,
  CalendarCheck,
  Inbox,
  Settings,
  LogOut,
  RefreshCw,
  Loader2,
  ImageIcon,
  type LucideIcon,
} from "lucide-react"

export type AdminSection = "overview" | "tours" | "categories" | "locations" | "bookings"

type NavItem = {
  key: AdminSection
  label: string
  icon: LucideIcon
  children?: { key: AdminSection; label: string; icon: LucideIcon }[]
}

const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  {
    key: "tours",
    label: "Tours",
    icon: Compass,
    children: [
      { key: "categories", label: "Categories", icon: Tag },
      { key: "locations", label: "Starting Locations", icon: MapPin },
    ],
  },
  { key: "bookings", label: "Bookings", icon: CalendarCheck },
]

const COMING_SOON: { label: string; icon: LucideIcon }[] = [
  { label: "Media Library", icon: ImageIcon },
  { label: "Requests", icon: Inbox },
  { label: "Settings", icon: Settings },
]

export function AdminSidebar({
  active,
  onNavigate,
  userName,
  onRefresh,
  onSignOut,
  refreshing,
}: {
  active: AdminSection
  onNavigate: (section: AdminSection) => void
  userName: string
  onRefresh: () => void
  onSignOut: () => void
  refreshing: boolean
}) {
  return (
    <aside className="flex h-svh w-64 shrink-0 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <SiteLogo width={110} height={30} className="h-7 w-auto" />
        <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Manage
        </p>
        {NAV.map((item) => {
          const isActive = active === item.key
          // Children only show when the parent or one of its children is active.
          const childActive = item.children?.some((c) => c.key === active) ?? false
          const showChildren = Boolean(item.children) && (isActive || childActive)
          return (
            <div key={item.key} className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => onNavigate(item.key)}
                aria-current={isActive ? "page" : undefined}
                aria-expanded={item.children ? showChildren : undefined}
                className={
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
                  (isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                }
              >
                <item.icon className="size-5 shrink-0" aria-hidden="true" />
                {item.label}
              </button>

              {showChildren && (
                <div className="ml-4 flex flex-col gap-1 border-l border-border pl-2">
                  {item.children!.map((child) => {
                    const childIsActive = active === child.key
                    return (
                      <button
                        key={child.key}
                        type="button"
                        onClick={() => onNavigate(child.key)}
                        aria-current={childIsActive ? "page" : undefined}
                        className={
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                          (childIsActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground")
                        }
                      >
                        <child.icon className="size-4 shrink-0" aria-hidden="true" />
                        {child.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Coming soon
        </p>
        {COMING_SOON.map((item) => (
          <div
            key={item.label}
            aria-disabled="true"
            className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/50"
          >
            <item.icon className="size-5 shrink-0" aria-hidden="true" />
            {item.label}
            <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              Soon
            </span>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-60"
        >
          {refreshing ? (
            <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-5 shrink-0" aria-hidden="true" />
          )}
          Sync from Bokun
        </button>

        <div className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">Administrator</p>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Version */}
        <div className="mt-2 px-3 text-[11px] leading-relaxed text-muted-foreground/70">
          <p className="font-medium text-muted-foreground">Version 1.1</p>
        </div>
      </div>
    </aside>
  )
}
