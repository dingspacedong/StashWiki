// A page's infobox fields: its template's fields with that page's own renames, removals, additions and order.
import type { InfoboxOverrides, Page, Template, TemplateField } from '@shared/types'

/** The fields this page's infobox actually shows, in order, with this page's labels. */
export function pageFields(template: Template | undefined, page: Pick<Page, 'infoboxOverrides'>): TemplateField[] {
  if (!template) return []
  const o = page.infoboxOverrides ?? {}
  const hidden = new Set(o.hidden ?? [])
  const base = [...template.fields.filter((f) => !hidden.has(f.id)), ...(o.extra ?? [])]

  let list = base
  if (o.order?.length) {
    const byId = new Map(base.map((f) => [f.id, f]))
    list = o.order.filter((id) => byId.has(id)).map((id) => byId.get(id)!)
    // Fields added to the template after the page was reordered go in after their neighbor.
    const placed = new Set(list.map((f) => f.id))
    base.forEach((f, i) => {
      if (placed.has(f.id)) return
      let at = 0
      for (let j = i - 1; j >= 0; j--) {
        const k = list.findIndex((x) => x.id === base[j].id)
        if (k >= 0) {
          at = k + 1
          break
        }
      }
      list.splice(at, 0, f)
      placed.add(f.id)
    })
  }
  return list.map((f) => (o.labels?.[f.id] ? { ...f, label: o.labels[f.id] } : f))
}

export function isCustomized(page: Pick<Page, 'infoboxOverrides'>): boolean {
  return !!page.infoboxOverrides
}

/** Drop empty parts so an untouched page stores nothing. */
function tidy(o: InfoboxOverrides): InfoboxOverrides | undefined {
  const out: InfoboxOverrides = {}
  if (o.labels && Object.keys(o.labels).length) out.labels = o.labels
  if (o.hidden?.length) out.hidden = o.hidden
  if (o.extra?.length) out.extra = o.extra
  if (o.order?.length) out.order = o.order
  return Object.keys(out).length ? out : undefined
}

export function renameField(template: Template, o: InfoboxOverrides = {}, id: string, label: string): InfoboxOverrides | undefined {
  if (o.extra?.some((f) => f.id === id)) {
    return tidy({ ...o, extra: o.extra.map((f) => (f.id === id ? { ...f, label } : f)) })
  }
  const labels = { ...o.labels }
  const original = template.fields.find((f) => f.id === id)?.label
  if (label === original) delete labels[id]
  else labels[id] = label
  return tidy({ ...o, labels })
}

export function removeField(o: InfoboxOverrides = {}, id: string): InfoboxOverrides | undefined {
  const order = o.order?.filter((x) => x !== id)
  if (o.extra?.some((f) => f.id === id)) {
    const labels = { ...o.labels }
    delete labels[id]
    return tidy({ ...o, extra: o.extra.filter((f) => f.id !== id), labels, order })
  }
  return tidy({ ...o, hidden: [...new Set([...(o.hidden ?? []), id])], order })
}

export function addField(o: InfoboxOverrides = {}, field: TemplateField): InfoboxOverrides | undefined {
  return tidy({ ...o, extra: [...(o.extra ?? []), field], order: o.order ? [...o.order, field.id] : undefined })
}

export function reorderFields(o: InfoboxOverrides = {}, ordered: TemplateField[]): InfoboxOverrides | undefined {
  return tidy({ ...o, order: ordered.map((f) => f.id) })
}

export function restoreHidden(o: InfoboxOverrides = {}): InfoboxOverrides | undefined {
  return tidy({ ...o, hidden: [] })
}
