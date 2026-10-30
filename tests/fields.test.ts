import { describe, expect, it } from 'vitest'
import type { Template } from '../src/shared/types'
import { addField, pageFields, removeField, renameField, reorderFields, restoreHidden } from '../src/renderer/src/lib/fields'

const tpl: Template = {
  id: 't', name: 'Character', headerColor: '', headerText: '', sections: [], categories: [],
  fields: [
    { id: 'img', label: 'Image', type: 'image' },
    { id: 'name', label: 'Full name', type: 'text' },
    { id: 'age', label: 'Age', type: 'text' }
  ]
}
const labels = (o: Parameters<typeof pageFields>[1]['infoboxOverrides']): string[] => pageFields(tpl, { infoboxOverrides: o }).map((f) => f.label)

describe('per-page infobox fields', () => {
  it('an untouched page shows the template fields', () => {
    expect(labels(undefined)).toEqual(['Image', 'Full name', 'Age'])
  })

  it('renames on one page only, and renaming back clears the override', () => {
    const o = renameField(tpl, undefined, 'age', 'Apparent age')
    expect(labels(o)).toEqual(['Image', 'Full name', 'Apparent age'])
    expect(tpl.fields[2].label).toBe('Age')
    expect(renameField(tpl, o, 'age', 'Age')).toBeUndefined()
  })

  it('adds and removes page-only fields', () => {
    let o = addField(undefined, { id: 'x', label: 'Favourite food', type: 'text' })
    expect(labels(o)).toEqual(['Image', 'Full name', 'Age', 'Favourite food'])
    o = renameField(tpl, o, 'x', 'Snack')
    expect(labels(o)).toEqual(['Image', 'Full name', 'Age', 'Snack'])
    expect(removeField(o, 'x')).toBeUndefined()
  })

  it('removes template fields from this page and can bring them back', () => {
    const o = removeField(undefined, 'img')
    expect(labels(o)).toEqual(['Full name', 'Age'])
    expect(restoreHidden(o)).toBeUndefined()
  })

  it('keeps a custom order, and slots new template fields in after their neighbour', () => {
    const o = reorderFields(undefined, pageFields(tpl, {}).slice().reverse())
    expect(labels(o)).toEqual(['Age', 'Full name', 'Image'])
    const grown: Template = { ...tpl, fields: [...tpl.fields.slice(0, 2), { id: 'sp', label: 'Species', type: 'text' }, tpl.fields[2]] }
    expect(pageFields(grown, { infoboxOverrides: o }).map((f) => f.label)).toEqual(['Age', 'Full name', 'Species', 'Image'])
  })

  it('appends a field added after reordering to the end of the custom order', () => {
    let o = reorderFields(undefined, pageFields(tpl, {}).slice().reverse())
    o = addField(o, { id: 'x', label: 'Extra', type: 'text' })
    expect(labels(o)).toEqual(['Age', 'Full name', 'Image', 'Extra'])
  })
})
