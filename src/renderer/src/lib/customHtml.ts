// Custom HTML blocks and custom CSS: the "more control" escape hatch for things the editor can't do.
// HTML blocks are stored in the page as <div data-html="…URL-encoded HTML…"></div> so the editor keeps them
// exactly as written. Scripts, forms and embedded frames are always removed: a wiki (and the share files and
// websites made from it) can carry styling and layout, never code.
import DOMPurify from 'dompurify'
import { escapeHtml } from '@shared/defaults'
import { cleanTitle } from './wikitext'

const CUSTOM = {
  ADD_TAGS: ['style'],
  ADD_ATTR: ['target', 'data-wikilink'],
  FORBID_TAGS: ['script', 'form', 'iframe', 'frame', 'object', 'embed', 'base', 'meta', 'link', 'button'],
  FORCE_BODY: true,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|stash):|#|data:image\/)/i
}

export function sanitizeCustomHtml(html: string): string {
  // DOMPurify drops an input's type; radio buttons and checkboxes (for CSS-only tabs and toggles) are kept
  // by carrying the type through as a data attribute. Any other input stays a plain, harmless text box.
  const marked = html.replace(/<input\b[^>]*>/gi, (tag) => tag.replace(/\btype\s*=\s*["']?(radio|checkbox)["']?/i, 'data-sw-type="$1"'))
  const clean = DOMPurify.sanitize(marked, CUSTOM) as string
  return clean.replace(/<input\b[^>]*>/gi, (tag) => tag.replace(/\bdata-sw-type="(radio|checkbox)"/i, 'type="$1"'))
}

export const encodeHtmlBlock = (html: string): string => encodeURIComponent(html)
export function decodeHtmlBlock(stored: string): string {
  try {
    return decodeURIComponent(stored)
  } catch {
    return ''
  }
}
/** An HTML block as it is stored in a page body. */
export const htmlBlockTag = (html: string): string => `<div data-html="${escapeHtml(encodeHtmlBlock(html))}"></div>`

const LINK = /\[\[([^[\]|]+)(?:\|([^[\]]*))?\]\]/g

/**
 * An HTML block ready to show: cleaned, with [[Page]] links turned into wiki links (red when missing) and
 * web links opening outside.
 */
export function renderHtmlBlock(raw: string, exists: (title: string) => boolean): string {
  const doc = new DOMParser().parseFromString(`<div id="b">${sanitizeCustomHtml(raw)}</div>`, 'text/html')
  const root = doc.getElementById('b')!
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const texts: Text[] = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const parent = (n as Text).parentElement
    if (parent && !parent.closest('style, a') && LINK.test((n as Text).data)) texts.push(n as Text)
    LINK.lastIndex = 0
  }
  for (const t of texts) {
    const span = doc.createElement('span')
    span.innerHTML = escapeHtml(t.data).replace(LINK, (_m, target: string, label?: string) => {
      const title = cleanTitle(target)
      return `<a class="wikilink${exists(title) ? '' : ' new'}" data-wikilink="${escapeHtml(title)}">${(label ?? '').trim() || target.trim()}</a>`
    })
    t.replaceWith(...span.childNodes)
  }
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[data-wikilink]')) {
    a.classList.add('wikilink')
    a.classList.toggle('new', !exists(cleanTitle(a.getAttribute('data-wikilink') ?? '')))
    a.removeAttribute('href')
  }
  for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    a.target = '_blank'
    a.rel = 'noreferrer'
  }
  return root.innerHTML
}

/** Class names that work in custom CSS, in the app and in an exported website alike. */
export const CSS_HINTS: [string, string][] = [
  ['body', 'the whole window (backgrounds, fonts)'],
  ['.topbar', 'the bar across the top'],
  ['.sidebar', 'the menu on the left'],
  ['.content-card', 'the white card the page sits on'],
  ['.page-title', 'the page’s name'],
  ['.prose', 'the page’s writing (.prose h2, .prose p, .prose a …)'],
  ['.infobox', 'the infobox (.ib-title, .ib-header, .ib-label, .ib-value)'],
  ['.toc', 'the contents box'],
  ['.hatnote, .top-quote', 'notes and the quote at the top'],
  ['.callout', 'note/tip/warning/spoiler boxes ([data-callout="tip"] for one kind)'],
  ['.pc-card', 'page cards (.pc-img, .pc-name, .pc-tag)'],
  ['.gallery', 'galleries (.g-item for each picture)'],
  ['.catlinks', 'the categories bar at the bottom'],
  ['.html-block', 'your HTML blocks'],
  ['a.wikilink, a.new', 'links to pages, and red links']
]
