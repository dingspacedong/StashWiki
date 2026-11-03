import { describe, expect, it } from 'vitest'
import { newPage, newWikiMeta } from '../src/shared/defaults'
import type { Page, WikiMeta } from '../src/shared/types'
import { systemPrompt } from '../src/renderer/src/ai/context'
import { plan, splitReply, setSection, toBodyHtml, type Proposal } from '../src/renderer/src/ai/proposals'
import { navboxTag } from '../src/renderer/src/lib/navigation'

const pg = (title: string, extra: Partial<Page> = {}): Page => ({ ...newPage(title, null), id: title, ...extra })
const setup = (): { meta: WikiMeta; pages: Record<string, Page> } => {
  const meta: WikiMeta = {
    ...newWikiMeta('Tools').meta,
    categories: { Characters: { description: 'Everyone' }, Heroes: { description: '', parent: 'Characters' } },
    navboxes: [{ id: 'nb1', title: 'Saga', groups: [{ id: 'g', label: 'Cast', pages: ['Wren'], category: 'Heroes' }], showOn: ['Places'] }],
    sidebar: [{ id: 's1', title: 'Cast', links: [{ id: 'l1', label: '', target: 'Category:Characters', listPages: true }] }]
  }
  const wren = pg('Wren', {
    categories: ['Characters', 'Heroes'],
    body:
      '<p>Intro.</p><h2>Look</h2><p>Tall.</p><img src="wren.png" data-caption="Wren at dawn"><div data-callout="tip"><p>Ask about the hat.</p></div>' +
      navboxTag('nb1'),
    galleries: [
      {
        id: 'g1',
        title: 'Art',
        autoCollapse: false,
        images: [
          { id: 'i1', file: 'a.png', caption: 'One', source: '' },
          { id: 'i2', file: 'b.png', caption: 'Two', source: 'pal', spoiler: true },
          { id: 'i3', file: 'c.png', caption: 'Three', source: '' }
        ]
      }
    ]
  })
  const moss = pg('Moss', { categories: ['Characters'], private: true })
  return { meta, pages: { Wren: wren, Moss: moss, Isle: pg('Isle', { categories: ['Places'] }) } }
}
const ctx = (s = setup()) => ({ ...s, sanitize: (h: string) => h })
const one = (text: string, tools: boolean): Proposal | undefined => {
  const seg = splitReply('```stashwiki\n' + text + '\n```', tools).find((x) => x.kind === 'proposal')
  return seg?.kind === 'proposal' ? seg.proposal : undefined
}

describe('the buddy knowing how StashWiki works', () => {
  it('only says more when switched on', () => {
    const { meta, pages } = setup()
    const off = systemPrompt(meta, pages, pages.Wren)
    expect(off).toBe(systemPrompt(meta, pages, pages.Wren, false, [], undefined, false))
    expect(off).not.toContain('How StashWiki works')
    expect(off).not.toContain('Galleries')
    expect(off).toContain('[Nav box]')
    const on = systemPrompt(meta, pages, pages.Wren, false, [], undefined, true)
    for (const bit of [
      'How StashWiki works',
      '"action":"update_category"',
      '- Characters (2): Everyone',
      '  - Heroes (1)',
      '"Cast": Category:Characters [lists its pages]',
      '"Saga": Cast: Wren, every page in Heroes; shown by itself on pages in: Places',
      'Private pages: Moss',
      '[Picture: Wren at dawn]',
      '[Tip box]',
      'Ask about the hat.',
      '[/Tip box]',
      '[Nav box: Saga]',
      '1. "Art": 3 pictures',
      '2) Two — credit: pal (spoiler)'
    ])
      expect(on).toContain(bit)
  })

  it('ignores its new kinds of change unless switched on', () => {
    expect(one('{"action":"update_category","name":"Villains","parent":"Characters"}', false)).toBeUndefined()
    expect(one('{"action":"update_category","name":"Villains","parent":"Characters"}', true)).toMatchObject({ action: 'update_category', parent: 'Characters' })
    const off = splitReply('```stashwiki\n{"action":"update_page","page":"Wren","private":true}\n```', false)
    expect(off[0]).toMatchObject({ kind: 'bad' })
    expect(one('{"action":"update_page","page":"Wren","private":true}', true)).toMatchObject({ private: true })
    expect(one('{"action":"delete_category","category":"Heroes"}', true)).toEqual({ action: 'remove_category', name: 'Heroes' })
  })

  it('changes page extras', () => {
    const p = one(
      '{"action":"update_page","page":"Wren","remove_categories":["heroes"],"notes":["For the bird, see [[Robin]]."],"quote":null,"private":true,"add_navbox":"saga","add_cards":{"title":"Friends","pages":["Moss"]}}',
      true
    )!
    const s = setup()
    s.pages.Wren.quote = { text: 'Hm.', by: 'Wren' }
    const out = plan(p, ctx(s)).pages[0]
    expect(out.categories).toEqual(['Characters'])
    expect(out.hatnotes).toEqual(['For the bird, see [[Robin]].'])
    expect(out.quote).toBeUndefined()
    expect(out.private).toBe(true)
    expect(out.body.split('data-navbox').length).toBe(2)
    expect(out.body).toContain('data-cards=')
    expect(() => plan({ action: 'update_page', page: 'Wren', add_navbox: 'Nope' }, ctx())).toThrow(/no nav box/)
  })

  it('edits a gallery by picture number', () => {
    const p = one('{"action":"update_gallery","page":"Wren","images":[{"n":1,"caption":"First","spoiler":true}],"order":[3,1],"remove_images":[2],"title":"Sketches"}', true)!
    const g = plan(p, ctx()).pages[0].galleries[0]
    expect(g.title).toBe('Sketches')
    expect(g.images.map((i) => [i.caption, !!i.spoiler])).toEqual([
      ['Three', false],
      ['First', true]
    ])
    expect(() => plan({ action: 'update_gallery', page: 'Wren', gallery: 'Nope' }, ctx())).toThrow(/no gallery/)
  })

  it('makes, renames, nests and removes categories', () => {
    let r = plan({ action: 'update_category', name: 'Villains', parent: 'Characters', description: 'Baddies' }, ctx())
    expect(r.meta!.categories.Villains).toEqual({ description: 'Baddies', parent: 'Characters' })
    r = plan({ action: 'update_category', name: 'Heroes', rename: 'Good guys', show_subcategory_pages: true }, ctx())
    expect(r.pages.map((x) => x.categories)).toEqual([['Characters', 'Good guys']])
    expect(r.meta!.categories['Good guys']).toEqual({ description: '', parent: 'Characters', withSubPages: true })
    r = plan({ action: 'update_category', name: 'Characters', show_subcategory_pages: true }, ctx())
    expect(r.meta!.categories.Characters.withSubPages).toBe(true)
    expect(() => plan({ action: 'update_category', name: 'Characters', parent: 'Heroes' }, ctx())).toThrow(/inside it/)
    r = plan({ action: 'remove_category', name: 'Heroes' }, ctx())
    expect(r.pages[0].categories).toEqual(['Characters'])
    expect(r.meta!.navboxes![0].groups[0].category).toBe('')
    expect(() => plan({ action: 'remove_category', name: 'Nope' }, ctx())).toThrow(/no category/)
  })

  it('sets up nav boxes and sidebar sections', () => {
    let r = plan({ action: 'update_navbox', title: 'Places box', rows: [{ label: 'Where', pages: ['Isle'], category: 'Places' }], show_on: ['Places'] }, ctx())
    expect(r.meta!.navboxes!.map((b) => b.title)).toEqual(['Saga', 'Places box'])
    r = plan({ action: 'update_navbox', title: 'saga', remove: true }, ctx())
    expect(r.meta!.navboxes).toEqual([])
    expect(r.pages[0].body).not.toContain('data-navbox')
    const p = one('{"action":"update_sidebar","section":"Cast","mode":"append","links":[{"label":"Wren","target":"Wren","children":[{"target":"Moss"}]}]}', true)!
    r = plan(p, ctx())
    expect(r.meta!.sidebar![0].links.map((l) => [l.target, l.children?.map((c) => c.target)])).toEqual([
      ['Category:Characters', undefined],
      ['Wren', ['Moss']]
    ])
    r = plan({ action: 'update_sidebar', section: 'Places', links: [{ label: '', target: 'Isle' }] }, ctx())
    expect(r.meta!.sidebar!.map((x) => x.title)).toEqual(['Cast', 'Places'])
  })

  it('starts a story with a first chapter, and changes its details', () => {
    const p = one('{"action":"create_story","title":"Night Flight","summary":"Wren flies.","status":"wip","rating":"teen","tags":["adventure"],"characters":["Wren"],"chapter":{"name":"Takeoff","html":"<p>Up.</p>"}}', true)!
    const r = plan(p, ctx())
    expect(r.created).toHaveLength(2)
    const [story, chapter] = r.pages
    expect(story.story).toMatchObject({ summary: 'Wren flies.', rating: 'teen', tags: ['adventure'], characters: ['Wren'], chapters: [chapter.id] })
    expect(chapter.title).toBe('Night Flight: Takeoff')
    const s = setup()
    s.pages[story.id] = story
    const u = plan({ action: 'update_story', story: 'night flight', status: 'complete', tags: ['cozy'] }, ctx(s))
    expect(u.pages[0].story).toMatchObject({ status: 'complete', tags: ['cozy'], summary: 'Wren flies.' })
    expect(() => plan({ action: 'create_story', title: 'Wren' }, ctx())).toThrow(/already/)
  })
})

describe('rewriting around pictures and boxes', () => {
  it('keeps pictures when a section is rewritten', () => {
    const body = '<h2>Look</h2><p>Tall.</p><img src="wren.png" data-caption="Wren"><p>Green eyes.</p><h2>Past</h2><p>Old.</p>'
    const out = setSection(body, 'Look', '<p>Very tall.</p><p>Bright green eyes.</p>', 'replace')
    expect(out).toContain('<img src="wren.png" data-caption="Wren">')
    expect(out).toContain('Very tall.')
    expect(out).not.toContain('<p>Tall.</p>')
  })
  it('turns box markers into boxes and drops picture markers', () => {
    expect(toBodyHtml('Before.\n\n[Spoiler box]\nShe was the **queen**.\n[/Spoiler box]\n\n[Picture: Wren]\n\nAfter.')).toBe(
      '<p>Before.</p><div class="callout" data-callout="spoiler"><p>She was the <strong>queen</strong>.</p></div><p>After.</p>'
    )
    expect(toBodyHtml('<p>A</p>[Tip box]<p>B</p>[/Tip box]')).toBe('<p>A</p><div class="callout" data-callout="tip"><p>B</p></div>')
  })
})
