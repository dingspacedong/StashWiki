// "What's new": shown once, the first time StashWiki opens after an update.
import { useEffect, useState } from 'react'
import { DEFAULT_THEME } from '@shared/defaults'
import { useStore } from '../store'
import { themeVars } from '../lib/theme'
import { notesSince, type ReleaseNote } from '../lib/releaseNotes'

export default function WhatsNew(): React.JSX.Element | null {
  const meta = useStore((s) => s.meta)
  const [notes, setNotes] = useState<{ list: ReleaseNote[]; current: string; previous: string | null } | null>(null)
  const [closing, setClosing] = useState(false)
  const close = (): void => {
    setClosing(true)
    setTimeout(() => setNotes(null), 180)
  }

  useEffect(() => {
    void window.stash.updates.whatsNew().then((w) => {
      const list = w.show ? notesSince(w.previous, w.current, __AI__) : []
      if (list.length) setNotes({ list, current: w.current, previous: w.previous })
    })
  }, [])

  useEffect(() => {
    if (!notes) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [notes])

  if (!notes) return null
  const [latest, ...older] = notes.list
  return (
    <div
      className={'whats-new-back' + (closing ? ' closing' : '')}
      style={themeVars(meta?.theme ?? DEFAULT_THEME) as React.CSSProperties}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <div className="whats-new" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
        <div className="wn-hero">
          <div className="wn-sparkles" aria-hidden>
            <span>✦</span>
            <span>✧</span>
            <span>✦</span>
          </div>
          <img className="wn-logo" src="logo.png" alt="" />
          <div className="wn-kicker">What’s new{notes.previous ? ` since ${notes.previous}` : ''}</div>
          <h2 id="whats-new-title">{latest.headline}</h2>
          <div className="wn-version">StashWiki {notes.current}</div>
        </div>
        <div className="wn-body">
          <ul className="wn-items">
            {latest.items.map((it) => (
              <li key={it.title}>
                <span className="wn-icon" aria-hidden>
                  {it.icon}
                </span>
                <div>
                  <div className="wn-item-title">{it.title}</div>
                  <div className="wn-item-text">{it.text}</div>
                </div>
              </li>
            ))}
          </ul>
          {older.length > 0 && (
            <details className="wn-older">
              <summary>
                Also new since you last updated <span className="muted">({older.map((r) => r.version).join(', ')})</span>
              </summary>
              {older.map((r) => (
                <div key={r.version} className="wn-older-release">
                  <div className="wn-older-head">
                    <strong>{r.headline}</strong> <span className="muted small">{r.version}</span>
                  </div>
                  <ul className="wn-items small">
                    {r.items.map((it) => (
                      <li key={it.title}>
                        <span className="wn-icon" aria-hidden>
                          {it.icon}
                        </span>
                        <div>
                          <div className="wn-item-title">{it.title}</div>
                          <div className="wn-item-text">{it.text}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </details>
          )}
        </div>
        <div className="wn-foot">
          <button className="btn wn-ok" autoFocus onClick={close}>
            Let’s go!
          </button>
        </div>
      </div>
    </div>
  )
}
