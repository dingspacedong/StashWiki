import { describe, expect, it } from 'vitest'
import { newWikiMeta } from '@shared/defaults'
import type { WikiMeta } from '@shared/types'
import { COLOR_THEMES, MINE, mixLogos, mixSiteCss, mixThemes, scopeCss, shownLogo, useMix, withMixedTheme } from '../src/renderer/src/lib/mixUp'
import { activeLooks, addLook } from '../src/renderer/src/lib/looks'
import { SAMPLE_ID, samplePage } from '../src/renderer/src/lib/samplePage'

const meta = (patch: Partial<WikiMeta> = {}): WikiMeta => ({ ...newWikiMeta('Mix').meta, ...patch })
const theme = (id: string) => COLOR_THEMES.find((t) => t.look.id === id)!

describe('mix it up', () => {
  it('switches logos only when it is on and there are two or more', () => {
    expect(mixLogos(meta({ logo: 'a.png', extraLogos: ['b.png'] }))).toEqual([])
    expect(mixLogos(meta({ logo: 'a.png', mix: { logos: true } }))).toEqual([])
    expect(mixLogos(meta({ logo: 'a.png', extraLogos: ['b.png'], mix: { logos: true } }))).toEqual(['a.png', 'b.png'])
    expect(shownLogo(meta({ logo: 'a.png', extraLogos: ['b.png'] }), 1)).toBe('a.png')
    expect(shownLogo(meta({ logo: 'a.png', extraLogos: ['b.png'], mix: { logos: true } }), 1)).toBe('b.png')
  })

  it('needs two known themes', () => {
    expect(mixThemes(meta({ mix: { themes: ['night'] } }))).toEqual([])
    expect(mixThemes(meta({ mix: { themes: ['night', 'no-such-look'] } }))).toEqual([])
    expect(mixThemes(meta({ mix: { themes: ['night', MINE] } }))).toEqual(['night', MINE])
  })

  it('swaps the color theme in the CSS and keeps the other looks', () => {
    const css = addLook('.x { color: red; }', theme('cottage').group, theme('cottage').look)
    const m = meta({ mix: { themes: ['night', MINE] } })
    expect([...activeLooks(withMixedTheme(m, css, 0))]).toEqual(['color-theme/night'])
    expect(withMixedTheme(m, css, 0)).toContain('.x { color: red; }')
    expect([...activeLooks(withMixedTheme(m, css, 1))]).toEqual([])
    expect(withMixedTheme(meta(), css, 1)).toBe(css)
  })

  it('never picks the same one twice in a row', () => {
    const m = meta({ logo: 'a.png', extraLogos: ['b.png', 'c.png'], mix: { logos: true, themes: ['night', 'ocean'] } })
    let last = useMix.getState()
    for (let i = 0; i < 30; i++) {
      useMix.getState().shuffle(m)
      const now = useMix.getState()
      expect(now.logo).not.toBe(last.logo)
      expect(now.theme).not.toBe(last.theme)
      expect(now.logo).toBeLessThan(3)
      expect(now.theme).toBeLessThan(2)
      last = now
    }
  })

  it('scopes theme CSS for a website', () => {
    expect(scopeCss('.a, .b {\n  --x: 1;\n}\n.c { color: red; }', 'html[data-mix="n"]')).toBe('\nhtml[data-mix="n"] .a, html[data-mix="n"] .b {\n  --x: 1;\n}\nhtml[data-mix="n"] .c { color: red; }')
    const css = mixSiteCss(meta({ mix: { themes: ['night', 'ocean', MINE] } }))
    expect(css).toContain('html[data-mix="night"] .topbar')
    expect(css).toContain('html[data-mix="ocean"] .layout')
    expect(css).not.toMatch(/^\s*\.topbar/m)
  })
})

describe('sample page', () => {
  it('has one of everything', () => {
    const m = meta()
    const p = samplePage(m)
    expect(p.id).toBe(SAMPLE_ID)
    expect(p.templateId).toBe('character')
    expect(Object.values(p.infobox)).toContain('sw-sample-portrait.svg')
    for (const bit of ['data-callout="note"', 'data-callout="spoiler"', 'data-cards=', 'data-html=', '<table>', '<h2>', '<blockquote>', 'data-wikilink=']) expect(p.body).toContain(bit)
    expect(p.galleries[0].images).toHaveLength(3)
    expect(p.quote?.text).toBeTruthy()
    expect(p.hatnotes).toHaveLength(1)
  })
  it('works without a Character template', () => {
    const m = meta()
    expect(samplePage({ ...m, templates: m.templates.filter((t) => t.id !== 'character') }).templateId).toBeTruthy()
    expect(samplePage({ ...m, templates: [] }).templateId).toBeNull()
  })
})
