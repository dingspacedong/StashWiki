import { describe, expect, it } from 'vitest'
import { ALL_LOOKS, LOOK_SECTIONS, activeLooks, addLook, removeLook } from '../src/renderer/src/lib/looks'
import { ALL_BLOCKS, BLOCK_SECTIONS, blockHtml } from '../src/renderer/src/lib/blockTemplates'

const group = (id: string) => LOOK_SECTIONS.flatMap((s) => s.groups).find((g) => g.id === id)!
const look = (g: string, l: string) => group(g).looks.find((x) => x.id === l)!

describe('ready-made looks', () => {
  it('adds a look between markers and finds it again', () => {
    const css = addLook('', group('infobox-shape'), look('infobox-shape', 'rounded'))
    expect(css).toBe('/* ✦ look: infobox-shape/rounded (Rounded corners) */\n.infobox { border-radius: 16px; }\n/* ✦ end */\n')
    expect([...activeLooks(css)]).toEqual(['infobox-shape/rounded'])
  })
  it('picking another look in a "pick one" group swaps it', () => {
    let css = addLook('', group('infobox-shape'), look('infobox-shape', 'rounded'))
    css = addLook(css, group('infobox-shape'), look('infobox-shape', 'sticker'))
    expect([...activeLooks(css)]).toEqual(['infobox-shape/sticker'])
    expect(css).not.toContain('border-radius: 16px')
  })
  it('"pick any" groups mix, and each can come off alone', () => {
    let css = addLook('', group('infobox-details'), look('infobox-details', 'zebra'))
    css = addLook(css, group('infobox-details'), look('infobox-details', 'labels'))
    expect(activeLooks(css).size).toBe(2)
    css = removeLook(css, 'infobox-details', 'zebra')
    expect([...activeLooks(css)]).toEqual(['infobox-details/labels'])
  })
  it('keeps CSS written by hand, before and after', () => {
    const mine = '/* my own */\nbody { color: red; }'
    let css = addLook(mine, group('headings-style'), look('headings-style', 'banner'))
    css += '\n.extra { color: blue; }\n'
    css = removeLook(css, 'headings-style')
    expect(css).toContain('body { color: red; }')
    expect(css).toContain('.extra { color: blue; }')
    expect(css).not.toContain('✦')
  })
  it('a look edited by hand still comes off as one piece', () => {
    let css = addLook('', group('title-style'), look('title-style', 'big'))
    css = css.replace('40px', '52px')
    expect(removeLook(css, 'title-style')).toBe('')
  })
  it('every look has a unique id, a name and CSS that can sit inside the markers', () => {
    const keys = ALL_LOOKS.map((x) => `${x.group.id}/${x.look.id}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const { look: l } of ALL_LOOKS) {
      expect(l.name).toBeTruthy()
      expect(l.css.trim()).toBeTruthy()
      expect(l.css).not.toContain('*/')
      expect(l.css.split('{').length).toBe(l.css.split('}').length)
    }
    expect(ALL_LOOKS.length).toBeGreaterThan(60)
  })
  it('every look added at once can all be found and all removed', () => {
    let css = ''
    for (const { group: g, look: l } of ALL_LOOKS) if (g.pick === 'any' || !g.looks.some((x) => activeLooks(css).has(`${g.id}/${x.id}`))) css = addLook(css, g, l)
    const n = activeLooks(css).size
    for (const key of activeLooks(css)) css = removeLook(css, ...(key.split('/') as [string, string]))
    expect(n).toBeGreaterThan(40)
    expect(css).toBe('')
  })
})

describe('ready-made blocks', () => {
  it('have unique ids and use only their own swb- classes', () => {
    const ids = ALL_BLOCKS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ALL_BLOCKS.length).toBeGreaterThan(25)
    for (const b of ALL_BLOCKS) {
      const classes = [...b.html.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(' '))
      expect(classes.every((c) => c.startsWith('swb-')), b.id).toBe(true)
      expect(b.html).not.toMatch(/<script|on\w+=/i)
    }
    expect(BLOCK_SECTIONS.length).toBeGreaterThanOrEqual(6)
  })
  it('two copies of the tabs block get different ids', () => {
    const tabs = ALL_BLOCKS.find((b) => b.id === 'tabs')!
    const a = blockHtml(tabs)
    const b = blockHtml(tabs)
    expect(a).not.toContain('{id}')
    expect(a.match(/name="(swb-\w+)"/)![1]).not.toBe(b.match(/name="(swb-\w+)"/)![1])
  })
})
