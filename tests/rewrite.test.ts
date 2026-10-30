import { describe, expect, it } from 'vitest'
import { defaultTemplates, newPage } from '../src/shared/defaults'
import type { Page, WikiMeta } from '../src/shared/types'
import { applyEdit, changesPage, findSection, plan, sectionEffect, splitReply, withMode, type Proposal } from '../src/renderer/src/ai/proposals'

const templates = defaultTemplates()
const meta: WikiMeta = { id: 'w', name: 'T', tagline: '', logo: '', mainPageId: null, createdAt: 0, categories: {}, theme: {} as WikiMeta['theme'], templates }
const wren: Page = {
  ...newPage('Wren', templates[0]),
  id: 'r1',
  body:
    '<p>Wren is a small grey wolf.</p><h2>Personality</h2><p>Wren is shy around strangers but fiercely loyal.</p>' +
    '<h3>Quirks</h3><p>She hums when nervous.</p><h2>Background</h2><p>Born in the north during a storm.</p>'
}
const ctx = { pages: { r1: wren }, meta, sanitize: (h: string) => h }
const proposalOf = (json: string): Proposal => {
  const seg = splitReply('```stashwiki\n' + json + '\n```')[0]
  if (seg.kind !== 'proposal') throw new Error(seg.kind === 'bad' ? seg.error : 'text')
  return seg.proposal
}
const bodyAfter = (json: string): string => plan(proposalOf(json), ctx).pages[0].body

describe('rewrites the buddy sends in other shapes still apply', () => {
  it('reads "sections" lists and other names for the writing', () => {
    const body = bodyAfter('{"action":"update_page","page":"Wren","sections":[{"heading":"Background","content":"<p>Born in the south.</p>","mode":"replace"}]}')
    expect(body).toContain('<h2>Background</h2><p>Born in the south.</p>')
    expect(body).not.toContain('north')
  })
  it('reads "section": "name" with the text beside it, and a top-level mode', () => {
    const body = bodyAfter('{"action":"update_page","page":"Wren","section":"Background","text":"Born in the south.","mode":"rewrite"}')
    expect(body).toContain('<h2>Background</h2><p>Born in the south.</p>')
  })
  it('reads "sections" as a heading → text map and other action names', () => {
    const body = bodyAfter('{"action":"edit_page","page":"Wren","sections":{"Background":"<p>Raised by foxes.</p>"},"mode":"replace"}')
    expect(body).toContain('<p>Raised by foxes.</p>')
    expect(body).not.toContain('north')
  })
  it('finds subsections and headings written a little differently', () => {
    expect(findSection(wren.body, '### Quirks')).not.toBeNull()
    expect(findSection(wren.body, 'personality:')).not.toBeNull()
    const body = bodyAfter('{"action":"update_page","page":"Wren","section":{"heading":"Quirks","html":"<p>She whistles.</p>","mode":"replace"}}')
    expect(body).toContain('<h3>Quirks</h3><p>She whistles.</p><h2>Background</h2>')
    // Replacing a section keeps its subsections' neighbours intact.
    const body2 = bodyAfter('{"action":"update_page","page":"Wren","section":{"heading":"Background","html":"<p>New.</p>","mode":"replace"}}')
    expect(body2).toContain('<h3>Quirks</h3><p>She hums when nervous.</p>')
  })
  it('a suggestion with nothing StashWiki understands becomes an explained card, not a blank one', () => {
    const seg = splitReply('```stashwiki\n{"action":"update_page","page":"Wren","rewritten":"…"}\n```')[0]
    expect(seg.kind).toBe('bad')
  })
})

describe('find-and-replace edits', () => {
  it('rewords a sentence in place', () => {
    const body = bodyAfter('{"action":"update_page","page":"Wren","edits":[{"find":"shy around strangers","replace":"wary of strangers"}]}')
    expect(body).toContain('Wren is wary of strangers but fiercely loyal.')
  })
  it('matches despite curly quotes, spacing and [[links]]', () => {
    const body = '<p>She said “hi” to <a data-wikilink="Moss" class="wikilink">Moss</a>  today.</p>'
    const out = applyEdit(body, { find: 'She said "hi" to [[Moss]] today.', replace: 'She waved at [[Moss]].' })
    expect(out).toContain('She waved at <a data-wikilink="Moss" class="wikilink">Moss</a>.')
  })
  it('says so when the text is not on the page', () => {
    expect(() => bodyAfter('{"action":"update_page","page":"Wren","edits":[{"find":"purple dragon","replace":"x"}]}')).toThrow(/Couldn’t find/)
  })
})

describe('the add / replace switch on the card', () => {
  const p = proposalOf('{"action":"update_page","page":"Wren","section":{"heading":"Personality","html":"<p>Wren is bold and loud.</p>"}}')
  it('defaults to adding when the text is new', () => {
    expect(sectionEffect(wren, p)).toBe('append')
    expect(plan(p, ctx).pages[0].body).toContain('fiercely loyal.</p><p>Wren is bold and loud.</p>')
  })
  it('replaces when switched', () => {
    const body = plan(withMode(p, 'replace'), ctx).pages[0].body
    expect(body).toContain('<h2>Personality</h2><p>Wren is bold and loud.</p><h3>Quirks</h3>')
    expect(body).not.toContain('fiercely loyal')
  })
  it('notices when applying would change nothing', () => {
    expect(changesPage(wren, { ...wren })).toBe(false)
    expect(changesPage(wren, { ...wren, body: wren.body + '<p>x</p>' })).toBe(true)
  })
})

describe('when the model says "append" but sends the old text back', () => {
  const p = proposalOf(
    '{"action":"update_page","page":"Wren","section":{"heading":"Personality","mode":"append","html":"<p>Wren is rather shy around strangers, but fiercely loyal.</p><p>She is learning to swim.</p>"}}'
  )
  it('the card says it replaces, and Apply replaces', () => {
    expect(sectionEffect(wren, p)).toBe('replace')
    const body = plan(p, ctx).pages[0].body
    expect(body.match(/fiercely loyal/g)).toHaveLength(1)
    expect(body).toContain('learning to swim')
  })
  it('choosing "Add to what’s there" on the card really adds', () => {
    const add = withMode(p, 'append')
    expect(sectionEffect(wren, add)).toBe('append')
    expect(plan(add, ctx).pages[0].body.match(/fiercely loyal/g)).toHaveLength(2)
  })
})
