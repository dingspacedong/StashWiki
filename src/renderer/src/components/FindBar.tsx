// Ctrl+F (⌘F on a Mac): find text in whatever is showing. Matches are painted with the CSS Highlight API, so the page
// itself (and an editor that's open) is never changed. HTML blocks and previews shown in frames aren't searched.
import { useEffect, useRef, useState } from 'react'
import { isModKey } from '../lib/platform'

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION'])

/** Every place `query` shows in the visible text of the window, in reading order. */
export function findRanges(root: Node, query: string): Range[] {
  const needle = query.toLowerCase()
  if (!needle.trim()) return []
  const nodes: Text[] = []
  const starts: number[] = []
  let text = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const el = n.parentElement
      if (!el || !n.nodeValue) return NodeFilter.FILTER_REJECT
      if (SKIP.has(el.tagName) || el.closest('.find-bar')) return NodeFilter.FILTER_REJECT
      return el.checkVisibility({ visibilityProperty: true }) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    }
  })
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    nodes.push(n)
    starts.push(text.length)
    text += n.nodeValue!
  }
  // Where a position in the joined text is: which text node, and how far into it.
  const at = (pos: number, end: boolean): [Text, number] => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] < pos || (!end && starts[mid] === pos)) lo = mid
      else hi = mid - 1
    }
    return [nodes[lo], pos - starts[lo]]
  }
  const hay = text.toLowerCase()
  const out: Range[] = []
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) {
    const r = document.createRange()
    r.setStart(...at(i, false))
    r.setEnd(...at(i + needle.length, true))
    out.push(r)
  }
  return out
}

function paint(all: Range[], current: Range | undefined): void {
  CSS.highlights.set('find-all', new Highlight(...all))
  if (current) CSS.highlights.set('find-current', new Highlight(current))
  else CSS.highlights.delete('find-current')
}

function unpaint(): void {
  CSS.highlights.delete('find-all')
  CSS.highlights.delete('find-current')
}

export default function FindBar(): React.JSX.Element | null {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [count, setCount] = useState(0)
  const [index, setIndex] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const ranges = useRef<Range[]>([])
  const indexRef = useRef(0)

  const show = (i: number, scroll: boolean): void => {
    const list = ranges.current
    const n = list.length ? ((i % list.length) + list.length) % list.length : 0
    indexRef.current = n
    setIndex(n)
    setCount(list.length)
    paint(list, list[n])
    if (scroll && list[n]) list[n].startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const search = (q: string, keepPlace: boolean): void => {
    ranges.current = findRanges(document.body, q)
    show(keepPlace ? indexRef.current : 0, !keepPlace)
  }

  // Ctrl+F opens it (or selects what's typed); Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isModKey(e) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        const picked = window.getSelection()?.toString().trim()
        if (picked && !picked.includes('\n') && picked.length < 100) setQuery(picked)
        setOpen(true)
        requestAnimationFrame(() => input.current?.select())
      } else if (open && (e.key === 'F3' || (isModKey(e) && e.key.toLowerCase() === 'g'))) {
        e.preventDefault()
        show(indexRef.current + (e.shiftKey ? -1 : 1), true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Look again as the person types, and when what's showing changes (another page, a panel opening…).
  useEffect(() => {
    if (!open) return unpaint()
    const t = setTimeout(() => search(query, false), 120)
    return () => clearTimeout(t)
  }, [open, query])
  useEffect(() => {
    if (!open || !query) return
    let t: ReturnType<typeof setTimeout> | undefined
    const watch = new MutationObserver((changes) => {
      if (changes.every((c) => (c.target instanceof Element ? c.target : c.target.parentElement)?.closest('.find-bar'))) return
      clearTimeout(t)
      t = setTimeout(() => search(query, true), 250)
    })
    watch.observe(document.body, { childList: true, subtree: true, characterData: true })
    return () => {
      watch.disconnect()
      clearTimeout(t)
    }
  }, [open, query])
  useEffect(() => unpaint, [])

  if (!open) return null
  const close = (): void => {
    setOpen(false)
    unpaint()
  }
  return (
    <div className="find-bar" role="search">
      <input
        ref={input}
        value={query}
        placeholder="Find on this page"
        aria-label="Find on this page"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            show(indexRef.current + (e.shiftKey ? -1 : 1), true)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            e.stopPropagation()
            close()
          }
        }}
      />
      <span className={'find-count' + (query && !count ? ' none' : '')}>{query ? (count ? `${index + 1} of ${count}` : 'No results') : ''}</span>
      <button className="icon-btn" title="Previous (Shift+Enter)" disabled={!count} onClick={() => show(indexRef.current - 1, true)}>
        ↑
      </button>
      <button className="icon-btn" title="Next (Enter)" disabled={!count} onClick={() => show(indexRef.current + 1, true)}>
        ↓
      </button>
      <button className="icon-btn" title="Close (Esc)" onClick={close}>
        ×
      </button>
    </div>
  )
}
