import { describe, expect, it } from 'vitest'
import { defaultTemplates, newPage } from '../src/shared/defaults'
import type { Page, WikiMeta } from '../src/shared/types'
import { appendWithoutRepeats, findPage, mergeBody, parseLenient, plan, setSection, splitBlocks, splitReply } from '../src/renderer/src/ai/proposals'
import { relatedPages } from '../src/renderer/src/ai/related'
import { systemPrompt } from '../src/renderer/src/ai/context'

const templates = defaultTemplates()
const meta: WikiMeta = { id: 'w', name: 'T', tagline: '', logo: '', mainPageId: null, createdAt: 0, categories: {}, theme: {} as WikiMeta['theme'], templates }
const juniper: Page = {
  ...newPage('juniper (wolf)', templates[0]),
  id: 'w1',
  body: '<h2>Appearance</h2><p></p><h2>Personality</h2><p>Juniper is shy around strangers but fiercely loyal.</p><h2>Background</h2><p></p>'
}
const ctx = { pages: { w1: juniper }, meta, sanitize: (h: string) => h }

describe('adding to a section never repeats what was there', () => {
  it('skips a paragraph the model resent word for word', () => {
    const out = setSection(juniper.body, 'Personality', '<p>Juniper is shy around strangers but fiercely loyal.</p><p>She also loves thunderstorms.</p>')
    expect(out).toContain('<h2>Personality</h2><p>Juniper is shy around strangers but fiercely loyal.</p><p>She also loves thunderstorms.</p><h2>Background</h2>')
    expect(out.match(/fiercely loyal/g)).toHaveLength(1)
  })
  it('replaces a paragraph the model resent and carried on, instead of doubling it', () => {
    const out = setSection(juniper.body, 'Personality', '<p>Juniper is shy around strangers but fiercely loyal. Once she trusts you, she never lets go.</p>')
    expect(out.match(/fiercely loyal/g)).toHaveLength(1)
    expect(out).toContain('fiercely loyal. Once she trusts you')
  })
  it('ignores a repeated heading and differences in quotes and spacing', () => {
    const existing = '<p>She said “hello” to   the moon.</p>'
    expect(appendWithoutRepeats(existing, '<h2>Personality</h2>'.replace('h2', 'h3').replace('h2', 'h3') + '<p>She said "hello" to the moon.</p>')).toContain('<h3>Personality</h3>')
    expect(appendWithoutRepeats(existing, '<p>She said "hello" to the moon.</p>')).toBe(existing)
    expect(setSection(juniper.body, 'Personality', '<h3>Personality</h3><p>New bit here, quite new.</p>')).not.toContain('<h3>Personality</h3>')
  })
  it('splits nested blocks correctly', () => {
    expect(splitBlocks('<p>a</p><ul><li><p>b</p><ul><li>c</li></ul></li></ul>text<hr><p>d</p>')).toEqual([
      '<p>a</p>', '<ul><li><p>b</p><ul><li>c</li></ul></li></ul>', 'text', '<hr>', '<p>d</p>'
    ])
  })
})

describe('pages that already exist (or not)', () => {
  it('turns “create” of an existing page into adding to it', () => {
    const out = plan({ action: 'create_page', title: 'Juniper (Wolf)', type: 'Character', body: '<h2>Personality</h2><p>Juniper is shy around strangers but fiercely loyal.</p><p>Hates baths.</p>', infobox: { Species: 'Wolf' } }, ctx)
    expect(out.created).toEqual([])
    expect(out.pages[0].id).toBe('w1')
    expect(out.pages[0].body.match(/fiercely loyal/g)).toHaveLength(1)
    expect(out.pages[0].body).toContain('<p>Hates baths.</p><h2>Background</h2>')
  })
  it('finds a page even when the model leaves off the “(…)” part', () => {
    expect(findPage(ctx.pages, 'Juniper')?.id).toBe('w1')
    expect(findPage(ctx.pages, '"juniper (wolf)"')?.id).toBe('w1')
    const out = plan({ action: 'update_page', page: 'Juniper', section: { heading: 'Background', html: 'Born in a snowstorm.' } }, ctx)
    expect(out.pages[0].id).toBe('w1')
    expect(out.pages[0].body).toContain('<h2>Background</h2><p>Born in a snowstorm.</p>')
  })
  it('creates a page when asked to edit one that does not exist', () => {
    const out = plan({ action: 'update_page', page: 'Moonfall', section: { heading: 'History', html: 'It fell.' } }, ctx)
    expect(out.created).toHaveLength(1)
    expect(out.pages[0].title).toBe('Moonfall')
    expect(out.pages[0].body).toContain('<h2>History</h2><p>It fell.</p>')
  })
  it('merges a drafted page into sections', () => {
    expect(mergeBody('<p>Lead.</p><h2>A</h2><p>a1</p>', '<p>Lead.</p><p>More lead text here.</p><h2>A</h2><p>a2</p><h2>B</h2><p>b1</p>')).toBe(
      '<p>Lead.</p><p>More lead text here.</p><h2>A</h2><p>a1</p><p>a2</p><h2>B</h2><p>b1</p>'
    )
  })
})

describe('sturdier reading of suggestions', () => {
  it('accepts trailing commas and comment lines', () => {
    expect(parseLenient('{"action":"create_page","title":"A",}')).toEqual({ action: 'create_page', title: 'A' })
    expect(parseLenient('// a new page\n{"action":"create_page","title":"A"}')).toEqual({ action: 'create_page', title: 'A' })
  })
  it('accepts several objects without an array', () => {
    expect(parseLenient('{"action":"create_page","title":"A"}\n{"action":"create_page","title":"B"}')).toHaveLength(2)
    const segs = splitReply('```stashwiki\n{"action":"create_page","title":"A"} {"action":"create_page","title":"B"}\n```')
    expect(segs.filter((s) => s.kind === 'proposal')).toHaveLength(2)
  })
})

describe('related pages', () => {
  const p = (title: string, extra: Partial<Page> = {}): Page => ({ ...newPage(title, null), id: title.replace(/\W/g, ''), ...extra })
  const marigold = p('Captain Marigold', { body: '<p>Sails with <a data-wikilink="Wren">Wren</a>. Born in Sunken City.</p>', categories: ['Crew'] })
  const pages = Object.fromEntries(
    [marigold, p('Wren'), p('Sunken City'), p('Bosun', { categories: ['Crew'] }), p('Fan', { body: '<p><a data-wikilink="Captain Marigold">her</a></p>' }), p('Unrelated'), p('Ash')].map((x) => [x.id, x])
  )
  it('finds linked, linking, mentioned and same-crew pages, not unrelated ones', () => {
    const titles = relatedPages(marigold, pages).map((x) => x.title)
    expect(titles.slice(0, 2)).toEqual(['Wren', 'Fan'])
    expect(titles).toContain('Sunken City')
    expect(titles).not.toContain('Unrelated')
  })
  it('adds pages named in the message', () => {
    expect(relatedPages(marigold, pages, 'how does she meet Ash?').map((x) => x.title)[0]).toBe('Ash')
  })
  it('puts the extra pages into what the buddy reads', () => {
    expect(systemPrompt(meta, pages, marigold, false, [pages.Wren])).toContain('Other pages the user wants you to know about:\n\nTitle: Wren')
  })
})
