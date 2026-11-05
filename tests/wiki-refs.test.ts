import { describe, expect, it } from 'vitest'
import { newPage } from '../src/shared/defaults'
import { findWiki, splitWikiRef, wikiRefTag } from '../src/renderer/src/lib/wikiRefs'
import { pageLinkKeys, renderInlineText, renameLinks, textLinkTargets } from '../src/renderer/src/lib/wikitext'
import { parseTarget, shownLinks } from '../src/renderer/src/lib/navigation'
import { bodyToText } from '../src/renderer/src/ai/context'
import { toBodyHtml } from '../src/renderer/src/ai/proposals'

describe('links to other wikis', () => {
  it('reads [[Other wiki::Page]]', () => {
    expect(splitWikiRef('Cats::Wren')).toEqual({ wiki: 'Cats', page: 'Wren' })
    expect(splitWikiRef(' My  Other Wiki :: The Owl ')).toEqual({ wiki: 'My Other Wiki', page: 'The Owl' })
    expect(splitWikiRef('Cats::')).toEqual({ wiki: 'Cats', page: '' })
    expect(splitWikiRef('Story: Chapter 1')).toBeNull()
    expect(splitWikiRef('::Wren')).toBeNull()
  })

  it('finds the wiki by id, then by name', () => {
    const wikis = [
      { id: 'a', name: 'Cats', dir: '', lastOpened: 0 },
      { id: 'b', name: 'Dogs', dir: '', lastOpened: 0 }
    ]
    expect(findWiki(wikis, 'Renamed', 'b')?.id).toBe('b')
    expect(findWiki(wikis, 'cats')?.id).toBe('a')
    expect(findWiki(wikis, 'Birds')).toBeUndefined()
  })

  it('works in infobox text without counting as a link in this wiki', () => {
    const html = renderInlineText('Friend of [[Cats::Wren|the owl]] and [[Moss]]', () => true)
    expect(html).toBe('Friend of <a class="wikiref" data-wikiref="Cats" data-page="Wren">the owl</a> and <a class="wikilink" data-wikilink="Moss">Moss</a>')
    expect(renderInlineText('[[Cats::]]', () => true)).toContain('>Cats</a>')
    expect(textLinkTargets('[[Cats::Wren]] [[Moss]]')).toEqual(['Moss'])
    const page = { ...newPage('Pip', null), body: wikiRefTag('Cats', 'Wren', 'Wren', 'a'), infobox: { f: '[[Cats::Wren]]' } }
    expect([...pageLinkKeys(page)]).toEqual([])
    expect(renameLinks(page, 'Wren', 'Robin')).toBeNull()
  })

  it('works in sidebar links', () => {
    expect(parseTarget('Cats::Wren')).toEqual({ kind: 'wiki', wiki: 'Cats', title: 'Wren' })
    expect(parseTarget('https://example.com/a::b').kind).toBe('url')
    expect(shownLinks([{ id: '1', label: '', target: 'Cats::' }], []).map((l) => l.label)).toEqual(['Cats'])
  })

  it('the buddy reads and writes them as [[Other wiki::Page]]', () => {
    const body = `<p>See ${wikiRefTag('Cats', 'Wren', 'Wren', 'a')} and ${wikiRefTag('Cats', 'Moss', 'her friend')}.</p>`
    const text = bodyToText(body)
    expect(text).toBe('See [[Cats::Wren]] and [[Cats::Moss|her friend]].')
    expect(toBodyHtml(text)).toBe(
      '<p>See <a class="wikiref" data-wikiref="Cats" data-page="Wren">Wren</a> and <a class="wikiref" data-wikiref="Cats" data-page="Moss">her friend</a>.</p>'
    )
  })
})
