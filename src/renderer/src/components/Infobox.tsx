import { useState } from 'react'
import type { Page, Template, TemplateField } from '@shared/types'
import { imgUrl } from '../lib/theme'
import { pageFields } from '../lib/fields'
import { imageTabs, tabLabel, type ImageTab } from '../lib/imageTabs'
import { openLightbox } from './Lightbox'
import { RichInline } from './ui'

/** Header rows only show when at least one field under them has a value. */
export function visibleRows(fields: TemplateField[], values: Record<string, string>): TemplateField[] {
  const out: TemplateField[] = []
  let pendingHeader: TemplateField | null = null
  for (const f of fields) {
    if (f.type === 'header') {
      pendingHeader = f
      continue
    }
    if (!values[f.id]?.trim()) continue
    if (pendingHeader) {
      out.push(pendingHeader)
      pendingHeader = null
    }
    out.push(f)
  }
  return out
}

export default function Infobox({ page, template }: { page: Page; template: Template }): React.JSX.Element | null {
  const rows = visibleRows(pageFields(template, page), page.infobox)
  const style = {
    '--ib-head': page.theme.infoboxHeader || template.headerColor,
    '--ib-head-text': page.theme.infoboxHeaderText || template.headerText
  } as React.CSSProperties

  return (
    <aside className="infobox" style={style}>
      <div className="ib-title">{page.title}</div>
      {rows.map((f) => {
        const v = page.infobox[f.id]
        if (f.type === 'header') {
          return (
            <div key={f.id} className="ib-header">
              {f.label}
            </div>
          )
        }
        if (f.type === 'image') return <TabbedImage key={f.id} tabs={imageTabs(page.infobox, f.id)} alt={f.label} />
        return (
          <div key={f.id} className="ib-row">
            <div className="ib-label">{f.label}</div>
            <RichInline className="ib-value" text={v} />
          </div>
        )
      })}
      {!rows.length && <div className="ib-empty">No details yet</div>}
    </aside>
  )
}

/** One infobox picture, or several with tabs to switch between them (like Fandom's “Card / Wish / In-Game”). */
function TabbedImage({ tabs, alt }: { tabs: ImageTab[]; alt: string }): React.JSX.Element | null {
  const [active, setActive] = useState(0)
  const i = Math.min(active, tabs.length - 1)
  const tab = tabs[i]
  if (!tab) return null
  return (
    <figure className="ib-image">
      {tabs.length > 1 && (
        <div className="ib-tabs" role="tablist">
          {tabs.map((t, n) => (
            <button key={n} role="tab" aria-selected={n === i} className={n === i ? 'active' : ''} onClick={() => setActive(n)}>
              {tabLabel(t, n)}
            </button>
          ))}
        </div>
      )}
      <button
        className="ib-zoom"
        onClick={() => openLightbox(tabs.map((t) => ({ file: t.file, caption: t.caption, source: '' })), i)}
        title="View larger"
      >
        <img src={imgUrl(tab.file)} alt={tab.caption || alt} />
      </button>
      {tab.caption && (
        <figcaption>
          <RichInline text={tab.caption} />
        </figcaption>
      )}
    </figure>
  )
}

/** The picture used for this page in category cards: first infobox image, else first gallery image. */
export function pageThumb(page: Page, template: Template | undefined): string | null {
  for (const f of pageFields(template, page)) if (f.type === 'image' && page.infobox[f.id]) return page.infobox[f.id]
  for (const g of page.galleries) if (g.images[0]) return g.images[0].file
  return null
}
