import { useState } from 'react'
import { newPage } from '@shared/defaults'
import type { Template } from '@shared/types'
import { findPage, useStore } from '../store'
import { cleanTitle } from '../lib/wikitext'
import { usePrefs } from '../lib/prefs'

/** `templateId`: a page type chosen in advance (the simple sidebar's “+”); '' means a plain page. */
export default function NewPage({ initialTitle, templateId }: { initialTitle: string; templateId?: string }): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const pages = useStore((s) => s.pages)
  const go = useStore((s) => s.go)
  const simple = usePrefs((s) => s.simple)
  const [title, setTitle] = useState(initialTitle)
  const clean = cleanTitle(title)
  const existing = clean ? findPage(pages, clean) : undefined

  const preset = templateId === undefined ? undefined : (meta.templates.find((t) => t.id === templateId) ?? null)

  const create = async (template: Template | null): Promise<void> => {
    if (!clean || existing) return
    const draft = newPage(clean, template)
    if (simple) {
      // The simple design has no separate editor: the page is made now and opens ready to type in.
      await useStore.getState().savePage(draft)
      go({ kind: 'edit', id: draft.id }, { replace: true })
    } else go({ kind: 'edit', id: draft.id, draft }, { replace: true })
  }

  return (
    <div className="new-page">
      <h1 className="page-title">
        {initialTitle ? `Create “${initialTitle}”` : preset ? `New ${preset.name} page` : 'Create a new page'}
      </h1>
      {initialTitle && <p className="muted">This page doesn’t exist yet. Pick a starting point to write it.</p>}
      <label className="field">
        <span>Page title</span>
        <input
          className="big-input"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void create(preset ?? null)}
          placeholder="e.g. Captain Marigold"
        />
      </label>
      {existing && (
        <div className="field-error">
          There’s already a page called{' '}
          <button className="link-btn" onClick={() => go({ kind: 'page', id: existing.id })}>
            {existing.title}
          </button>
          .
        </div>
      )}
      {preset !== undefined && (
        <button className="btn big-btn" disabled={!clean || !!existing} onClick={() => void create(preset)}>
          Create page
        </button>
      )}
      <h3>{preset !== undefined ? 'Or pick a different type' : simple ? 'What kind of page? (click one to create it)' : 'Start from'}</h3>
      <div className="template-cards">
        <button className={'template-card' + (preset === null ? ' preset' : '')} disabled={!clean || !!existing} onClick={() => void create(null)}>
          <span className="tc-head" style={{ background: 'var(--panel)', color: 'var(--text)' }}>
            Blank page
          </span>
          <span className="tc-body">No infobox — just text, pictures and galleries.</span>
        </button>
        {meta.templates.map((t) => (
          <button key={t.id} className={'template-card' + (preset?.id === t.id ? ' preset' : '')} disabled={!clean || !!existing} onClick={() => void create(t)}>
            <span className="tc-head" style={{ background: t.headerColor, color: t.headerText }}>
              {t.name}
            </span>
            <span className="tc-body">
              {t.fields.filter((f) => f.type !== 'header').length} infobox fields
              {t.sections.length > 0 && <> · sections: {t.sections.slice(0, 4).join(', ')}{t.sections.length > 4 ? '…' : ''}</>}
            </span>
          </button>
        ))}
      </div>
      {simple ? (
        <p className="hint">Page types (and their infobox fields) can be changed in Settings → Page types.</p>
      ) : (
        <p className="hint">
          Templates are fully editable under{' '}
          <button className="link-btn" onClick={() => go({ kind: 'special', name: 'templates' })}>
            Templates
          </button>
          .
        </p>
      )}
    </div>
  )
}
