// Merging a shared copy of a wiki (a .stashwiki file a friend sent back) into your own copy.
// Each page keeps whichever version was edited most recently; nothing is thrown away silently.
import type { Page, TrashedPage, WikiMeta } from './types'

export interface MergeSummary {
  /** Pages that were only in the shared copy. */
  added: number
  /** Pages where the shared copy was newer. */
  updated: number
  /** Pages where your copy was newer (kept yours). */
  keptLocal: number
  unchanged: number
  /** Pages you deleted after the shared copy last changed them (left deleted). */
  stayedDeleted: number
}

export interface MergeResult {
  meta: WikiMeta
  /** Pages to write (new or changed). */
  write: Page[]
  summary: MergeSummary
}

const key = (t: string): string => t.trim().replace(/\s+/g, ' ').toLowerCase()

export function mergeWiki(
  local: { meta: WikiMeta; pages: Page[]; trash: TrashedPage[] },
  incoming: { meta: WikiMeta; pages: Page[] }
): MergeResult {
  const summary: MergeSummary = { added: 0, updated: 0, keptLocal: 0, unchanged: 0, stayedDeleted: 0 }
  const byId = new Map(local.pages.map((p) => [p.id, p]))
  const byTitle = new Map(local.pages.map((p) => [key(p.title), p]))
  const deletedAt = new Map(local.trash.map((t) => [t.page.id, t.deletedAt]))
  /** Incoming page ids that turned out to be pages we already have under another id (same title). */
  const remap = new Map<string, string>()
  const write: Page[] = []

  for (const p of incoming.pages) {
    // Same page by id, or two people who each made a page with the same title.
    const mine = byId.get(p.id) ?? byTitle.get(key(p.title))
    if (!mine) {
      const gone = deletedAt.get(p.id)
      if (gone !== undefined && gone > p.updatedAt) {
        summary.stayedDeleted++
        continue
      }
      write.push(p)
      summary.added++
      continue
    }
    if (mine.id !== p.id) remap.set(p.id, mine.id)
    if (p.updatedAt > mine.updatedAt) {
      write.push({ ...p, id: mine.id })
      summary.updated++
    } else if (p.updatedAt === mine.updatedAt) summary.unchanged++
    else summary.keptLocal++
  }

  // Wiki settings and templates: the most recently changed side wins, and nobody's templates go missing.
  const incomingNewer = (incoming.meta.updatedAt ?? 0) > (local.meta.updatedAt ?? 0)
  const newer = incomingNewer ? incoming.meta : local.meta
  const older = incomingNewer ? local.meta : incoming.meta
  const templates = [...newer.templates, ...older.templates.filter((t) => !newer.templates.some((n) => n.id === t.id))]
  const pageIds = new Set([...local.pages.map((p) => p.id), ...write.map((p) => p.id)])
  let mainPageId = newer.mainPageId ? (remap.get(newer.mainPageId) ?? newer.mainPageId) : null
  if (mainPageId && !pageIds.has(mainPageId)) mainPageId = local.meta.mainPageId
  const meta: WikiMeta = {
    ...newer,
    id: local.meta.id,
    templates,
    categories: { ...older.categories, ...newer.categories },
    mainPageId,
    updatedAt: Math.max(local.meta.updatedAt ?? 0, incoming.meta.updatedAt ?? 0)
  }
  return { meta, write, summary }
}
