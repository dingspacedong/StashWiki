// Finds pages likely to matter for what the user is writing, so the buddy can read them too.
// Runs locally from links, mentions and categories; nothing is sent anywhere to do this.
import type { Page } from '@shared/types'
import { pageLinkKeys, stripHtml, titleKey } from '../lib/wikitext'
import { infoboxText } from '../lib/imageTabs'

const mentions = (text: string, title: string): boolean => {
  const t = title.trim()
  if (t.length < 3) return false
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'iu')
  return re.test(text)
}

/** Pages related to `current` and/or named in `message`, best first. */
export function relatedPages(current: Page | null, pages: Record<string, Page>, message = '', limit = 6): Page[] {
  const all = Object.values(pages)
  const scores = new Map<string, number>()
  const add = (id: string, n: number): void => {
    if (id !== current?.id) scores.set(id, (scores.get(id) ?? 0) + n)
  }

  if (current) {
    const linksOut = pageLinkKeys(current)
    const currentKey = titleKey(current.title)
    const text = stripHtml(current.body) + ' ' + infoboxText(current.infobox).join(' ')
    const categorySize = new Map<string, number>()
    for (const p of all) for (const c of p.categories) categorySize.set(titleKey(c), (categorySize.get(titleKey(c)) ?? 0) + 1)
    for (const p of all) {
      if (p.id === current.id) continue
      const key = titleKey(p.title)
      if (linksOut.has(key)) add(p.id, 5)
      if (pageLinkKeys(p).has(currentKey)) add(p.id, 4)
      else if (!linksOut.has(key) && mentions(text, p.title)) add(p.id, 2)
      for (const c of p.categories) {
        if (!current.categories.some((x) => titleKey(x) === titleKey(c))) continue
        // A small shared category ("House Vance") says more than a big one ("Characters").
        add(p.id, (categorySize.get(titleKey(c)) ?? 0) <= 12 ? 1.5 : 0.3)
      }
    }
  }
  // Pages the user names in their message matter most.
  if (message.trim()) for (const p of all) if (mentions(message, p.title)) add(p.id, 10)

  return [...scores]
    .filter(([, s]) => s >= 2)
    .sort((a, b) => b[1] - a[1] || pages[a[0]].title.localeCompare(pages[b[0]].title))
    .slice(0, limit)
    .map(([id]) => pages[id])
}
