import { describe, expect, it } from 'vitest'
import { defaultTemplates, newPage } from '../src/shared/defaults'
import type { Page, WikiMeta } from '../src/shared/types'
import { keepBlocks, plan, toBodyHtml } from '../src/renderer/src/ai/proposals'
import { bodyToText } from '../src/renderer/src/ai/context'
import { decodeHtmlBlock, htmlBlockTag } from '../src/renderer/src/lib/customHtml'

const LIKES = '<div class="likes"><b>Likes</b> tea, [[Moss]]</div>\n<style>.likes { color: hotpink; }</style>'
const block = htmlBlockTag(LIKES)
const cards = '<div class="page-cards-block" data-cards="%7B%7D"></div>'
const templates = defaultTemplates()
const meta: WikiMeta = { id: 'w', name: 'T', tagline: '', logo: '', mainPageId: null, createdAt: 0, categories: {}, theme: {} as WikiMeta['theme'], templates }
const wren: Page = {
  ...newPage('Wren', templates[0]),
  id: 'p1',
  body: `<h2>Personality</h2><p>Wren is quiet.</p>${block}<p>She hums.</p>${cards}<h2>Background</h2><p>Old.</p>`
}
const ctx = { pages: { p1: wren }, meta, sanitize: (h: string) => h }
const blocksIn = (html: string): string[] => [...html.matchAll(/data-html="([^"]*)"/g)].map((m) => decodeHtmlBlock(m[1].replace(/&amp;/g, '&')))

describe('the buddy never melts fancy blocks into the page text', () => {
  it('keeps blocks a rewritten section leaves out', () => {
    const out = plan({ action: 'update_page', page: 'Wren', sections: [{ heading: 'Personality', html: '<p>Wren is very quiet.</p>', mode: 'replace' }] }, ctx).pages[0].body
    expect(out).toContain(block)
    expect(out).toContain(cards)
    expect(out).toContain('<p>Wren is very quiet.</p>')
    expect(out).not.toContain('Wren is quiet.')
  })

  it('turns a block sent back in [HTML block: …] form into a real block', () => {
    const changed = LIKES.replace('tea', 'tea and rain')
    const text = bodyToText(wren.body.replace(block, htmlBlockTag(changed))).replace(/‹/g, '<').replace(/›/g, '>')
    const section = text.split('## Personality')[1].split('## Background')[0]
    const out = plan({ action: 'update_page', page: 'Wren', sections: [{ heading: 'Personality', html: section, mode: 'replace' }] }, ctx).pages[0].body
    expect(blocksIn(out)).toEqual([changed])
    expect(out).not.toContain('<div class="likes">')
    expect(out).toContain(cards)
  })

  it('wraps loose HTML with its own classes and <style> into one block', () => {
    const html = toBodyHtml('<p>Intro.</p><div class="likes"><b>Likes</b> tea</div>\n<style>.likes { color: red; }</style><p>After.</p>')
    expect(html.startsWith('<p>Intro.</p><div data-html=')).toBe(true)
    expect(html.endsWith('<p>After.</p>')).toBe(true)
    expect(blocksIn(html)[0]).toContain('<style>')
  })

  it('leaves ordinary writing alone', () => {
    expect(toBodyHtml('<p>Hi [[Moss]].</p><ul><li>One</li></ul>')).toBe('<p>Hi <a data-wikilink="Moss" class="wikilink">Moss</a>.</p><ul><li>One</li></ul>')
    expect(toBodyHtml('Just **text**.')).toBe('<p>Just <strong>text</strong>.</p>')
  })

  it('keepBlocks puts missing blocks back roughly where they were', () => {
    expect(keepBlocks(`${block}<p>a</p><p>b</p>`, '<p>A</p><p>B</p>')).toBe(`${block}<p>A</p><p>B</p>`)
    expect(keepBlocks(`<p>a</p><p>b</p>${block}`, '<p>A</p><p>B</p>')).toBe(`<p>A</p><p>B</p>${block}`)
    expect(keepBlocks('<p>a</p>', '<p>A</p>')).toBe('<p>A</p>')
  })
})
