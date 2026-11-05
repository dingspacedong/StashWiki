// Links to a page in another of the person's wikis, written [[Other wiki::Page]] ([[Other wiki::]] for its main
// page). Stored as <a data-wikiref="Other wiki" data-page="Page">, apart from [[links]] within the wiki, so renaming
// pages, red links and "what links here" in this wiki never touch them. Found by the wiki's id when known, else its name.
import { escapeHtml } from '@shared/defaults'
import type { LibraryEntry } from '@shared/types'
import { cleanTitle, titleKey } from './wikitext'

export const REF_SEP = '::'

/** "Other wiki::Page" → its parts, or null for an ordinary title. */
export function splitWikiRef(target: string): { wiki: string; page: string } | null {
  const i = target.indexOf(REF_SEP)
  if (i < 0) return null
  const wiki = target.slice(0, i).replace(/\s+/g, ' ').trim()
  return wiki ? { wiki, page: cleanTitle(target.slice(i + REF_SEP.length)) } : null
}

/** The link as stored in page HTML. */
export function wikiRefTag(wiki: string, page: string, label: string, id?: string): string {
  return `<a class="wikiref" data-wikiref="${escapeHtml(wiki)}"${id ? ` data-wiki-id="${escapeHtml(id)}"` : ''} data-page="${escapeHtml(page)}">${escapeHtml(label)}</a>`
}

/** Which of the person's wikis a link means: by id, or else by name. */
export function findWiki(wikis: LibraryEntry[], name: string, id?: string | null): LibraryEntry | undefined {
  return (id ? wikis.find((w) => w.id === id) : undefined) ?? wikis.find((w) => titleKey(w.name) === titleKey(name))
}

/** Shown text when none is given: the page, or the wiki's name for its main page. */
export const refLabel = (wiki: string, page: string): string => page || wiki
