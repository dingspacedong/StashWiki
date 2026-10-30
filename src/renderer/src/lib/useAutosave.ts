import { useEffect, useRef, useState } from 'react'
import type { Page } from '@shared/types'
import { useStore } from '../store'
import { isModKey } from './platform'

export type SaveState = 'saved' | 'saving' | 'waiting'

/** Pages open in a self-saving editor, and how to save them now (so others, like the buddy, can change them safely). */
const openEditors = new Map<string, () => Promise<void>>()
export const isOpenInAutosave = (id: string): boolean => openEditors.has(id)
export async function flushEditor(id: string): Promise<void> {
  await openEditors.get(id)?.()
}

/**
 * Edit a page with automatic saving: changes are written a moment after typing stops, when leaving, and on
 * Ctrl/Cmd+S. `beforeSave` can adjust the page (e.g. its title) and `afterSave` runs once it's written.
 */
export function useAutosave(
  id: string,
  opts: { beforeSave?: (p: Page) => Page; afterSave?: (saved: Page, previousTitle: string) => Promise<void> | void } = {}
): { draft: Page | undefined; update: (patch: Partial<Page>) => void; status: SaveState; flush: () => Promise<void>; version: number } {
  const stored = useStore((s) => s.pages[id])
  const [draft, setDraft] = useState<Page | undefined>(stored)
  const [status, setStatus] = useState<SaveState>('saved')
  // Bumped when the page changed from outside (e.g. the buddy added text), so editors redraw with it.
  const [version, setVersion] = useState(0)
  const saving = useRef(false)
  const lastWritten = useRef(stored?.updatedAt)
  const draftRef = useRef(draft)
  const savedTitle = useRef(stored?.title ?? '')
  const pending = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const optsRef = useRef(opts)
  optsRef.current = opts
  // The wiki this page belongs to: a last save after the wiki was closed still goes there.
  const wikiId = useRef(useStore.getState().wikiId)

  const flush = async (): Promise<void> => {
    clearTimeout(timer.current)
    if (!pending.current || !draftRef.current) return
    pending.current = false
    setStatus('saving')
    const page = optsRef.current.beforeSave ? optsRef.current.beforeSave(draftRef.current) : draftRef.current
    const previous = savedTitle.current
    // Keep the newest saved version (other pages may have changed it meanwhile, e.g. its chapter list).
    const latest = useStore.getState().pages[page.id]
    saving.current = true
    const toSave = latest?.story && page.story ? { ...page, story: { ...page.story, chapters: latest.story.chapters } } : page
    if (useStore.getState().wikiId === wikiId.current) await useStore.getState().savePage(toSave, previous !== page.title ? previous : undefined)
    else if (wikiId.current) await window.stash.savePage(wikiId.current, { ...toSave, updatedAt: Date.now() })
    saving.current = false
    lastWritten.current = useStore.getState().pages[page.id]?.updatedAt
    savedTitle.current = page.title
    if (page.title !== draftRef.current.title) {
      draftRef.current = { ...draftRef.current, title: page.title }
      setDraft(draftRef.current)
    }
    await optsRef.current.afterSave?.(page, previous)
    if (!pending.current) setStatus('saved')
  }
  const flushRef = useRef(flush)
  flushRef.current = flush

  const update = (patch: Partial<Page>): void => {
    const next = { ...draftRef.current!, ...patch }
    draftRef.current = next
    setDraft(next)
    pending.current = true
    setStatus('waiting')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flushRef.current(), 800)
  }

  // Someone else changed the page (and nothing is waiting to be saved here): show their version.
  useEffect(() => {
    if (!stored || saving.current || pending.current || stored.updatedAt === lastWritten.current) return
    lastWritten.current = stored.updatedAt
    draftRef.current = stored
    savedTitle.current = stored.title
    setDraft(stored)
    setVersion((v) => v + 1)
  }, [stored])

  useEffect(() => {
    openEditors.set(id, () => flushRef.current())
    const onUnload = (): void => void flushRef.current()
    const onKey = (e: KeyboardEvent): void => {
      if (isModKey(e) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void flushRef.current().then(() => useStore.getState().notify('Saved'))
      }
    }
    window.addEventListener('beforeunload', onUnload)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      window.removeEventListener('keydown', onKey)
      openEditors.delete(id)
      void flushRef.current()
    }
  }, [])

  return { draft, update, status, flush, version }
}

export const SAVE_LABEL: Record<SaveState, string> = { saved: 'All changes saved', saving: 'Saving…', waiting: 'Saving…' }
