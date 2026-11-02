// Categories and subcategories: a category is any name used on a page, a template or in the wiki's settings, and
// the settings can put one inside another. Renaming or removing one changes it everywhere it's used.
import type { CategoryInfo, NavLink, Page, Template, WikiMeta } from '@shared/types'
import { cleanTitle, titleKey } from './wikitext'

const same = (a: string, b: string): boolean => titleKey(a) === titleKey(b)

/** The settings entry for a category, whatever its capitals. */
export function categoryInfo(meta: WikiMeta, name: string): CategoryInfo | undefined {
  const k = Object.keys(meta.categories).find((c) => same(c, name))
  return k === undefined ? undefined : meta.categories[k]
}

/** The category this one is inside, if any. */
export function parentOf(meta: WikiMeta, name: string): string | undefined {
  return categoryInfo(meta, name)?.parent?.trim() || undefined
}

/** The categories directly inside this one, by name. */
export function childrenOf(meta: WikiMeta, name: string): string[] {
  return Object.keys(meta.categories)
    .filter((c) => !same(c, name) && same(meta.categories[c].parent ?? '', name))
    .sort((a, b) => a.localeCompare(b))
}

/** The categories this one is inside, nearest first. */
export function ancestorsOf(meta: WikiMeta, name: string): string[] {
  const out: string[] = []
  const seen = new Set([titleKey(name)])
  for (let p = parentOf(meta, name); p && !seen.has(titleKey(p)); p = parentOf(meta, p)) {
    seen.add(titleKey(p))
    out.push(p)
  }
  return out
}

/** Whether `name` can go inside `parent` without ending up inside itself. */
export function canNestUnder(meta: WikiMeta, name: string, parent: string): boolean {
  return !same(name, parent) && !ancestorsOf(meta, parent).some((a) => same(a, name))
}

/** Every category inside this one, however deep. */
export function descendantsOf(meta: WikiMeta, name: string): string[] {
  const out: string[] = []
  const seen = new Set([titleKey(name)])
  const walk = (n: string): void => {
    for (const c of childrenOf(meta, n)) {
      if (seen.has(titleKey(c))) continue
      seen.add(titleKey(c))
      out.push(c)
      walk(c)
    }
  }
  walk(name)
  return out
}

/** The pages a category's page lists: its own, plus its subcategories' when it's set to. */
export function categoryMembers<P extends Page>(meta: WikiMeta, pages: P[], name: string): P[] {
  const keys = new Set([name, ...(categoryInfo(meta, name)?.withSubPages ? descendantsOf(meta, name) : [])].map(titleKey))
  return pages.filter((p) => p.categories.some((c) => keys.has(titleKey(c))))
}

/** Every category in tree order: top-level ones A–Z, each followed by what's inside it. */
export function categoryTree(meta: WikiMeta, all: string[]): { name: string; depth: number }[] {
  const out: { name: string; depth: number }[] = []
  const known = new Set(all.map(titleKey))
  const done = new Set<string>()
  const walk = (name: string, depth: number): void => {
    if (done.has(titleKey(name))) return
    done.add(titleKey(name))
    out.push({ name, depth })
    for (const c of all.filter((x) => same(parentOf(meta, x) ?? '', name)).sort((a, b) => a.localeCompare(b))) walk(c, depth + 1)
  }
  all = [...all].sort((a, b) => a.localeCompare(b))
  for (const c of all) {
    const p = parentOf(meta, c)
    if (!p || !known.has(titleKey(p))) walk(c, 0)
  }
  // Anything left was caught in a loop (A inside B inside A): show it at the top.
  for (const c of all) walk(c, 0)
  return out
}

/** Changes to save: the wiki's settings and the pages that changed. */
export interface CategoryChange {
  meta: WikiMeta
  pages: Page[]
}

function swapIn(list: string[], from: string, to: string | null): string[] {
  const out: string[] = []
  for (const c of list) {
    const next = same(c, from) ? to : c
    if (next && !out.some((o) => same(o, next))) out.push(next)
  }
  return out
}

function relinkNav(links: NavLink[], from: string, to: string | null): NavLink[] {
  const out: NavLink[] = []
  for (const l of links) {
    const children = l.children ? relinkNav(l.children, from, to) : undefined
    const m = l.target.trim().match(/^category\s*:\s*(.+)$/i)
    if (m && same(m[1], from)) {
      // Removed: the link goes, and whatever was under it moves up.
      if (to === null) out.push(...(children ?? []))
      else out.push({ ...l, target: `Category:${to}`, ...(children ? { children } : {}) })
    } else out.push(children ? { ...l, children } : l)
  }
  return out
}

/** Everything in the settings that names categories, with `from` renamed to `to` (or taken out when `to` is null). */
function relinkMeta(meta: WikiMeta, from: string, to: string | null): WikiMeta {
  const templates: Template[] = meta.templates.map((t) => (t.categories.some((c) => same(c, from)) ? { ...t, categories: swapIn(t.categories, from, to) } : t))
  const next: WikiMeta = { ...meta, templates }
  if (meta.sidebar) next.sidebar = meta.sidebar.map((s) => ({ ...s, links: relinkNav(s.links, from, to) }))
  if (meta.navboxes)
    next.navboxes = meta.navboxes.map((b) => ({
      ...b,
      groups: b.groups.map((g) => (g.category && same(g.category, from) ? { ...g, category: to ?? '' } : g)),
      ...(b.showOn ? { showOn: swapIn(b.showOn, from, to) } : {})
    }))
  return next
}

function changedPages(pages: Page[], from: string, to: string | null): Page[] {
  return pages.filter((p) => p.categories.some((c) => same(c, from))).map((p) => ({ ...p, categories: swapIn(p.categories, from, to) }))
}

/** A new category (or new settings for one): its description and the category it's inside. */
export function setCategory(meta: WikiMeta, name: string, info: CategoryInfo): WikiMeta {
  const categories = { ...meta.categories }
  for (const k of Object.keys(categories)) if (same(k, name)) delete categories[k]
  const { parent: _p, ...rest } = info
  const clean: CategoryInfo = { ...rest, description: info.description.trim() }
  const parent = info.parent ? cleanTitle(info.parent) : ''
  if (parent && canNestUnder({ ...meta, categories }, name, parent)) clean.parent = parent
  categories[cleanTitle(name)] = clean
  return { ...meta, categories }
}

/**
 * Rename a category everywhere: its pages, templates, sidebar links, nav boxes and the categories inside it.
 * Renaming to a category that already exists puts the two together.
 */
export function renameCategory(meta: WikiMeta, pages: Page[], from: string, to: string): CategoryChange {
  to = cleanTitle(to)
  // Joining another category keeps that one's spelling.
  if (!same(from, to)) to = Object.keys(meta.categories).find((c) => same(c, to)) ?? to
  const fromInfo = categoryInfo(meta, from)
  const toInfo = same(from, to) ? undefined : categoryInfo(meta, to)
  const categories: Record<string, CategoryInfo> = {}
  for (const [k, v] of Object.entries(meta.categories)) {
    if (same(k, from) || same(k, to)) continue
    categories[k] = v.parent && same(v.parent, from) ? { ...v, parent: to } : v
  }
  if (fromInfo || toInfo) {
    const merged: CategoryInfo = { description: toInfo?.description || fromInfo?.description || '' }
    if (toInfo?.withSubPages || fromInfo?.withSubPages) merged.withSubPages = true
    const parent = toInfo?.parent || fromInfo?.parent
    const parentNow = parent && same(parent, from) ? to : parent
    if (parentNow && !same(parentNow, to)) merged.parent = parentNow
    categories[to] = merged
  }
  const next = { ...relinkMeta(meta, from, to), categories }
  // Putting a category into its own subcategory would make a loop: that subcategory moves up instead.
  if (next.categories[to]?.parent && !canNestUnder({ ...next, categories: { ...categories, [to]: { description: '' } } }, to, next.categories[to].parent!)) {
    const { parent: _p, ...rest } = next.categories[to]
    next.categories[to] = rest
  }
  return { meta: next, pages: changedPages(pages, from, to) }
}

/** Take a category off every page and out of the wiki. The pages stay; what was inside it moves up a level. */
export function removeCategory(meta: WikiMeta, pages: Page[], name: string): CategoryChange {
  const up = parentOf(meta, name)
  const categories: Record<string, CategoryInfo> = {}
  for (const [k, v] of Object.entries(meta.categories)) {
    if (same(k, name)) continue
    if (v.parent && same(v.parent, name)) {
      const { parent: _p, ...rest } = v
      categories[k] = up ? { ...rest, parent: up } : rest
    } else categories[k] = v
  }
  return { meta: { ...relinkMeta(meta, name, null), categories }, pages: changedPages(pages, name, null) }
}
