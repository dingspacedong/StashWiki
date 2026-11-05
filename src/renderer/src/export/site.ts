// Builds a static website from a wiki: one HTML file per public page plus index pages, a stylesheet,
// a small script and the pictures those pages use. Private pages are left out entirely, and links to
// them (or to pages that don't exist) become plain text, so nothing hints at what isn't published.
import { escapeHtml, fontFaceCss, fontFiles } from '@shared/defaults'
import { GOOGLE_FONTS } from '@shared/googleFonts'
import type { Gallery, Page, Template, WikiMeta } from '@shared/types'
import { renderBody } from '../lib/render'
import { renderInlineText, stripHtml, titleKey } from '../lib/wikitext'
import { pageFields } from '../lib/fields'
import { imageTabs, infoboxText, tabLabel } from '../lib/imageTabs'
import { imgUrl, themeVars } from '../lib/theme'
import { pageThumb, visibleRows } from '../components/Infobox'
import { SITE_CSS, SITE_JS } from './siteAssets'
import { STORY_CSS, STORY_SITE_CSS } from '../lib/storyStyles'
import { parseCards, renderCardsHtml } from '../lib/cards'
import { autoNavboxes, navboxHtml, navboxTag, shownLinks, type ShownLink } from '../lib/navigation'
import { cardGridLook, cardPicStyle, styleAttr } from '../lib/cardPic'
import { mixLogos, mixSiteCss, mixSiteScript, mixThemes } from '../lib/mixUp'
import { removeLook } from '../lib/looks'
import { ancestorsOf, categoryInfo, categoryMembers, categoryTree, childrenOf } from '../lib/categories'
import {
  RATING_LABELS,
  STATUS_LABELS,
  appearances,
  formatCount,
  isWikiPage,
  readingTime,
  seriesStories,
  storyChapters,
  wordCount
} from '../lib/stories'

export interface Site {
  /** Relative path → file contents. */
  files: Record<string, string>
  /** Picture files (in the wiki's images folder) the site uses. */
  images: string[]
  /** Bundled font files the site uses (copied into fonts/). */
  fonts: string[]
  pageCount: number
  /** Page id → its file name. */
  pageFiles: Record<string, string>
}

export interface SiteOptions {
  /** Only render this page (for a preview); other pages still get file names so links work. */
  only?: string
  /** Include private pages (only for previews, never for an export). */
  includePrivate?: boolean
}

/** Custom CSS put inside a <style> tag can't close the tag early. */
const styleText = (css: string): string => css.replace(/<\/(style)/gi, '<\\/$1')

const IMG_PREFIX = 'stash://wiki/images/'

export function slugify(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'page'
  )
}

export function buildSite(meta: WikiMeta, allPages: Record<string, Page>, opts: SiteOptions = {}): Site {
  // Private pages are left out; so are chapters of a private story.
  // Which kinds of page go in: the wiki and its stories, just one of them, or no stories while they're switched off.
  const content = meta.storiesOff ? 'wiki' : (meta.siteContent ?? 'all')
  const kindOk = (p: Page): boolean => content === 'all' || (content === 'wiki' ? isWikiPage(p) : !isWikiPage(p))
  const shown = (p: Page): boolean =>
    opts.includePrivate || (kindOk(p) && !p.private && (!p.chapter || (!!allPages[p.chapter.storyId] && !allPages[p.chapter.storyId].private)))
  const pages = Object.values(allPages)
    .filter(shown)
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
  const byKey = new Map(pages.map((p) => [titleKey(p.title), p]))
  const exists = (t: string): boolean => byKey.has(titleKey(t))
  const mainId = meta.mainPageId && allPages[meta.mainPageId] && shown(allPages[meta.mainPageId]) ? meta.mainPageId : null

  // File names: the main page is index.html; others are named after their titles.
  const used = new Set(['index', 'all-pages', 'categories', 'style', 'site', 'search-index', 'stories', 'custom', 'mix'])
  const wikiPages = pages.filter(isWikiPage)
  const storyPages = pages.filter((p) => p.story)
  const hasStories = storyPages.length > 0
  const storiesOnly = content === 'stories'
  const unique = (base: string): string => {
    let s = base
    for (let n = 2; used.has(s); n++) s = `${base}-${n}`
    used.add(s)
    return s
  }
  const fileOf = new Map<string, string>()
  if (mainId) fileOf.set(mainId, 'index.html')
  for (const p of pages) {
    if (p.id === mainId) continue
    let base = slugify(p.title)
    if (base.startsWith('category-')) base = 'page-' + base
    fileOf.set(p.id, unique(base) + '.html')
  }

  // Categories that have at least one public page.
  const categories = new Map<string, { name: string; pages: Page[] }>()
  for (const p of pages) {
    if (!isWikiPage(p)) continue
    for (const c of p.categories) {
      const k = titleKey(c)
      if (!categories.has(k)) categories.set(k, { name: c, pages: [] })
      categories.get(k)!.pages.push(p)
    }
  }
  // The categories those are inside get a page too, so the subcategories can be found from them.
  for (const c of [...categories.values()])
    for (const a of ancestorsOf(meta, c.name)) if (!categories.has(titleKey(a))) categories.set(titleKey(a), { name: a, pages: [] })
  // A category set to show its subcategories' pages lists them as well.
  for (const c of categories.values()) if (categoryInfo(meta, c.name)?.withSubPages) c.pages = categoryMembers(meta, wikiPages, c.name)
  const catFile = new Map<string, string>()
  for (const [k, c] of [...categories].sort((a, b) => a[1].name.localeCompare(b[1].name)))
    catFile.set(k, unique('category-' + slugify(c.name)) + '.html')

  const images = new Set<string>()
  const usedFonts = new Set<string>()
  const customOn = !meta.customCssOff
  // Switching color themes: each picked theme goes in mix.css, and the wiki's own pick comes out of custom.css.
  const mixing = customOn && mixThemes(meta).length > 0
  const customCss = mixing ? removeLook(meta.customCss ?? '', 'color-theme') : (meta.customCss ?? '')
  const files: Record<string, string> = {}
  const navbox = (id: string): string => navboxHtml(meta.navboxes?.find((b) => b.id === id), pages)
  const cardsOf = (json: string): string => renderCardsHtml(parseCards(json), (t) => byKey.get(titleKey(t)), meta)

  // The wiki's own sidebar sections. Links to pages that aren't in the website are left out.
  const navLink = (l: ShownLink): string => {
    const t = l.target
    const text = escapeHtml(l.label)
    let one = ''
    if (t.kind === 'url') one = `<a href="${escapeHtml(t.url)}" target="_blank" rel="noreferrer">${text}</a>`
    else if (t.kind === 'page') {
      const p = byKey.get(titleKey(t.title))
      if (p) one = `<a href="${fileOf.get(p.id)}">${text}</a>`
    } else if (t.kind === 'category') {
      const f = catFile.get(titleKey(t.name))
      if (f) one = `<a href="${f}">${text}</a>`
    }
    const kids = l.children.map(navLink).filter(Boolean).join('')
    if (!kids) return one
    return `<details class="nav-sub"><summary>${one || `<span class="nav-plain">${text}</span>`}</summary><div class="nav-children">${kids}</div></details>`
  }
  const sidebarExtra = (meta.sidebar ?? [])
    .map((s) => {
      const links = shownLinks(s.links, pages).map(navLink).filter(Boolean).join('\n')
      return links || s.title.trim() ? `\n<div class="nav-title">${escapeHtml(s.title)}</div>\n${links}` : ''
    })
    .join('')

  /** Fix up a finished piece of page HTML: wiki links, pictures, contents links. */
  const finish = (html: string): string => {
    const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html')
    const root = doc.getElementById('r')!
    for (const a of root.querySelectorAll('a[data-wikilink]')) {
      const target = byKey.get(titleKey(a.getAttribute('data-wikilink') ?? ''))
      if (target) {
        a.setAttribute('href', fileOf.get(target.id)!)
        a.removeAttribute('data-wikilink')
        a.removeAttribute('title')
        a.classList.add('wikilink')
        a.classList.remove('new')
      } else {
        const span = doc.createElement('span')
        // Keep card styling classes, drop the link ones.
        span.className = [...a.classList]
          .filter((c) => c !== 'wikilink' && c !== 'new')
          .concat('missing')
          .join(' ')
        span.innerHTML = a.innerHTML
        a.replaceWith(span)
      }
    }
    for (const a of root.querySelectorAll('a[data-wikiref]')) {
      const span = doc.createElement('span')
      span.innerHTML = a.innerHTML
      a.replaceWith(span)
    }
    for (const a of root.querySelectorAll('a[data-toc]')) {
      a.setAttribute('href', '#' + a.getAttribute('data-toc'))
      a.removeAttribute('data-toc')
    }
    for (const img of root.querySelectorAll('img')) {
      const src = img.getAttribute('src') ?? ''
      if (!src.startsWith(IMG_PREFIX)) continue
      const file = decodeURIComponent(src.slice(IMG_PREFIX.length))
      images.add(file)
      img.setAttribute('src', 'images/' + file)
      img.setAttribute('data-full', 'images/' + file)
      img.setAttribute('loading', 'lazy')
    }
    return root.innerHTML
  }

  const styleOf = (p: Page | null): string => {
    const look = { ...meta.theme, ...(p?.theme ?? {}) }
    usedFonts.add(look.bodyFont).add(look.headingFont)
    const vars = themeVars(meta.theme, p?.theme ?? {})
    if (vars['--bg-image'].startsWith('url("' + IMG_PREFIX)) {
      const file = decodeURIComponent(vars['--bg-image'].slice(5 + IMG_PREFIX.length, -2))
      images.add(file)
      vars['--bg-image'] = `url("images/${file}")`
    }
    return Object.entries(vars)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ')
      .replace(/"/g, '&quot;')
  }

  const layout = (title: string, content: string, page: Page | null): string => {
    // With several logos switching, site.js picks one on every page.
    const logos = mixLogos(meta)
    for (const l of logos) images.add(l)
    const logo = meta.logo
      ? (images.add(meta.logo),
        `<img src="images/${escapeHtml(meta.logo)}" alt=""${logos.length ? ` data-logos="${escapeHtml(JSON.stringify(logos))}"` : ''}>`)
      : `<span class="brand-dot">${escapeHtml(meta.name.slice(0, 1))}</span>`
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title === meta.name ? title : `${title} — ${meta.name}`)}</title>
<meta name="generator" content="StashWiki">
<link rel="stylesheet" href="style.css">${customOn && customCss.trim() ? '\n<link rel="stylesheet" href="custom.css">' : ''}${
      mixing ? `\n<link rel="stylesheet" href="mix.css">\n${mixSiteScript(meta)}` : ''
    }${customOn && page?.customCss?.trim() ? `\n<style class="page-css">\n${styleText(page.customCss)}\n</style>` : ''}
</head>
<body style="${styleOf(page)}">
<div class="backdrop"></div>
<header class="topbar">
<a class="wiki-brand" href="index.html">${logo}<span>${escapeHtml(meta.name)}</span></a>
<div class="search"><input id="sw-search" type="search" placeholder="Search this wiki" autocomplete="off" aria-label="Search"><div class="search-drop" hidden></div></div>
<button class="menu-btn" aria-label="Menu">☰</button>
</header>
<div class="layout">
<nav class="sidebar">
<div class="nav-title">Navigation</div>
${storiesOnly ? '' : '<a href="index.html">Main page</a>\n<a href="all-pages.html">All pages</a>\n<a href="categories.html">Categories</a>'}${hasStories ? '\n<a href="stories.html">Stories</a>' : ''}
<a href="#" id="sw-random">Random page</a>${sidebarExtra}
</nav>
<main class="content">
<div class="content-card">
${content}
</div>
<footer class="site-foot">Made with StashWiki</footer>
</main>
</div>
<div class="lightbox" hidden>
<button class="lb-close" aria-label="Close">×</button>
<button class="lb-nav lb-prev" aria-label="Previous">‹</button>
<button class="lb-nav lb-next" aria-label="Next">›</button>
<figure class="lb-figure"><img alt=""><figcaption></figcaption></figure>
</div>
<script src="search-index.js"></script>
<script src="site.js"></script>
</body>
</html>
`
  }

  const inline = (text: string): string => renderInlineText(text, exists)

  const infobox = (p: Page, t: Template): string => {
    const head = p.theme.infoboxHeader || t.headerColor
    const headText = p.theme.infoboxHeaderText || t.headerText
    const rows = visibleRows(pageFields(t, p), p.infobox).map((f) => {
      if (f.type === 'header') return `<div class="ib-header">${escapeHtml(f.label)}</div>`
      if (f.type === 'image') {
        const tabs = imageTabs(p.infobox, f.id)
        const panes = tabs
          .map(
            (tab, i) =>
              `<div class="ib-pane"${i ? ' hidden' : ''} data-lb><img src="${imgUrl(tab.file)}" alt="${escapeHtml(tab.caption || f.label)}">` +
              (tab.caption ? `<figcaption>${inline(tab.caption)}</figcaption>` : '') +
              `<div class="lb-data"><div class="lb-caption">${tab.caption ? inline(tab.caption) : ''}</div></div></div>`
          )
          .join('')
        const bar =
          tabs.length > 1
            ? `<div class="ib-tabs" role="tablist">${tabs.map((tab, i) => `<button role="tab" aria-selected="${i === 0}"${i === 0 ? ' class="active"' : ''}>${escapeHtml(tabLabel(tab, i))}</button>`).join('')}</div>`
            : ''
        return `<figure class="ib-image" data-group${tabs.length > 1 ? ' data-tabs' : ''}>${bar}${panes}</figure>`
      }
      return `<div class="ib-row"><div class="ib-label">${escapeHtml(f.label)}</div><div class="ib-value">${inline(p.infobox[f.id] ?? '')}</div></div>`
    })
    return `<aside class="infobox" style="--ib-head: ${escapeHtml(head)}; --ib-head-text: ${escapeHtml(headText)}"><div class="ib-title">${escapeHtml(p.title)}</div>${rows.join('')}</aside>`
  }

  // Spoilers: a whole gallery sits under a cover until clicked; otherwise each spoiler picture is blurred on its own.
  const gallery = (g: Gallery): string =>
    `<section class="gallery${g.spoiler ? ' spoiler-gallery covered' : ''}" data-collapse="${g.autoCollapse ? 1 : 0}">` +
    `<div class="gallery-head"><h2>${escapeHtml(g.title || 'Gallery')}</h2><span class="gallery-count">${g.images.length} image${g.images.length === 1 ? '' : 's'}</span>` +
    (g.spoiler ? `<button class="gallery-rehide" hidden>Hide spoilers</button>` : '') +
    `<button class="gallery-toggle" hidden>Show all</button></div>` +
    `<div class="gallery-body"><div class="gallery-grid" data-group${g.spoiler ? ' inert' : ''}>` +
    g.images
      .map((img) => {
        const blur = !g.spoiler && img.spoiler
        return (
          `<figure class="g-item${blur ? ' g-spoiler' : ''}" data-lb><a class="g-thumb" href="images/${escapeHtml(img.file)}"${blur ? ' title="Spoiler: click to show"' : ''}><img src="${imgUrl(img.file)}" alt="${blur ? 'Spoiler' : escapeHtml(img.caption)}"></a>` +
          (img.caption ? `<figcaption>${inline(img.caption)}</figcaption>` : '') +
          `<div class="lb-data"><div class="lb-caption">${img.caption ? inline(img.caption) : ''}</div><div class="lb-src">${img.source ? inline(img.source) : ''}</div></div></figure>`
        )
      })
      .join('') +
    `</div>` +
    (g.spoiler
      ? `<button class="gallery-cover"><strong>Spoilers</strong><span>Click to show ${g.images.length === 1 ? 'this picture' : `these ${g.images.length} pictures`}</span></button>`
      : '') +
    `</div></section>`

  const topMatter = (p: Page): string => {
    const notes = (p.hatnotes ?? []).filter((n) => n.trim()).map((n) => `<div class="hatnote">${inline(n)}</div>`)
    const q = p.quote?.text.trim() ? p.quote : null
    const quote = q
      ? `<blockquote class="top-quote"><div>“${inline(q.text.trim())}”</div>${q.by.trim() ? `<div class="top-quote-by">— ${inline(q.by.trim())}</div>` : ''}</blockquote>`
      : ''
    return notes.length || quote ? `<div class="top-matter">${notes.join('')}${quote}</div>` : ''
  }

  const date = (ms: number): string => new Date(ms).toLocaleDateString(undefined, { dateStyle: 'long' })

  // ---------- stories ----------
  const published = (story: Page): Page[] => storyChapters(story, allPages).filter((c) => fileOf.has(c.id))
  const badge = (cls: string, text: string): string => `<span class="story-badge ${cls}">${escapeHtml(text)}</span>`
  const cover = (story: Page, size: string): string => {
    const file = story.story?.cover
    if (file) images.add(file)
    return `<div class="story-cover ${size}">${file ? `<img src="images/${escapeHtml(file)}" alt="">` : `<span>${escapeHtml(story.title.slice(0, 1))}</span>`}</div>`
  }
  const crumbs = (story: Page | undefined, last?: string): string =>
    `<nav class="story-crumbs"><a href="stories.html">Stories</a>` +
    (story?.story?.series ? ` <span>›</span> <span class="muted">${escapeHtml(story.story.series)}</span>` : '') +
    (story
      ? ` <span>›</span> ${last ? `<a href="${fileOf.get(story.id)}">${escapeHtml(story.title)}</a>` : `<span>${escapeHtml(story.title)}</span>`}`
      : '') +
    (last ? ` <span>›</span> <span>${escapeHtml(last)}</span>` : '') +
    `</nav>`
  const note = (text: string | undefined, label: string): string =>
    text?.trim() ? `<aside class="author-note"><div class="author-note-label">${label}</div><div>${inline(text.trim())}</div></aside>` : ''

  const storyHtml = (p: Page): string => {
    const info = p.story!
    const chapters = published(p)
    const words = chapters.reduce((n, c) => n + wordCount(c.body), 0)
    const row = (label: string, items: string[]): string =>
      items.length ? `<div class="story-meta-row"><span class="story-meta-label">${label}</span>${items.join('')}</div>` : ''
    const series = info.series ? seriesStories(info.series, allPages).filter((x) => fileOf.has(x.id)) : []
    const about = p.body.replace(/<p>\s*<\/p>/g, '').trim()
      ? renderBody(p.body, exists, cardsOf, navbox).html
      : ''
    return (
      `<article class="page story-page">${crumbs(p)}<header class="story-hero">${cover(p, 'big')}<div class="story-hero-text">` +
      `<h1 class="page-title story-title">${escapeHtml(p.title)}</h1>` +
      (info.series
        ? `<div class="story-series-line">${info.seriesPart ? `Part ${info.seriesPart} of ` : 'Part of '}<strong>${escapeHtml(info.series)}</strong></div>`
        : '') +
      `<div class="story-badges">${badge('status-' + info.status, STATUS_LABELS[info.status])}${info.rating ? badge('rating-' + info.rating, RATING_LABELS[info.rating]) : ''}</div>` +
      (info.summary.trim() ? `<div class="story-summary">${inline(info.summary.trim())}</div>` : '') +
      `<div class="story-stats"><span><b>${chapters.length}</b> chapter${chapters.length === 1 ? '' : 's'}</span><span><b>${formatCount(words)}</b> words</span><span><b>${readingTime(words)}</b> read</span></div>` +
      row(
        'Warnings',
        info.warnings.map((w) => `<span class="chip warn">${escapeHtml(w)}</span>`)
      ) +
      row(
        'Characters',
        info.characters.map((c) => `<a class="chip link" data-wikilink="${escapeHtml(c)}">${escapeHtml(c)}</a>`)
      ) +
      row(
        'Tags',
        info.tags.map((t) => `<span class="chip">${escapeHtml(t)}</span>`)
      ) +
      (chapters.length ? `<div class="story-actions"><a class="btn" href="${fileOf.get(chapters[0].id)}">▶ Start reading</a></div>` : '') +
      `</div></header>` +
      `<section class="story-chapters"><h2>Chapters</h2>` +
      (chapters.length
        ? `<ol class="chapter-list">${chapters
            .map(
              (c, i) =>
                `<li class="chapter-row"><span class="chapter-num">${i + 1}</span><div class="chapter-row-main"><a class="chapter-row-name" href="${fileOf.get(c.id)}">${escapeHtml(c.chapter!.name)}</a>` +
                (c.chapter!.summary?.trim() ? `<div class="chapter-row-summary">${escapeHtml(c.chapter!.summary.trim())}</div>` : '') +
                `</div><span class="chapter-row-meta">${formatCount(wordCount(c.body))} words</span></li>`
            )
            .join('')}</ol>`
        : '<p class="muted">No chapters yet.</p>') +
      `</section>` +
      (about ? `<section class="story-about"><div class="prose" data-group>${about}</div></section>` : '') +
      (series.length > 1
        ? `<section class="story-series"><h2>${escapeHtml(info.series!)}</h2><ol>${series
            .map(
              (x) =>
                `<li>${x.id === p.id ? `<strong>${escapeHtml(x.title)}</strong>` : `<a href="${fileOf.get(x.id)}">${escapeHtml(x.title)}</a>`}</li>`
            )
            .join('')}</ol></section>`
        : '') +
      `</article>`
    )
  }

  const chapterHtml = (p: Page): string => {
    const story = allPages[p.chapter!.storyId]
    const chapters = story ? published(story) : [p]
    const n = chapters.findIndex((c) => c.id === p.id)
    const prev = chapters[n - 1]
    const next = chapters[n + 1]
    const words = wordCount(p.body)
    const body = renderBody(p.body, exists, cardsOf, navbox).html
    const end = !next && story ? `<div class="chapter-end">${story.story!.status === 'complete' ? '✦ The End ✦' : 'To be continued…'}</div>` : ''
    return (
      `<article class="page chapter-page">${crumbs(story, story ? `Chapter ${n + 1} of ${chapters.length}` : p.chapter!.name)}` +
      `<div class="chapter-reader"><header class="chapter-head"><div class="chapter-kicker">Chapter ${n + 1}</div><h1 class="chapter-title">${escapeHtml(p.chapter!.name)}</h1>` +
      `<div class="chapter-meta">${formatCount(words)} words · ${readingTime(words)} read</div></header>` +
      note(p.chapter!.notesBefore, 'Author’s note') +
      `<div class="prose chapter-prose" data-group>${body}</div>` +
      note(p.chapter!.notesAfter, 'End note') +
      end +
      `<nav class="chapter-nav">${prev ? `<a class="btn ghost" href="${fileOf.get(prev.id)}">← Previous</a>` : '<span></span>'}` +
      (story ? `<a href="${fileOf.get(story.id)}">Contents</a>` : '') +
      (next
        ? `<a class="btn" href="${fileOf.get(next.id)}">Next →</a>`
        : story
          ? `<a class="btn ghost" href="${fileOf.get(story.id)}">Back to the story</a>`
          : '<span></span>') +
      `</nav></div></article>`
    )
  }

  /** "Appears in" on a wiki page: the published stories it turns up in. */
  const appearsIn = (p: Page): string => {
    const list = appearances(p, allPages).filter((a) => fileOf.has(a.story.id))
    if (!list.length) return ''
    return (
      `<section class="appears-in"><h3>Appears in</h3><ul>` +
      list
        .map(({ story, chapters }) => {
          const shownCh = chapters.filter((c) => fileOf.has(c.id))
          return (
            `<li><a href="${fileOf.get(story.id)}">${escapeHtml(story.title)}</a>` +
            (shownCh.length
              ? ` <span class="muted small">— mentioned in ${shownCh
                  .slice(0, 4)
                  .map((c) => `<a href="${fileOf.get(c.id)}">${escapeHtml(c.chapter!.name)}</a>`)
                  .join(', ')}${shownCh.length > 4 ? ` and ${shownCh.length - 4} more` : ''}</span>`
              : '') +
            `</li>`
          )
        })
        .join('') +
      `</ul></section>`
    )
  }

  // ---------- pages ----------
  for (const p of pages) {
    if (opts.only && p.id !== opts.only) continue
    if (p.story || p.chapter) {
      files[fileOf.get(p.id)!] = layout(
        p.chapter ? `${p.chapter.name} — ${allPages[p.chapter.storyId]?.title ?? ''}` : p.title,
        finish(p.story ? storyHtml(p) : chapterHtml(p)),
        p
      )
      continue
    }
    const t = meta.templates.find((x) => x.id === p.templateId)
    const body = renderBody(p.body, exists, cardsOf, navbox).html
    const autos = autoNavboxes(meta, p)
    const bottom = autos.length ? `<div class="prose auto-navboxes">${renderBody(autos.map((b) => navboxTag(b.id)).join(''), exists, undefined, navbox).html}</div>` : ''
    const cats = p.categories.filter((c) => catFile.has(titleKey(c)))
    const content =
      `<article class="page"><h1 class="page-title">${escapeHtml(p.title)}</h1>` +
      (meta.tagline ? `<div class="page-sub">${escapeHtml(meta.tagline)}</div>` : '') +
      `<div class="article">${topMatter(p)}${t ? infobox(p, t) : ''}<div class="prose" data-group>${body}</div>${p.galleries
        .filter((g) => g.images.length)
        .map(gallery)
        .join('')}<div class="clear"></div></div>` +
      bottom +
      appearsIn(p) +
      (cats.length
        ? `<div class="catlinks"><b>Categories:</b>${cats.map((c) => `<a href="${catFile.get(titleKey(c))}">${escapeHtml(c)}</a>`).join('')}</div>`
        : '') +
      `<div class="page-foot">Last edited ${escapeHtml(date(p.updatedAt))}</div></article>`
    files[fileOf.get(p.id)!] = layout(p.title, finish(content), p)
  }

  // ---------- index pages ----------
  const link = (p: Page): string => `<a href="${fileOf.get(p.id)}">${escapeHtml(p.title)}</a>`
  const groups = new Map<string, Page[]>()
  for (const p of wikiPages) {
    const letter = /^\p{L}/u.test(p.title) ? p.title[0].toUpperCase() : '#'
    groups.set(letter, [...(groups.get(letter) ?? []), p])
  }
  const allPagesHtml =
    `<h1 class="page-title">All pages</h1><p class="muted">${wikiPages.length} page${wikiPages.length === 1 ? '' : 's'}</p><div class="letter-groups">` +
    [...groups]
      .map(([l, list]) => `<div class="letter-group"><h3>${escapeHtml(l)}</h3><ul>${list.map((p) => `<li>${link(p)}</li>`).join('')}</ul></div>`)
      .join('') +
    `</div>`
  files['all-pages.html'] = layout('All pages', allPagesHtml, null)

  if (hasStories) {
    const shelves = new Map<string, Page[]>()
    for (const st of storyPages) shelves.set(st.story!.series?.trim() || '', [...(shelves.get(st.story!.series?.trim() || '') ?? []), st])
    const card = (st: Page): string => {
      const ch = published(st)
      const words = ch.reduce((n, c) => n + wordCount(c.body), 0)
      return (
        `<a class="story-card" href="${fileOf.get(st.id)}">${cover(st, 'small')}<div class="story-card-text"><div class="story-card-title">${st.story!.seriesPart ? `<span class="muted">${st.story!.seriesPart}. </span>` : ''}${escapeHtml(st.title)}</div>` +
        `<div class="story-badges">${badge('status-' + st.story!.status, STATUS_LABELS[st.story!.status])}${st.story!.rating ? badge('rating-' + st.story!.rating, RATING_LABELS[st.story!.rating]) : ''}</div>` +
        (st.story!.summary
          ? `<p class="story-card-summary">${escapeHtml(st.story!.summary.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, a: string, b?: string) => b || a))}</p>`
          : '') +
        `<div class="story-card-meta">${ch.length} chapter${ch.length === 1 ? '' : 's'} · ${formatCount(words)} words</div></div></a>`
      )
    }
    const order = [...shelves.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    files['stories.html'] = layout(
      'Stories',
      `<h1 class="page-title">Stories</h1>` +
        order
          .map((series) => {
            const list = shelves
              .get(series)!
              .sort((a, b) => (series ? (a.story!.seriesPart ?? 999) - (b.story!.seriesPart ?? 999) : a.title.localeCompare(b.title)))
            return `<section class="story-shelf">${series ? `<h2 class="shelf-title">📚 ${escapeHtml(series)}</h2>` : order.length > 1 ? '<h2 class="shelf-title">Stories</h2>' : ''}<div class="story-cards">${list.map(card).join('')}</div></section>`
          })
          .join(''),
      null
    )
  }
  // A stories-only site opens on the shelf.
  if (storiesOnly) files['index.html'] = files['stories.html'] ?? layout(meta.name, '<p class="muted">No stories yet.</p>', null)
  if (!mainId && !storiesOnly)
    files['index.html'] = layout(meta.name, `<p class="muted">Welcome to ${escapeHtml(meta.name)}.</p>` + allPagesHtml, null)

  files['categories.html'] = layout(
    'Categories',
    `<h1 class="page-title">Categories</h1><ul class="category-list">` +
      categoryTree(
        meta,
        [...categories.values()].map((c) => c.name)
      )
        .map(({ name, depth }) => {
          const k = titleKey(name)
          const c = categories.get(k)!
          const desc = categoryInfo(meta, name)?.description
          return `<li${depth ? ` style="padding-left: ${depth * 22}px"` : ''}>${depth ? '<span class="muted">↳</span> ' : ''}<a href="${catFile.get(k)}">${escapeHtml(c.name)}</a> <span class="muted">(${c.pages.length})</span>${desc ? `<div class="muted">${escapeHtml(desc)}</div>` : ''}</li>`
        })
        .join('') +
      `</ul>`,
    null
  )
  const grid = cardGridLook(meta.cardStyle)
  const blurCards = meta.cardStyle?.fit === 'whole' && meta.cardStyle.fill === 'blur'
  const catLink = (name: string): string => {
    const f = catFile.get(titleKey(name))
    return f ? `<a href="${f}">${escapeHtml(categories.get(titleKey(name))!.name)}</a>` : ''
  }
  for (const [k, c] of categories) {
    const desc = categoryInfo(meta, c.name)?.description
    const crumbs = ancestorsOf(meta, c.name).reverse().map(catLink).filter(Boolean)
    const subs = childrenOf(meta, c.name).filter((s) => catFile.has(titleKey(s)))
    const cards = c.pages
      .map((p) => {
        const thumb = pageThumb(
          p,
          meta.templates.find((t) => t.id === p.templateId)
        )
        const look = styleAttr(cardPicStyle(p))
        const img = thumb
          ? (images.add(thumb),
            (blurCards ? `<img class="page-card-blur" src="images/${escapeHtml(thumb)}" alt="" aria-hidden="true" loading="lazy">` : '') +
              `<img src="images/${escapeHtml(thumb)}" alt="" loading="lazy"${look ? ` style="${look}"` : ''}>`)
          : `<span>${escapeHtml(p.title.slice(0, 1))}</span>`
        return `<a class="page-card" href="${fileOf.get(p.id)}"><span class="page-card-img">${img}</span><span class="page-card-title">${escapeHtml(p.title)}</span></a>`
      })
      .join('')
    files[catFile.get(k)!] = layout(
      `Category: ${c.name}`,
      (crumbs.length ? `<div class="cat-crumbs">${crumbs.join(' › ')} ›</div>` : '') +
        `<h1 class="page-title"><span class="muted">Category:</span> ${escapeHtml(c.name)}</h1>` +
        (desc ? `<p>${escapeHtml(desc)}</p>` : '') +
        (subs.length
          ? `<h3>Subcategories</h3><ul class="subcat-list">${subs.map((s) => `<li>${catLink(s)} <span class="muted">(${categories.get(titleKey(s))!.pages.length})</span></li>`).join('')}</ul>`
          : '') +
        `<h3>${c.pages.length} page${c.pages.length === 1 ? '' : 's'} in this category</h3><div class="${grid.className}"${grid.style['--card-fill'] ? ` style="--card-fill: ${escapeHtml(grid.style['--card-fill'])}"` : ''}>${cards}</div>`,
      null
    )
  }

  // ---------- search index, style, script ----------
  const index = pages.map((p) => ({
    t: p.title,
    u: fileOf.get(p.id)!,
    s: (stripHtml(p.body) + ' ' + infoboxText(p.infobox).join(' ')).replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, a, b) => b || a).slice(0, 2000)
  }))
  files['search-index.js'] = `window.SW_PAGES = ${JSON.stringify(index).replace(/</g, '\\u003c')};\n`
  // Bundled fonts named in custom CSS, page CSS or fancy blocks (ready-made looks and blocks use some) go along too.
  const written = Object.values(files).join('\n') + (customOn ? customCss + (mixing ? mixSiteCss(meta) : '') : '')
  for (const f of GOOGLE_FONTS) if (written.includes(`"${f.family}"`) || written.includes(`'${f.family}'`)) usedFonts.add(f.key)
  files['style.css'] = fontFaceCss('fonts/', usedFonts) + '\n' + SITE_CSS + (hasStories ? STORY_CSS + STORY_SITE_CSS : '')
  files['site.js'] = SITE_JS
  if (customOn && customCss.trim()) files['custom.css'] = customCss
  if (mixing) files['mix.css'] = mixSiteCss(meta) + '\n'

  return { files, images: [...images], fonts: fontFiles(usedFonts), pageCount: pages.length, pageFiles: Object.fromEntries(fileOf) }
}
