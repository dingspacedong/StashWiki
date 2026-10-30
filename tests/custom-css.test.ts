import { describe, expect, it } from 'vitest'
import { defaultTemplates, newPage } from '../src/shared/defaults'
import type { Page, WikiMeta } from '../src/shared/types'
import { describe as describeProposal, plan, splitReply, type Proposal } from '../src/renderer/src/ai/proposals'
import { bodyToText, systemPrompt } from '../src/renderer/src/ai/context'
import { decodeHtmlBlock, htmlBlockTag } from '../src/renderer/src/lib/customHtml'
import { mergeWiki } from '../src/shared/merge'

const templates = defaultTemplates()
const meta: WikiMeta = { id: 'w', name: 'T', tagline: '', logo: '', mainPageId: null, createdAt: 0, categories: {}, theme: {} as WikiMeta['theme'], templates, customCss: '.infobox { color: red; }' }
const wren: Page = { ...newPage('Wren', templates[0]), id: 'r1', body: '<p>Intro.</p><h2>Appearance</h2><p>Grey.</p><h2>Trivia</h2><p>Hums.</p>' }
const ctx = { pages: { r1: wren }, meta, sanitize: (h: string) => h }
const one = (json: string): Proposal => {
  const seg = splitReply('```stashwiki\n' + json + '\n```')[0]
  if (seg.kind !== 'proposal') throw new Error(seg.kind === 'bad' ? seg.error : 'text')
  return seg.proposal
}

describe('HTML blocks are stored safely', () => {
  it('round-trips any HTML through the stored attribute', () => {
    const html = '<style>.a{color:red}</style><div class="a" title="x &amp; y">"hi" & </div>'
    const tag = htmlBlockTag(html)
    const stored = tag.match(/data-html="([^"]*)"/)![1]
    expect(stored).not.toMatch(/[<>"]/)
    expect(decodeHtmlBlock(stored.replace(/&amp;/g, '&'))).toBe(html)
  })
  it('a broken stored value gives an empty block instead of an error', () => {
    expect(decodeHtmlBlock('%E0%A4%A')).toBe('')
  })
})

describe('the buddy and custom CSS', () => {
  it('appends to the wiki CSS, and can replace it', () => {
    const add = plan(one('{"action":"update_css","target":"wiki","css":".prose h2 { color: blue; }"}'), ctx)
    expect(add.meta!.customCss).toBe('.infobox { color: red; }\n\n.prose h2 { color: blue; }')
    const rep = plan(one('{"action":"update_css","target":"wiki","css":"body { background: black; }","mode":"replace"}'), ctx)
    expect(rep.meta!.customCss).toBe('body { background: black; }')
  })
  it('reads other shapes: action "css", "code", a page given', () => {
    const p = one('{"action":"css","page":"Wren","code":".page-title { color: pink; }"}')
    expect(p).toMatchObject({ action: 'update_css', target: 'page', page: 'Wren' })
    expect(plan(p, ctx).pages[0].customCss).toBe('.page-title { color: pink; }')
    expect(describeProposal(p)).toContain('“Wren” page CSS')
  })
  it('adds an HTML block under a section, kept as written', () => {
    const html = '<div class="sparkle">✨</div><style>.sparkle{animation:spin 1s infinite}</style>'
    const body = plan(one(JSON.stringify({ action: 'update_page', page: 'Wren', html_block: { html, section: 'Appearance' } })), ctx).pages[0].body
    expect(body).toMatch(/<h2>Appearance<\/h2><p>Grey\.<\/p><div data-html="[^"]+"><\/div><h2>Trivia<\/h2>/)
    expect(decodeHtmlBlock(body.match(/data-html="([^"]+)"/)![1])).toBe(html)
  })
  it('add_html_block with the html beside it is not also added as loose text', () => {
    const p = one('{"action":"add_html_block","page":"Wren","section":"Trivia","html":"<b>x</b>"}')
    expect(p).toMatchObject({ action: 'update_page', html_block: { html: '<b>x</b>', section: 'Trivia' } })
    expect((p as { append?: string }).append).toBeUndefined()
    expect((p as { sections?: unknown }).sections).toBeUndefined()
  })
  it('the buddy sees the wiki CSS, page CSS and HTML blocks', () => {
    const page = { ...wren, customCss: '.x{}', body: wren.body + htmlBlockTag('<marquee>hi</marquee>') }
    const sys = systemPrompt(meta, { r1: page }, page)
    expect(sys).toContain('.infobox { color: red; }')
    expect(sys).toContain('Custom CSS for this page:\n.x{}')
    expect(sys).toContain('[HTML block:\n<marquee>hi</marquee>')
    expect(sys).toContain('"action":"update_css"')
    expect(bodyToText(page.body)).toContain('[HTML block:')
  })
})

describe('share files keep custom CSS', () => {
  it('the newer side’s CSS wins in a merge', () => {
    const local = { meta: { ...meta, updatedAt: 1 }, pages: [], trash: [] }
    const incoming = { meta: { ...meta, customCss: 'body{}', updatedAt: 2 }, pages: [] }
    expect(mergeWiki(local, incoming).meta.customCss).toBe('body{}')
  })
})
