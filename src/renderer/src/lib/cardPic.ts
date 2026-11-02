// How pictures sit in the cards on category pages (and page cards): one shape for every card, the picture cropped
// to fill it or shown whole on a fill, and for each page which part of its picture shows and how close.
import type { CardStyle, Page } from '@shared/types'

export const CARD_SHAPES: { id: NonNullable<CardStyle['shape']>; label: string; ratio: string }[] = [
  { id: 'square', label: 'Square', ratio: '1' },
  { id: 'portrait', label: 'Portrait', ratio: '3 / 4' },
  { id: 'tall', label: 'Tall', ratio: '2 / 3' },
  { id: 'wide', label: 'Wide', ratio: '4 / 3' }
]

/** Classes and style for a grid of category cards. */
export function cardGridLook(style: CardStyle | undefined): { className: string; style: Record<string, string> } {
  const s = style ?? {}
  const fill = s.fill ?? 'theme'
  const custom = /^#[0-9a-f]{6}$/i.test(fill)
  return {
    className:
      'card-grid' +
      ` shape-${s.shape ?? 'square'}` +
      (s.fit === 'whole' ? ` fit-whole fill-${fill === 'blur' ? 'blur' : custom ? 'color' : 'theme'}` : ''),
    style: custom ? { '--card-fill': fill } : {}
  }
}

/** Which part of the page's picture shows, and how close (only for its own picture, not one a card picked). */
export function cardPicStyle(page: Page | undefined): Record<string, string> {
  const c = page?.card
  if (!c || (c.x === undefined && c.y === undefined && !c.zoom)) return {}
  const pos = `${c.x ?? 50}% ${c.y ?? 50}%`
  const out: Record<string, string> = { 'object-position': pos }
  if (c.zoom && c.zoom !== 1) {
    out.transform = `scale(${c.zoom})`
    out['transform-origin'] = pos
  }
  return out
}

export const styleAttr = (s: Record<string, string>): string =>
  Object.entries(s)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ')

/** The same as a React style object. */
export const reactStyle = (s: Record<string, string>): React.CSSProperties =>
  Object.fromEntries(Object.entries(s).map(([k, v]) => [k.startsWith('--') ? k : k.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase()), v]))
