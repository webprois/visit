import type { Metadata } from "next"
import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudHail,
  CloudSnow,
  CloudRainWind,
  CloudLightning,
  Wind,
  Droplets,
  Sparkles,
  ExternalLink,
  type LucideIcon,
} from "lucide-react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { getLocale } from "@/lib/get-locale"
import { getServerDict } from "@/lib/get-dictionary"
import {
  FORECAST_LOCATIONS,
  fetchDailyForecast,
  fetchAuroraForecast,
  conditionForCode,
  type ConditionKey,
  type AuroraLevel,
  type DailyForecast,
} from "@/lib/weather"

export const metadata: Metadata = {
  title: "Iceland Weather & Northern Lights Forecast | Visit Iceland",
  description:
    "7-day weather forecast for Reykjavík, the Golden Circle, the South Coast and more — plus tonight's northern lights (aurora) outlook for Iceland.",
}

// Forecasts change hourly; keep the page fresh without rebuilding on each view.
export const revalidate = 1800

const CONDITION_ICONS: Record<ConditionKey, LucideIcon> = {
  clear: Sun,
  partlyCloudy: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  freezingRain: CloudHail,
  snow: CloudSnow,
  showers: CloudRainWind,
  snowShowers: CloudSnow,
  thunderstorm: CloudLightning,
}

const LEVEL_TONES: Record<AuroraLevel, string> = {
  excellent: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  good: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  fair: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "border-border bg-secondary text-muted-foreground",
}

const USEFUL_LINKS = [
  { name: "Safetravel.is", href: "https://safetravel.is", key: "linkSafetravel" as const },
  { name: "Road.is", href: "https://www.road.is", key: "linkRoad" as const },
  { name: "Vedur.is", href: "https://en.vedur.is", key: "linkVedur" as const },
]

export default async function WeatherPage() {
  const locale = await getLocale()
  const dict = await getServerDict()
  const t = dict.weather

  // Fetch everything in parallel; each fetch degrades to null on failure.
  const [aurora, ...forecasts] = await Promise.all([
    fetchAuroraForecast(),
    ...FORECAST_LOCATIONS.map((l) => fetchDailyForecast(l.lat, l.lng)),
  ])

  const dayFormat = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "Atlantic/Reykjavik",
  })
  const dateFormat = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "Atlantic/Reykjavik",
  })

  const levelLabel: Record<AuroraLevel, string> = {
    excellent: t.levelExcellent,
    good: t.levelGood,
    fair: t.levelFair,
    low: t.levelLow,
  }
  const levelText: Record<AuroraLevel, string> = {
    excellent: t.levelExcellentText,
    good: t.levelGoodText,
    fair: t.levelFairText,
    low: t.levelLowText,
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader locale={locale} />
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-4 py-14 md:px-6 md:py-20">
          <h1 className="text-balance font-heading text-4xl font-extrabold leading-tight text-foreground md:text-5xl">
            {t.title}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg">
            {t.intro}
          </p>

          {/* Tonight's aurora outlook */}
          <div className="mt-10 rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="size-5" aria-hidden="true" />
              </span>
              <h2 className="font-heading text-2xl font-bold text-foreground">
                {t.auroraTitle}
              </h2>
            </div>

            {aurora === null ? (
              <p className="mt-4 text-muted-foreground">{t.auroraUnavailable}</p>
            ) : !aurora.inSeason ? (
              <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-pretty leading-relaxed text-muted-foreground">
                  {t.outOfSeason}
                </p>
                <a
                  href="/tours"
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {t.browseTours}
                </a>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span
                  className={
                    "inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-semibold " +
                    LEVEL_TONES[aurora.level]
                  }
                >
                  {levelLabel[aurora.level]}
                </span>
                <span className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-sm text-muted-foreground">
                  {t.kpLabel}: <span className="font-semibold text-foreground">{aurora.kp}</span>
                </span>
                {aurora.cloudCover !== null && (
                  <span className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-sm text-muted-foreground">
                    {t.cloudLabel}:{" "}
                    <span className="font-semibold text-foreground">{aurora.cloudCover}%</span>
                  </span>
                )}
                <p className="w-full text-pretty leading-relaxed text-muted-foreground">
                  {levelText[aurora.level]}
                </p>
              </div>
            )}
          </div>

          {/* 7-day forecast per region */}
          <div className="mt-14">
            <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
              {t.forecastTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              {t.forecastIntro}
            </p>

            <div className="mt-8 flex flex-col gap-6">
              {FORECAST_LOCATIONS.map((location, i) => (
                <LocationForecast
                  key={location.key}
                  name={t.locations[location.key]}
                  days={forecasts[i]}
                  dayFormat={dayFormat}
                  dateFormat={dateFormat}
                  conditionLabels={t.conditions}
                  windUnit={t.windUnit}
                  unavailable={t.forecastUnavailable}
                />
              ))}
            </div>

            <p className="mt-4 text-xs text-muted-foreground/70">{t.sourcesNote}</p>
          </div>

          {/* Official sources */}
          <div className="mt-14">
            <h2 className="font-heading text-2xl font-bold text-foreground">{t.linksTitle}</h2>
            <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">{t.linksIntro}</p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-3">
              {USEFUL_LINKS.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40"
                  >
                    <span className="flex items-center gap-1.5 font-heading font-bold text-foreground">
                      {link.name}
                      <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <span className="text-sm leading-relaxed text-muted-foreground">
                      {t[link.key]}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

function LocationForecast({
  name,
  days,
  dayFormat,
  dateFormat,
  conditionLabels,
  windUnit,
  unavailable,
}: {
  name: string
  days: DailyForecast[] | null
  dayFormat: Intl.DateTimeFormat
  dateFormat: Intl.DateTimeFormat
  conditionLabels: Record<ConditionKey, string>
  windUnit: string
  unavailable: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 md:p-6">
      <h3 className="font-heading text-lg font-bold text-foreground">{name}</h3>
      {days === null ? (
        <p className="mt-3 text-sm text-muted-foreground">{unavailable}</p>
      ) : (
        // One column per day; horizontally scrollable on narrow screens.
        <ul className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => {
            const condition = conditionForCode(day.weatherCode)
            const Icon = CONDITION_ICONS[condition]
            // Local noon avoids UTC day-shift when parsing the ISO date.
            const date = new Date(`${day.date}T12:00:00`)
            return (
              <li
                key={day.date}
                className="flex min-w-[104px] flex-1 flex-col items-center gap-1.5 rounded-xl bg-secondary/40 px-2 py-3 text-center"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {dayFormat.format(date)}
                </span>
                <span className="text-[11px] text-muted-foreground/70">
                  {dateFormat.format(date)}
                </span>
                <Icon className="size-7 text-primary" aria-hidden="true" />
                <span className="text-[11px] leading-tight text-muted-foreground">
                  {conditionLabels[condition]}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {day.tempMaxC}°
                  <span className="ml-1 font-normal text-muted-foreground">{day.tempMinC}°</span>
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Wind className="size-3" aria-hidden="true" />
                  {day.windMaxMs} {windUnit}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Droplets className="size-3" aria-hidden="true" />
                  {day.precipChance}%
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
