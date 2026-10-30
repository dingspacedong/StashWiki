// Changes to stories that touch more than one page (a story and its chapters), kept in step.
import type { Page } from '@shared/types'
import { findPage, useStore } from '../store'
import { chapterTitle, makeChapter, makeStory, renumber, storyChapters } from './stories'
import { cleanTitle, titleKey } from './wikitext'

const st = (): ReturnType<typeof useStore.getState> => useStore.getState()
const taken = (except?: string) => (t: string): boolean => Object.values(st().pages).some((p) => p.id !== except && titleKey(p.title) === titleKey(t))

/** Make a new story; returns it, or an error message when the title is no good. */
export async function createStory(title: string): Promise<Page | string> {
  const t = cleanTitle(title)
  if (!t) return 'Give the story a title.'
  const clash = findPage(st().pages, t)
  if (clash) return `There is already a ${clash.story ? 'story' : clash.chapter ? 'chapter' : 'page'} called “${clash.title}”.`
  const story = makeStory(t)
  await st().savePage(story)
  return story
}

/** Add a chapter at the end (or after `afterId`). */
export async function addChapter(storyId: string, name?: string, body?: string, afterId?: string): Promise<Page> {
  const story = st().pages[storyId]
  const chapters = storyChapters(story, st().pages)
  const chapter = makeChapter(story, name?.trim() || `Chapter ${chapters.length + 1}`, taken())
  if (body) chapter.body = body
  await st().savePage(chapter)
  const ids = chapters.map((c) => c.id)
  const at = afterId ? ids.indexOf(afterId) + 1 : ids.length
  ids.splice(at > 0 ? at : ids.length, 0, chapter.id)
  await st().savePage({ ...st().pages[storyId], story: { ...st().pages[storyId].story!, chapters: ids } })
  return st().pages[chapter.id]
}

/** Give chapters a new order; chapters still called "Chapter N" are renumbered to match. */
export async function reorderChapters(storyId: string, ids: string[]): Promise<void> {
  const story = st().pages[storyId]
  await st().savePage({ ...story, story: { ...story.story!, chapters: ids } }, undefined, 'none')
  for (const { page, name } of renumber(ids.map((id) => st().pages[id]).filter(Boolean))) await renameChapter(page.id, name)
}

/** Rename a chapter (its page title follows: "Story: New name"); links to it keep working. */
export async function renameChapter(id: string, name: string): Promise<void> {
  const ch = st().pages[id]
  const story = st().pages[ch.chapter!.storyId]
  const title = story ? chapterTitle(story.title, name, taken(id)) : ch.title
  await st().savePage({ ...ch, title, chapter: { ...ch.chapter!, name } }, ch.title)
}

/** After a story's title changes, its chapters' titles follow. */
export async function retitleChapters(storyId: string): Promise<void> {
  const story = st().pages[storyId]
  for (const ch of storyChapters(story, st().pages)) {
    const title = chapterTitle(story.title, ch.chapter!.name, taken(ch.id))
    if (title !== ch.title) await st().savePage({ ...ch, title }, ch.title, 'none')
  }
}

/** Move a chapter to the trash and take it out of its story's list. */
export async function trashChapter(id: string): Promise<void> {
  const ch = st().pages[id]
  const story = ch?.chapter && st().pages[ch.chapter.storyId]
  await st().trashPage(id)
  if (story) await st().savePage({ ...story, story: { ...story.story!, chapters: story.story!.chapters.filter((c) => c !== id) } }, undefined, 'none')
}

/** Move a story and all its chapters to the trash. */
export async function trashStory(id: string): Promise<number> {
  const story = st().pages[id]
  const chapters = storyChapters(story, st().pages)
  for (const c of chapters) await st().trashPage(c.id)
  await st().trashPage(id)
  return chapters.length
}

/** A chapter back from the trash goes back into its story (at the end if its place is gone). */
export async function relinkRestored(page: Page): Promise<void> {
  const story = page.chapter && st().pages[page.chapter.storyId]
  if (story?.story && !story.story.chapters.includes(page.id)) {
    await st().savePage({ ...story, story: { ...story.story, chapters: [...story.story.chapters, page.id] } }, undefined, 'none')
  }
}

// ---------- where you stopped reading (per computer, not saved in the wiki) ----------

export interface Progress {
  chapterId: string
  /** How far down the chapter, 0–1. */
  at: number
  time: number
}
const progressKey = (): string => `sw-progress:${st().wikiId}`

function readAll(): Record<string, Progress> {
  try {
    return JSON.parse(localStorage.getItem(progressKey()) ?? '{}') as Record<string, Progress>
  } catch {
    return {}
  }
}

export function getProgress(storyId: string): Progress | null {
  const p = readAll()[storyId]
  return p && st().pages[p.chapterId] ? p : null
}

export function setProgress(storyId: string, chapterId: string, at: number): void {
  try {
    const all = readAll()
    all[storyId] = { chapterId, at: Math.max(0, Math.min(1, at)), time: Date.now() }
    localStorage.setItem(progressKey(), JSON.stringify(all))
  } catch {
    // Private window or blocked storage: reading still works, it just won't be remembered.
  }
}
