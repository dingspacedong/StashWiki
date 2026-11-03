import { useState } from 'react'
import { DEFAULT_THEME } from '@shared/defaults'
import { useStore } from '../store'
import { themeVars } from '../lib/theme'
import { formatDate } from '../components/ui'
import { isMac } from '../lib/platform'
import { startImport } from '../share/importFlow'
import FindBar from '../components/FindBar'

export default function LibraryScreen(): React.JSX.Element {
  const library = useStore((s) => s.library)!
  const error = useStore((s) => s.error)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const create = async (): Promise<void> => {
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      const entry = await window.stash.createWiki(name.trim())
      await useStore.getState().openWiki(entry.id)
    } catch (e) {
      window.alert(String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }
  const openFolder = async (): Promise<void> => {
    try {
      const entry = await window.stash.openWikiFolder()
      if (entry) await useStore.getState().openWiki(entry.id)
    } catch (e) {
      window.alert(String((e as Error).message ?? e))
    }
  }

  return (
    <div className="library" style={themeVars(DEFAULT_THEME) as React.CSSProperties}>
      <FindBar />
      <div className="library-card">
        <div className="library-brand">
          <img className="library-logo" src="logo.png" alt="" />
          <div>
            <h1>StashWiki</h1>
            <div className="muted">Private wikis that live only on your computer.</div>
          </div>
        </div>

        {error && <div className="field-error">{error}</div>}

        {library.wikis.length > 0 && (
          <>
            <h3>Your wikis</h3>
            <div className="wiki-list">
              {library.wikis.map((w) => (
                <div key={w.id} className="wiki-row">
                  <button className="wiki-open" onClick={() => void useStore.getState().openWiki(w.id)}>
                    <strong>{w.name}</strong>
                    <span className="muted small">
                      {w.dir} · opened {formatDate(w.lastOpened)}
                    </span>
                  </button>
                  <button
                    className="icon-btn"
                    title="Remove from this list (the files stay where they are)"
                    onClick={async () => {
                      if (!window.confirm(`Remove “${w.name}” from the list? Its files are not deleted; you can open the folder again later.`)) return
                      await window.stash.forgetWiki(w.id)
                      await useStore.getState().refreshLibrary()
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <h3>{library.wikis.length ? 'Start another wiki' : 'Start your first wiki'}</h3>
        <div className="row gap">
          <input
            className="big-input grow"
            value={name}
            autoFocus
            placeholder="Wiki name, e.g. Starfall AU Wiki"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
          />
          <button className="btn" disabled={!name.trim() || busy} onClick={() => void create()}>
            Create
          </button>
        </div>
        <div className="library-foot">
          <span className="row gap">
            <button className="link-btn" onClick={() => void openFolder()}>
              Open a wiki folder…
            </button>
            <button className="link-btn" onClick={() => void startImport()}>
              Open a .stashwiki file…
            </button>
          </span>
          <span className="muted small">New wikis are saved in {isMac ? 'Documents/StashWiki' : 'Documents\\StashWiki'}.</span>
        </div>
      </div>
    </div>
  )
}
