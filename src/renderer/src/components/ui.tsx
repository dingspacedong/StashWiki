import { useEffect, useRef, useState } from 'react'
import { useStore, useTitleIndex } from '../store'
import { renderInlineText, titleKey } from '../lib/wikitext'

/** A button that opens a small floating panel; the panel closes on outside click or Escape. */
export function Dropdown({
  label,
  title,
  className,
  align = 'left',
  children
}: {
  label: React.ReactNode
  title?: string
  className?: string
  align?: 'left' | 'right'
  children: (close: () => void) => React.ReactNode
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="dropdown" ref={ref}>
      <button
        type="button"
        title={title}
        className={(className ?? 'tb-btn') + (open ? ' active' : '')}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && <div className={'dropdown-panel ' + align}>{children(() => setOpen(false))}</div>}
    </div>
  )
}

export function ColorInput({
  value,
  onChange,
  placeholder
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}): React.JSX.Element {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  return (
    <span className="color-input">
      <input type="color" value={value || placeholder || '#000000'} onChange={(e) => onChange(e.target.value)} />
      <input
        className="hex"
        value={text}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value)
          if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value)
        }}
        onBlur={() => setText(value)}
      />
    </span>
  )
}

/** Plain text that may contain [[links]] and URLs, rendered and clickable. */
export function RichInline({ text, className }: { text: string; className?: string }): React.JSX.Element {
  const index = useTitleIndex()
  const html = renderInlineText(text, (t) => index.has(titleKey(t)))
  return <span className={className} onClick={handleLinkClick} dangerouslySetInnerHTML={{ __html: html }} />
}

/** Shared click handling for rendered wiki content: wiki links navigate, external links open the browser. */
export function handleLinkClick(e: React.MouseEvent): void {
  const a = (e.target as HTMLElement).closest('a')
  if (!a) return
  e.preventDefault()
  const s = useStore.getState()
  const target = a.getAttribute('data-wikilink')
  if (target !== null) {
    const page = Object.values(s.pages).find((p) => titleKey(p.title) === titleKey(target))
    s.go(page ? { kind: 'page', id: page.id } : { kind: 'new', title: target })
    return
  }
  const toc = a.getAttribute('data-toc')
  if (toc) {
    document.getElementById(toc)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    return
  }
  const href = a.getAttribute('href')
  if (href && /^https?:/i.test(href)) void window.stash.openExternal(href)
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
