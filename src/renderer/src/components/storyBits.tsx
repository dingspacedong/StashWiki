// Small pieces shared by the story screens.
import { useEffect, useState } from 'react'
import type { Page, StoryRating, StoryStatus } from '@shared/types'
import { useStore } from '../store'
import { imgUrl } from '../lib/theme'
import { RATING_LABELS, STATUS_LABELS, appearances, isStory, storiesOn } from '../lib/stories'
import { Dropdown } from './ui'

export function StatusBadge({ status }: { status: StoryStatus }): React.JSX.Element {
  return <span className={`story-badge status-${status}`}>{STATUS_LABELS[status]}</span>
}

export function RatingBadge({ rating }: { rating: StoryRating }): React.JSX.Element | null {
  return rating ? <span className={`story-badge rating-${rating}`}>{RATING_LABELS[rating]}</span> : null
}

/** The story's cover, or a soft coloured tile with its first letter. */
export function Cover({ story, size = 'big' }: { story: Page; size?: 'big' | 'small' }): React.JSX.Element {
  const cover = story.story?.cover
  return (
    <div className={`story-cover ${size}`} aria-hidden>
      {cover ? <img src={imgUrl(cover)} alt="" /> : <span>{story.title.slice(0, 1)}</span>}
    </div>
  )
}

/** Stories › (Series ›) Story › … */
export function StoryCrumbs({ story, last }: { story?: Page; last?: string }): React.JSX.Element {
  const go = useStore((s) => s.go)
  return (
    <nav className="story-crumbs" aria-label="Where you are">
      <button className="link-btn" onClick={() => go({ kind: 'special', name: 'stories' })}>
        Stories
      </button>
      {story?.story?.series && (
        <>
          <span>›</span>
          <span className="muted">{story.story.series}</span>
        </>
      )}
      {story && (
        <>
          <span>›</span>
          {last ? (
            <button className="link-btn" onClick={() => go({ kind: 'page', id: story.id })}>
              {story.title}
            </button>
          ) : (
            <span>{story.title}</span>
          )}
        </>
      )}
      {last && (
        <>
          <span>›</span>
          <span>{last}</span>
        </>
      )}
    </nav>
  )
}

/** Little removable chips with a box to add more. */
export function ChipInput({
  value,
  onChange,
  placeholder,
  suggestions = []
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder: string
  suggestions?: string[]
}): React.JSX.Element {
  const [text, setText] = useState('')
  const listId = 'chips-' + placeholder.replace(/\W+/g, '')
  const add = (): void => {
    const t = text.trim()
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t])
    setText('')
  }
  return (
    <div className="chip-input">
      {value.map((v) => (
        <span key={v} className="chip">
          {v}
          <button aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>
            ×
          </button>
        </span>
      ))}
      <input
        value={text}
        list={suggestions.length ? listId : undefined}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add()
          } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
        }}
        onBlur={add}
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  )
}

// ---------- reading settings (per computer) ----------

export interface ReadingPrefs {
  size: 's' | 'm' | 'l' | 'xl'
  font: 'wiki' | 'book' | 'sans' | 'dyslexic'
  spacing: 'normal' | 'relaxed'
  width: 'narrow' | 'normal' | 'wide'
  theme: 'page' | 'paper' | 'sepia' | 'night'
}
const DEFAULT_READING: ReadingPrefs = { size: 'm', font: 'wiki', spacing: 'relaxed', width: 'normal', theme: 'page' }
const READING_KEY = 'sw-reading'
let listeners: ((p: ReadingPrefs) => void)[] = []

function loadReading(): ReadingPrefs {
  try {
    return { ...DEFAULT_READING, ...(JSON.parse(localStorage.getItem(READING_KEY) ?? '{}') as Partial<ReadingPrefs>) }
  } catch {
    return DEFAULT_READING
  }
}

export function useReading(): [ReadingPrefs, (patch: Partial<ReadingPrefs>) => void] {
  const [prefs, setPrefs] = useState(loadReading)
  useEffect(() => {
    listeners.push(setPrefs)
    return () => void (listeners = listeners.filter((l) => l !== setPrefs))
  }, [])
  const update = (patch: Partial<ReadingPrefs>): void => {
    const next = { ...loadReading(), ...patch }
    try {
      localStorage.setItem(READING_KEY, JSON.stringify(next))
    } catch {
      // not remembered, still applied
    }
    for (const l of listeners) l(next)
  }
  return [prefs, update]
}

/** The "Aa" menu: text size, font, spacing, width and page colour while reading. */
export function ReadingMenu(): React.JSX.Element {
  const [prefs, set] = useReading()
  const row = <K extends keyof ReadingPrefs>(key: K, label: string, options: [ReadingPrefs[K], string][]): React.JSX.Element => (
    <div className="reading-row">
      <span>{label}</span>
      <span className="seg">
        {options.map(([v, text]) => (
          <button key={v} className={prefs[key] === v ? 'on' : ''} onClick={() => set({ [key]: v } as Partial<ReadingPrefs>)}>
            {text}
          </button>
        ))}
      </span>
    </div>
  )
  return (
    <Dropdown label="Aa" className="btn small ghost reading-btn" align="right" title="Reading settings">
      {() => (
        <div className="menu reading-menu">
          {row('size', 'Text size', [
            ['s', 'S'],
            ['m', 'M'],
            ['l', 'L'],
            ['xl', 'XL']
          ])}
          {row('font', 'Font', [
            ['wiki', 'Wiki'],
            ['book', 'Book'],
            ['sans', 'Plain'],
            ['dyslexic', 'Dyslexia']
          ])}
          {row('spacing', 'Line spacing', [
            ['normal', 'Normal'],
            ['relaxed', 'Roomy']
          ])}
          {row('width', 'Width', [
            ['narrow', 'Narrow'],
            ['normal', 'Medium'],
            ['wide', 'Wide']
          ])}
          {row('theme', 'Page', [
            ['page', 'Wiki'],
            ['paper', 'Paper'],
            ['sepia', 'Sepia'],
            ['night', 'Night']
          ])}
          <p className="muted small">Only changes how stories look for you, on this computer.</p>
        </div>
      )}
    </Dropdown>
  )
}

/** On a character's (or any) wiki page: the stories it turns up in. */
export function AppearsIn({ page }: { page: Page }): React.JSX.Element | null {
  const pages = useStore((s) => s.pages)
  const go = useStore((s) => s.go)
  const on = useStore((s) => storiesOn(s.meta))
  if (!on || !page || isStory(page) || page.chapter) return null
  const list = appearances(page, pages)
  if (!list.length) return null
  return (
    <section className="appears-in">
      <h3>Appears in</h3>
      <ul>
        {list.map(({ story, chapters, listed }) => (
          <li key={story.id}>
            <button className="link-btn" onClick={() => go({ kind: 'page', id: story.id })}>
              {story.title}
            </button>
            {listed && <span className="story-badge soft">character</span>}
            {chapters.length > 0 && (
              <span className="muted small">
                {' '}
                — mentioned in{' '}
                {chapters.slice(0, 4).map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ', '}
                    <button className="link-btn" onClick={() => go({ kind: 'page', id: c.id })}>
                      {c.chapter!.name}
                    </button>
                  </span>
                ))}
                {chapters.length > 4 && ` and ${chapters.length - 4} more`}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
