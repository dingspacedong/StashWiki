// The wiki's own sidebar sections and its nav boxes: worked out once from the wiki's settings, and drawn the same
// way in the app and in an exported website.
import { escapeHtml } from '@shared/defaults'
import type { NavLink, Navbox, Page, WikiMeta } from '@shared/types'
import { isWikiPage } from './stories'
import { titleKey } from './wikitext'

/** What a sidebar link points at: "https://…" is a website, "Category:Name" a category, anything else a page title. */
export type NavTarget = { kind: 'page'; title: string } | { kind: 'category'; name: string } | { kind: 'url'; url: string } | { kind: 'none' }

export function parseTarget(target: string): NavTarget {
  const s = target.trim()
  if (!s) return { kind: 'none' }
  if (/^https?:\/\//i.test(s)) return { kind: 'url', url: s }
  const cat = s.match(/^category\s*:\s*(.+)$/i)
  if (cat) return { kind: 'category', name: cat[1].trim() }
  return { kind: 'page', title: s }
}

/** The wiki pages in a category, by title. */
export function categoryPages(pages: Page[], name: string): Page[] {
  const key = titleKey(name)
  return pages
    .filter((p) => isWikiPage(p) && p.categories.some((c) => titleKey(c) === key))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
}

/** A link as shown: its label (the target's name when left empty) and its sub-links, with a category's pages added when asked. */
export interface ShownLink {
  label: string
  target: NavTarget
  children: ShownLink[]
}

export function shownLinks(links: NavLink[], pages: Page[]): ShownLink[] {
  return links
    .filter((l) => l.label.trim() || l.target.trim())
    .map((l) => {
      const target = parseTarget(l.target)
      const fallback = target.kind === 'page' ? target.title : target.kind === 'category' ? target.name : target.kind === 'url' ? target.url : ''
      const children = shownLinks(l.children ?? [], pages)
      if (l.listPages && target.kind === 'category') {
        const have = new Set(children.map((c) => (c.target.kind === 'page' ? titleKey(c.target.title) : '')))
        for (const p of categoryPages(pages, target.name)) {
          if (!have.has(titleKey(p.title))) children.push({ label: p.title, target: { kind: 'page', title: p.title }, children: [] })
        }
      }
      return { label: l.label.trim() || fallback, target, children }
    })
}

/** Every page title a nav box row lists: the ones picked by hand, then its category's pages. */
export function navboxRowPages(row: Navbox['groups'][number], pages: Page[]): string[] {
  const out = row.pages.map((t) => t.trim()).filter(Boolean)
  const seen = new Set(out.map(titleKey))
  if (row.category?.trim()) {
    for (const p of categoryPages(pages, row.category)) {
      if (!seen.has(titleKey(p.title))) {
        seen.add(titleKey(p.title))
        out.push(p.title)
      }
    }
  }
  return out
}

/**
 * A nav box as HTML. Its links are ordinary wiki links (`data-wikilink`), so reading view and the website treat
 * them like any other link (missing pages show in red).
 */
export function navboxHtml(box: Navbox | undefined, pages: Page[]): string {
  if (!box) return ''
  const rows = box.groups
    .map((g) => ({ label: g.label.trim(), links: navboxRowPages(g, pages) }))
    .filter((r) => r.label || r.links.length)
    .map(
      (r) =>
        `<div class="nb-row"><div class="nb-label">${escapeHtml(r.label)}</div><div class="nb-links">${r.links
          .map((t) => `<a data-wikilink="${escapeHtml(t)}">${escapeHtml(t)}</a>`)
          .join('<span class="nb-dot"> · </span>')}</div></div>`
    )
    .join('')
  return `<div class="navbox" data-box="${escapeHtml(box.id)}"><div class="nb-title">${escapeHtml(box.title || 'Navigation')}</div>${rows}</div>`
}

/** Nav boxes set to show by themselves on this page (by its categories), leaving out ones already placed in its writing. */
export function autoNavboxes(meta: WikiMeta, page: Page): Navbox[] {
  const cats = new Set(page.categories.map(titleKey))
  return (meta.navboxes ?? []).filter(
    (b) => (b.showOn ?? []).some((c) => cats.has(titleKey(c))) && !page.body.includes(`data-navbox="${b.id}"`)
  )
}

/** The stored tag for a nav box placed in a page's writing. */
export const navboxTag = (id: string): string => `<div data-navbox="${escapeHtml(id)}"></div>`
