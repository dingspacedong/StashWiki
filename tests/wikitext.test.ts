import { describe, expect, it } from 'vitest'
import { newPage } from '../src/shared/defaults'
import {
  bodyLinkTargets, cleanTitle, headingId, pageLinkKeys, renameLinks, renderInlineText, snippet, stripHtml, titleKey
} from '../src/renderer/src/lib/wikitext'

const exists = (t: string): boolean => ['Marigold', 'Sunken City'].includes(t)

describe('titles', () => {
  it('cleans and compares titles case-insensitively', () => {
    expect(cleanTitle('  Captain   [Mari]gold| ')).toBe('Captain Marigold')
    expect(titleKey('Sunken  CITY')).toBe(titleKey('sunken city'))
  })
})

describe('renderInlineText', () => {
  it('escapes HTML and makes blue and red links', () => {
    const html = renderInlineText('<b>hi</b> [[Marigold]] and [[Nobody|someone]]', exists)
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;')
    expect(html).toContain('<a class="wikilink" data-wikilink="Marigold">Marigold</a>')
    expect(html).toContain('<a class="wikilink new" data-wikilink="Nobody">someone</a>')
  })
  it('linkifies URLs and keeps line breaks', () => {
    const html = renderInlineText('art by x\nhttps://example.com/a.', exists)
    expect(html).toContain('<br>')
    expect(html).toContain('href="https://example.com/a"')
    expect(html).toMatch(/<\/a>\.$/)
  })
  it('does not let a crafted link break out of the attribute', () => {
    const html = renderInlineText('[[a" onmouseover="x]]', exists)
    expect(html).not.toContain('onmouseover="x"')
  })
})

describe('links between pages', () => {
  const page = {
    ...newPage('Sunken City', null),
    body: '<p>Home of <a data-wikilink="Marigold" class="wikilink">Marigold</a> and <a data-wikilink="Tom &amp; Jerry"><strong>them</strong></a></p>',
    infobox: { a: 'Ruler: [[marigold|the captain]]', b: 'nothing' }
  }

  it('finds link targets in body and infobox', () => {
    expect(bodyLinkTargets(page.body)).toEqual(['Marigold', 'Tom & Jerry'])
    expect([...pageLinkKeys(page)].sort()).toEqual(['marigold', 'tom & jerry'])
  })

  it('renames links in body text and infobox fields', () => {
    const out = renameLinks(page, 'Marigold', 'Captain Marigold')!
    expect(out.body).toContain('data-wikilink="Captain Marigold" class="wikilink">Captain Marigold</a>')
    expect(out.infobox.a).toBe('Ruler: [[Captain Marigold|the captain]]')
    expect(out.infobox.b).toBe('nothing')
  })

  it('renames formatted links without touching their text', () => {
    const out = renameLinks(page, 'tom & jerry', 'T&J')!
    expect(out.body).toContain('data-wikilink="T&amp;J"><strong>them</strong>')
  })

  it('returns null when nothing links to the old title', () => {
    expect(renameLinks(page, 'Elsewhere', 'Other')).toBeNull()
  })
})

describe('misc', () => {
  it('strips html for search', () => {
    expect(stripHtml('<h2>A</h2><p>b &amp; c</p>')).toBe('A b & c')
  })
  it('makes unique heading ids', () => {
    const used = new Set<string>()
    expect(headingId('Early life', used)).toBe('early-life')
    expect(headingId('Early life', used)).toBe('early-life-2')
    expect(headingId('???', used)).toBe('section')
  })
  it('builds snippets around matches', () => {
    expect(snippet('a'.repeat(200) + 'needle' + 'b'.repeat(200), 'needle', 5)).toBe('…aaaaaneedlebbbbb…')
  })
  it('new pages from a template get its sections and categories', () => {
    const p = newPage('X', { id: 't', name: 'T', headerColor: '', headerText: '', fields: [], sections: ['Looks', 'A<b>'], categories: ['Characters'] })
    expect(p.body).toBe('<p></p><h2>Looks</h2><p></p><h2>A&lt;b&gt;</h2><p></p>')
    expect(p.categories).toEqual(['Characters'])
  })
})
