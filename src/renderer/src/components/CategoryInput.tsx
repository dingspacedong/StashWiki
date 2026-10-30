import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { cleanTitle, titleKey } from '../lib/wikitext'

/** Every category name in use anywhere in the wiki. */
export function useAllCategories(): string[] {
  const pages = useStore((s) => s.pages)
  const meta = useStore((s) => s.meta)
  return useMemo(() => {
    const names = new Map<string, string>()
    const add = (c: string): void => {
      if (!names.has(titleKey(c))) names.set(titleKey(c), c)
    }
    Object.values(pages).forEach((p) => p.categories.forEach(add))
    Object.keys(meta?.categories ?? {}).forEach(add)
    meta?.templates.forEach((t) => t.categories.forEach(add))
    return [...names.values()].sort((a, b) => a.localeCompare(b))
  }, [pages, meta])
}

export default function CategoryInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }): React.JSX.Element {
  const all = useAllCategories()
  const [text, setText] = useState('')
  const [focus, setFocus] = useState(false)
  const has = (c: string): boolean => value.some((v) => titleKey(v) === titleKey(c))
  const suggestions = all.filter((c) => !has(c) && titleKey(c).includes(titleKey(text))).slice(0, 8)

  const add = (c: string): void => {
    const name = cleanTitle(c)
    if (!name || has(name)) return setText('')
    const existing = all.find((a) => titleKey(a) === titleKey(name))
    onChange([...value, existing ?? name])
    setText('')
  }

  return (
    <div className="chips-input">
      {value.map((c) => (
        <span key={c} className="chip">
          {c}
          <button title="Remove" onClick={() => onChange(value.filter((v) => v !== c))}>
            ×
          </button>
        </span>
      ))}
      <div className="chips-field">
        <input
          value={text}
          placeholder={value.length ? 'Add another…' : 'Add a category…'}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setTimeout(() => setFocus(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(text)
            } else if (e.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
        />
        {focus && (suggestions.length > 0 || text.trim()) && (
          <div className="chips-drop">
            {suggestions.map((s) => (
              <button key={s} onMouseDown={() => add(s)}>
                {s}
              </button>
            ))}
            {text.trim() && !all.some((a) => titleKey(a) === titleKey(text)) && (
              <button onMouseDown={() => add(text)}>
                New category “{cleanTitle(text)}”
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
