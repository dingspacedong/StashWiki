// "Page cards": grouped picture cards that link to pages (like a wiki's "Appearances" grid).
// Stored in a page's text as <div data-cards="{json}"></div>. This file has the data side (no DOM, testable);
// cards.ts draws them.
import { escapeHtml } from '@shared/defaults'

export interface PageCard {
  /** The linked page's title. */
  page: string
  /** Small label in the corner, e.g. "Debut" or "Mentioned". */
  tag?: string
  /** A picture to use instead of the page's own. */
  image?: string
}

export interface CardGroup {
  title: string
  cards: PageCard[]
}

export interface CardsData {
  groups: CardGroup[]
}

export function parseCards(json: string | null | undefined): CardsData {
  try {
    const d = JSON.parse(json ?? '')
    const groups = Array.isArray(d?.groups) ? d.groups : []
    return {
      groups: groups.map((g: CardGroup) => ({
        title: String(g?.title ?? ''),
        cards: (Array.isArray(g?.cards) ? g.cards : [])
          .filter((c: PageCard) => c && typeof c.page === 'string' && c.page.trim())
          .map((c: PageCard) => ({ page: c.page, ...(c.tag ? { tag: String(c.tag) } : {}), ...(c.image ? { image: String(c.image) } : {}) }))
      }))
    }
  } catch {
    return { groups: [] }
  }
}

export const emptyCards = (): CardsData => ({ groups: [{ title: 'Characters', cards: [] }] })

/** Page titles the cards link to (for "what links here" and renaming). */
export function cardTitles(html: string): string[] {
  const out: string[] = []
  for (const m of html.matchAll(/data-cards="([^"]*)"/g)) {
    for (const g of parseCards(decodeAttr(m[1])).groups) for (const c of g.cards) out.push(c.page)
  }
  return out
}

/** Rename a page inside every cards block of some page HTML. */
export function renameInCards(html: string, from: (title: string) => boolean, to: string): { html: string; changed: boolean } {
  let changed = false
  const out = html.replace(/data-cards="([^"]*)"/g, (all, raw: string) => {
    const data = parseCards(decodeAttr(raw))
    let hit = false
    for (const g of data.groups) for (const c of g.cards) if (from(c.page)) ((c.page = to), (hit = true))
    if (!hit) return all
    changed = true
    return `data-cards="${escapeHtml(JSON.stringify(data))}"`
  })
  return { html: out, changed }
}

function decodeAttr(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}
