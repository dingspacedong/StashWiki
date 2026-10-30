// Turns stored body HTML into what the read view shows: sanitized, red links marked,
// headings given ids, and a contents box when there are enough sections.
import DOMPurify from 'dompurify'
import { escapeHtml } from '@shared/defaults'
import { cleanTitle, headingId } from './wikitext'
import { decodeHtmlBlock, renderHtmlBlock } from './customHtml'

const PURIFY = {
  ADD_ATTR: ['target', 'data-wikilink', 'data-align'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|stash):|#)/i
}

/** Clean HTML from outside the editor (e.g. the writing buddy) before it goes into a page. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, PURIFY) as string
}

export interface TocEntry {
  id: string
  text: string
  level: number
}

/** `cards` draws a page-cards block from its stored JSON (the app and the website each supply their own). */
export function renderBody(
  html: string,
  exists: (title: string) => boolean,
  cards?: (json: string) => string
): { html: string; toc: TocEntry[] } {
  const clean = DOMPurify.sanitize(html, PURIFY) as string
  const doc = new DOMParser().parseFromString(`<div id="root">${clean}</div>`, 'text/html')
  const root = doc.getElementById('root')!

  // HTML blocks are set aside and put back at the end, so nothing below rewrites what their author wrote.
  const blocks: string[] = []
  for (const el of root.querySelectorAll('div[data-html]')) {
    const slot = doc.createElement('div')
    slot.setAttribute('data-html-slot', String(blocks.length))
    blocks.push(decodeHtmlBlock(el.getAttribute('data-html') ?? ''))
    el.replaceWith(slot)
  }

  for (const el of root.querySelectorAll('div[data-cards]')) {
    if (cards) el.outerHTML = cards(el.getAttribute('data-cards') ?? '')
    else el.remove()
  }

  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[data-wikilink]')) {
    const target = cleanTitle(a.getAttribute('data-wikilink') ?? '')
    a.classList.add('wikilink')
    a.classList.toggle('new', !exists(target))
    a.title = exists(target) ? target : `${target} (page does not exist)`
    a.removeAttribute('href')
  }
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    a.classList.add('external')
    a.target = '_blank'
    a.rel = 'noreferrer'
  }

  const used = new Set<string>()
  const toc: TocEntry[] = []
  for (const h of root.querySelectorAll('h2, h3, h4')) {
    const text = h.textContent?.trim() ?? ''
    if (!text) continue
    h.id = headingId(text, used)
    toc.push({ id: h.id, text, level: Number(h.tagName[1]) })
  }

  // Empty paragraphs left under template headings shouldn't take up space when reading.
  for (const p of root.querySelectorAll('p')) {
    if (!p.textContent?.trim() && !p.querySelector('img')) p.remove()
  }

  if (toc.length >= 3) {
    const first = root.querySelector('h2, h3, h4')
    const box = doc.createElement('div')
    box.innerHTML = tocHtml(toc)
    first?.parentNode?.insertBefore(box.firstChild!, first)
  }
  for (const slot of root.querySelectorAll('div[data-html-slot]')) {
    slot.outerHTML = `<div class="html-block">${renderHtmlBlock(blocks[Number(slot.getAttribute('data-html-slot'))] ?? '', exists)}</div>`
  }
  return { html: root.innerHTML, toc }
}

function tocHtml(toc: TocEntry[]): string {
  const min = Math.min(...toc.map((t) => t.level))
  const counters = [0, 0, 0]
  const items = toc
    .map((t) => {
      const depth = t.level - min
      counters[depth]++
      for (let i = depth + 1; i < counters.length; i++) counters[i] = 0
      const num = counters.slice(0, depth + 1).join('.')
      return `<li class="toc-l${depth}"><a data-toc="${t.id}"><span class="toc-num">${num}</span> ${escapeHtml(t.text)}</a></li>`
    })
    .join('')
  return `<details class="toc" open><summary>Contents</summary><ul>${items}</ul></details>`
}
