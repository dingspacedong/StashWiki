// Infobox picture fields can hold several pictures shown as tabs (e.g. "Card / Wish / In-Game").
// Stored inside the page's infobox values so older wikis keep working:
//   <id>          the first picture's file   (what thumbnails and older versions use)
//   <id>.caption  the first picture's caption
//   <id>.tabs     JSON list of every picture, only when there is more than one or a tab has a name

export interface ImageTab {
  label: string
  file: string
  caption: string
}

export const TABS_SUFFIX = '.tabs'

export function imageTabs(infobox: Record<string, string>, id: string): ImageTab[] {
  const raw = infobox[id + TABS_SUFFIX]
  if (raw) {
    try {
      const list = JSON.parse(raw)
      if (Array.isArray(list)) {
        const tabs = list
          .map((t) => ({ label: String(t?.label ?? ''), file: String(t?.file ?? ''), caption: String(t?.caption ?? '') }))
          .filter((t) => t.file)
        if (tabs.length) return tabs
      }
    } catch {
      // damaged list: fall back to the single picture below
    }
  }
  return infobox[id] ? [{ label: '', file: infobox[id], caption: infobox[id + '.caption'] ?? '' }] : []
}

export function setImageTabs(infobox: Record<string, string>, id: string, tabs: ImageTab[]): Record<string, string> {
  const list = tabs.filter((t) => t.file)
  const out = { ...infobox, [id]: list[0]?.file ?? '', [id + '.caption']: list[0]?.caption ?? '' }
  if (list.length > 1 || list.some((t) => t.label.trim())) out[id + TABS_SUFFIX] = JSON.stringify(list)
  else delete out[id + TABS_SUFFIX]
  return out
}

const STORED_PICTURE = /^[0-9a-f]{20}\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i

/** Infobox values as readable text: no picture file names, and tab lists become just their captions. */
export function infoboxText(infobox: Record<string, string>): string[] {
  return Object.entries(infobox).flatMap(([k, v]) => {
    if (k.endsWith(TABS_SUFFIX)) return imageTabs(infobox, k.slice(0, -TABS_SUFFIX.length)).map((t) => t.caption)
    if (k.endsWith('.caption') && infobox[k.slice(0, -'.caption'.length) + TABS_SUFFIX]) return []
    if (STORED_PICTURE.test(v)) return []
    return [v]
  })
}

/** The name shown on a tab. */
export function tabLabel(t: ImageTab, i: number): string {
  return t.label.trim() || `Image ${i + 1}`
}
