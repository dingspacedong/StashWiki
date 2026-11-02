// Making, renaming, nesting and removing categories. A window for one category, used from the Categories page and
// from a category's own page.
import { useState } from 'react'
import { useStore } from '../store'
import { canNestUnder, categoryInfo, childrenOf, removeCategory, renameCategory, setCategory } from '../lib/categories'
import { cleanTitle, titleKey } from '../lib/wikitext'
import { useAllCategories } from './CategoryInput'

/** Take a category off every page, after asking. Returns whether it went. */
export async function confirmRemoveCategory(name: string): Promise<boolean> {
  const { meta, pages, route, go, notify } = useStore.getState()
  if (!meta) return false
  const on = Object.values(pages).filter((p) => p.categories.some((c) => titleKey(c) === titleKey(name))).length
  const kids = childrenOf(meta, name).length
  const msg =
    `Remove the category “${name}”?\n\n` +
    (on ? `It comes off ${on} page${on === 1 ? '' : 's'}. The pages themselves stay.` : 'No pages are in it.') +
    (kids ? `\nIts ${kids} subcategor${kids === 1 ? 'y moves' : 'ies move'} up a level.` : '')
  if (!window.confirm(msg)) return false
  const change = removeCategory(meta, Object.values(pages), name)
  await useStore.getState().saveMetaAndPages(change.meta, change.pages)
  if (route.kind === 'category' && titleKey(route.name) === titleKey(name)) go({ kind: 'special', name: 'categories' }, { replace: true })
  notify(`Removed the category “${name}”`)
  return true
}

/** `name` set: edit that category. Otherwise make a new one, inside `parent` if given. */
export function CategoryEditor({ name, parent, onClose }: { name?: string; parent?: string; onClose: () => void }): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const all = useAllCategories()
  const info = name ? categoryInfo(meta, name) : undefined
  const [title, setTitle] = useState(name ?? '')
  const [inside, setInside] = useState(info?.parent ?? parent ?? '')
  const [desc, setDesc] = useState(info?.description ?? '')
  const [error, setError] = useState('')
  // Anything but itself and what's already inside it.
  const parents = all.filter((c) => !name || canNestUnder(meta, name, c))

  const save = async (): Promise<void> => {
    const typed = cleanTitle(title)
    if (!typed) return setError('Give the category a name.')
    const { pages, go, route, notify } = useStore.getState()
    const taken = all.find((c) => titleKey(c) === titleKey(typed) && (!name || titleKey(c) !== titleKey(name)))
    const next = taken ?? typed
    if (taken && !name) return setError(`There’s already a category called “${taken}”.`)
    if (taken && !window.confirm(`There’s already a category called “${taken}”. Put “${name}” and its pages into it?`)) return
    let change = { meta, pages: [] as typeof pages[string][] }
    if (name && next !== name) change = renameCategory(meta, Object.values(pages), name, next)
    const kept = categoryInfo(change.meta, next)
    const nextMeta = setCategory(change.meta, next, { ...kept, description: taken ? kept?.description || desc : desc, parent: inside || undefined })
    await useStore.getState().saveMetaAndPages(nextMeta, change.pages)
    if (name && route.kind === 'category' && titleKey(route.name) === titleKey(name)) go({ kind: 'category', name: next }, { replace: true })
    if (!name) notify(`Made the category “${next}”`)
    else if (change.pages.length) notify(`Renamed on ${change.pages.length} page${change.pages.length === 1 ? '' : 's'}`)
    onClose()
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal category-editor"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <h2>{name ? `Edit category: ${name}` : parent ? `New subcategory of ${parent}` : 'New category'}</h2>
        <label className="field">
          <span>Name</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setError('')
            }}
            placeholder="Characters"
          />
        </label>
        {name && cleanTitle(title) && cleanTitle(title) !== name && <p className="hint">Every page, template, sidebar link and nav box using “{name}” changes too.</p>}
        <label className="field">
          <span>Inside</span>
          <select value={inside} onChange={(e) => setInside(e.target.value)}>
            <option value="">Nothing (a top-level category)</option>
            {parents.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Description</span>
          <textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What belongs in this category?" />
        </label>
        {error && <p className="field-error">{error}</p>}
        <div className="row gap modal-actions">
          {name && (
            <button type="button" className="link-btn danger" onClick={() => void confirmRemoveCategory(name).then((gone) => gone && onClose())}>
              Remove category…
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn">
            {name ? 'Save' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
