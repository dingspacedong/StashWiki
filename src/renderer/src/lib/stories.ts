// Stories: a story is a page with `story` details and an ordered list of chapters; each chapter is a page
// with `chapter` details. Because they are pages, links, search, history, share files, the buddy and the
// website export all work on them. This file has the rules that don't need the screen.
import { newPage, uid } from '@shared/defaults'
import type { ChapterInfo, Page, StoryInfo, StoryRating, StoryStatus, WikiMeta } from '@shared/types'
import { pageLinkKeys, stripHtml, titleKey } from './wikitext'

export const isStory = (p: Page | undefined): p is Page & { story: StoryInfo } => !!p?.story
export const isChapter = (p: Page | undefined): p is Page & { chapter: ChapterInfo } => !!p?.chapter
/** An ordinary wiki page (not a story or a chapter). */
export const isWikiPage = (p: Page): boolean => !p.story && !p.chapter
/** Whether this wiki uses the Stories feature (on unless switched off in Look & settings). */
export const storiesOn = (meta: WikiMeta | null | undefined): boolean => !meta?.storiesOff
/** Pages to list in search, recent changes and the like: everything, minus stories while they're switched off. */
export const listed = (meta: WikiMeta | null | undefined) => (p: Page): boolean => storiesOn(meta) || isWikiPage(p)

export const STATUS_LABELS: Record<StoryStatus, string> = { wip: 'In progress', complete: 'Complete', hiatus: 'On hiatus' }
export const RATING_LABELS: Record<StoryRating, string> = { '': 'Not rated', general: 'General', teen: 'Teen', mature: 'Mature', explicit: 'Explicit' }
/** Common content warnings to tick; writers can add their own too. */
export const COMMON_WARNINGS = ['Violence', 'Blood or injury', 'Character death', 'Abuse', 'Self-harm', 'Suicide', 'Strong language', 'Sexual content', 'Drugs or alcohol', 'Horror', 'Major spoilers']

export function emptyStory(): StoryInfo {
  return { summary: '', status: 'wip', rating: '', warnings: [], tags: [], characters: [], chapters: [] }
}

/** The page title of a chapter: "Story: Chapter name", made unique if it has to be. */
export function chapterTitle(storyTitle: string, name: string, taken: (t: string) => boolean = () => false): string {
  const base = `${storyTitle}: ${name.trim() || 'Untitled chapter'}`
  let t = base
  for (let n = 2; taken(t); n++) t = `${base} (${n})`
  return t
}

export function makeStory(title: string): Page {
  return { ...newPage(title, null), body: '', story: emptyStory() }
}

export function makeChapter(story: Page, name: string, taken: (t: string) => boolean): Page {
  return {
    ...newPage(chapterTitle(story.title, name, taken), null),
    id: uid(),
    body: '<p></p>',
    chapter: { storyId: story.id, name }
  }
}

/** A story's chapters in reading order. Chapters that point at the story but are missing from its list (e.g. after merging a share file) go at the end. */
export function storyChapters(story: Page, pages: Record<string, Page>): Page[] {
  const listed = (story.story?.chapters ?? []).map((id) => pages[id]).filter((p): p is Page => !!p && p.chapter?.storyId === story.id)
  const seen = new Set(listed.map((p) => p.id))
  const loose = Object.values(pages)
    .filter((p) => p.chapter?.storyId === story.id && !seen.has(p.id))
    .sort((a, b) => a.createdAt - b.createdAt)
  return [...listed, ...loose]
}

/** All stories, newest change first. */
export function allStories(pages: Record<string, Page>): Page[] {
  return Object.values(pages)
    .filter(isStory)
    .sort((a, b) => storyUpdated(b, pages) - storyUpdated(a, pages))
}

/** When anything in the story (its page or a chapter) last changed. */
export function storyUpdated(story: Page, pages: Record<string, Page>): number {
  return Math.max(story.updatedAt, ...storyChapters(story, pages).map((c) => c.updatedAt))
}

/** Words in a piece of page HTML (fancy blocks and page cards don't count). */
export function wordCount(html: string): number {
  const text = stripHtml(html.replace(/<div[^>]*data-(?:html|cards)="[^"]*"[^>]*>(<\/div>)?/g, ' '))
  return text ? text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length : 0
}

export function storyWords(story: Page, pages: Record<string, Page>): number {
  return storyChapters(story, pages).reduce((n, c) => n + wordCount(c.body), 0)
}

/** About how long it takes to read, at a relaxed 230 words a minute. */
export function readingTime(words: number): string {
  if (!words) return '—'
  const min = Math.max(1, Math.round(words / 230))
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60 ? `${min % 60} min` : ''}`.trim()
}

export const formatCount = (n: number): string => n.toLocaleString('en-US')

/** Stories in a series, in part order. */
export function seriesStories(series: string, pages: Record<string, Page>): Page[] {
  const key = titleKey(series)
  return Object.values(pages)
    .filter((p) => p.story?.series && titleKey(p.story.series) === key)
    .sort((a, b) => (a.story!.seriesPart ?? 999) - (b.story!.seriesPart ?? 999) || a.title.localeCompare(b.title))
}

/** Stories a wiki page turns up in: listed as a character, or linked from one of its chapters. */
export function appearances(page: Page, pages: Record<string, Page>): { story: Page; chapters: Page[]; listed: boolean }[] {
  const key = titleKey(page.title)
  const out: { story: Page; chapters: Page[]; listed: boolean }[] = []
  for (const story of Object.values(pages).filter(isStory)) {
    if (story.id === page.id) continue
    const listed = story.story.characters.some((c) => titleKey(c) === key)
    const chapters = storyChapters(story, pages).filter((c) => pageLinkKeys(c).has(key))
    if (listed || chapters.length || pageLinkKeys(story).has(key)) out.push({ story, chapters, listed })
  }
  return out.sort((a, b) => a.story.title.localeCompare(b.story.title))
}

/** After reordering: chapters still called "Chapter N" get the number of their new place. */
export function renumber(chapters: Page[]): { page: Page; name: string }[] {
  return chapters.flatMap((c, i) => {
    const m = /^Chapter (\d+)$/i.exec(c.chapter?.name ?? '')
    return m && Number(m[1]) !== i + 1 ? [{ page: c, name: `Chapter ${i + 1}` }] : []
  })
}
