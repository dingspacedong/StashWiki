import { useRef, useState } from 'react'
import { uid } from '@shared/defaults'
import type { InfoboxOverrides, PageTheme, Template, TemplateField } from '@shared/types'
import { useStore } from '../store'
import { imgUrl } from '../lib/theme'
import { addField, pageFields, removeField, renameField, reorderFields, restoreHidden } from '../lib/fields'
import { RichInline } from '../components/ui'
import SortableRows from '../components/SortableRows'
import { imageTabs, setImageTabs, tabLabel, type ImageTab } from '../lib/imageTabs'

interface Props {
  title: string
  template: Template
  values: Record<string, string>
  overrides: InfoboxOverrides | undefined
  theme: PageTheme
  onChange: (values: Record<string, string>) => void
  onOverridesChange: (overrides: InfoboxOverrides | undefined) => void
  wikiId: string
}

/**
 * The infobox, editable where it sits: click a value to type, click a field's name to rename it (on this
 * page only), drag the grip to move it, × to take it off this page.
 */
export default function InfoboxInline({ title, template, values, overrides, theme, onChange, onOverridesChange, wikiId }: Props): React.JSX.Element {
  const fields = pageFields(template, { infoboxOverrides: overrides })
  const set = (key: string, v: string): void => onChange({ ...values, [key]: v })
  const hiddenCount = overrides?.hidden?.length ?? 0
  const style = {
    '--ib-head': theme.infoboxHeader || template.headerColor,
    '--ib-head-text': theme.infoboxHeaderText || template.headerText
  } as React.CSSProperties

  const remove = (f: TemplateField): void => {
    const isExtra = overrides?.extra?.some((x) => x.id === f.id)
    if (isExtra && values[f.id]?.trim() && !window.confirm(`Remove “${f.label}” and what's written in it from this page?`)) return
    onOverridesChange(removeField(overrides, f.id))
    if (isExtra) {
      const next = { ...values }
      delete next[f.id]
      delete next[f.id + '.caption']
      onChange(next)
    }
  }
  const tools = (f: TemplateField, handle: React.ReactNode): React.ReactNode => (
    <>
      <span className="ibi-grip">{handle}</span>
      <button className="ibi-x" title="Take this field off this page" onClick={() => remove(f)}>
        ×
      </button>
    </>
  )
  // A one-line text box that wraps like a normal label, so long names aren't cut off.
  const label = (f: TemplateField, className: string): React.ReactNode => (
    <textarea
      className={'ibi-label-input ' + className}
      rows={1}
      value={f.label}
      data-label={f.label}
      title="Click to rename this field on this page"
      ref={(el) => {
        if (el) autosize(el, 0)
      }}
      onInput={(e) => autosize(e.currentTarget, 0)}
      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
      onChange={(e) => onOverridesChange(renameField(template, overrides, f.id, e.target.value.replace(/\n/g, ' ')))}
    />
  )

  return (
    <aside className="infobox infobox-inline" style={style}>
      <div className="ib-title">{title || 'Untitled'}</div>
      <SortableRows
        items={fields}
        onReorder={(list) => onOverridesChange(reorderFields(overrides, list))}
        render={(f, handle) => {
          if (f.type === 'header') {
            return (
              <div className="ib-header ibi-field">
                {tools(f, handle)}
                {label(f, 'center')}
              </div>
            )
          }
          if (f.type === 'image') {
            return (
              <figure className="ib-image ibi-field">
                {tools(f, handle)}
                <InlineTabs label={f.label} tabs={imageTabs(values, f.id)} onTabs={(tabs) => onChange(setImageTabs(values, f.id, tabs))} wikiId={wikiId} />
              </figure>
            )
          }
          return (
            <div className="ib-row ibi-field">
              {tools(f, handle)}
              {label(f, 'ib-label')}
              <InlineValue value={values[f.id] ?? ''} onChange={(v) => set(f.id, v)} />
            </div>
          )
        }}
      />
      <AddField template={template} onAddHere={(field) => onOverridesChange(addField(overrides, field))} />
      {(hiddenCount > 0 || overrides) && (
        <div className="ibi-foot">
          {hiddenCount > 0 && (
            <button className="link-btn" onClick={() => onOverridesChange(restoreHidden(overrides))}>
              Bring back {hiddenCount} removed field{hiddenCount === 1 ? '' : 's'}
            </button>
          )}
          {overrides && (
            <button
              className="link-btn"
              onClick={() => {
                if (window.confirm(`Go back to the ${template.name} fields for this page? Fields you added only here will be removed.`)) {
                  onOverridesChange(undefined)
                }
              }}
            >
              Use the {template.name} fields again
            </button>
          )}
        </div>
      )}
    </aside>
  )
}

/**
 * A picture field: one picture, or several with tabs (Card / Wish / In-Game…). Click the picture to swap
 * it, × to remove it, and name the tab right under it.
 */
function InlineTabs({
  label,
  tabs,
  onTabs,
  wikiId
}: {
  label: string
  tabs: ImageTab[]
  onTabs: (tabs: ImageTab[]) => void
  wikiId: string
}): React.JSX.Element {
  const [active, setActive] = useState(0)
  const i = Math.min(active, Math.max(0, tabs.length - 1))
  const tab = tabs[i]
  const edit = (patch: Partial<ImageTab>): void => onTabs(tabs.map((t, n) => (n === i ? { ...t, ...patch } : t)))
  const add = async (): Promise<void> => {
    const files = await window.stash.pickImages(wikiId, true)
    if (!files.length) return
    onTabs([...tabs, ...files.map((file) => ({ label: '', file, caption: '' }))])
    setActive(tabs.length)
  }
  const change = async (): Promise<void> => {
    const [file] = await window.stash.pickImages(wikiId, false)
    if (file) edit({ file })
  }
  const move = (d: number): void => {
    const j = i + d
    if (j < 0 || j >= tabs.length) return
    const next = [...tabs]
    ;[next[i], next[j]] = [next[j], next[i]]
    onTabs(next)
    setActive(j)
  }

  if (!tab) {
    return (
      <button className="ibi-addpic" onClick={() => void add()}>
        + Add {label.toLowerCase() === 'image' ? 'a picture' : label.toLowerCase()}
      </button>
    )
  }
  return (
    <>
      {tabs.length > 1 && (
        <div className="ib-tabs" role="tablist">
          {tabs.map((t, n) => (
            <button key={n} role="tab" aria-selected={n === i} className={n === i ? 'active' : ''} onClick={() => setActive(n)}>
              {tabLabel(t, n)}
            </button>
          ))}
        </div>
      )}
      <div className="ibi-pic">
        <img src={imgUrl(tab.file)} alt="" onClick={() => void change()} title="Click to change the picture" />
        <button
          className="ibi-remove"
          title="Remove this picture"
          onClick={() => {
            onTabs(tabs.filter((_, n) => n !== i))
            setActive(Math.max(0, i - 1))
          }}
        >
          ×
        </button>
      </div>
      {tabs.length > 1 && (
        <div className="ibi-tabname">
          <button className="icon-btn" title="Move this tab left" disabled={i === 0} onClick={() => move(-1)}>
            ‹
          </button>
          <input value={tab.label} placeholder={`Tab name (e.g. ${['Card', 'Wish', 'In-Game', 'Casual'][i % 4]})`} onChange={(e) => edit({ label: e.target.value })} />
          <button className="icon-btn" title="Move this tab right" disabled={i === tabs.length - 1} onClick={() => move(1)}>
            ›
          </button>
        </div>
      )}
      <input className="ibi-caption" value={tab.caption} placeholder="Add a caption" onChange={(e) => edit({ caption: e.target.value })} />
      <button className="link-btn small ibi-addtab" onClick={() => void add()} title="Several pictures show as tabs, like Card / Wish / In-Game">
        + Add another picture{tabs.length === 1 ? ' (shows tabs)' : ''}
      </button>
    </>
  )
}

/** Shows the value with working links; turns into a text box when clicked. */
function InlineValue({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <textarea
        className="ibi-input"
        autoFocus
        rows={1}
        value={value}
        placeholder="Type here — [[Page]] links a page"
        ref={(el) => {
          if (el) autosize(el)
        }}
        onInput={(e) => autosize(e.currentTarget)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
            e.preventDefault()
            setEditing(false)
          }
        }}
      />
    )
  }
  return (
    <div
      className={'ibi-value' + (value.trim() ? '' : ' empty')}
      tabIndex={0}
      onFocus={() => setEditing(true)}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('a')) setEditing(true)
      }}
    >
      {value.trim() ? <RichInline className="ib-value" text={value} /> : 'Add…'}
    </div>
  )
}

/** Add a field to this page only, or to every page of this type (the template). */
function AddField({ template, onAddHere }: { template: Template; onAddHere: (f: TemplateField) => void }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const box = useRef<HTMLDivElement>(null)

  const close = (): void => {
    setLabel('')
    setOpen(false)
  }
  const addHere = (): void => {
    if (label.trim()) onAddHere({ id: uid(), label: label.trim(), type: 'text' })
    close()
  }
  const addEverywhere = async (): Promise<void> => {
    const name = label.trim()
    if (name) {
      const meta = useStore.getState().meta!
      const templates = meta.templates.map((t) => (t.id === template.id ? { ...t, fields: [...t.fields, { id: uid(), label: name, type: 'text' as const }] } : t))
      await useStore.getState().saveMeta({ ...meta, templates })
      useStore.getState().notify(`Added “${name}” to every ${template.name} page`)
    }
    close()
  }

  if (!open) {
    return (
      <button className="ibi-addfield" onClick={() => setOpen(true)}>
        + Add a field
      </button>
    )
  }
  return (
    <div
      className="ibi-addfield-form"
      ref={box}
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node) && !label.trim()) close()
      }}
    >
      <input
        autoFocus
        value={label}
        placeholder="Field name, e.g. Birthday"
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') addHere()
          if (e.key === 'Escape') close()
        }}
      />
      <div className="row gap wrap ibi-add-buttons">
        <button className="btn small" disabled={!label.trim()} onClick={addHere}>
          Add to this page
        </button>
        <button className="btn small ghost" disabled={!label.trim()} onClick={() => void addEverywhere()}>
          Add to every {template.name} page
        </button>
      </div>
    </div>
  )
}

function autosize(el: HTMLTextAreaElement, extra = 2): void {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + extra + 'px'
}
