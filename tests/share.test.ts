import { describe, expect, it } from 'vitest'
import { defaultTemplates, newPage } from '../src/shared/defaults'
import { mergeWiki } from '../src/shared/merge'
import type { Page, WikiMeta } from '../src/shared/types'
import { imageTabs, infoboxText, setImageTabs } from '../src/renderer/src/lib/imageTabs'
import { renameLinks } from '../src/renderer/src/lib/wikitext'

const meta = (over: Partial<WikiMeta> = {}): WikiMeta => ({
  id: 'w', name: 'W', tagline: '', logo: '', mainPageId: 'a', createdAt: 0, categories: {}, theme: {} as WikiMeta['theme'],
  templates: defaultTemplates(), updatedAt: 100, ...over
})
const page = (id: string, title: string, updatedAt: number, body = ''): Page => ({ ...newPage(title, null), id, body, updatedAt })

describe('merging a shared copy', () => {
  it('keeps the newest version of each page and adds new pages', () => {
    const local = { meta: meta(), pages: [page('a', 'Main', 10, 'mine'), page('b', 'Bea', 50, 'my newer'), page('c', 'Cat', 5)], trash: [] }
    const incoming = { meta: meta(), pages: [page('a', 'Main', 20, 'theirs'), page('b', 'Bea', 40, 'their older'), page('c', 'Cat', 5), page('d', 'Dee', 1)] }
    const r = mergeWiki(local, incoming)
    expect(r.summary).toEqual({ added: 1, updated: 1, keptLocal: 1, unchanged: 1, stayedDeleted: 0 })
    expect(r.write.map((p) => `${p.id}:${p.body}`).sort()).toEqual(['a:theirs', 'd:'])
  })
  it('treats pages with the same title as the same page', () => {
    const r = mergeWiki({ meta: meta(), pages: [page('x1', 'Wren', 1)], trash: [] }, { meta: meta(), pages: [page('y9', 'wren', 2, 'new')] })
    expect(r.write).toEqual([expect.objectContaining({ id: 'x1', body: 'new' })])
  })
  it('leaves a page deleted if you deleted it after their last edit', () => {
    const trashed = { page: page('d', 'Dee', 1), deletedAt: 30 }
    const r = mergeWiki({ meta: meta(), pages: [], trash: [trashed] }, { meta: meta(), pages: [page('d', 'Dee', 20)] })
    expect(r.summary.stayedDeleted).toBe(1)
    const r2 = mergeWiki({ meta: meta(), pages: [], trash: [trashed] }, { meta: meta(), pages: [page('d', 'Dee', 40)] })
    expect(r2.summary.added).toBe(1)
  })
  it('takes the newer settings but never drops anyone’s templates', () => {
    const mine = meta({ updatedAt: 100, name: 'Mine', templates: [...defaultTemplates(), { ...defaultTemplates()[0], id: 'mine-only', name: 'Ship' }] })
    const theirs = meta({ updatedAt: 200, name: 'Theirs', templates: [...defaultTemplates(), { ...defaultTemplates()[0], id: 'theirs-only', name: 'Spell' }] })
    const r = mergeWiki({ meta: mine, pages: [], trash: [] }, { meta: { ...theirs, id: 'other-id' }, pages: [] })
    expect(r.meta.name).toBe('Theirs')
    expect(r.meta.id).toBe('w')
    expect(r.meta.templates.map((t) => t.id)).toEqual(expect.arrayContaining(['mine-only', 'theirs-only']))
  })
})

describe('infobox picture tabs', () => {
  it('reads a plain single picture', () => {
    expect(imageTabs({ img: 'a.png', 'img.caption': 'Cap' }, 'img')).toEqual([{ label: '', file: 'a.png', caption: 'Cap' }])
    expect(imageTabs({}, 'img')).toEqual([])
  })
  it('stores several pictures, keeping the first as the plain value for older versions', () => {
    const v = setImageTabs({}, 'img', [
      { label: 'Card', file: 'a.png', caption: 'Card art' },
      { label: 'Wish', file: 'b.png', caption: '' }
    ])
    expect(v.img).toBe('a.png')
    expect(v['img.caption']).toBe('Card art')
    expect(imageTabs(v, 'img').map((t) => t.label)).toEqual(['Card', 'Wish'])
    expect(setImageTabs(v, 'img', [{ label: '', file: 'b.png', caption: '' }])['img.tabs']).toBeUndefined()
  })
  it('keeps the tab list out of search text and renames links in tab captions', () => {
    const v = setImageTabs({ name: 'Wren' }, 'img', [
      { label: 'A', file: '0123456789abcdef0123.png', caption: 'with [[Ash]]' },
      { label: 'B', file: 'b.png', caption: 'hi' }
    ])
    expect(infoboxText(v).join(' ')).not.toContain('.png')
    expect(infoboxText(v)).toContain('hi')
    const renamed = renameLinks({ ...newPage('P', null), infobox: v }, 'Ash', 'Ash "the Tree"')!
    expect(imageTabs(renamed.infobox, 'img')[0].caption).toBe('with [[Ash "the Tree"]]')
  })
})
