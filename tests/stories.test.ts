import { describe, expect, it } from 'vitest'
import { defaultTemplates, newPage } from '../src/shared/defaults'
import { stripThinking } from '../src/shared/ai'
import type { Page, WikiMeta } from '../src/shared/types'
import { appearances, chapterTitle, makeChapter, makeStory, readingTime, renumber, storyChapters, storyWords, wordCount } from '../src/renderer/src/lib/stories'
import { cleanProse, plan, splitReply, type Proposal } from '../src/renderer/src/ai/proposals'
import { systemPrompt } from '../src/renderer/src/ai/context'
import { htmlBlockTag } from '../src/renderer/src/lib/customHtml'
import { pageLinkKeys, renameLinks } from '../src/renderer/src/lib/wikitext'

const templates = defaultTemplates()
const meta: WikiMeta = { id: 'w', name: 'T', tagline: '', logo: '', mainPageId: null, createdAt: 0, categories: {}, theme: {} as WikiMeta['theme'], templates }

function world(): Record<string, Page> {
  const wren = { ...newPage('Wren', templates[0]), id: 'wren', body: '<p>A small grey owl who keeps the lighthouse.</p>' }
  const story = { ...makeStory('The Lighthouse'), id: 's1' }
  story.story = { ...story.story!, characters: ['Wren'], summary: 'Wren keeps the lamp lit.', chapters: ['c1', 'c2'] }
  const c1 = { ...makeChapter(story, 'Chapter 1', () => false), id: 'c1', body: '<p>The storm came at night.</p><p>Wren climbed the stairs.</p>', createdAt: 1 }
  const c2 = { ...makeChapter(story, 'The Key', () => false), id: 'c2', body: '<p>She found a key. <a data-wikilink="Wren" class="wikilink">Wren</a> smiled.</p>', createdAt: 2 }
  c1.chapter!.summary = 'The storm arrives.'
  return { wren, s1: story, c1, c2 }
}
const ctx = (pages: Record<string, Page>) => ({ pages, meta, sanitize: (h: string) => h })
const one = (json: string): Proposal => {
  const seg = splitReply('```stashwiki\n' + json + '\n```')[0]
  if (seg.kind !== 'proposal') throw new Error(seg.kind === 'bad' ? seg.error : 'text')
  return seg.proposal
}

describe('stories and chapters', () => {
  it('chapter titles are "Story: Name" and kept unique', () => {
    expect(chapterTitle('The Lighthouse', 'The Key')).toBe('The Lighthouse: The Key')
    expect(chapterTitle('A', 'B', (t) => t === 'A: B')).toBe('A: B (2)')
  })
  it('lists chapters in order, adding ones missing from the list (e.g. after a merge)', () => {
    const pages = world()
    pages.s1 = { ...pages.s1, story: { ...pages.s1.story!, chapters: ['c2'] } }
    expect(storyChapters(pages.s1, pages).map((c) => c.id)).toEqual(['c2', 'c1'])
  })
  it('counts words without fancy blocks, and reading time', () => {
    expect(wordCount('<p>One two three.</p>' + htmlBlockTag('<p>not these words at all</p>'))).toBe(3)
    expect(storyWords(world().s1, world())).toBe(15)
    expect(readingTime(0)).toBe('—')
    expect(readingTime(460)).toBe('2 min')
    expect(readingTime(23000)).toBe('1 h 40 min')
  })
  it('renumbers chapters still called "Chapter N" after reordering', () => {
    const pages = world()
    expect(renumber([pages.c2, pages.c1]).map((r) => [r.page.id, r.name])).toEqual([['c1', 'Chapter 2']])
  })
  it('a character page knows the stories it appears in', () => {
    const pages = world()
    const a = appearances(pages.wren, pages)
    expect(a).toHaveLength(1)
    expect(a[0].listed).toBe(true)
    expect(a[0].chapters.map((c) => c.id)).toEqual(['c2'])
  })
  it('renaming a character updates the story’s character list, and links are counted', () => {
    const pages = world()
    expect(pageLinkKeys(pages.s1).has('wren')).toBe(true)
    expect(renameLinks(pages.s1, 'Wren', 'Wren the Owl')!.story!.characters).toEqual(['Wren the Owl'])
  })
})

describe('the buddy never leaves its thinking in the story', () => {
  it('removes every kind of thinking block, even when only the closing tag arrives', () => {
    expect(stripThinking('<thinking>plan</thinking>Hi').text).toBe('Hi')
    expect(stripThinking('[THINK]hmm[/THINK]Hi').text).toBe('Hi')
    expect(stripThinking('so first I will plan the scene...</think>\n\nThe rain fell.').text).toBe('The rain fell.')
  })
  it('cleans prose: thinking, stray tags and a repeated chapter heading', () => {
    expect(cleanProse('<think>outline</think><h2>Chapter 3: Rain</h2><p>The rain fell.</p>')).toBe('<p>The rain fell.</p>')
    expect(cleanProse('<p>The rain fell.</think></p>')).toBe('<p>The rain fell.</p>')
  })
})

describe('write with me', () => {
  it('adds prose to the end of a chapter', () => {
    const pages = world()
    const p = one('{"action":"write_chapter","chapter":"The Lighthouse: The Key","html":"<p>The door creaked open.</p>","mode":"append"}')
    const body = plan(p, ctx(pages)).pages[0].body
    expect(body).toBe('<p>She found a key. <a data-wikilink="Wren" class="wikilink">Wren</a> smiled.</p><p>The door creaked open.</p>')
  })
  it('understands other names for it and finds the chapter by its own name or number', () => {
    const pages = world()
    expect(plan(one('{"action":"continue","story":"The Lighthouse","chapter":"The Key","text":"More."}'), ctx(pages)).pages[0].id).toBe('c2')
    expect(plan(one('{"action":"write","story":"The Lighthouse","chapter":"1","prose":"<p>More.</p>"}'), ctx(pages)).pages[0].id).toBe('c1')
  })
  it('a new chapter goes at the end of the story', () => {
    const pages = world()
    const r = plan(one('{"action":"new_chapter","story":"The Lighthouse","name":"Dawn","html":"<p>Morning came.</p>"}'), ctx(pages))
    const [chapter, story] = r.pages
    expect(chapter.title).toBe('The Lighthouse: Dawn')
    expect(chapter.chapter).toMatchObject({ storyId: 's1', name: 'Dawn' })
    expect(story.story!.chapters).toEqual(['c1', 'c2', chapter.id])
    expect(r.created).toEqual([chapter.id])
  })
  it('the writing in the card has no thinking in it', () => {
    const p = one('{"action":"write_chapter","chapter":"x","html":"<think>let me plan</think><p>Prose.</p>"}') as Extract<Proposal, { action: 'write_chapter' }>
    expect(p.html).toBe('<p>Prose.</p>')
  })
})

describe('summaries', () => {
  it('sets a chapter or story summary', () => {
    const pages = world()
    expect(plan(one('{"action":"set_summary","target":"chapter","page":"The Lighthouse: The Key","summary":"Wren finds a key."}'), ctx(pages)).pages[0].chapter!.summary).toBe('Wren finds a key.')
    expect(plan(one('{"action":"summarize","story":"The Lighthouse","blurb":"<p>A lighthouse tale.</p>"}'), ctx(pages)).pages[0].story!.summary).toBe('A lighthouse tale.')
  })
})

describe('what the buddy is told about a story', () => {
  it('story details, characters from the wiki, chapter summaries, the previous chapter and the mode', () => {
    const pages = world()
    const sys = systemPrompt(meta, pages, pages.c2, false, [], { mode: 'write', length: 'long' })
    expect(sys).toContain('"The Lighthouse"')
    expect(sys).toContain('Story summary: Wren keeps the lamp lit.')
    expect(sys).toContain('- Wren: ')
    expect(sys).toContain('A small grey owl')
    expect(sys).toContain('1. Chapter 1 (page title "The Lighthouse: Chapter 1") — The storm arrives.')
    expect(sys).toContain('The previous chapter ("Chapter 1") ends like this:')
    expect(sys).toContain('MODE: WRITE WITH ME')
    expect(sys).toContain('about 800 words')
    expect(sys).toContain('Never show your reasoning')
    expect(systemPrompt(meta, pages, pages.c2, false, [], { mode: 'summary', length: 'short' })).toContain('MODE: SUMMARIZE')
    expect(systemPrompt(meta, pages, pages.s1, false, [], { mode: 'suggest', length: 'short' })).toContain('MODE: SUGGEST')
    // Chapters don't crowd the list of wiki pages.
    expect(sys).not.toMatch(/Pages \(\d+\):[^\n]*The Lighthouse: The Key/)
  })
})
