import { describe, expect, it } from 'vitest'
import { newPage, newWikiMeta } from '../src/shared/defaults'
import type { Page, WikiMeta } from '../src/shared/types'
import {
  ancestorsOf,
  canNestUnder,
  categoryMembers,
  categoryTree,
  childrenOf,
  removeCategory,
  renameCategory,
  setCategory
} from '../src/renderer/src/lib/categories'

const page = (title: string, categories: string[]): Page => ({ ...newPage(title, null), id: title, categories })
const pages = [page('Wren', ['Charaters']), page('Moss', ['charaters', 'Heroes']), page('Isle', ['Places'])]
const base = (): WikiMeta => {
  const m = newWikiMeta('Test').meta
  return {
    ...m,
    categories: { Charaters: { description: 'Everyone' }, Heroes: { description: '', parent: 'Charaters' }, Villains: { description: '', parent: 'Charaters' } },
    templates: m.templates.map((t) => (t.id === 'character' ? { ...t, categories: ['Charaters'] } : t)),
    sidebar: [{ id: 's', title: 'Cast', links: [{ id: 'l', label: '', target: 'Category:Charaters', listPages: true, children: [{ id: 'k', label: 'Wren', target: 'Wren' }] }] }],
    navboxes: [{ id: 'b', title: 'Cast', groups: [{ id: 'g', label: 'All', pages: [], category: 'charaters' }], showOn: ['Charaters', 'Places'] }]
  }
}

describe('categories', () => {
  it('nests and walks the tree', () => {
    const m = setCategory(base(), 'Bosses', { description: '', parent: 'Villains' })
    expect(childrenOf(m, 'charaters')).toEqual(['Heroes', 'Villains'])
    expect(ancestorsOf(m, 'Bosses')).toEqual(['Villains', 'Charaters'])
    expect(canNestUnder(m, 'Charaters', 'Bosses')).toBe(false)
    expect(canNestUnder(m, 'Bosses', 'Heroes')).toBe(true)
    // A loop isn't saved.
    expect(setCategory(m, 'Charaters', { description: '', parent: 'Bosses' }).categories.Charaters.parent).toBeUndefined()
    expect(categoryTree(m, ['Places', 'Bosses', 'Charaters', 'Heroes', 'Villains'])).toEqual([
      { name: 'Charaters', depth: 0 },
      { name: 'Heroes', depth: 1 },
      { name: 'Villains', depth: 1 },
      { name: 'Bosses', depth: 2 },
      { name: 'Places', depth: 0 }
    ])
  })

  it('lists subcategory pages only when asked', () => {
    const m = base()
    expect(categoryMembers(m, pages, 'Charaters').map((p) => p.title)).toEqual(['Wren', 'Moss'])
    const villain = page('Crow', ['Villains'])
    expect(categoryMembers(m, [...pages, villain], 'Charaters')).toHaveLength(2)
    const on = setCategory(m, 'Charaters', { description: 'Everyone', withSubPages: true })
    expect(categoryMembers(on, [...pages, villain], 'Charaters').map((p) => p.title)).toEqual(['Wren', 'Moss', 'Crow'])
  })

  it('renames everywhere', () => {
    const { meta, pages: changed } = renameCategory(base(), pages, 'Charaters', 'Characters')
    expect(changed.map((p) => [p.title, p.categories])).toEqual([
      ['Wren', ['Characters']],
      ['Moss', ['Characters', 'Heroes']]
    ])
    expect(meta.categories.Characters).toEqual({ description: 'Everyone' })
    expect(meta.categories.Charaters).toBeUndefined()
    expect(meta.categories.Heroes.parent).toBe('Characters')
    expect(meta.templates.find((t) => t.id === 'character')!.categories).toEqual(['Characters'])
    expect(meta.sidebar![0].links[0].target).toBe('Category:Characters')
    expect(meta.navboxes![0].groups[0].category).toBe('Characters')
    expect(meta.navboxes![0].showOn).toEqual(['Characters', 'Places'])
  })

  it('fixes capitals', () => {
    const { meta, pages: changed } = renameCategory(base(), pages, 'Charaters', 'CHARATERS')
    expect(Object.keys(meta.categories)).toContain('CHARATERS')
    expect(changed).toHaveLength(2)
  })

  it('renaming onto another category puts them together', () => {
    const { meta, pages: changed } = renameCategory(base(), pages, 'Heroes', 'charaters')
    expect(changed.map((p) => p.categories)).toEqual([['charaters']])
    expect(meta.categories.Charaters.description).toBe('Everyone')
    expect(meta.categories.Heroes).toBeUndefined()
    // Merging a category into its own subcategory doesn't leave a loop.
    const into = renameCategory(base(), pages, 'Charaters', 'Heroes').meta
    expect(into.categories.Heroes.parent).toBeUndefined()
    expect(into.categories.Villains.parent).toBe('Heroes')
  })

  it('removes, moving subcategories up', () => {
    const m = setCategory(base(), 'Bosses', { description: '', parent: 'Villains' })
    const { meta, pages: changed } = removeCategory(m, pages, 'charaters')
    expect(changed.map((p) => [p.title, p.categories])).toEqual([
      ['Wren', []],
      ['Moss', ['Heroes']]
    ])
    expect(meta.categories.Charaters).toBeUndefined()
    expect(meta.categories.Heroes.parent).toBeUndefined()
    expect(meta.categories.Bosses.parent).toBe('Villains')
    expect(meta.sidebar![0].links.map((l) => l.target)).toEqual(['Wren'])
    expect(meta.navboxes![0].groups[0].category).toBe('')
    expect(meta.navboxes![0].showOn).toEqual(['Places'])
    expect(meta.templates.find((t) => t.id === 'character')!.categories).toEqual([])
    const sub = removeCategory(m, pages, 'Villains').meta
    expect(sub.categories.Bosses.parent).toBe('Charaters')
  })
})
