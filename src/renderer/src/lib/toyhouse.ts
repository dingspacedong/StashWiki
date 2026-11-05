// Turning what was read from a Toyhouse character into the wiki's own galleries and credit lines.
import type { ToyhouseImage } from '@shared/types'

/** A picture's credit line: each artist linked to their page, as [name](address), with any note after it. */
export function creditLine(credits: ToyhouseImage['credits']): string {
  return credits
    .map((c) => {
      const who = c.url && c.url !== c.name && /^https?:\/\//.test(c.url) ? `[${c.name.replace(/[[\]]/g, '')}](${c.url})` : c.name
      return c.note ? `${who} ${c.note}` : who
    })
    .join(', ')
}

/** One gallery per Toyhouse gallery tab, in the order they come, each keeping its pictures' order. */
export function groupGalleries<T extends { group: string }>(images: T[]): { title: string; images: T[] }[] {
  const out: { title: string; images: T[] }[] = []
  for (const im of images) {
    const title = im.group || 'Gallery'
    const g = out.find((x) => x.title === title)
    if (g) g.images.push(im)
    else out.push({ title, images: [im] })
  }
  return out
}
