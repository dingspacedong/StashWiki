// Just for fun: a wiki can switch between several logos and/or color themes, like websites that show a
// different logo on every visit. Which one shows is picked here (never the same one twice in a row) and is
// only for display: nothing is saved, and the wiki's own settings stay as they are.
import { useLayoutEffect } from 'react'
import { create } from 'zustand'
import type { WikiMeta } from '@shared/types'
import { ALL_LOOKS, addLook, removeLook } from './looks'
import type { Route } from '../store'

/** Stands for the wiki's own colors in the list of themes to switch between. */
export const MINE = 'mine'
export const COLOR_THEMES = ALL_LOOKS.filter((l) => l.group.id === 'color-theme')

export const allLogos = (meta: WikiMeta): string[] => [meta.logo, ...(meta.extraLogos ?? [])].filter(Boolean)

/** The logos being switched between (none unless it's on and there are two or more). */
export function mixLogos(meta: WikiMeta): string[] {
  const logos = meta.mix?.logos ? allLogos(meta) : []
  return logos.length > 1 ? logos : []
}

/** The color themes being switched between (none unless two or more are picked). */
export function mixThemes(meta: WikiMeta): string[] {
  const ids = (meta.mix?.themes ?? []).filter((id) => id === MINE || COLOR_THEMES.some((t) => t.look.id === id))
  return ids.length > 1 ? ids : []
}

export const mixOn = (meta: WikiMeta): boolean => mixLogos(meta).length > 0 || mixThemes(meta).length > 0

/** A random index below n, but not `not` (so it always changes). */
function pick(n: number, not: number): number {
  if (n < 2) return 0
  if (not < 0 || not >= n) return Math.floor(Math.random() * n)
  return (not + 1 + Math.floor(Math.random() * (n - 1))) % n
}

interface Mix {
  logo: number
  theme: number
  at: number
  shuffle(meta: WikiMeta): void
}

export const useMix = create<Mix>((set, get) => ({
  logo: 0,
  theme: 0,
  at: 0,
  shuffle(meta) {
    const s = get()
    set({ logo: pick(mixLogos(meta).length, s.logo), theme: pick(mixThemes(meta).length, s.theme), at: Date.now() })
  }
}))

/** The logo to show right now. */
export function shownLogo(meta: WikiMeta, i: number): string {
  const logos = mixLogos(meta)
  return logos.length ? logos[i % logos.length] : meta.logo
}

/** The wiki's custom CSS with the color theme to show right now swapped in. */
export function withMixedTheme(meta: WikiMeta, css: string, i: number): string {
  const themes = mixThemes(meta)
  if (!themes.length) return css
  const id = themes[i % themes.length]
  const base = removeLook(css, 'color-theme')
  const t = COLOR_THEMES.find((x) => x.look.id === id)
  return t ? addLook(base, t.group, t.look) : base
}

/** Switches when the wiki opens, and on every page if asked. */
export function useMixUp(meta: WikiMeta, wikiId: string | null, route: Route): void {
  const on = mixOn(meta)
  const when = meta.mix?.when ?? 'open'
  const reading = route.kind !== 'edit' && route.kind !== 'new' && !(route.kind === 'special' && (route.name === 'settings' || route.name === 'css'))
  const key = reading ? JSON.stringify(route) : ''
  // Before the first paint, so the wiki never flashes the first logo.
  useLayoutEffect(() => {
    if (on) useMix.getState().shuffle(meta)
  }, [wikiId, on])
  useLayoutEffect(() => {
    if (on && when === 'page' && key) useMix.getState().shuffle(meta)
  }, [key])
}

/** Called after a page is saved. Autosaving editors save often, so it switches at most every few seconds. */
export function mixAfterSave(meta: WikiMeta): void {
  if (!mixOn(meta) || meta.mix?.when !== 'save') return
  const s = useMix.getState()
  if (Date.now() - s.at > 4000) s.shuffle(meta)
}

/** Puts `prefix` in front of every selector of plain CSS (rules only, as the color themes are). */
export function scopeCss(css: string, prefix: string): string {
  return css.replace(
    /(^|})\s*([^{}]+)\{/g,
    (_m, close: string, sels: string) =>
      `${close}\n${sels
        .split(',')
        .map((s) => `${prefix} ${s.trim()}`)
        .join(', ')} {`
  )
}

/** For an exported website: each picked theme, used when the page's <html> has data-mix="<id>". */
export function mixSiteCss(meta: WikiMeta): string {
  return mixThemes(meta)
    .map((id) => COLOR_THEMES.find((t) => t.look.id === id))
    .filter((t) => !!t)
    .map((t) => scopeCss(t.look.css, `html[data-mix="${t.look.id}"]`).trim())
    .join('\n\n')
}

/** For an exported website: picks a theme before the page shows (inline, in <head>). */
export function mixSiteScript(meta: WikiMeta): string {
  const themes = JSON.stringify(mixThemes(meta)).replace(/</g, '\\u003c')
  return `<script>(function(){var t=${themes},k='sw-mix',p=-1;try{var s=sessionStorage.getItem(k);if(s!==null)p=+s}catch(e){}var i=Math.floor(Math.random()*t.length);if(i===p)i=(i+1)%t.length;try{sessionStorage.setItem(k,i)}catch(e){}document.documentElement.setAttribute('data-mix',t[i])})()</script>`
}
