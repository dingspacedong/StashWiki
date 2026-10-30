import { useEffect, useState } from 'react'
import type { HistoryEntry, Page } from '@shared/types'
import { useStore, useTitleIndex } from '../store'
import { renderBody } from '../lib/render'
import { parseCards, renderCardsHtml } from '../lib/cards'
import { titleKey } from '../lib/wikitext'
import { formatDate } from '../components/ui'

/** Earlier versions of a page, each viewable and restorable. */
export default function HistoryView({ id }: { id: string }): React.JSX.Element {
  const page = useStore((s) => s.pages[id])
  const wikiId = useStore((s) => s.wikiId)!
  const meta = useStore((s) => s.meta)!
  const go = useStore((s) => s.go)
  const index = useTitleIndex()
  const [list, setList] = useState<HistoryEntry[] | null>(null)
  const [open, setOpen] = useState<{ at: number; page: Page } | null>(null)

  useEffect(() => {
    void window.stash.listHistory(wikiId, id).then(setList)
  }, [wikiId, id])

  if (!page) return <p className="muted">This page no longer exists.</p>

  const show = async (at: number): Promise<void> => {
    if (open?.at === at) return setOpen(null)
    setOpen({ at, page: await window.stash.readHistory(wikiId, id, at) })
  }
  const restore = async (at: number): Promise<void> => {
    const old = await window.stash.readHistory(wikiId, id, at)
    if (!window.confirm(`Put back the version from ${formatDate(old.updatedAt)}? The current version is kept in this history too.`)) return
    const current = useStore.getState().pages[id]
    await useStore.getState().savePage({ ...old, id }, current && current.title !== old.title ? current.title : undefined, 'force')
    useStore.getState().notify('Earlier version restored')
    go({ kind: 'page', id }, { replace: true })
  }

  return (
    <div className="history-view">
      <h1 className="page-title">
        <span className="muted">History:</span> {page.title}
      </h1>
      <p className="muted">
        Earlier versions of this page, newest first. A version is kept before each change (at most one every 10 minutes while you type, and always
        before the writing buddy changes something). Restoring keeps the current version here too.
      </p>
      {list && list.length === 0 && <p>No earlier versions yet — they appear here after the page is changed.</p>}
      <ul className="history-list">
        <li className="history-current">
          <strong>Current version</strong> <span className="muted">— edited {formatDate(page.updatedAt)}</span>
        </li>
        {list?.map((h) => (
          <li key={h.at}>
            <div className="row gap">
              <span>
                Version from <strong>{formatDate(h.updatedAt)}</strong>
                {h.title !== page.title && <span className="muted"> (called “{h.title}”)</span>}
                <span className="muted small"> · {Math.max(1, Math.round(h.size / 100) / 10)}k characters</span>
              </span>
              <span className="grow" />
              <button className="link-btn" onClick={() => void show(h.at)}>
                {open?.at === h.at ? 'Hide' : 'Show'}
              </button>
              <button className="btn small" onClick={() => void restore(h.at)}>
                Restore
              </button>
            </div>
            {open?.at === h.at && (
              <div
                className="history-preview prose"
                dangerouslySetInnerHTML={{
                  __html: renderBody(
                    open.page.body,
                    (t) => index.has(titleKey(t)),
                    (json) => renderCardsHtml(parseCards(json), (t) => index.get(titleKey(t)), meta)
                  ).html
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
