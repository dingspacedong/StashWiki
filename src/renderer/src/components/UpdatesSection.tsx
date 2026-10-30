import { useEffect, useState } from 'react'
import type { UpdateCheck, UpdateInfo, UpdateProgress } from '@shared/types'
import { useStore } from '../store'

const sizeMb = (bytes: number): string => `${Math.max(1, Math.round(bytes / 1048576))} MB`

/** "Check for updates" and "Update and restart", in Look & settings. */
export default function UpdatesSection(): React.JSX.Element {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [found, setFound] = useState<UpdateCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<UpdateProgress | null>(null)

  useEffect(() => {
    void window.stash.updates.info().then(setInfo)
    return window.stash.updates.onProgress((p) => {
      setProgress(p)
      if (p.stage === 'error') setError(p.message)
    })
  }, [])

  const check = async (): Promise<void> => {
    setChecking(true)
    setError('')
    setFound(null)
    try {
      setFound(await window.stash.updates.check())
    } catch (e) {
      setError(String((e as Error).message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setChecking(false)
    }
  }
  const install = (): void => {
    setError('')
    setProgress({ stage: 'download', percent: 0, message: 'Starting…' })
    void window.stash.updates.install()
  }

  const busy = !!progress && progress.stage !== 'error'
  const canInstall = found?.newer && (found.mode === 'source' || (!!found.asset && found.mode !== 'manual'))

  return (
    <section className="settings-section updates-section">
      <h2>Updates</h2>
      <p>
        You have StashWiki <strong>{info?.current ?? '…'}</strong>.
        {info?.mode === 'source' && ' (running from the source code: updating uses git pull and rebuilds.)'}
      </p>
      <div className="row gap wrap">
        <button className="btn" disabled={checking || busy} onClick={() => void check()}>
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
        {info && (
          <label className="check">
            <input
              type="checkbox"
              checked={info.autoCheck}
              onChange={(e) => {
                setInfo({ ...info, autoCheck: e.target.checked })
                void window.stash.updates.setAutoCheck(e.target.checked)
              }}
            />
            Check when StashWiki starts
          </label>
        )}
      </div>

      {found && !found.newer && <p className="update-ok">✓ You have the newest version.</p>}
      {found?.newer && (
        <div className="update-box">
          <div className="update-title">
            Version <strong>{found.latest}</strong> is available
            {found.asset && <span className="muted small"> · {sizeMb(found.asset.size)} download</span>}
          </div>
          {found.notes && <pre className="update-notes">{found.notes}</pre>}
          {busy ? (
            <div className="update-progress">
              <div className="update-bar">
                <div style={{ width: `${progress?.stage === 'download' ? (progress.percent ?? 0) : 100}%` }} />
              </div>
              <span className="muted small">{progress?.message}</span>
            </div>
          ) : canInstall ? (
            <button className="btn" onClick={install}>
              Update and restart
            </button>
          ) : (
            <p className="muted small">This copy can’t update itself — download the new version from the releases page.</p>
          )}
          <button className="link-btn small" onClick={() => void window.stash.openExternal(found.url)}>
            See this release on GitHub
          </button>
        </div>
      )}
      {error && <div className="field-error">{error}</div>}
      <p className="muted small">
        StashWiki only goes online when you check for updates (or tick the box). It asks GitHub for the newest version and downloads it — nothing about
        you or your wikis is sent. Updating never touches your wikis.
      </p>
    </section>
  )
}

/** A gentle note when the start-up check finds a new version. */
export function listenForUpdates(): () => void {
  return window.stash.updates.onAvailable((c) =>
    useStore.getState().notify(`StashWiki ${c.latest} is available`, {
      label: 'See',
      run: () => useStore.getState().go({ kind: 'special', name: 'settings' })
    })
  )
}
