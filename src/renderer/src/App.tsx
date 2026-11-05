import { useEffect } from 'react'
import { useStore } from './store'
import LibraryScreen from './views/LibraryScreen'
import Shell from './Shell'
import { historyKey, isModKey } from './lib/platform'
import { ImportDialog, startImport } from './share/importFlow'
import { listenForUpdates } from './components/UpdatesSection'
import WhatsNew from './components/WhatsNew'

export default function App(): React.JSX.Element {
  const library = useStore((s) => s.library)
  const wikiId = useStore((s) => s.wikiId)
  const toast = useStore((s) => s.toast)
  const toastAction = useStore((s) => s.toastAction)

  useEffect(() => {
    // Opened by double-clicking a .stashwiki file (now, or later while running).
    void useStore
      .getState()
      .init()
      .then(() => window.stash.takeShareFile())
      .then((f) => (f ? startImport(f) : undefined))
    return window.stash.onShareFile((f) => void startImport(f))
  }, [])

  useEffect(listenForUpdates, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const s = useStore.getState()
      const nav = historyKey(e)
      if (nav) {
        e.preventDefault()
        if (nav === 'back') s.back()
        else s.forward()
      } else if (isModKey(e) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('.search input')?.focus()
      } else if (isModKey(e) && e.key === ',' && s.wikiId) {
        // Always a way back to the settings, even if custom CSS hides the sidebar.
        e.preventDefault()
        s.go({ kind: 'special', name: 'settings' })
      }
    }
    const onMouse = (e: MouseEvent): void => {
      if (e.button === 3) useStore.getState().back()
      if (e.button === 4) useStore.getState().forward()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mouseup', onMouse)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mouseup', onMouse)
    }
  }, [])

  if (!library) return <div className="loading">Opening StashWiki…</div>
  return (
    <>
      {wikiId ? <Shell /> : <LibraryScreen />}
      <ImportDialog />
      <WhatsNew />
      {toast && (
        <div className="toast">
          {toast}
          {toastAction && (
            <button
              className="toast-btn"
              onClick={() => {
                useStore.setState({ toast: null, toastAction: null })
                toastAction.run()
              }}
            >
              {toastAction.label}
            </button>
          )}
        </div>
      )}
    </>
  )
}
