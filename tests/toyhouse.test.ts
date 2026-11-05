import { describe, expect, it } from 'vitest'
import { creditLine, groupGalleries } from '../src/renderer/src/lib/toyhouse'
import { renderInlineText } from '../src/renderer/src/lib/wikitext'

describe('importing from Toyhouse', () => {
  it('links each artist in the credit line', () => {
    expect(creditLine([{ name: 'babywolfy', url: 'https://toyhou.se/babywolfy' }])).toBe('[babywolfy](https://toyhou.se/babywolfy)')
    expect(
      creditLine([
        { name: 'https://artfight.net/attack/1.x', url: 'https://artfight.net/attack/1.x' },
        { name: 'Amber', url: 'https://toyhou.se/Amber' },
        { name: 'offsite pal', url: '' },
        { name: 'rattysoup', url: 'https://toyhou.se/rattysoup', note: '(Base)' }
      ])
    ).toBe('https://artfight.net/attack/1.x, [Amber](https://toyhou.se/Amber), offsite pal, [rattysoup](https://toyhou.se/rattysoup) (Base)')
  })
  it('makes one gallery per Toyhouse gallery tab, in order', () => {
    const got = groupGalleries([
      { group: 'ref', n: 1 },
      { group: 'others art', n: 2 },
      { group: 'ref', n: 3 },
      { group: '', n: 4 }
    ])
    expect(got.map((g) => [g.title, g.images.map((i) => i.n)])).toEqual([
      ['ref', [1, 3]],
      ['others art', [2]],
      ['Gallery', [4]]
    ])
  })
  it('shows [name](address) as a link in credits and infobox text', () => {
    expect(renderInlineText('Art by [Amber](https://toyhou.se/Amber) & https://x.com/a', () => true)).toBe(
      'Art by <a class="external" href="https://toyhou.se/Amber" target="_blank" rel="noreferrer">Amber</a> &amp; <a class="external" href="https://x.com/a" target="_blank" rel="noreferrer">https://x.com/a</a>'
    )
    expect(renderInlineText('[[Wren]] and [not a link](javascript:alert(1))', () => true)).toContain('[not a link](javascript:alert(1))')
  })
})
