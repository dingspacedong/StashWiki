import { create } from 'zustand'
import type { Library, Page, WikiMeta } from '@shared/types'
import { cleanTitle, renameLinks, titleKey } from './lib/wikitext'
import { mixAfterSave } from './lib/mixUp'

export type SpecialName = 'allpages' | 'categories' | 'recent' | 'templates' | 'settings' | 'trash' | 'css' | 'stories' | 'navigation'

export type Route =
  | { kind: 'page'; id: string }
  | { kind: 'edit'; id: string; draft?: Page }
  | { kind: 'new'; title?: string; templateId?: string }
  | { kind: 'special'; name: SpecialName }
  | { kind: 'search'; q: string }
  | { kind: 'category'; name: string }
  | { kind: 'backlinks'; id: string }
  | { kind: 'history'; id: string }

interface State {
  library: Library | null
  wikiId: string | null
  meta: WikiMeta | null
  dir: string
  pages: Record<string, Page>
  route: Route
  past: Route[]
  future: Route[]
  /** Set by the editor while it has unsaved changes. */
  dirty: boolean
  toast: string | null
  /** A button on the toast, e.g. Undo. */
  toastAction: { label: string; run: () => void } | null
  error: string | null

  init(): Promise<void>
  refreshLibrary(): Promise<void>
  openWiki(id: string): Promise<void>
  closeWiki(): void
  go(route: Route, opts?: { replace?: boolean; force?: boolean }): void
  back(): void
  forward(): void
  setDirty(d: boolean): void
  notify(msg: string, action?: { label: string; run: () => void }): void
  /** `snapshot: 'force'` keeps the replaced version in the page history even if one was kept recently. */
  savePage(page: Page, previousTitle?: string, snapshot?: 'auto' | 'force' | 'none'): Promise<void>
  trashPage(id: string): Promise<void>
  addRestoredPage(page: Page): Promise<void>
  saveMeta(meta: WikiMeta): Promise<void>
  /** Save a change that touches the settings and many pages at once (renaming a category, say). */
  saveMetaAndPages(meta: WikiMeta, pages: Page[]): Promise<void>
}

const api = window.stash
let toastTimer: ReturnType<typeof setTimeout> | undefined

function confirmLeave(dirty: boolean): boolean {
  return !dirty || window.confirm('You have unsaved changes on this page. Leave without saving?')
}

export const useStore = create<State>((set, get) => ({
  library: null,
  wikiId: null,
  meta: null,
  dir: '',
  pages: {},
  route: { kind: 'special', name: 'recent' },
  past: [],
  future: [],
  dirty: false,
  toast: null,
  toastAction: null,
  error: null,

  async init() {
    const library = await api.library()
    set({ library })
    const last = library.lastWikiId && library.wikis.find((w) => w.id === library.lastWikiId)
    if (last)
      await get()
        .openWiki(last.id)
        .catch(() => set({ wikiId: null }))
  },

  async refreshLibrary() {
    set({ library: await api.library() })
  },

  async openWiki(id) {
    try {
      const data = await api.loadWiki(id)
      const pages: Record<string, Page> = {}
      for (const p of data.pages) pages[p.id] = p
      const main = data.meta.mainPageId && pages[data.meta.mainPageId]
      set({
        wikiId: id,
        meta: data.meta,
        dir: data.dir,
        pages,
        route: main ? { kind: 'page', id: main.id } : { kind: 'special', name: 'allpages' },
        past: [],
        future: [],
        dirty: false,
        error: null
      })
      await get().refreshLibrary()
    } catch (e) {
      set({ error: String((e as Error).message ?? e) })
      throw e
    }
  },

  closeWiki() {
    if (!confirmLeave(get().dirty)) return
    set({ wikiId: null, meta: null, pages: {}, dirty: false })
    void get().refreshLibrary()
  },

  go(route, opts) {
    const s = get()
    if (!opts?.force && !confirmLeave(s.dirty)) return
    if (opts?.replace) set({ route, dirty: false })
    else set({ route, past: [...s.past.slice(-50), s.route], future: [], dirty: false })
    document.querySelector('.content-scroll')?.scrollTo(0, 0)
  },

  back() {
    const s = get()
    const prev = s.past[s.past.length - 1]
    if (!prev || !confirmLeave(s.dirty)) return
    set({ route: prev, past: s.past.slice(0, -1), future: [s.route, ...s.future], dirty: false })
  },

  forward() {
    const s = get()
    const next = s.future[0]
    if (!next || !confirmLeave(s.dirty)) return
    set({ route: next, past: [...s.past, s.route], future: s.future.slice(1), dirty: false })
  },

  setDirty(dirty) {
    if (get().dirty !== dirty) set({ dirty })
  },

  notify(msg, action) {
    clearTimeout(toastTimer)
    set({ toast: msg, toastAction: action ?? null })
    // Messages with a button stay up longer so there is time to press it.
    toastTimer = setTimeout(() => set({ toast: null, toastAction: null }), action ? 8000 : 2600)
  },

  async savePage(page, previousTitle, snapshot) {
    const { wikiId, pages } = get()
    if (!wikiId) return
    const saved = { ...page, title: cleanTitle(page.title), updatedAt: Date.now() }
    await api.savePage(wikiId, saved, snapshot)
    const next = { ...pages, [saved.id]: saved }

    // Renaming a page keeps every link to it working.
    let relinked = 0
    if (previousTitle && titleKey(previousTitle) !== titleKey(saved.title)) {
      const changed: Page[] = []
      for (const p of Object.values(next)) {
        const updated = renameLinks(p, previousTitle, saved.title)
        if (updated) changed.push(updated)
      }
      if (changed.length) {
        await api.savePages(wikiId, changed)
        for (const p of changed) next[p.id] = p
        relinked = changed.length
      }
    }
    set({ pages: next, dirty: false })
    if (get().meta) mixAfterSave(get().meta!)
    if (relinked) get().notify(`Updated links on ${relinked} page${relinked === 1 ? '' : 's'}`)
  },

  async trashPage(id) {
    const { wikiId, pages, meta } = get()
    if (!wikiId || !meta) return
    await api.trashPage(wikiId, id)
    const next = { ...pages }
    delete next[id]
    set({ pages: next, dirty: false })
    if (meta.mainPageId === id) await get().saveMeta({ ...meta, mainPageId: null })
  },

  async addRestoredPage(page) {
    const { pages } = get()
    let title = page.title
    const taken = (t: string): boolean => Object.values(pages).some((p) => titleKey(p.title) === titleKey(t))
    for (let n = 2; taken(title); n++) title = `${page.title} (${n})`
    const restored = { ...page, title }
    if (title !== page.title) await get().savePage(restored)
    else set({ pages: { ...pages, [page.id]: restored } })
  },

  async saveMeta(meta) {
    const { wikiId } = get()
    if (!wikiId) return
    await api.saveMeta(wikiId, meta)
    set({ meta })
  },

  async saveMetaAndPages(meta, changed) {
    const { wikiId } = get()
    if (!wikiId) return
    const now = Date.now()
    const stamped = changed.map((p) => ({ ...p, updatedAt: now }))
    if (stamped.length) await api.savePages(wikiId, stamped)
    await api.saveMeta(wikiId, meta)
    const pages = { ...get().pages }
    for (const p of stamped) pages[p.id] = p
    set({ meta, pages })
  }
}))

/** Look a page up by title (case-insensitive). */
export function findPage(pages: Record<string, Page>, title: string): Page | undefined {
  const key = titleKey(title)
  return Object.values(pages).find((p) => titleKey(p.title) === key)
}

export function useTitleIndex(): Map<string, Page> {
  const pages = useStore((s) => s.pages)
  return titleIndexFor(pages)
}

let cachedPages: Record<string, Page> | null = null
let cachedIndex = new Map<string, Page>()
function titleIndexFor(pages: Record<string, Page>): Map<string, Page> {
  if (pages !== cachedPages) {
    cachedPages = pages
    cachedIndex = new Map(Object.values(pages).map((p) => [titleKey(p.title), p]))
  }
  return cachedIndex
}

export function sortedPages(pages: Record<string, Page>): Page[] {
  return Object.values(pages).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
}
