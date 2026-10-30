import { create } from 'zustand'
import type { ImportMode, ShareInfo } from '@shared/types'
import { useStore } from '../store'

/** The share file waiting for the user to choose how to bring it in. */
export const useImport = create<{ info: ShareInfo | null; busy: boolean }>(() => ({ info: null, busy: false }))

/** Open a .stashwiki file (asks for one when no path is given) and bring it in. */
export async function startImport(path?: string): Promise<void> {
  try {
    const info = await window.stash.inspectShare(path)
    if (!info) return
    // A wiki you don't have yet just comes straight in.
    if (!info.existing) await finishImport(info, 'new')
    else useImport.setState({ info })
  } catch (e) {
    window.alert(String((e as Error).message ?? e))
  }
}

export async function finishImport(info: ShareInfo, mode: ImportMode): Promise<void> {
  const s = useStore.getState()
  if (s.dirty && !window.confirm('You have unsaved changes on a page. Bring in the shared file anyway (your unsaved changes will be lost)?')) return
  useImport.setState({ busy: true })
  try {
    const res = await window.stash.applyShare(info.token, mode)
    useStore.setState({ dirty: false })
    await useStore.getState().openWiki(res.entry.id)
    const m = res.summary
    useStore
      .getState()
      .notify(
        m
          ? `Merged: ${m.added} new, ${m.updated} updated, ${m.keptLocal} kept yours` + (m.stayedDeleted ? `, ${m.stayedDeleted} left deleted` : '')
          : mode === 'replace'
            ? `Replaced with the shared copy`
            : `Opened “${res.entry.name}”`
      )
  } catch (e) {
    window.alert('Couldn’t bring that file in: ' + String((e as Error).message ?? e))
  } finally {
    useImport.setState({ info: null, busy: false })
  }
}

/** Asks how to bring in a shared copy of a wiki you already have. */
export function ImportDialog(): React.JSX.Element | null {
  const { info, busy } = useImport()
  if (!info?.existing) return null
  const when = info.exportedAt ? new Date(info.exportedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null
  const cancel = (): void => useImport.setState({ info: null })
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && !busy && cancel()}>
      <div className="modal import-dialog">
        <h2>You already have “{info.existing.name}”</h2>
        <p className="muted">
          This file is a copy of the same wiki ({info.pages} pages{when ? `, saved ${when}` : ''}). How should it come in? A backup of your copy is saved
          first either way.
        </p>
        <button className="import-choice primary" disabled={busy} onClick={() => void finishImport(info, 'merge')}>
          <strong>Merge (recommended)</strong>
          <span>Each page keeps whichever version was edited most recently. New pages from either copy are kept. Good for passing a wiki back and forth.</span>
        </button>
        <button className="import-choice" disabled={busy} onClick={() => void finishImport(info, 'replace')}>
          <strong>Replace my copy</strong>
          <span>Your copy becomes exactly the shared one. Pages only you had go to the Trash.</span>
        </button>
        <button className="import-choice" disabled={busy} onClick={() => void finishImport(info, 'copy')}>
          <strong>Keep both</strong>
          <span>Opens the shared one as a separate wiki called “{info.name} (copy)”.</span>
        </button>
        <div className="row gap modal-actions">
          <span className="grow" />
          <button className="btn ghost" disabled={busy} onClick={cancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
