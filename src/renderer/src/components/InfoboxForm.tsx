import { uid } from '@shared/defaults'
import type { FieldType, InfoboxOverrides, Template, TemplateField } from '@shared/types'
import { imgUrl } from '../lib/theme'
import { addField, pageFields, removeField, renameField, reorderFields, restoreHidden } from '../lib/fields'
import SortableRows from './SortableRows'
import { imageTabs, setImageTabs, type ImageTab } from '../lib/imageTabs'

interface Props {
  template: Template
  values: Record<string, string>
  overrides: InfoboxOverrides | undefined
  onChange: (values: Record<string, string>) => void
  onOverridesChange: (overrides: InfoboxOverrides | undefined) => void
  wikiId: string
  onEditTemplate: () => void
}

const NEW_LABEL: Record<FieldType, string> = { text: 'New field', header: 'New section', image: 'Picture' }

/**
 * The infobox in the page editor. Field names, order and which fields exist can be changed here for
 * this page only; the template (and every other page using it) stays as it is.
 */
export default function InfoboxForm({ template, values, overrides, onChange, onOverridesChange, wikiId, onEditTemplate }: Props): React.JSX.Element {
  const fields = pageFields(template, { infoboxOverrides: overrides })
  const set = (key: string, v: string): void => onChange({ ...values, [key]: v })
  const hiddenCount = overrides?.hidden?.length ?? 0

  const remove = (f: TemplateField): void => {
    const isExtra = overrides?.extra?.some((x) => x.id === f.id)
    const hasValue = !!values[f.id]?.trim()
    if (isExtra && hasValue && !window.confirm(`Remove “${f.label}” and what's written in it from this page?`)) return
    onOverridesChange(removeField(overrides, f.id))
    if (isExtra) {
      const next = { ...values }
      delete next[f.id]
      delete next[f.id + '.caption']
      onChange(next)
    }
  }
  const add = (type: FieldType): void => onOverridesChange(addField(overrides, { id: uid(), label: NEW_LABEL[type], type }))

  return (
    <div className="infobox-form" style={{ '--ib-head': template.headerColor, '--ib-head-text': template.headerText } as React.CSSProperties}>
      <div className="ib-title">{template.name} details</div>
      <SortableRows
        items={fields}
        onReorder={(list) => onOverridesChange(reorderFields(overrides, list))}
        render={(f, handle) => (
          <div className={'ibf-field type-' + f.type}>
            <div className="ibf-field-head">
              {handle}
              <input
                className="ibf-label-input"
                value={f.label}
                title="Rename this field on this page"
                onChange={(e) => onOverridesChange(renameField(template, overrides, f.id, e.target.value))}
              />
              <button className="icon-btn" title="Remove this field from this page" onClick={() => remove(f)}>
                ×
              </button>
            </div>
            {f.type === 'image' && <ImageField id={f.id} values={values} onValues={onChange} wikiId={wikiId} />}
            {f.type === 'text' && (
              <textarea
                rows={1}
                value={values[f.id] ?? ''}
                onChange={(e) => set(f.id, e.target.value)}
                onInput={(e) => autosize(e.currentTarget)}
                ref={(el) => {
                  if (el) autosize(el)
                }}
              />
            )}
          </div>
        )}
      />
      <div className="ibf-add">
        <span className="muted small">Add to this page:</span>
        <button className="link-btn" onClick={() => add('text')}>
          + Field
        </button>
        <button className="link-btn" onClick={() => add('header')}>
          + Section bar
        </button>
        <button className="link-btn" onClick={() => add('image')}>
          + Picture
        </button>
      </div>
      <div className="ibf-foot">
        Empty fields are hidden. Use <code>[[Page]]</code> to link. Renaming, moving, adding or removing fields here only changes
        this page.
        {hiddenCount > 0 && (
          <>
            {' '}
            <button className="link-btn" onClick={() => onOverridesChange(restoreHidden(overrides))}>
              Bring back {hiddenCount} removed field{hiddenCount === 1 ? '' : 's'}
            </button>
          </>
        )}
        {overrides && (
          <>
            {' '}
            <button
              className="link-btn"
              onClick={() => {
                if (window.confirm("Go back to the template's fields for this page? Fields you added here will be removed.")) {
                  onOverridesChange(undefined)
                }
              }}
            >
              Use the template’s fields again
            </button>
          </>
        )}{' '}
        <button className="link-btn" onClick={onEditTemplate}>
          Edit the template for all pages
        </button>
      </div>
    </div>
  )
}

/** One picture, or several shown as tabs (Card / Wish / In-Game…). */
function ImageField({
  id,
  values,
  onValues,
  wikiId
}: {
  id: string
  values: Record<string, string>
  onValues: (v: Record<string, string>) => void
  wikiId: string
}): React.JSX.Element {
  const tabs = imageTabs(values, id)
  const save = (next: ImageTab[]): void => onValues(setImageTabs(values, id, next))
  const edit = (i: number, patch: Partial<ImageTab>): void => save(tabs.map((t, n) => (n === i ? { ...t, ...patch } : t)))
  const add = async (): Promise<void> => {
    const files = await window.stash.pickImages(wikiId, true)
    if (files.length) save([...tabs, ...files.map((file) => ({ label: '', file, caption: '' }))])
  }
  const change = async (i: number): Promise<void> => {
    const [file] = await window.stash.pickImages(wikiId, false)
    if (file) edit(i, { file })
  }
  // Stable ids for dragging, even if the same picture is used twice.
  const seen = new Map<string, number>()
  const items = tabs.map((t) => {
    const n = (seen.get(t.file) ?? 0) + 1
    seen.set(t.file, n)
    return { ...t, id: `${t.file}#${n}` }
  })

  if (!tabs.length) {
    return (
      <div className="ibf-image">
        <div className="ibf-noimg">No image</div>
        <button className="btn small" onClick={() => void add()}>
          Choose image
        </button>
      </div>
    )
  }
  if (tabs.length === 1) {
    const t = tabs[0]
    return (
      <div className="ibf-image">
        <img src={imgUrl(t.file)} alt="" />
        <div className="row gap">
          <button className="btn small" onClick={() => void change(0)}>
            Change
          </button>
          <button className="link-btn danger" onClick={() => save([])}>
            Remove
          </button>
        </div>
        <input value={t.caption} placeholder="Caption (optional)" onChange={(e) => edit(0, { caption: e.target.value })} />
        <button className="link-btn small ibf-addtab" onClick={() => void add()} title="Show several pictures with tabs, like Card / Wish / In-Game">
          + Add another picture (shows tabs)
        </button>
      </div>
    )
  }
  return (
    <div className="ibf-image">
      <SortableRows
        items={items}
        onReorder={(list) => save(list.map(({ label, file, caption }) => ({ label, file, caption })))}
        render={(t, handle, i) => (
          <div className="ibf-tab">
            {handle}
            <img src={imgUrl(t.file)} alt="" onClick={() => void change(i)} title="Click to change this picture" />
            <div className="ibf-tab-fields">
              <input
                value={t.label}
                placeholder={`Tab name (e.g. ${['Card', 'Wish', 'In-Game', 'Casual'][i % 4]})`}
                onChange={(e) => edit(i, { label: e.target.value })}
              />
              <input value={t.caption} placeholder="Caption (optional)" onChange={(e) => edit(i, { caption: e.target.value })} />
            </div>
            <button className="icon-btn" title="Remove this picture" onClick={() => save(tabs.filter((_, n) => n !== i))}>
              ×
            </button>
          </div>
        )}
      />
      <button className="link-btn small ibf-addtab" onClick={() => void add()}>
        + Add another picture
      </button>
    </div>
  )
}

function autosize(el: HTMLTextAreaElement): void {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 2 + 'px'
}
