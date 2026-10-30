import { useEffect, useMemo, useState } from 'react'
import type { Page, TrashedPage } from '@shared/types'
import { sortedPages, useStore } from '../store'
import { isWikiPage, listed } from '../lib/stories'
import { relinkRestored } from '../lib/storyActions'
import { pageLinkKeys, snippet, stripHtml, titleKey } from '../lib/wikitext'
import { imgUrl } from '../lib/theme'
import { pageThumb } from '../components/Infobox'
import { formatDate } from '../components/ui'
import { infoboxText } from '../lib/imageTabs'
import { useAllCategories } from '../components/CategoryInput'

function PageLink({ page }: { page: Page }): React.JSX.Element {
  const go = useStore((s) => s.go)
  return (
    <button className="link-btn" onClick={() => go({ kind: 'page', id: page.id })}>
      {page.title}
    </button>
  )
}

/** Pages grouped under their first letter, MediaWiki style. */
function LetterGroups({ pages }: { pages: Page[] }): React.JSX.Element {
  const groups = new Map<string, Page[]>()
  for (const p of pages) {
    const letter = /^\p{L}/u.test(p.title) ? p.title[0].toUpperCase() : '#'
    groups.set(letter, [...(groups.get(letter) ?? []), p])
  }
  return (
    <div className="letter-groups">
      {[...groups].map(([letter, list]) => (
        <div key={letter} className="letter-group">
          <h3>{letter}</h3>
          <ul>
            {list.map((p) => (
              <li key={p.id}>
                <PageLink page={p} />
                {p.private && <span className="badge tiny">private</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function AllPages(): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const meta = useStore((s) => s.meta)!
  const [filter, setFilter] = useState('')
  const [tpl, setTpl] = useState('*')
  const list = sortedPages(pages).filter(
    (p) =>
      isWikiPage(p) &&
      titleKey(p.title).includes(titleKey(filter)) &&
      (tpl === '*' || (tpl === '' ? !p.templateId : p.templateId === tpl))
  )
  return (
    <div>
      <h1 className="page-title">All pages</h1>
      <div className="filter-bar">
        <input value={filter} placeholder="Filter by title…" onChange={(e) => setFilter(e.target.value)} />
        <select value={tpl} onChange={(e) => setTpl(e.target.value)}>
          <option value="*">Any template</option>
          <option value="">No template</option>
          {meta.templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="muted">{list.length} pages</span>
      </div>
      {list.length ? <LetterGroups pages={list} /> : <p className="muted">No pages match.</p>}
    </div>
  )
}

export function Recent(): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const meta = useStore((s) => s.meta)!
  const list = Object.values(pages)
    .filter(listed(meta))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 100)
  const days = new Map<string, Page[]>()
  for (const p of list) {
    const day = new Date(p.updatedAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    days.set(day, [...(days.get(day) ?? []), p])
  }
  return (
    <div>
      <h1 className="page-title">Recent changes</h1>
      {[...days].map(([day, ps]) => (
        <div key={day} className="recent-day">
          <h3>{day}</h3>
          <ul className="recent-list">
            {ps.map((p) => (
              <li key={p.id}>
                <span className="muted time">{new Date(p.updatedAt).toLocaleTimeString(undefined, { timeStyle: 'short' })}</span>
                <PageLink page={p} />
                {p.templateId && <span className="muted"> · {meta.templates.find((t) => t.id === p.templateId)?.name}</span>}
                {p.story && <span className="muted"> · story</span>}
                {p.chapter && <span className="muted"> · chapter{pages[p.chapter.storyId] ? ` of ${pages[p.chapter.storyId].title}` : ''}</span>}
                {p.createdAt === p.updatedAt || Math.abs(p.updatedAt - p.createdAt) < 2000 ? <span className="badge tiny">new</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function Categories(): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const meta = useStore((s) => s.meta)!
  const go = useStore((s) => s.go)
  const all = useAllCategories()
  const count = (c: string): number => Object.values(pages).filter((p) => p.categories.some((x) => titleKey(x) === titleKey(c))).length
  const uncategorized = Object.values(pages).filter((p) => isWikiPage(p) && !p.categories.length).length
  return (
    <div>
      <h1 className="page-title">Categories</h1>
      {all.length === 0 && <p className="muted">No categories yet. Add them at the bottom of the page editor.</p>}
      <ul className="category-list">
        {all.map((c) => (
          <li key={c}>
            <button className="link-btn" onClick={() => go({ kind: 'category', name: c })}>
              {c}
            </button>
            <span className="muted"> ({count(c)})</span>
            {meta.categories[c]?.description && <div className="muted small">{meta.categories[c].description}</div>}
          </li>
        ))}
      </ul>
      {uncategorized > 0 && <p className="muted">{uncategorized} page(s) have no category.</p>}
    </div>
  )
}

export function CategoryView({ name }: { name: string }): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const meta = useStore((s) => s.meta)!
  const go = useStore((s) => s.go)
  const [editing, setEditing] = useState(false)
  const info = meta.categories[name]
  const [desc, setDesc] = useState(info?.description ?? '')
  const members = sortedPages(pages).filter((p) => p.categories.some((c) => titleKey(c) === titleKey(name)))

  const saveDesc = async (): Promise<void> => {
    await useStore.getState().saveMeta({ ...meta, categories: { ...meta.categories, [name]: { description: desc.trim() } } })
    setEditing(false)
  }

  return (
    <div>
      <h1 className="page-title">
        <span className="muted">Category:</span> {name}
      </h1>
      {editing ? (
        <div className="category-desc-edit">
          <textarea rows={3} autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What belongs in this category?" />
          <div className="row gap">
            <button className="btn small" onClick={() => void saveDesc()}>
              Save
            </button>
            <button className="btn small ghost" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="category-desc">
          {info?.description || <span className="muted">No description.</span>}{' '}
          <button className="link-btn" onClick={() => setEditing(true)}>
            {info?.description ? 'Edit' : 'Add a description'}
          </button>
        </p>
      )}
      <h3>
        {members.length} page{members.length === 1 ? '' : 's'} in this category
      </h3>
      <div className="card-grid">
        {members.map((p) => {
          const thumb = pageThumb(p, meta.templates.find((t) => t.id === p.templateId))
          return (
            <button key={p.id} className="page-card" onClick={() => go({ kind: 'page', id: p.id })}>
              <span className="page-card-img">{thumb ? <img src={imgUrl(thumb)} alt="" /> : <span>{p.title.slice(0, 1)}</span>}</span>
              <span className="page-card-title">{p.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function SearchResults({ q }: { q: string }): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const go = useStore((s) => s.go)
  const results = useMemo(() => {
    const needle = q.toLowerCase()
    const out: { page: Page; text: string; score: number }[] = []
    for (const p of Object.values(pages).filter(listed(useStore.getState().meta))) {
      const text = stripHtml(p.body) + ' ' + infoboxText(p.infobox).join(' ') + ' ' + (p.hatnotes ?? []).join(' ') + ' ' + (p.quote?.text ?? '') + ' ' + p.galleries.flatMap((g) => g.images.map((i) => i.caption)).join(' ')
      const inTitle = p.title.toLowerCase().includes(needle)
      const inText = text.toLowerCase().includes(needle)
      if (inTitle || inText) out.push({ page: p, text, score: (inTitle ? 2 : 0) + (titleKey(p.title) === titleKey(q) ? 5 : 0) })
    }
    return out.sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title))
  }, [q, pages])

  return (
    <div>
      <h1 className="page-title">Search results for “{q}”</h1>
      {!Object.values(pages).some((p) => titleKey(p.title) === titleKey(q)) && (
        <p>
          There’s no page called “{q}”.{' '}
          <button className="link-btn redlink" onClick={() => go({ kind: 'new', title: q })}>
            Create it
          </button>
        </p>
      )}
      {results.length === 0 && <p className="muted">Nothing found.</p>}
      <ul className="search-results">
        {results.map(({ page, text }) => (
          <li key={page.id}>
            <PageLink page={page} />
            <div className="muted small">{snippet(text, q)}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Backlinks({ id }: { id: string }): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const page = pages[id]
  const key = page ? titleKey(page.title) : ''
  const linking = sortedPages(pages).filter((p) => p.id !== id && pageLinkKeys(p).has(key))
  return (
    <div>
      <h1 className="page-title">What links here</h1>
      {page && (
        <p>
          Pages that link to <PageLink page={page} />:
        </p>
      )}
      {linking.length ? (
        <ul>
          {linking.map((p) => (
            <li key={p.id}>
              <PageLink page={p} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No pages link here yet.</p>
      )}
    </div>
  )
}

export function Trash(): React.JSX.Element {
  const wikiId = useStore((s) => s.wikiId)!
  const go = useStore((s) => s.go)
  const [items, setItems] = useState<TrashedPage[] | null>(null)
  const load = (): void => void window.stash.listTrash(wikiId).then(setItems)
  useEffect(load, [wikiId])

  return (
    <div>
      <h1 className="page-title">Trash</h1>
      <p className="muted">Deleted pages wait here until you restore them or delete them for good.</p>
      {items && items.length === 0 && <p className="muted">The trash is empty.</p>}
      <ul className="trash-list">
        {items?.map(({ page, deletedAt }) => (
          <li key={page.id}>
            <strong>{page.title}</strong>
            {page.story && <span className="story-badge soft">story</span>}
            {page.chapter && <span className="story-badge soft">chapter</span>}{' '}
            <span className="muted small">deleted {formatDate(deletedAt)}</span>
            <span className="grow" />
            <button
              className="btn small"
              onClick={async () => {
                const restored = await window.stash.restorePage(wikiId, page.id)
                await useStore.getState().addRestoredPage(restored)
                // A story comes back with its chapters; a chapter goes back into its story.
                let extra = 0
                if (restored.story) {
                  for (const t of items ?? []) {
                    if (t.page.chapter?.storyId !== restored.id) continue
                    await useStore.getState().addRestoredPage(await window.stash.restorePage(wikiId, t.page.id))
                    extra++
                  }
                }
                await relinkRestored(useStore.getState().pages[restored.id] ?? restored)
                useStore.getState().notify(`Restored “${restored.title}”${extra ? ` and ${extra} chapter${extra === 1 ? '' : 's'}` : ''}`)
                go({ kind: 'page', id: restored.id })
              }}
            >
              Restore
            </button>
            <button
              className="link-btn danger"
              onClick={async () => {
                if (!window.confirm(`Delete “${page.title}” forever? This can’t be undone.`)) return
                await window.stash.purgePage(wikiId, page.id)
                load()
              }}
            >
              Delete forever
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
