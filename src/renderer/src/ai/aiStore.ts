import { create } from 'zustand'
import { uid } from '@shared/defaults'
import { AI_PROVIDERS, stripThinking, type AiMessage, type AiSettings } from '@shared/ai'
import type { Page } from '@shared/types'
import { useStore, type Route } from '../store'
import { sanitizeHtml } from '../lib/render'
import { titleKey } from '../lib/wikitext'
import { systemPrompt } from './context'
import { changesPage, plan, touchedTitles, type Proposal } from './proposals'
import { relatedPages } from './related'
import { flushEditor, isOpenInAutosave } from '../lib/useAutosave'
import { usePrefs } from '../lib/prefs'

export type StoryMode = 'write' | 'suggest' | 'summary'
export type WriteLength = 'short' | 'medium' | 'long'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
  error?: string
  /** For replies about a story: which helper mode asked, and the story or chapter it was about. */
  mode?: StoryMode
  target?: string
  /** Sent while the buddy knew how StashWiki works, so its other kinds of change are understood. */
  tools?: boolean
}

export interface CardState {
  status: 'applied' | 'dismissed' | 'undone'
  undo?: () => Promise<void>
}

interface AiState {
  settings: AiSettings | null
  open: boolean
  messages: ChatMessage[]
  busyId: string | null
  /** Whether the page being looked at is sent along with messages. */
  includePage: boolean
  /** Pages the user added for the buddy to read. */
  extraIds: string[]
  /** Look for related pages by itself; what it found, each with its own tickbox. */
  autoFind: boolean
  found: { id: string; on: boolean }[]
  cards: Record<string, CardState>
  /** How the buddy helps while a story or chapter is open. */
  storyMode: StoryMode
  writeLength: WriteLength
  loadSettings(): Promise<void>
  saveSettings(patch: Parameters<NonNullable<typeof window.stash.ai>['saveSettings']>[0]): Promise<void>
  setKey(key: string | null): Promise<void>
  setOpen(open: boolean): void
  send(text: string): Promise<void>
  /** Ask again for a reply (the same message), replacing the old reply. */
  retry(assistantId: string): Promise<void>
  stop(): void
  clear(): void
  apply(cardId: string, p: Proposal): Promise<void>
  dismiss(cardId: string): void
  undo(cardId: string): Promise<void>
}

const api = (): NonNullable<typeof window.stash.ai> => {
  if (!window.stash.ai) throw new Error('This version of StashWiki has no AI writing buddy.')
  return window.stash.ai
}

/** The page the user is reading or editing, if any. */
export function currentPage(): Page | null {
  const { route, pages } = useStore.getState()
  return pageFor(route, pages)
}

/** Same as currentPage, but re-renders the component when the page or route changes. */
export function useCurrentPage(): Page | null {
  const route = useStore((s) => s.route)
  const pages = useStore((s) => s.pages)
  return pageFor(route, pages)
}

function pageFor(route: Route, pages: Record<string, Page>): Page | null {
  if (route.kind === 'page' || route.kind === 'backlinks') return pages[route.id] ?? null
  if (route.kind === 'edit') return pages[route.id] ?? route.draft ?? null
  return null
}

const HISTORY = 20
const SHORT_HISTORY = 8

/** Settings are complete enough to chat. */
export function isReady(s: AiSettings | null): boolean {
  return !!s && !!s.model && (s.hasKey || !AI_PROVIDERS[s.provider].needsKey)
}

export const useAi = create<AiState>((set, get) => ({
  settings: null,
  open: false,
  messages: [],
  busyId: null,
  includePage: true,
  extraIds: [],
  autoFind: false,
  found: [],
  cards: {},
  storyMode: 'write',
  writeLength: 'medium',

  async loadSettings() {
    if (!window.stash.ai) return
    set({ settings: await api().getSettings() })
  },

  async saveSettings(patch) {
    const settings = await api().saveSettings(patch)
    set({ settings, open: settings.enabled ? get().open : false })
  },

  async setKey(key) {
    set({ settings: await api().setKey(key) })
  },

  setOpen(open) {
    set({ open })
  },

  async send(text) {
    const content = text.trim()
    const { meta, pages } = useStore.getState()
    if (!content || get().busyId || !meta) return
    const page = get().includePage ? currentPage() : null
    if (get().autoFind) refreshFound(content)
    const extra = contextPages()
    const short = !!get().settings?.shortContext
    const history: AiMessage[] = get()
      .messages.filter((m) => !m.error && m.content)
      .slice(-(short ? SHORT_HISTORY : HISTORY))
      .map((m) => ({ role: m.role, content: m.role === 'assistant' ? stripThinking(m.content).text : m.content }))
    const storyPage = page && (page.story || page.chapter) ? page : null
    const story = storyPage ? { mode: get().storyMode, length: get().writeLength } : undefined
    const messages: AiMessage[] = [{ role: 'system', content: systemPrompt(meta, pages, page, short, extra, story, !!get().settings?.wikiTools) }, ...history, { role: 'user', content }]
    const id = uid()
    set({
      busyId: id,
      messages: [
        ...get().messages,
        { id: uid(), role: 'user', content },
        { id, role: 'assistant', content: '', streaming: true, mode: story?.mode, target: storyPage?.title, tools: !!get().settings?.wikiTools }
      ]
    })
    try {
      await api().chat(id, messages)
    } catch (e) {
      finish(id, String((e as Error).message ?? e))
    }
  },

  async retry(assistantId) {
    const msgs = get().messages
    const i = msgs.findIndex((m) => m.id === assistantId)
    const ask = msgs[i - 1]
    if (i < 1 || ask?.role !== 'user' || get().busyId) return
    set({ messages: msgs.slice(0, i - 1) })
    await get().send(ask.content)
  },

  stop() {
    const id = get().busyId
    if (id) void api().abort(id)
  },

  clear() {
    get().stop()
    set({ messages: [], cards: {}, busyId: null })
  },

  async apply(cardId, p) {
    const s = useStore.getState()
    if (s.route.kind === 'edit') {
      const editing = s.pages[s.route.id]?.title ?? s.route.draft?.title ?? ''
      const touches = touchedTitles(p, s.pages).some((t) => titleKey(t) === titleKey(editing))
      // Self-saving editors (chapters, story details) save first and then show the change.
      if (touches && isOpenInAutosave(s.route.id)) await flushEditor(s.route.id)
      else if (touches) {
        throw new Error(
          usePrefs.getState().simple
            ? 'That page is open for editing. Click Done on it first, then apply.'
            : 'That page is open in the editor. Save or cancel your edits first, then apply.'
        )
      }
    }
    const result = plan(p, { pages: useStore.getState().pages, meta: s.meta!, sanitize: sanitizeHtml })
    if (!result.meta && !result.created.length && !result.pages.some((pg) => changesPage(useStore.getState().pages[pg.id], pg))) {
      throw new Error('Applying this wouldn’t change anything: what it suggests is already on the page.')
    }
    const prevTemplates = s.meta!.templates
    const prevCss = s.meta!.customCss
    const { categories: prevCategories, sidebar: prevSidebar, navboxes: prevNavboxes } = s.meta!
    const prevPages = result.pages.map((pg) => useStore.getState().pages[pg.id]).filter((x): x is Page => !!x)

    if (result.meta) await useStore.getState().saveMeta(result.meta)
    for (const pg of result.pages) {
      const prev = prevPages.find((x) => x.id === pg.id)
      // Always keep the version the buddy replaces in the page history.
      await useStore.getState().savePage(pg, prev && prev.title !== pg.title ? prev.title : undefined, 'force')
    }
    const now = useStore.getState()
    if (result.openPageId && !(now.route.kind === 'page' && now.route.id === result.openPageId) && now.route.kind !== 'edit') {
      now.go({ kind: 'page', id: result.openPageId })
    }

    const undo = async (): Promise<void> => {
      const st = useStore.getState()
      if (result.meta)
        await st.saveMeta({ ...st.meta!, templates: prevTemplates, customCss: prevCss, categories: prevCategories, sidebar: prevSidebar, navboxes: prevNavboxes })
      for (const id of result.created) if (st.pages[id]) await useStore.getState().trashPage(id)
      for (const prev of prevPages) {
        const cur = useStore.getState().pages[prev.id]
        await useStore.getState().savePage(prev, cur && cur.title !== prev.title ? cur.title : undefined, 'force')
      }
    }
    set({ cards: { ...get().cards, [cardId]: { status: 'applied', undo } } })
  },

  dismiss(cardId) {
    set({ cards: { ...get().cards, [cardId]: { status: 'dismissed' } } })
  },

  async undo(cardId) {
    const card = get().cards[cardId]
    if (!card?.undo) return
    await card.undo()
    set({ cards: { ...get().cards, [cardId]: { status: 'undone' } } })
    useStore.getState().notify('Change undone')
  }
}))

/** Recompute what “find related pages” offers, keeping any tickbox the user already changed. */
export function refreshFound(message = ''): void {
  const { pages } = useStore.getState()
  const s = useAi.getState()
  const fresh = relatedPages(currentPage(), pages, message).filter((p) => !s.extraIds.includes(p.id))
  const kept = s.found.filter((f) => pages[f.id] && (fresh.some((p) => p.id === f.id) || !f.on))
  const next = [...kept, ...fresh.filter((p) => !kept.some((k) => k.id === p.id)).map((p) => ({ id: p.id, on: true }))]
  useAi.setState({ found: next })
}

/** The extra pages that go along with the next message. */
export function contextPages(): Page[] {
  const { pages } = useStore.getState()
  const s = useAi.getState()
  const ids = [...s.extraIds, ...(s.autoFind ? s.found.filter((f) => f.on).map((f) => f.id) : [])]
  return [...new Set(ids)].map((id) => pages[id]).filter((p): p is Page => !!p)
}

function finish(id: string, error?: string): void {
  useAi.setState((s) => ({
    busyId: s.busyId === id ? null : s.busyId,
    messages: s.messages.map((m) => (m.id === id ? { ...m, streaming: false, error } : m))
  }))
}

// Streamed pieces of replies arrive here from the main process.
window.stash.ai?.onEvent((e) => {
  if (e.type === 'delta') {
    useAi.setState((s) => ({ messages: s.messages.map((m) => (m.id === e.id ? { ...m, content: m.content + e.text } : m)) }))
  } else if (e.type === 'done') finish(e.id)
  else finish(e.id, e.message)
})
