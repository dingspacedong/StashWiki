import { useEffect, useRef } from 'react'

/** A plain code box: monospace, no spellcheck, Tab indents (Shift+Tab un-indents), Ctrl/Cmd+S saves. */
export function CodeArea({
  value,
  onChange,
  onSave,
  placeholder,
  rows = 14,
  label
}: {
  value: string
  onChange: (v: string) => void
  onSave?: () => void
  placeholder?: string
  rows?: number
  label: string
}): React.JSX.Element {
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    const ta = e.currentTarget
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && onSave) {
      e.preventDefault()
      e.stopPropagation()
      onSave()
      return
    }
    if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return
    e.preventDefault()
    const { selectionStart: a, selectionEnd: b } = ta
    const start = value.lastIndexOf('\n', a - 1) + 1
    if (a === b && !e.shiftKey) {
      onChange(value.slice(0, a) + '  ' + value.slice(b))
      requestAnimationFrame(() => ta.setSelectionRange(a + 2, a + 2))
      return
    }
    // Indent or un-indent every selected line.
    const lines = value.slice(start, b).split('\n')
    const changed = lines.map((l) => (e.shiftKey ? l.replace(/^ {1,2}/, '') : '  ' + l))
    const next = value.slice(0, start) + changed.join('\n') + value.slice(b)
    onChange(next)
    const delta = changed.join('\n').length - lines.join('\n').length
    requestAnimationFrame(() => ta.setSelectionRange(Math.max(start, a + (e.shiftKey ? Math.min(0, delta) : 2)), b + delta))
  }
  return (
    <textarea
      className="code-area"
      aria-label={label}
      value={value}
      rows={rows}
      spellCheck={false}
      autoCapitalize="off"
      autoComplete="off"
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
    />
  )
}

/**
 * Shows HTML inside its own shadow root, so a <style> in it only styles the preview and can't change the
 * rest of the screen.
 */
export function IsolatedHtml({
  html,
  className,
  onEdit
}: {
  html: string
  className?: string
  /** Makes the words editable in place; gets the block's HTML after each change. */
  onEdit?: (html: string) => void
}): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  const ownChange = useRef(false)
  const editRef = useRef(onEdit)
  editRef.current = onEdit
  useEffect(() => {
    const el = host.current
    if (!el) return
    // The HTML just came from typing in here: redrawing it would lose the cursor.
    if (ownChange.current) {
      ownChange.current = false
      return
    }
    const root = el.shadowRoot ?? el.attachShadow({ mode: 'open' })
    const base = '<style>:host{display:block}img{max-width:100%}a{color:var(--link)}a.new{color:var(--redlink)}</style>'
    if (!onEdit) {
      root.innerHTML = base + html
      return
    }
    root.innerHTML = base + `<style>${EDITING_CSS}</style><div class="sw-edit" contenteditable="true" spellcheck="true"></div>`
    const box = root.querySelector<HTMLDivElement>('.sw-edit')!
    box.innerHTML = html
    // Show everything that's normally hidden (closed fold-outs, other tabs…) so all the words can be changed.
    for (const d of box.querySelectorAll('details:not([open])')) d.setAttribute('open', ''), d.setAttribute('data-sw-opened', '')
    box.addEventListener('input', () => {
      const copy = box.cloneNode(true) as HTMLElement
      for (const d of copy.querySelectorAll('[data-sw-opened]')) d.removeAttribute('open'), d.removeAttribute('data-sw-opened')
      ownChange.current = true
      editRef.current?.(copy.innerHTML)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, !!onEdit])
  return <div ref={host} className={className} />
}

/** While changing the words: nothing moves, and hidden parts (tabs, backs of cards, blacked-out words) show. */
const EDITING_CSS = `
.sw-edit { outline: 2px dashed color-mix(in srgb, var(--accent) 45%, transparent); outline-offset: 4px; border-radius: 4px; min-height: 40px; }
.sw-edit *, .sw-edit *::before, .sw-edit *::after { animation: none !important; transition: none !important; }
.sw-edit .swb-tab { display: block !important; margin-top: 6px; }
.sw-edit .swb-tabs input { display: none; }
.sw-edit .swb-flip { height: auto !important; }
.sw-edit .swb-flip-in { transform: none !important; }
.sw-edit .swb-front, .sw-edit .swb-back { position: static !important; transform: none !important; backface-visibility: visible !important; margin-bottom: 6px; }
.sw-edit .swb-redact { color: inherit !important; background: transparent !important; outline: 1px dashed currentColor; }
.sw-edit .swb-type span { max-width: none !important; }
.sw-edit .swb-marquee span { padding-left: 0 !important; }
`
