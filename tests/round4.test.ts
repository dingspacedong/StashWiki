import { describe, expect, it } from 'vitest'
import { defaultTemplates, newPage } from '../src/shared/defaults'
import type { Page, WikiMeta } from '../src/shared/types'
import { plan, resendsExisting, sectionEffect, setIntro, setSection } from '../src/renderer/src/ai/proposals'
import { cardTitles, emptyCards, parseCards, renameInCards } from '../src/renderer/src/lib/cardsData'
import { pageLinkKeys, renameLinks } from '../src/renderer/src/lib/wikitext'
import { sidebarBackground } from '../src/renderer/src/lib/theme'

const templates = defaultTemplates()
const meta: WikiMeta = { id: 'w', name: 'T', tagline: '', logo: '', mainPageId: null, createdAt: 0, categories: {}, theme: {} as WikiMeta['theme'], templates }
const personality =
  '<p>Juniper is shy around strangers but fiercely loyal to her friends.</p><p>She loves rainy days and collects shiny pebbles from the river.</p>'
const juniper: Page = { ...newPage('Juniper', templates[0]), id: 'w1', body: `<p>A small wolf.</p><h2>Personality</h2>${personality}<h2>Background</h2><p></p>` }
const ctx = { pages: { w1: juniper }, meta, sanitize: (h: string) => h }

describe('buddy re-sending a section it means to add to', () => {
  const reworded =
    '<p>Juniper is rather shy around strangers, but she is fiercely loyal to her friends.</p><p>She loves rainy days and collects shiny pebbles from the riverbank.</p><p>Lately she has been learning to swim.</p>'
  it('spots reworded old text', () => {
    expect(resendsExisting(personality, reworded)).toBe(true)
    expect(resendsExisting(personality, '<p>Lately she has been learning to swim, slowly but surely.</p>')).toBe(false)
  })
  it('replaces the section instead of keeping two copies', () => {
    const out = setSection(juniper.body, 'Personality', reworded)
    expect(out.match(/fiercely loyal/g)).toHaveLength(1)
    expect(out).toContain('learning to swim')
    expect(out).toContain('<h2>Background</h2>')
  })
  it('still just adds genuinely new paragraphs', () => {
    const out = setSection(juniper.body, 'Personality', '<p>Lately she has been learning to swim, slowly but surely.</p>')
    expect(out).toContain(personality + '<p>Lately she has been learning to swim')
  })
  it('the card can say it will replace', () => {
    expect(sectionEffect(juniper, { action: 'update_page', page: 'Juniper', section: { heading: 'Personality', html: reworded } })).toBe('replace')
    expect(sectionEffect(juniper, { action: 'update_page', page: 'Juniper', section: { heading: 'Personality', html: '<p>Brand new thing here today.</p>' } })).toBe('append')
  })
})

describe('introduction changes', () => {
  it('adds to or replaces the text before the first heading', () => {
    expect(setIntro(juniper.body, '<p>She lives by the river.</p>')).toMatch(/^<p>A small wolf\.<\/p><p>She lives by the river\.<\/p><h2>Personality<\/h2>/)
    expect(setIntro(juniper.body, '<p>A tiny wolf pup.</p>', 'replace')).toMatch(/^<p>A tiny wolf pup\.<\/p><h2>/)
    const out = plan({ action: 'update_page', page: 'Juniper', intro: { html: 'Juniper is a small grey wolf.' } }, ctx)
    expect(out.pages[0].body.startsWith('<p>A small wolf.</p><p>Juniper is a small grey wolf.</p><h2>')).toBe(true)
  })
})

describe('page cards', () => {
  const data = { groups: [{ title: 'Characters', cards: [{ page: 'Wren', tag: 'Debut' }, { page: 'Ash' }] }] }
  const body = `<p>Hi</p><div data-cards="${JSON.stringify(data).replace(/"/g, '&quot;')}"></div>`
  it('reads damaged data safely', () => {
    expect(parseCards('nonsense')).toEqual({ groups: [] })
    expect(parseCards(JSON.stringify(emptyCards())).groups[0].title).toBe('Characters')
  })
  it('counts card links for “what links here”', () => {
    expect(cardTitles(body)).toEqual(['Wren', 'Ash'])
    expect([...pageLinkKeys({ ...newPage('P', null), body })]).toEqual(['wren', 'ash'])
  })
  it('follows a renamed page', () => {
    expect(renameInCards(body, (t) => t === 'Wren', 'Wren the Owl').changed).toBe(true)
    const page = renameLinks({ ...newPage('P', null), body }, 'wren', 'Wren the Owl')!
    expect(cardTitles(page.body)).toEqual(['Wren the Owl', 'Ash'])
    expect(parseCards(page.body.match(/data-cards="([^"]*)"/)![1].replace(/&quot;/g, '"')).groups[0].cards[0].tag).toBe('Debut')
  })
})

describe('sidebar background', () => {
  it('is see-through colour, optionally fading out', () => {
    expect(sidebarBackground({})).toBe('transparent')
    expect(sidebarBackground({ sidebarColor: '#ff8800', sidebarOpacity: '50' })).toBe('rgba(255, 136, 0, 0.5)')
    expect(sidebarBackground({ sidebarColor: '#000000', sidebarOpacity: '100', sidebarEdge: 'soft' })).toBe(
      'linear-gradient(to right, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 70%, transparent 100%)'
    )
  })
})
