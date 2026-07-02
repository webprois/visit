import "server-only"

import { createHash } from "node:crypto"
import { generateObject } from "ai"
import { z } from "zod"
import { inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { translationCache } from "@/lib/db/schema"
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n"

/**
 * Machine-translate dynamic, non-admin-managed content (Bokun add-on names,
 * participant category labels, etc.) into the active language.
 *
 * Behaviour:
 * - English (the source language) is returned unchanged.
 * - Each unique string is translated at most once per language: results are
 *   persisted in the `translation_cache` table and reused on later requests.
 * - Only cache misses are sent to the model, batched into a single call.
 * - On any failure we fall back to the original English text so the booking
 *   flow never breaks because of translation.
 */

const MODEL = "google/gemini-2.5-flash-lite"

const LANGUAGE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
  it: "Italian",
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

/**
 * Translate a list of strings into `locale`, preserving order. Blank strings
 * and the default locale pass through untouched.
 */
export async function translateTexts(
  texts: string[],
  locale: Locale,
): Promise<string[]> {
  if (locale === DEFAULT_LOCALE || texts.length === 0) return texts

  // Unique, non-empty source strings to actually translate.
  const unique = Array.from(
    new Set(texts.map((t) => t.trim()).filter(Boolean)),
  )
  if (unique.length === 0) return texts

  const result = new Map<string, string>()
  const hashes = unique.map(hashText)

  // 1) Load whatever is already cached for this language.
  try {
    const cached = await db
      .select()
      .from(translationCache)
      .where(inArray(translationCache.hash, hashes))
    for (const row of cached) {
      if (row.lang === locale) result.set(row.sourceText, row.translated)
    }
  } catch {
    // Cache read failure is non-fatal; we simply translate everything.
  }

  const missing = unique.filter((t) => !result.has(t))

  // 2) Translate the misses in a single batched model call.
  if (missing.length > 0) {
    try {
      const { object } = await generateObject({
        model: MODEL,
        schema: z.object({
          translations: z
            .array(z.string())
            .describe("Translated strings, in the same order as the input"),
        }),
        system:
          `You are a professional translator for a travel/tours booking website. ` +
          `Translate each input string from English into ${LANGUAGE_NAMES[locale]}. ` +
          `Keep translations concise and natural for UI labels. Preserve numbers, ` +
          `prices, and proper nouns. Return exactly one translation per input, in order.`,
        prompt: JSON.stringify(missing),
      })

      const translations = object.translations
      const rows: (typeof translationCache.$inferInsert)[] = []
      missing.forEach((source, i) => {
        const translated = translations[i]?.trim() || source
        result.set(source, translated)
        rows.push({
          hash: hashText(source),
          lang: locale,
          sourceText: source,
          translated,
        })
      })

      // 3) Persist new translations (ignore conflicts from concurrent writes).
      if (rows.length > 0) {
        try {
          await db.insert(translationCache).values(rows).onConflictDoNothing()
        } catch {
          // Cache write failure is non-fatal.
        }
      }
    } catch {
      // Model failure: fall back to English for the missing strings.
      for (const source of missing) result.set(source, source)
    }
  }

  // Map back to the original order, falling back to the source when needed.
  return texts.map((t) => {
    const key = t.trim()
    return result.get(key) ?? t
  })
}
