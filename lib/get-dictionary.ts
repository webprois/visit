import "server-only"
import { getLocale } from "@/lib/get-locale"
import { getDictionary, type Dictionary } from "@/lib/translations"

/**
 * Resolve the UI dictionary for the current request's locale. For use in
 * server components so they can translate without prop-drilling a dictionary.
 */
export async function getServerDict(): Promise<Dictionary> {
  return getDictionary(await getLocale())
}
