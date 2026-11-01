import { describe, expect, it } from 'vitest'
import { newPage } from '../src/shared/defaults'
import type { Navbox, Page, WikiMeta } from '../src/shared/types'
import { autoNavboxes, navboxHtml, navboxTag, parseTarget, shownLinks } from '../src/renderer/src/lib/navigation'
import { keepBlocks } from '../src/renderer/src/ai/proposals'

const page = (title: string, categories: string[] = [], extra: Partial<Page> = {}): Page => ({ ...newPage(title, null), id: title, categories, ...extra })
const pages = [page('Wren', ['Characters']), page('Moss', ['characters']), page('Isle', ['Places']), page('Saga', [], { story: { summary: '', status: 'wip', rating: '', warnings: [], tags: [], characters: [], chapters: [] } })]
const box: Navbox = {
  id: 'b1',
  title: 'Saga',
  groups: [
    { id: 'g1', label: 'Characters', pages: ['Old Pell'], category: 'Characters' },
    { id: 'g2', label: 'Empty', pages: [] }
  ],
  showOn: ['places']
}

describe('sidebar links', () => {
  it('reads targets', () => {
    expect(parseTarget('https://x.com/a')).toEqual({ kind: 'url', url: 'https://x.com/a' })
    expect(parseTarget('category: Characters')).toEqual({ kind: 'category', name: 'Characters' })
    expect(parseTarget(' Wren ')).toEqual({ kind: 'page', title: 'Wren' })
    expect(parseTarget('')).toEqual({ kind: 'none' })
  })
  it('lists a category’s pages under it (not stories), after its own sub-links, without repeats', () => {
    const [l] = shownLinks([{ id: '1', label: '', target: 'Category:Characters', listPages: true, children: [{ id: '2', label: 'Hero', target: 'Wren' }] }], pages)
    expect(l.label).toBe('Characters')
    expect(l.children.map((c) => c.label)).toEqual(['Hero', 'Moss'])
  })
})

describe('nav boxes', () => {
  it('rows list picked pages, then the category’s pages', () => {
    const html = navboxHtml(box, pages)
    expect(html).toContain('<div class="nb-title">Saga</div>')
    expect([...html.matchAll(/data-wikilink="([^"]*)"/g)].map((m) => m[1])).toEqual(['Old Pell', 'Moss', 'Wren'])
    expect(html).toContain('<div class="nb-label">Empty</div>')
  })
  it('shows by itself on pages in its categories, unless already placed', () => {
    const meta = { navboxes: [box] } as WikiMeta
    expect(autoNavboxes(meta, pages[2]).map((b) => b.id)).toEqual(['b1'])
    expect(autoNavboxes(meta, pages[0])).toEqual([])
    expect(autoNavboxes(meta, { ...pages[2], body: navboxTag('b1') })).toEqual([])
  })
  it('the buddy never drops a nav box from a section it rewrites', () => {
    expect(keepBlocks(`<p>a</p>${navboxTag('b1')}`, '<p>A</p>')).toBe(`<p>A</p>${navboxTag('b1')}`)
  })
})

