import { useState } from 'react'
import { LOOK_SECTIONS, activeLooks, addLook, removeLook, type LookGroup } from '../lib/looks'

/** Does a search like "round info" match these words? Every word has to appear somewhere. */
export function matches(q: string, ...texts: string[]): boolean {
  const hay = texts.join(' ').toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w))
}

/** Ready-made looks by section: click to switch one on, click again (or "None") to take it off. */
export default function LookPicker({ css, onChange }: { css: string; onChange: (css: string) => void }): React.JSX.Element {
  const [sectionId, setSectionId] = useState(LOOK_SECTIONS[0].id)
  const [q, setQ] = useState('')
  const section = LOOK_SECTIONS.find((s) => s.id === sectionId) ?? LOOK_SECTIONS[0]
  const on = activeLooks(css)
  const countIn = (id: string): number => LOOK_SECTIONS.find((s) => s.id === id)!.groups.reduce((n, g) => n + g.looks.filter((l) => on.has(`${g.id}/${l.id}`)).length, 0)

  // While searching: every group with a matching look, from all sections, showing only the matches.
  const shown: { group: LookGroup; label: string }[] = q.trim()
    ? LOOK_SECTIONS.flatMap((s) =>
        s.groups
          .map((g) => ({ group: { ...g, looks: g.looks.filter((l) => matches(q, l.name, l.hint, g.title, s.title)) }, label: `${s.title} › ${g.title}` }))
          .filter((x) => x.group.looks.length)
      )
    : section.groups.map((g) => ({ group: g, label: g.title }))

  return (
    <div className="look-picker">
      <input className="picker-search" type="search" placeholder="Search looks… (e.g. rounded, dark, stars)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search looks" />
      {!q.trim() && (
        <div className="look-sections" role="tablist">
          {LOOK_SECTIONS.map((s) => (
            <button key={s.id} role="tab" aria-selected={s.id === section.id} className={'chip-btn' + (s.id === section.id ? ' on' : '')} onClick={() => setSectionId(s.id)}>
              <span aria-hidden>{s.icon}</span> {s.title}
              {countIn(s.id) > 0 && <span className="look-count">{countIn(s.id)}</span>}
            </button>
          ))}
        </div>
      )}
      {q.trim() && !shown.length && <p className="muted">No looks match “{q}”.</p>}
      {shown.map(({ group: g, label }) => {
        // "None" and the swap rule always use the whole group, not just the search matches.
        const full = LOOK_SECTIONS.flatMap((s) => s.groups).find((x) => x.id === g.id)!
        const anyOn = full.looks.some((l) => on.has(`${g.id}/${l.id}`))
        return (
          <div key={g.id} className="look-group">
            <div className="look-group-title">
              {label} <span className="muted small">{g.pick === 'one' ? '— pick one' : '— pick any'}</span>
            </div>
            <div className="look-options">
              {g.pick === 'one' && !q.trim() && (
                <button className={'look-opt' + (!anyOn ? ' on' : '')} onClick={() => onChange(removeLook(css, g.id))}>
                  <strong>None</strong>
                  <span>As it was</span>
                </button>
              )}
              {g.looks.map((l) => {
                const active = on.has(`${g.id}/${l.id}`)
                return (
                  <button
                    key={l.id}
                    className={'look-opt' + (active ? ' on' : '')}
                    aria-pressed={active}
                    onClick={() => onChange(active ? removeLook(css, g.id, l.id) : addLook(css, full, l))}
                  >
                    <strong>
                      {active && '✓ '}
                      {l.name}
                    </strong>
                    {l.hint && <span>{l.hint}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      {on.size > 0 && (
        <button
          className="link-btn danger small"
          onClick={() => {
            if (!window.confirm('Take off every ready-made look? CSS you wrote yourself stays.')) return
            let next = css
            for (const key of on) next = removeLook(next, key.split('/')[0], key.split('/')[1])
            onChange(next)
          }}
        >
          Remove all ready-made looks ({on.size})
        </button>
      )}
    </div>
  )
}
