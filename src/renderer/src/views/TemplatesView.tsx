import { useEffect, useRef, useState } from 'react'
import { uid } from '@shared/defaults'
import type { FieldType, Page, Template, TemplateField } from '@shared/types'
import { useStore } from '../store'
import Infobox from '../components/Infobox'
import SortableRows from '../components/SortableRows'
import CategoryInput from '../components/CategoryInput'
import { ColorInput } from '../components/ui'

const TYPE_LABELS: Record<FieldType, string> = { text: 'Text', image: 'Picture', header: 'Section bar' }

export default function TemplatesView(): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const pages = useStore((s) => s.pages)
  const [templates, setTemplates] = useState<Template[]>(meta.templates)
  const [selected, setSelected] = useState<string | null>(meta.templates[0]?.id ?? null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const latest = useRef(templates)

  // Changes save on their own shortly after you stop typing.
  const commit = (next: Template[]): void => {
    setTemplates(next)
    latest.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const m = useStore.getState().meta!
      void useStore.getState().saveMeta({ ...m, templates: latest.current })
    }, 400)
  }
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current)
        const m = useStore.getState().meta
        if (m && m.templates !== latest.current) void useStore.getState().saveMeta({ ...m, templates: latest.current })
      }
    },
    []
  )

  const tpl = templates.find((t) => t.id === selected)
  const update = (patch: Partial<Template>): void => commit(templates.map((t) => (t.id === selected ? { ...t, ...patch } : t)))
  const usage = (id: string): number => Object.values(pages).filter((p) => p.templateId === id).length

  const addTemplate = (base?: Template): void => {
    const t: Template = base
      ? { ...structuredClone(base), id: uid(), name: base.name + ' copy' }
      : {
          id: uid(),
          name: 'New template',
          headerColor: '#5a6b8c',
          headerText: '#ffffff',
          fields: [{ id: uid(), label: 'Image', type: 'image' }, { id: uid(), label: 'Name', type: 'text' }],
          sections: ['Overview'],
          categories: []
        }
    commit([...templates, t])
    setSelected(t.id)
  }

  return (
    <div className="templates-view">
      <h1 className="page-title">Templates</h1>
      <p className="muted">
        Templates decide which infobox a page gets and which sections it starts with. Changes save automatically and show up on every page that uses the template.
      </p>
      <div className="templates-layout">
        <div className="template-list">
          {templates.map((t) => (
            <button key={t.id} className={'template-item' + (t.id === selected ? ' active' : '')} onClick={() => setSelected(t.id)}>
              <span className="dot" style={{ background: t.headerColor }} />
              {t.name}
              <span className="muted small">{usage(t.id)}</span>
            </button>
          ))}
          <button className="btn small ghost" onClick={() => addTemplate()}>
            + New template
          </button>
        </div>

        {tpl ? (
          <div className="template-edit">
            <div className="template-form">
              <div className="row gap wrap">
                <label className="field inline">
                  <span>Name</span>
                  <input value={tpl.name} onChange={(e) => update({ name: e.target.value })} />
                </label>
                <label className="field inline">
                  <span>Title bar</span>
                  <ColorInput value={tpl.headerColor} onChange={(headerColor) => update({ headerColor })} />
                </label>
                <label className="field inline">
                  <span>Title text</span>
                  <ColorInput value={tpl.headerText} onChange={(headerText) => update({ headerText })} />
                </label>
              </div>

              <h3>Infobox fields</h3>
              <FieldList fields={tpl.fields} onChange={(fields) => update({ fields })} />

              <h3>Sections a new page starts with</h3>
              <textarea
                className="sections-input"
                rows={Math.max(3, tpl.sections.length + 1)}
                value={tpl.sections.join('\n')}
                placeholder="One heading per line"
                onChange={(e) => update({ sections: e.target.value.split('\n') })}
                onBlur={() => update({ sections: tpl.sections.map((s) => s.trim()).filter(Boolean) })}
              />

              <h3>Categories a new page goes in</h3>
              <CategoryInput value={tpl.categories} onChange={(categories) => update({ categories })} />

              <div className="row gap template-actions">
                <button className="btn small ghost" onClick={() => addTemplate(tpl)}>
                  Duplicate
                </button>
                <span className="grow" />
                <button
                  className="link-btn danger"
                  onClick={() => {
                    const n = usage(tpl.id)
                    const msg = n
                      ? `${n} page(s) use “${tpl.name}”. They will keep their text but lose the infobox. Delete the template?`
                      : `Delete the template “${tpl.name}”?`
                    if (!window.confirm(msg)) return
                    const next = templates.filter((t) => t.id !== tpl.id)
                    commit(next)
                    setSelected(next[0]?.id ?? null)
                  }}
                >
                  Delete template
                </button>
              </div>
            </div>
            <div className="template-preview">
              <div className="muted small">Preview</div>
              <Infobox page={previewPage(tpl)} template={tpl} />
            </div>
          </div>
        ) : (
          <p className="muted">No templates. Make one to give pages an infobox.</p>
        )}
      </div>
    </div>
  )
}

function FieldList({ fields, onChange }: { fields: TemplateField[]; onChange: (f: TemplateField[]) => void }): React.JSX.Element {
  const set = (i: number, patch: Partial<TemplateField>): void => onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)))
  const add = (type: FieldType): void =>
    onChange([...fields, { id: uid(), label: type === 'header' ? 'New section' : type === 'image' ? 'Picture' : 'New field', type }])

  return (
    <div className="field-list">
      <SortableRows
        items={fields}
        onReorder={onChange}
        render={(f, handle, i) => (
          <div className={'field-item type-' + f.type}>
            {handle}
            <input value={f.label} onChange={(e) => set(i, { label: e.target.value })} />
            <select value={f.type} onChange={(e) => set(i, { type: e.target.value as FieldType })}>
              {(Object.keys(TYPE_LABELS) as FieldType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <button
              className="icon-btn"
              title="Remove field (pages keep what they had typed, it just stops showing)"
              onClick={() => onChange(fields.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        )}
      />
      <div className="row gap">
        <button className="btn small ghost" onClick={() => add('text')}>
          + Text field
        </button>
        <button className="btn small ghost" onClick={() => add('header')}>
          + Section bar
        </button>
        <button className="btn small ghost" onClick={() => add('image')}>
          + Picture
        </button>
      </div>
    </div>
  )
}

function previewPage(t: Template): Page {
  const infobox: Record<string, string> = {}
  for (const f of t.fields) if (f.type === 'text') infobox[f.id] = '…'
  return {
    id: 'preview', title: t.name || 'Template', categories: [], templateId: t.id, infobox, body: '',
    galleries: [], theme: {}, private: false, createdAt: 0, updatedAt: 0
  }
}
