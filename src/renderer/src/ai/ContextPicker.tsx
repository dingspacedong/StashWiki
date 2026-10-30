import { useEffect, useMemo, useState } from 'react'
import { sortedPages, useStore } from '../store'
import { titleKey } from '../lib/wikitext'
import { Dropdown } from '../components/ui'
import { refreshFound, useAi, useCurrentPage } from './aiStore'

/** Under “Let it read …”: more pages for the buddy to read, picked by hand or found automatically. */
export default function ContextPicker(): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const { extraIds, autoFind, found } = useAi()
  const viewing = useCurrentPage()
  const extra = extraIds.map((id) => pages[id]).filter(Boolean)

  // Look again whenever the page being viewed (or the wiki) changes.
  useEffect(() => {
    if (autoFind) refreshFound()
  }, [autoFind, viewing?.id, pages])

  const remove = (id: string): void => useAi.setState({ extraIds: extraIds.filter((x) => x !== id) })
  const visibleFound = found.filter((f) => pages[f.id] && f.id !== viewing?.id && !extraIds.includes(f.id))

  return (
    <div className="ai-pages">
      <div className="ai-pages-row">
        <span className="ai-pages-label">Also read:</span>
        {extra.map((p) => (
          <span key={p.id} className="chip small">
            {p.title}
            <button title="Stop reading this page" onClick={() => remove(p.id)}>
              ×
            </button>
          </span>
        ))}
        <Dropdown label="+ Add a page" className="link-btn small" title="Add another page for it to read">
          {(close) => (
            <PagePicker
              exclude={[...extraIds, viewing?.id ?? '']}
              onPick={(id) => {
                useAi.setState({ extraIds: [...extraIds, id], found: found.filter((f) => f.id !== id) })
                close()
              }}
            />
          )}
        </Dropdown>
      </div>
      <label className="ai-pages-auto">
        <input type="checkbox" checked={autoFind} onChange={(e) => useAi.setState({ autoFind: e.target.checked })} />
        Find related pages automatically
      </label>
      {autoFind && (
        <div className="ai-found">
          {visibleFound.length === 0 ? (
            <span className="muted small">Nothing related found yet — pages it links to, or that you name in a message, show up here.</span>
          ) : (
            visibleFound.map((f) => (
              <label key={f.id} className="ai-found-item" title="Untick if this page isn't relevant">
                <input
                  type="checkbox"
                  checked={f.on}
                  onChange={(e) => useAi.setState({ found: found.map((x) => (x.id === f.id ? { ...x, on: e.target.checked } : x)) })}
                />
                {pages[f.id].title}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function PagePicker({ exclude, onPick }: { exclude: string[]; onPick: (id: string) => void }): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const [q, setQ] = useState('')
  const list = useMemo(
    () =>
      sortedPages(pages)
        .filter((p) => !exclude.includes(p.id) && titleKey(p.title).includes(titleKey(q)))
        .slice(0, 12),
    [pages, q, exclude]
  )
  return (
    <div className="link-panel">
      <input autoFocus value={q} placeholder="Search pages" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && list[0] && onPick(list[0].id)} />
      <div className="link-options">
        {list.map((p) => (
          <button key={p.id} onClick={() => onPick(p.id)}>
            {p.title}
          </button>
        ))}
        {list.length === 0 && <span className="muted small">No matching pages.</span>}
      </div>
    </div>
  )
}
