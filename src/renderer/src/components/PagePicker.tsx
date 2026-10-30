import { useMemo, useState } from 'react'
import { sortedPages, useStore } from '../store'
import { titleKey } from '../lib/wikitext'

/** Search box + list for choosing one of the wiki's pages. */
export default function PagePicker({ exclude = [], onPick }: { exclude?: string[]; onPick: (title: string) => void }): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const [q, setQ] = useState('')
  const skip = new Set(exclude.map(titleKey))
  const list = useMemo(
    () =>
      sortedPages(pages)
        .filter((p) => !skip.has(titleKey(p.title)) && titleKey(p.title).includes(titleKey(q)))
        .slice(0, 12),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pages, q, exclude.join('|')]
  )
  return (
    <div className="link-panel">
      <input autoFocus value={q} placeholder="Search pages" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && list[0] && onPick(list[0].title)} />
      <div className="link-options">
        {list.map((p) => (
          <button key={p.id} onClick={() => onPick(p.title)}>
            {p.title}
          </button>
        ))}
        {list.length === 0 && <span className="muted small">No matching pages.</span>}
      </div>
    </div>
  )
}
