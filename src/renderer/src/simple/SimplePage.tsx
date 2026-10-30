import { useEffect, useMemo, useRef, useState } from 'react'
import type { Page } from '@shared/types'
import { findPage, useStore } from '../store'
import { cleanTitle, titleKey } from '../lib/wikitext'
import { isModKey } from '../lib/platform'
import { useApplyPageTheme } from '../previewTheme'
import RichEditor from '../components/RichEditor'
import GalleryEditor from '../components/GalleryEditor'
import CategoryInput from '../components/CategoryInput'
import ThemeEditor from '../components/ThemeEditor'
import PageCssEditor from '../components/PageCssEditor'
import { TopMatterEditor } from '../components/TopMatter'
import { Dropdown, formatDate } from '../components/ui'
import InfoboxInline from './InfoboxInline'

type SaveState = 'saved' | 'saving' | 'waiting'

/**
 * The simple design's editor: you type straight onto a page laid out like the finished one, and it is
 * saved automatically a moment after you stop. “Done” goes back to the normal reading view.
 */
export default function SimplePage({ id }: { id: string }): React.JSX.Element {
  const stored = useStore((s) => s.pages[id])
  const meta = useStore((s) => s.meta)!
  const wikiId = useStore((s) => s.wikiId)!
  const pages = useStore((s) => s.pages)
  const go = useStore((s) => s.go)

  const [draft, setDraft] = useState<Page | undefined>(stored)
  const draftRef = useRef(draft)
  const [titleText, setTitleText] = useState(stored?.title ?? '')
  const [status, setStatus] = useState<SaveState>('saved')
  const [colors, setColors] = useState(false)
  const [css, setCss] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef(false)

  useApplyPageTheme(draft?.theme)
  const titles = useMemo(() => Object.values(pages).map((p) => p.title), [pages])

  const flush = async (): Promise<void> => {
    clearTimeout(timer.current)
    if (!pending.current || !draftRef.current) return
    pending.current = false
    setStatus('saving')
    // Still lands in this wiki if it's being closed (e.g. "Switch wiki" right after typing).
    if (useStore.getState().wikiId === wikiId) await useStore.getState().savePage(draftRef.current)
    else await window.stash.savePage(wikiId, { ...draftRef.current, updatedAt: Date.now() })
    if (!pending.current) setStatus('saved')
  }
  const flushRef = useRef(flush)
  flushRef.current = flush

  const update = (patch: Partial<Page>): void => {
    const next = { ...draftRef.current!, ...patch }
    draftRef.current = next
    setDraft(next)
    pending.current = true
    setStatus('waiting')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void flushRef.current(), 700)
  }

  // Save straight away when leaving the page or closing the window.
  useEffect(() => {
    const onUnload = (): void => void flushRef.current()
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      void flushRef.current()
    }
  }, [])

  // ⌘S still works for people who press it out of habit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isModKey(e) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void flushRef.current().then(() => useStore.getState().notify('Saved'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!draft) {
    return (
      <div className="notice-page">
        <h1 className="page-title">Page not found</h1>
        <p>This page was deleted or moved to the trash.</p>
      </div>
    )
  }

  const template = meta.templates.find((t) => t.id === draft.templateId)
  const isMain = meta.mainPageId === draft.id

  const commitTitle = async (): Promise<void> => {
    const next = cleanTitle(titleText)
    const current = draftRef.current!
    if (!next || next === current.title) {
      setTitleText(current.title)
      return
    }
    const clash = findPage(useStore.getState().pages, next)
    if (clash && clash.id !== current.id) {
      useStore.getState().notify(`There’s already a page called “${clash.title}”`)
      setTitleText(current.title)
      return
    }
    const old = current.title
    const renamed = { ...current, title: next }
    draftRef.current = renamed
    setDraft(renamed)
    setTitleText(next)
    clearTimeout(timer.current)
    pending.current = false
    setStatus('saving')
    await useStore.getState().savePage(renamed, titleKey(old) !== titleKey(next) ? old : undefined)
    setStatus('saved')
  }

  const openLink = (title: string): void => {
    void flush()
    const target = findPage(useStore.getState().pages, title)
    go(target ? { kind: 'page', id: target.id } : { kind: 'new', title })
  }

  const trash = async (): Promise<void> => {
    if (!window.confirm(`Move “${draft.title}” to the trash? You can get it back from Trash in the sidebar.`)) return
    clearTimeout(timer.current)
    pending.current = false
    await useStore.getState().trashPage(draft.id)
    useStore.getState().notify(`Moved “${draft.title}” to the trash`)
    go({ kind: 'special', name: 'recent' }, { replace: true })
  }

  const statusText = status === 'saved' ? 'All changes saved' : status === 'saving' ? 'Saving…' : 'Editing…'

  return (
    <article className="page simple-page">
      <div className="simple-bar">
        <span className={'save-status ' + status}>{statusText}</span>
        <span className="grow" />
        <button
          className="btn small"
          onClick={() => {
            void flush()
            go({ kind: 'page', id: draft.id }, { replace: true })
          }}
          title="Finish editing and see the page as it reads"
        >
          Done
        </button>
        <Dropdown label="⋯" className="btn small ghost" align="right" title="Page options">
          {(close) => (
            <div className="menu page-menu">
              <label className="menu-field">
                <span>Page type</span>
                <select value={draft.templateId ?? ''} onChange={(e) => update({ templateId: e.target.value || null })}>
                  <option value="">Plain page (no infobox)</option>
                  {meta.templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <button onClick={() => (close(), setColors(true))}>Page colors…</button>
              <button onClick={() => (close(), setCss(true))}>Page looks & CSS…</button>
              <label className="menu-check">
                <input type="checkbox" checked={draft.private} onChange={(e) => update({ private: e.target.checked })} />
                Private (never in a website export)
              </label>
              {!isMain && (
                <button
                  onClick={async () => {
                    close()
                    await useStore.getState().saveMeta({ ...meta, mainPageId: draft.id })
                    useStore.getState().notify(`“${draft.title}” is now the home page`)
                  }}
                >
                  Make this the home page
                </button>
              )}
              <button onClick={() => (close(), void flush(), go({ kind: 'backlinks', id: draft.id }))}>What links here</button>
              <button onClick={() => (close(), void flush(), go({ kind: 'history', id: draft.id }))}>Page history (earlier versions)</button>
              <button className="danger" onClick={() => (close(), void trash())}>
                Move to trash
              </button>
            </div>
          )}
        </Dropdown>
      </div>

      <>
          <input
            className="title-inline"
            value={titleText}
            placeholder="Page title"
            onChange={(e) => setTitleText(e.target.value)}
            onBlur={() => void commitTitle()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                setTitleText(draft.title)
                e.currentTarget.blur()
              }
            }}
            title="Click to rename — links to this page update automatically"
          />
          {draft.private && <span className="badge">Private</span>}
          <TopMatterEditor hatnotes={draft.hatnotes} quote={draft.quote} onChange={(p) => update(p)} />

          <div className="article simple-article">
            {template && (
              <InfoboxInline
                title={draft.title}
                template={template}
                values={draft.infobox}
                overrides={draft.infoboxOverrides}
                theme={draft.theme}
                onChange={(infobox) => update({ infobox })}
                onOverridesChange={(infoboxOverrides) => update({ infoboxOverrides })}
                wikiId={wikiId}
              />
            )}
            <div className="simple-body">
              <RichEditor
                value={draft.body}
                onChange={(body) => update({ body })}
                wikiId={wikiId}
                titles={titles}
                simple
                onOpenLink={openLink}
              />
            </div>
            <div className="clear" />
          </div>

          <section className="simple-section">
            <h3>Pictures</h3>
            {draft.galleries.length === 0 && <p className="hint">Add a gallery to collect art, outfits or screenshots for this page.</p>}
            <GalleryEditor galleries={draft.galleries} onChange={(galleries) => update({ galleries })} wikiId={wikiId} />
          </section>

          <section className="simple-section">
            <h3>Categories</h3>
            <CategoryInput value={draft.categories} onChange={(categories) => update({ categories })} />
          </section>

          <div className="page-foot">
            Last edited {formatDate(stored?.updatedAt ?? draft.updatedAt)} · saved automatically
          </div>
      </>

      {colors && (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setColors(false)}>
          <div className="modal colors-modal">
            <h2>Colors for this page</h2>
            <p className="hint">Only this page changes. Leave a color empty to use the wiki’s.</p>
            <ThemeEditor value={draft.theme} base={meta.theme} onChange={(theme) => update({ theme })} isPage wikiId={wikiId} />
            <div className="row gap modal-actions">
              <span className="grow" />
              <button className="btn" onClick={() => setColors(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {css && (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setCss(false)}>
          <div className="modal colors-modal">
            <h2>Looks for this page</h2>
            <PageCssEditor value={draft.customCss ?? ''} onChange={(customCss) => update({ customCss })} />
            <div className="row gap modal-actions">
              <span className="grow" />
              <button className="btn" onClick={() => setCss(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}
