import { FONTS } from '@shared/defaults'
import type { PageTheme, Theme } from '@shared/types'

export function imgUrl(file: string): string {
  return `stash://wiki/images/${encodeURIComponent(file)}`
}

/** CSS custom properties for a wiki theme with an optional per-page override on top. */
export function themeVars(base: Theme, override: PageTheme = {}): Record<string, string> {
  const t: Theme = { ...base }
  for (const [k, v] of Object.entries(override)) if (v) (t as unknown as Record<string, string>)[k] = v
  return {
    '--bg': t.background,
    '--surface': t.surface,
    '--panel': t.panel,
    '--text': t.text,
    '--muted': t.muted,
    '--link': t.link,
    '--redlink': t.redlink,
    '--accent': t.accent,
    '--accent-text': t.accentText,
    '--border': t.border,
    '--font-body': FONTS[t.bodyFont]?.stack ?? FONTS.system.stack,
    '--font-heading': FONTS[t.headingFont]?.stack ?? FONTS.classic.stack,
    '--bg-image': t.backgroundImage ? `url("${imgUrl(t.backgroundImage)}")` : 'none',
    '--bg-size': t.backgroundMode === 'tile' ? 'auto' : 'cover',
    '--bg-repeat': t.backgroundMode === 'tile' ? 'repeat' : 'no-repeat',
    '--bg-position': t.backgroundMode === 'tile' ? 'top left' : 'center',
    '--sidebar-bg': sidebarBackground(t),
    '--zoom': String(Math.min(200, Math.max(50, Number(t.textSize) || 100)) / 100)
  }
}

/** The sidebar's background: none, a see-through color, or that color fading out at its right edge. */
export function sidebarBackground(t: Pick<Theme, 'sidebarColor' | 'sidebarOpacity' | 'sidebarEdge'>): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(t.sidebarColor ?? '')
  if (!m) return 'transparent'
  const alpha = Math.min(100, Math.max(0, Number(t.sidebarOpacity ?? 85) || 0)) / 100
  const rgba = `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`
  return t.sidebarEdge === 'soft' ? `linear-gradient(to right, ${rgba} 0%, ${rgba} 70%, transparent 100%)` : rgba
}

export const COLOR_FIELDS: { key: keyof Theme; label: string; hint: string }[] = [
  { key: 'background', label: 'Backdrop', hint: 'Behind the page' },
  { key: 'surface', label: 'Page', hint: 'Article background' },
  { key: 'panel', label: 'Boxes', hint: 'Infobox, contents, tables' },
  { key: 'text', label: 'Text', hint: '' },
  { key: 'muted', label: 'Soft text', hint: 'Captions, notes' },
  { key: 'link', label: 'Links', hint: '' },
  { key: 'redlink', label: 'Missing links', hint: 'Pages not written yet' },
  { key: 'accent', label: 'Accent', hint: 'Top bar, buttons' },
  { key: 'accentText', label: 'Accent text', hint: 'Text on the accent' },
  { key: 'border', label: 'Borders', hint: '' }
]
