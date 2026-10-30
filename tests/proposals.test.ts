import { describe, expect, it } from 'vitest'
import { defaultTemplates, newPage } from '../src/shared/defaults'
import type { Page, WikiMeta } from '../src/shared/types'
import { plan, setSection, splitReply, toBodyHtml, type Proposal } from '../src/renderer/src/ai/proposals'
import { pageFields } from '../src/renderer/src/lib/fields'

const templates = defaultTemplates()
const character = templates[0]
const meta: WikiMeta = {
  id: 'w', name: 'Test', tagline: '', logo: '', mainPageId: null, createdAt: 0, categories: {},
  theme: {} as WikiMeta['theme'], templates
}
const marigold: Page = { ...newPage('Captain Marigold', character), id: 'm1' }
const pages = { m1: marigold }
const ctx = { pages, meta, sanitize: (h: string) => h }

describe('reading proposals out of a reply', () => {
  it('splits text and stashwiki blocks', () => {
    const reply = 'Here you go!\n```stashwiki\n{"action":"update_page","page":"Captain Marigold","append":"<p>Hi</p>"}\n```\nWant more?'
    const segs = splitReply(reply)
    expect(segs.map((s) => s.kind)).toEqual(['text', 'proposal', 'text'])
  })

  it('accepts an array of changes and ```json blocks', () => {
    const reply = '```json\n[{"action":"create_page","title":"Wren"},{"action":"create_page","title":"Ash"}]\n```'
    expect(splitReply(reply).filter((s) => s.kind === 'proposal')).toHaveLength(2)
  })

  it('leaves other code blocks and half-streamed blocks as text', () => {
    expect(splitReply('```json\n{"a":1}\n```').every((s) => s.kind === 'text')).toBe(true)
    expect(splitReply('Working…\n```stashwiki\n{"action":"crea').every((s) => s.kind === 'text')).toBe(true)
  })

  it('flags broken stashwiki blocks instead of hiding them', () => {
    expect(splitReply('```stashwiki\n{not json}\n```')[0].kind).toBe('bad')
    expect(splitReply('```stashwiki\n{"action":"create_page"}\n```')[0].kind).toBe('bad')
  })
})

describe('turning writing into page HTML', () => {
  it('converts markdown-ish text and links', () => {
    expect(toBodyHtml('### Early days\nShe met [[Wren]] and **laughed**.\n\n- one\n- two')).toBe(
      '<h3>Early days</h3><p>She met <a data-wikilink="Wren" class="wikilink">Wren</a> and <strong>laughed</strong>.</p><ul><li><p>one</p></li><li><p>two</p></li></ul>'
    )
  })
  it('keeps HTML and only links text, not attributes', () => {
    expect(toBodyHtml('<p title="[[x]]">See [[Ash|the ash tree]]</p>')).toBe(
      '<p title="[[x]]">See <a data-wikilink="Ash" class="wikilink">the ash tree</a></p>'
    )
  })
  it('adds to a section, replacing the empty starter paragraph', () => {
    const body = '<h2>Appearance</h2><p></p><h2>Background</h2><p>Born at sea.</p><h2>Trivia</h2><p></p>'
    expect(setSection(body, 'background', '<p>Then a storm.</p>')).toBe(
      '<h2>Appearance</h2><p></p><h2>Background</h2><p>Born at sea.</p><p>Then a storm.</p><h2>Trivia</h2><p></p>'
    )
    expect(setSection(body, 'Appearance', '<p>Tall.</p>', 'replace')).toContain('<h2>Appearance</h2><p>Tall.</p><h2>Background</h2>')
    expect(setSection(body, 'Legacy', '<p>Remembered.</p>')).toMatch(/<h2>Legacy<\/h2><p>Remembered.<\/p>$/)
  })
})

describe('planning changes', () => {
  it('creates a typed page with infobox values, adding unknown labels to that page only', () => {
    const p: Proposal = { action: 'create_page', title: 'Wren', type: 'character', infobox: { Species: 'Owl', 'Favourite tea': 'Mint' }, body: 'A quiet owl.' }
    const out = plan(p, ctx)
    const page = out.pages[0]
    const fields = pageFields(character, page)
    const value = (label: string): string | undefined => page.infobox[fields.find((f) => f.label === label)!.id]
    expect(page.templateId).toBe('character')
    expect(value('Species')).toBe('Owl')
    expect(value('Favourite tea')).toBe('Mint')
    expect(character.fields.some((f) => f.label === 'Favourite tea')).toBe(false)
    expect(page.body).toBe('<p>A quiet owl.</p>')
    expect(out.created).toEqual([page.id])
  })

  it('refuses unknown templates; existing or missing pages are handled instead of failing', () => {
    expect(plan({ action: 'create_page', title: 'captain marigold' }, ctx).created).toEqual([])
    expect(plan({ action: 'update_page', page: 'Nobody', append: 'x' }, ctx).created).toHaveLength(1)
    expect(() => plan({ action: 'update_template', template: 'Spaceship' }, ctx)).toThrow(/no “Spaceship”/)
  })

  it('continues a section of an existing page', () => {
    const out = plan({ action: 'update_page', page: 'Captain Marigold', section: { heading: 'Background', html: 'She left after the flood.' } }, ctx)
    expect(out.pages[0].body).toContain('<h2>Background</h2><p>She left after the flood.</p><h2>Abilities</h2>')
    expect(out.created).toEqual([])
  })

  it('edits a template: add after a field, rename, remove', () => {
    const out = plan(
      {
        action: 'update_template',
        template: 'Character',
        add_fields: [{ label: 'Birthday', after: 'Age' }],
        rename_fields: { Species: 'Kind' },
        remove_fields: ['Enemies']
      },
      ctx
    )
    const labels = out.meta!.templates[0].fields.map((f) => f.label)
    expect(labels[labels.indexOf('Age') + 1]).toBe('Birthday')
    expect(labels).toContain('Kind')
    expect(labels).not.toContain('Species')
    expect(labels).not.toContain('Enemies')
    expect(meta.templates[0].fields.map((f) => f.label)).toContain('Species')
  })
})
