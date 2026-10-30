import { useMemo, useRef, useState } from 'react'
import { listed } from '../lib/stories'
import { useStore } from '../store'
import { titleKey } from '../lib/wikitext'
import { kb } from '../lib/platform'

export default function SearchBox(): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const go = useStore((s) => s.go)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => {
    const key = titleKey(q)
    if (!key) return []
    const all = Object.values(pages).filter(listed(useStore.getState().meta))
    const starts = all.filter((p) => titleKey(p.title).startsWith(key))
    const contains = all.filter((p) => !titleKey(p.title).startsWith(key) && titleKey(p.title).includes(key))
    const byTitle = (a: { title: string }, b: { title: string }): number => a.title.localeCompare(b.title)
    return [...starts.sort(byTitle), ...contains.sort(byTitle)].slice(0, 8)
  }, [q, pages])

  const finish = (): void => {
    setQ('')
    setOpen(false)
    input.current?.blur()
  }
  const choose = (i: number): void => {
    if (i < matches.length) go({ kind: 'page', id: matches[i].id })
    else if (q.trim()) go({ kind: 'search', q: q.trim() })
    finish()
  }

  return (
    <div className="search">
      <input
        ref={input}
        value={q}
        placeholder={`Search this wiki (${kb('K')})`}
        onChange={(e) => {
          setQ(e.target.value)
          setSel(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSel((s) => Math.min(s + 1, matches.length))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSel((s) => Math.max(s - 1, 0))
          } else if (e.key === 'Enter') {
            choose(sel)
          } else if (e.key === 'Escape') {
            finish()
          }
        }}
      />
      {open && q.trim() && (
        <div className="search-drop">
          {matches.map((p, i) => (
            <button key={p.id} className={i === sel ? 'sel' : ''} onMouseDown={() => choose(i)}>
              {p.title}
            </button>
          ))}
          <button className={'search-all' + (sel === matches.length ? ' sel' : '')} onMouseDown={() => choose(matches.length)}>
            Search page text for “{q.trim()}”
          </button>
        </div>
      )}
    </div>
  )
}
