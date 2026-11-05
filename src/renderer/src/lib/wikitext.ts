// Pure helpers for titles and [[links]]. Kept free of the DOM so they can be unit-tested.
import { escapeHtml } from '@shared/defaults'
import type { Page } from '@shared/types'
import { cardTitles, renameInCards } from './cardsData'
import { refLabel, splitWikiRef, wikiRefTag } from './wikiRefs'

/** Tidy a title as typed: collapse spaces, drop characters that would break [[link]] syntax. */
export function cleanTitle(t: string): string {
  return t.replace(/[[\]|{}<>#]/g, '').replace(/\s+/g, ' ').trim()
}

/** Comparison key for titles: links are case-insensitive. */
export function titleKey(t: string): string {
  return cleanTitle(t).toLowerCase()
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

const LINK_RE = /\[\[([^[\]|]+)(?:\|([^[\]]*))?\]\]/g
const URL_RE = /\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g

/**
 * Render plain text from an infobox field: escapes HTML, turns [[Page]] / [[Page|label]]
 * into wiki links (red when the page doesn't exist), bare URLs into links, newlines into breaks.
 */
export function renderInlineText(text: string, exists: (title: string) => boolean): string {
  let out = ''
  let last = 0
  for (const m of text.matchAll(LINK_RE)) {
    out += linkifyUrls(escapeHtml(text.slice(last, m.index)))
    last = m.index! + m[0].length
    // [[Other wiki::Page]]: a page in another wiki.
    const ref = splitWikiRef(m[1])
    if (ref) {
      out += wikiRefTag(ref.wiki, ref.page, (m[2] ?? '').trim() || refLabel(ref.wiki, ref.page))
      continue
    }
    const target = cleanTitle(m[1])
    const label = (m[2] ?? '').trim() || m[1].trim()
    const cls = exists(target) ? 'wikilink' : 'wikilink new'
    out += `<a class="${cls}" data-wikilink="${escapeHtml(target)}">${escapeHtml(label)}</a>`
  }
  out += linkifyUrls(escapeHtml(text.slice(last)))
  return out.replace(/\r?\n/g, '<br>')
}

function linkifyUrls(escaped: string): string {
  return escaped.replace(URL_RE, (u) => `<a class="external" href="${u}" target="_blank" rel="noreferrer">${u}</a>`)
}

/** Titles linked from rich-text body HTML. */
export function bodyLinkTargets(html: string): string[] {
  const out: string[] = []
  for (const m of html.matchAll(/data-wikilink="([^"]*)"/g)) out.push(decodeEntities(m[1]))
  return out
}

export function textLinkTargets(text: string): string[] {
  return [...text.matchAll(LINK_RE)].filter((m) => !splitWikiRef(m[1])).map((m) => cleanTitle(m[1]))
}

/** Every title this page links to, as title keys. */
export function pageLinkKeys(page: Page): Set<string> {
  const keys = new Set<string>()
  for (const t of bodyLinkTargets(page.body)) keys.add(titleKey(t))
  for (const t of cardTitles(page.body)) keys.add(titleKey(t))
  for (const v of Object.values(page.infobox)) for (const t of textLinkTargets(v)) keys.add(titleKey(t))
  // A story links to its characters; a chapter's author's notes can link too.
  for (const t of page.story?.characters ?? []) keys.add(titleKey(t))
  for (const v of [page.chapter?.notesBefore, page.chapter?.notesAfter]) for (const t of textLinkTargets(v ?? '')) keys.add(titleKey(t))
  return keys
}

/** Point links at a renamed page. Returns the updated page, or null if nothing changed. */
export function renameLinks(page: Page, oldTitle: string, newTitle: string): Page | null {
  const oldKey = titleKey(oldTitle)
  let changed = false

  const body = page.body.replace(
    /(<a\b[^>]*?data-wikilink=")([^"]*)("[^>]*>)([^<]*)(<\/a>)/g,
    (all, pre: string, target: string, mid: string, text: string, close: string) => {
      if (titleKey(decodeEntities(target)) !== oldKey) return all
      changed = true
      const newText = titleKey(decodeEntities(text)) === oldKey ? escapeHtml(newTitle) : text
      return pre + escapeHtml(newTitle) + mid + newText + close
    }
  )
  // Links whose text is formatted (e.g. bold) only get their target updated.
  const body2 = body.replace(/data-wikilink="([^"]*)"/g, (all, target: string) => {
    if (titleKey(decodeEntities(target)) !== oldKey) return all
    changed = true
    return `data-wikilink="${escapeHtml(newTitle)}"`
  })

  const relink = (v: string): string =>
    v.replace(LINK_RE, (all, target: string, label?: string) => {
      if (titleKey(target) !== oldKey) return all
      changed = true
      return label !== undefined ? `[[${newTitle}|${label}]]` : `[[${newTitle}]]`
    })
  const infobox: Record<string, string> = {}
  for (const [k, v] of Object.entries(page.infobox)) {
    if (k.endsWith('.tabs')) {
      // Picture tab lists are JSON; rename inside the captions so the JSON stays valid.
      try {
        const tabs = JSON.parse(v) as { caption?: string }[]
        infobox[k] = JSON.stringify(tabs.map((t) => ({ ...t, caption: relink(t.caption ?? '') })))
        continue
      } catch {
        // not valid JSON: treat as text
      }
    }
    infobox[k] = relink(v)
  }
  // Page cards keep their links in a JSON attribute.
  const cards = renameInCards(body2, (t) => titleKey(t) === oldKey, newTitle)
  if (cards.changed) changed = true
  let story = page.story
  if (story?.characters.some((c) => titleKey(c) === oldKey)) {
    story = { ...story, characters: story.characters.map((c) => (titleKey(c) === oldKey ? newTitle : c)) }
    changed = true
  }
  let chapter = page.chapter
  if (chapter && (chapter.notesBefore || chapter.notesAfter)) {
    const before = relink(chapter.notesBefore ?? '')
    const after = relink(chapter.notesAfter ?? '')
    if (before !== (chapter.notesBefore ?? '') || after !== (chapter.notesAfter ?? '')) chapter = { ...chapter, notesBefore: before, notesAfter: after }
  }
  return changed ? { ...page, body: cards.html, infobox, ...(story ? { story } : {}), ...(chapter ? { chapter } : {}) } : null
}

export function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<(br|\/p|\/h\d|\/li)[^>]*>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

export function headingId(text: string, used: Set<string>): string {
  const base =
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '') || 'section'
  let id = base
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`
  used.add(id)
  return id
}

/** Short text around the first match of `q`, for search results. */
export function snippet(text: string, q: string, radius = 70): string {
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return text.slice(0, radius * 2)
  const start = Math.max(0, i - radius)
  const end = Math.min(text.length, i + q.length + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}
