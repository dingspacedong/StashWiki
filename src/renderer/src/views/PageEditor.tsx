import { useEffect, useMemo, useRef, useState } from 'react'
import type { Page } from '@shared/types'
import { findPage, useStore } from '../store'
import { cleanTitle, titleKey } from '../lib/wikitext'
import { useApplyPageTheme } from '../previewTheme'
import RichEditor from '../components/RichEditor'
import InfoboxForm from '../components/InfoboxForm'
import GalleryEditor from '../components/GalleryEditor'
import CategoryInput from '../components/CategoryInput'
import ThemeEditor from '../components/ThemeEditor'
import PageCssEditor from '../components/PageCssEditor'
import { TopMatterEditor } from '../components/TopMatter'
import { isModKey, kb } from '../lib/platform'

export default function PageEditor({ id, draft: initialDraft }: { id: string; draft?: Page }): React.JSX.Element {
  const stored = useStore((s) => s.pages[id])
  const meta = useStore((s) => s.meta)!
  const wikiId = useStore((s) => s.wikiId)!
  const pages = useStore((s) => s.pages)
  const go = useStore((s) => s.go)
  const isNew = !stored

  const [original] = useState<Page | undefined>(() => stored ?? initialDraft)
  const [draft, setDraft] = useState<Page | undefined>(original)
  const [saving, setSaving] = useState(false)
  const [showLook, setShowLook] = useState(() => Object.keys(original?.theme ?? {}).length > 0)
  const [showCss, setShowCss] = useState(() => !!original?.customCss?.trim())
  const initialJson = useRef(JSON.stringify(original))
  const saved = useRef(false)

  useApplyPageTheme(draft?.theme)

  const titles = useMemo(() => Object.values(pages).map((p) => p.title), [pages])
  const template = meta.templates.find((t) => t.id === draft?.templateId)

  const title = cleanTitle(draft?.title ?? '')
  const clash = title ? findPage(pages, title) : undefined
  const titleError = !title ? 'Give the page a title.' : clash && clash.id !== id ? `There is already a page called “${clash.title}”.` : ''

  // Track unsaved changes for the leave-page warning.
  useEffect(() => {
    if (saved.current) return
    useStore.getState().setDirty(isNew || JSON.stringify(draft) !== initialJson.current)
  }, [draft, isNew])
  useEffect(() => () => useStore.getState().setDirty(false), [])

  const saveRef = useRef<() => void>(() => {})
  saveRef.current = () => void save()
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isModKey(e) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        saveRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!draft) {
    return (
      <div className="notice-page">
        <h1 className="page-title">Page not found</h1>
        <p>This page no longer exists.</p>
      </div>
    )
  }

  const patch = (p: Partial<Page>): void => setDraft((d) => (d ? { ...d, ...p } : d))

  async function save(): Promise<void> {
    if (!draft || saving) return
    if (titleError) {
      window.alert(titleError)
      return
    }
    setSaving(true)
    try {
      const previous = original && !isNew && titleKey(original.title) !== titleKey(title) ? original.title : undefined
      saved.current = true
      await useStore.getState().savePage({ ...draft, title }, previous)
      useStore.getState().notify(isNew ? `Created “${title}”` : 'Saved')
      go({ kind: 'page', id: draft.id }, { replace: true, force: true })
    } catch (e) {
      saved.current = false
      window.alert('Could not save: ' + String((e as Error).message ?? e))
    } finally {
      setSaving(false)
    }
  }

  const cancel = (): void => {
    if (isNew) useStore.getState().back()
    else go({ kind: 'page', id }, { replace: true })
  }

  return (
    <div className="editor-page">
      <div className="editor-bar">
        <span className="editor-bar-title">{isNew ? 'Creating a new page' : `Editing “${original?.title}”`}</span>
        <span className="grow" />
        <button className="btn ghost" onClick={cancel}>
          Cancel
        </button>
        <button className="btn" onClick={() => void save()} disabled={saving || !!titleError} title={`Save (${kb('S')})`}>
          {saving ? 'Saving…' : isNew ? 'Create page' : 'Save'}
        </button>
      </div>

      <input
        className="title-input"
        value={draft.title}
        placeholder="Page title"
        onChange={(e) => patch({ title: e.target.value })}
        autoFocus={isNew && !draft.title}
      />
      {titleError && draft.title && <div className="field-error">{titleError}</div>}
      {!isNew && original && title && titleKey(original.title) !== titleKey(title) && !titleError && (
        <div className="hint">Renaming: links to “{original.title}” on other pages will be updated when you save.</div>
      )}

      <div className="editor-options">
        <label className="field inline">
          <span>Template</span>
          <select value={draft.templateId ?? ''} onChange={(e) => patch({ templateId: e.target.value || null })}>
            <option value="">None (no infobox)</option>
            {meta.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check" title="Private pages are left out when you export the wiki as a website (coming in a later version)">
          <input type="checkbox" checked={draft.private} onChange={(e) => patch({ private: e.target.checked })} />
          Private page <span className="muted">(never included in a website export)</span>
        </label>
      </div>

      <TopMatterEditor hatnotes={draft.hatnotes} quote={draft.quote} onChange={(p) => patch(p)} />

      <div className={'editor-main' + (template ? ' with-infobox' : '')}>
        <div className="editor-body">
          <RichEditor value={draft.body} onChange={(body) => patch({ body })} wikiId={wikiId} titles={titles} />
        </div>
        {template && (
          <InfoboxForm
            template={template}
            values={draft.infobox}
            onChange={(infobox) => patch({ infobox })}
            overrides={draft.infoboxOverrides}
            onOverridesChange={(infoboxOverrides) => patch({ infoboxOverrides })}
            wikiId={wikiId}
            onEditTemplate={() => go({ kind: 'special', name: 'templates' })}
          />
        )}
      </div>

      <section className="editor-section">
        <h3>Galleries</h3>
        <GalleryEditor galleries={draft.galleries} onChange={(galleries) => patch({ galleries })} wikiId={wikiId} />
      </section>

      <section className="editor-section">
        <h3>Categories</h3>
        <CategoryInput value={draft.categories} onChange={(categories) => patch({ categories })} />
      </section>

      <section className="editor-section">
        <h3>
          <button className="disclosure" onClick={() => setShowLook((s) => !s)}>
            {showLook ? '▾' : '▸'} This page’s colors &amp; fonts
          </button>
          {Object.keys(draft.theme).length > 0 && <span className="badge soft">customized</span>}
        </h3>
        {showLook && (
          <>
            <p className="hint">Anything you change here only affects this page. Leave a color empty to use the wiki’s.</p>
            <ThemeEditor value={draft.theme} base={meta.theme} onChange={(theme) => patch({ theme })} isPage wikiId={wikiId} />
          </>
        )}
      </section>

      <section className="editor-section">
        <h3>
          <button className="disclosure" onClick={() => setShowCss((s) => !s)}>
            {showCss ? '▾' : '▸'} This page’s looks &amp; custom CSS
          </button>
          {draft.customCss?.trim() && <span className="badge soft">in use</span>}
        </h3>
        {showCss && <PageCssEditor value={draft.customCss ?? ''} onChange={(customCss) => patch({ customCss })} />}
      </section>

      <div className="editor-bar bottom">
        <span className="grow" />
        <button className="btn ghost" onClick={cancel}>
          Cancel
        </button>
        <button className="btn" onClick={() => void save()} disabled={saving || !!titleError}>
          {isNew ? 'Create page' : 'Save'}
        </button>
      </div>
    </div>
  )
}
