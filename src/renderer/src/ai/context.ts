// What the writing buddy is told about the wiki. Only built (and sent) when the user sends a message.
import type { NavLink, Page, WikiMeta } from '@shared/types'
import { pageFields } from '../lib/fields'
import { decodeEntities, titleKey } from '../lib/wikitext'
import { parseCards } from '../lib/cardsData'
import { decodeHtmlBlock } from '../lib/customHtml'
import { storyChapters } from '../lib/stories'
import { categoryInfo, categoryMembers, categoryTree } from '../lib/categories'
import type { StoryMode, WriteLength } from './aiStore'

/** How much of the wiki to send: small local models only have room for a little. */
const LIMITS = {
  normal: { page: 12000, titles: 400, extra: 5000, extraTotal: 30000, css: 6000 },
  short: { page: 3500, titles: 60, extra: 1500, extraTotal: 4500, css: 1200 }
}

const cut = (s: string, max: number): string => (s.length > max ? s.slice(0, max) + '\n/* …(rest cut off) */' : s)

const BOX = (kind: string): string => kind.charAt(0).toUpperCase() + kind.slice(1) + ' box'

/**
 * Page HTML as plain, readable text with headings and [[links]] kept. With `full` (the buddy knows how StashWiki
 * works), pictures, boxes and which nav box it is are shown too.
 */
export function bodyToText(html: string, full?: { meta: WikiMeta }): string {
  if (full) {
    html = html
      .replace(/<div[^>]*data-navbox="([^"]*)"[^>]*>(<\/div>)?/g, (_m, id: string) => {
        const box = full.meta.navboxes?.find((b) => b.id === decodeEntities(id))
        return box ? `\n[Nav box: ${box.title}]\n` : ''
      })
      .replace(/<img\b[^>]*>/g, (tag) => {
        const cap = decodeEntities(tag.match(/data-caption="([^"]*)"/)?.[1] ?? '').trim()
        return `\n[Picture${cap ? ': ' + cap : ''}]\n`
      })
      .replace(/<div[^>]*data-callout="(\w+)"[^>]*>([\s\S]*?)<\/div>/g, (_m, kind: string, inner: string) => `\n[${BOX(kind)}]\n${inner}\n[/${BOX(kind)}]\n`)
  }
  return decodeEntities(
    html
      .replace(/<a\b([^>]*\bdata-wikiref="[^"]*"[^>]*)>([\s\S]*?)<\/a>/g, (_m, attrs: string, text: string) => {
        const wiki = attrs.match(/data-wikiref="([^"]*)"/)![1]
        const page = attrs.match(/data-page="([^"]*)"/)?.[1] ?? ''
        const label = text.replace(/<[^>]+>/g, '')
        return label === decodeEntities(page || wiki) ? `[[${wiki}::${page}]]` : `[[${wiki}::${page}|${label}]]`
      })
      .replace(/<a\b[^>]*data-wikilink="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_m, t: string, text: string) => {
        const label = text.replace(/<[^>]+>/g, '')
        return label === decodeEntities(t) ? `[[${t}]]` : `[[${t}|${label}]]`
      })
      .replace(/<div[^>]*data-navbox="[^"]*"[^>]*>(<\/div>)?/g, '\n[Nav box]\n')
      .replace(/<div[^>]*data-cards="([^"]*)"[^>]*>(<\/div>)?/g, (_m, raw: string) => {
        const groups = parseCards(decodeEntities(raw)).groups
        return '\n[Page cards: ' + groups.map((g) => `${g.title || 'Pages'}: ${g.cards.map((c) => c.page).join(', ')}`).join('; ') + ']\n'
      })
      .replace(/<div[^>]*data-html="([^"]*)"[^>]*>(<\/div>)?/g, (_m, raw: string) => `\n[HTML block:\n${decodeHtmlBlock(decodeEntities(raw)).replace(/</g, '‹').replace(/>/g, '›')}\n]\n`)
      .replace(/<h2[^>]*>/g, '\n\n## ')
      .replace(/<h3[^>]*>/g, '\n\n### ')
      .replace(/<h4[^>]*>/g, '\n\n#### ')
      .replace(/<li[^>]*>/g, '\n- ')
      .replace(/<\/(p|h\d|blockquote)>/g, '\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function describePage(page: Page, meta: WikiMeta, maxChars: number, full = false): string {
  const template = meta.templates.find((t) => t.id === page.templateId)
  const lines = [`Title: ${page.title}`, `Type: ${template?.name ?? 'plain page (no infobox)'}`]
  if (page.categories.length) lines.push(`Categories: ${page.categories.join(', ')}`)
  if (full && page.private) lines.push('Private page (left out of exported websites)')
  for (const n of page.hatnotes ?? []) if (n.trim()) lines.push(`Note at the top: ${n.trim()}`)
  if (page.quote?.text.trim()) lines.push(`Opening quote: “${page.quote.text.trim()}”${page.quote.by.trim() ? ` — ${page.quote.by.trim()}` : ''}`)
  if (template) {
    lines.push('Infobox:')
    for (const f of pageFields(template, page)) {
      if (f.type === 'header') lines.push(`  [${f.label}]`)
      else if (f.type === 'image') lines.push(`  ${f.label}: ${page.infobox[f.id] ? '(picture)' : '(no picture)'}`)
      else lines.push(`  ${f.label}: ${page.infobox[f.id]?.trim() || '(empty)'}`)
    }
  }
  let text = bodyToText(page.body, full ? { meta } : undefined).replace(/‹/g, '<').replace(/›/g, '>')
  if (text.length > maxChars) text = text.slice(0, maxChars) + '\n…(rest of the page cut off)'
  lines.push('Text:', text || '(empty)')
  if (full && page.galleries.length) {
    lines.push('Galleries (at the bottom of the page):')
    page.galleries.forEach((g, i) => {
      lines.push(`  ${i + 1}. "${g.title || 'Gallery'}"${g.spoiler ? ' (whole gallery is a spoiler)' : ''}: ${g.images.length} picture${g.images.length === 1 ? '' : 's'}`)
      g.images.forEach((im, n) =>
        lines.push(`     ${n + 1}) ${im.caption.trim() || '(no caption)'}${im.source.trim() ? ` — credit: ${im.source.trim()}` : ''}${im.spoiler ? ' (spoiler)' : ''}`)
      )
    })
  }
  if (page.customCss?.trim()) lines.push('Custom CSS for this page:', cut(page.customCss, Math.round(maxChars / 3)))
  return lines.join('\n')
}

const CSS_FORMATS = `- {"action":"update_css","target":"wiki"|"page","page":"<title, when target is page>","css":"<css>","mode":"append"|"replace"}
- {"action":"update_page","page":"…","html_block":{"html":"<html, may include a <style> tag>","section":"<heading to put it under, optional>"}}`
const STORY_FORMATS = `- {"action":"write_chapter","chapter":"<chapter page title>","html":"<p>…</p>","mode":"append"|"replace"}  (story prose for a chapter; for a new chapter: {"action":"write_chapter","story":"<story title>","mode":"new","name":"<chapter name>","html":"<p>…</p>"})
- {"action":"set_summary","target":"chapter"|"story","page":"<page title>","summary":"<plain text>"}`
const CSS_HELP = `Custom CSS and HTML blocks (for people who ask for looks or effects the editor can't do):
- "update_css" changes the wiki's custom CSS (target "wiki", used on every page and in the exported website) or one page's (target "page"). Use mode "append" to add rules; use "replace" with the complete stylesheet when changing existing rules.
- Useful selectors: body, .topbar, .sidebar, .content-card, .page-title, .prose (h2, p, a), .infobox (.ib-title, .ib-header, .ib-label, .ib-value), .toc, .hatnote, .top-quote, .callout ([data-callout="tip"]), .pc-card, .gallery, .catlinks, .html-block, a.wikilink, a.new. Theme colors are CSS variables: var(--accent), var(--link), var(--text), var(--panel), var(--surface), var(--bg), var(--border), var(--ib-head) (inside the infobox). Parts of the CSS between /* ✦ look: … */ and /* ✦ end */ comments are ready-made looks the user switched on with a click: when replacing the stylesheet, keep those comment lines around them unchanged.
- "html_block" adds a block of raw HTML to a page (shown as written; CSS in a <style> tag inside it works; [[Page]] links work). No JavaScript: scripts, forms, iframes and on…= handlers are always removed.
- Pages show their HTML blocks as [HTML block: …]. To change one, send its whole new HTML back in that same [HTML block: …] form where it goes in the section's text. Blocks you leave out stay on the page as they are.
- Show CSS and HTML only inside the blocks, never as loose code in your message.`

const TOOL_FORMATS = `- update_page also takes: "remove_categories":["…"], "notes":["For the pup, see [[Pip]]."] (the notes at the top of the page; replaces them all, [] removes them), "quote":{"text":"…","by":"…"} (the opening quote; null removes it), "private":true|false, "add_navbox":"<nav box title>" (puts that nav box at the end of the page), "add_cards":{"title":"Characters","pages":["<page title>","…"],"section":"<heading, optional>"} (picture cards linking to pages)
- {"action":"update_gallery","page":"…","gallery":"<gallery title or number>","title":"<new title>","spoiler":true|false,"images":[{"n":1,"caption":"…","credit":"…","spoiler":true|false}],"order":[3,1,2],"remove_images":[2],"remove":true}  (only what changes; pictures are numbered as listed)
- {"action":"update_category","name":"…","rename":"<new name>","description":"…","parent":"<the category it goes inside; empty for top level>","show_subcategory_pages":true|false}  (makes the category if it doesn't exist; renaming changes it on every page)
- {"action":"remove_category","name":"…"}  (takes it off every page; the pages stay)
- {"action":"update_navbox","title":"…","rename":"…","rows":[{"label":"Family","pages":["<page title>"],"category":"<also every page in this category, optional>"}],"show_on":["<category>"],"remove":true}  (makes it if it doesn't exist; "rows" replaces all its rows)
- {"action":"update_sidebar","section":"<section header>","rename":"…","links":[{"label":"…","target":"<page title, Category:Name, or https://…>","list_pages":true,"links":[<sub-links, same shape>]}],"mode":"replace"|"append","remove":true}  (makes the section if it doesn't exist)
- {"action":"create_story","title":"…","summary":"…","status":"wip"|"complete"|"hiatus","rating":""|"general"|"teen"|"mature"|"explicit","tags":["…"],"warnings":["…"],"characters":["<character page titles>"],"series":"…","series_part":1,"chapter":{"name":"…","html":"<p>…</p>"}}
- {"action":"update_story","story":"<story title>", and any create_story details to change (lists replace the old ones)}`

const TOOLS_GUIDE = `How StashWiki works (you can suggest changes to all of this with the formats above; the person applies them):
- A page can have an infobox (from its template), notes at the top, an opening quote, an introduction, sections (the ## headings), galleries at the bottom, and categories.
- In page text, [Picture: caption] is a picture, and [Nav box: Title], [Page cards: …] and [HTML block: …] are blocks. They stay where they are when you rewrite the text around them; you can't add pictures. Boxes look like [Tip box] … [/Tip box] (also Note, Warning and Spoiler; spoiler boxes stay blurred until clicked). To add or keep a box, write it the same way inside your html.
- Categories group pages, and a category can be inside another (a subcategory). A category's page lists its pages, and its subcategories' pages too when "show_subcategory_pages" is on.
- Nav boxes are boxes of related links at the bottom of pages, set up once and shown on many: put one on a page with add_navbox, or have it show by itself on every page in its "show_on" categories. A row can list a category's pages by itself.
- The sidebar has the wiki's own sections under the built-in Navigation: a header with links, and a link can fold out sub-links or list a category's pages.
- Galleries hold the person's pictures with captions and credits; one picture or a whole gallery can be a spoiler. You can change captions, credits, spoilers, order and titles, and remove pictures, but not add them.
- Stories are pages with chapters; a chapter's page title is "Story: Chapter name". Private pages and draft chapters are left out of exported websites.
- You can't change the wiki's settings (its name, logo, colors and looks, main page, updates). For those, point the person to Look & settings.
- If asked how to do something in the app: the Categories page has "+ New category"; hover a category for + (add a subcategory) and ✎ (rename, move, remove), or drag one onto another. Navigation (under Wiki tools) sets up sidebar sections and nav boxes. In the page editor, the Insert menu adds boxes, page cards, nav boxes, fancy blocks, tables and pictures, and galleries are at the bottom. Stories (in the sidebar) has the shelf and "New story".`

const linkLine = (l: NavLink): string =>
  `${l.label || l.target}${l.label && l.target && l.label !== l.target ? ` (→ ${l.target})` : ''}${l.listPages ? ' [lists its pages]' : ''}${l.children?.length ? ` > ${l.children.map(linkLine).join(', ')}` : ''}`

/** Categories, the sidebar, nav boxes, stories and private pages, for a buddy that knows how StashWiki works. */
function wikiOverview(meta: WikiMeta, pages: Record<string, Page>, max: number): string {
  const all = Object.values(pages)
  const names = new Map<string, string>()
  const add = (c: string): void => void (names.has(titleKey(c)) || names.set(titleKey(c), c))
  all.forEach((p) => p.categories.forEach(add))
  Object.keys(meta.categories).forEach(add)
  meta.templates.forEach((t) => t.categories.forEach(add))
  const parts: string[] = []
  const tree = categoryTree(meta, [...names.values()])
  if (tree.length)
    parts.push(
      'Categories (indented ones are subcategories; number of pages):\n' +
        tree
          .map(({ name, depth }) => {
            const info = categoryInfo(meta, name)
            return `${'  '.repeat(depth)}- ${name} (${categoryMembers(meta, all, name).length})${info?.withSubPages ? ' [shows subcategory pages]' : ''}${info?.description ? `: ${info.description}` : ''}`
          })
          .join('\n')
    )
  if (meta.sidebar?.length) parts.push('Sidebar sections:\n' + meta.sidebar.map((s) => `- "${s.title}": ${s.links.map(linkLine).join('; ') || '(no links)'}`).join('\n'))
  if (meta.navboxes?.length)
    parts.push(
      'Nav boxes:\n' +
        meta.navboxes
          .map(
            (b) =>
              `- "${b.title}": ${b.groups.map((g) => `${g.label || '(no label)'}: ${[...g.pages, ...(g.category ? [`every page in ${g.category}`] : [])].join(', ') || '(empty)'}`).join(' | ') || '(no rows)'}${b.showOn?.length ? `; shown by itself on pages in: ${b.showOn.join(', ')}` : ''}`
          )
          .join('\n')
    )
  const stories = all.filter((p) => p.story).map((p) => p.title)
  if (stories.length) parts.push(`Stories: ${stories.sort().join(' | ')}`)
  const hidden = all.filter((p) => p.private && !p.chapter).map((p) => p.title)
  if (hidden.length) parts.push(`Private pages: ${hidden.sort().join(' | ')}`)
  return cut(parts.join('\n\n'), max)
}

/** `extra`: more pages the user chose (or let it find) for the buddy to read. */
export function systemPrompt(
  meta: WikiMeta,
  pages: Record<string, Page>,
  current: Page | null,
  short = false,
  extra: Page[] = [],
  story?: { mode: StoryMode; length: WriteLength },
  /** Tell it how StashWiki works and about its other changes (categories, galleries, nav boxes…). Off: as before. */
  tools = false
): string {
  const limit = LIMITS[short ? 'short' : 'normal']
  const titles = Object.values(pages)
    .filter((p) => !p.chapter)
    .map((p) => p.title)
    .sort((a, b) => a.localeCompare(b))
  const shown = titles.slice(0, limit.titles)
  const templates = meta.templates
    .map((t) => `- ${t.name}: fields ${t.fields.map((f) => (f.type === 'header' ? `[${f.label}]` : f.label)).join(', ') || '(none)'}; sections ${t.sections.join(', ') || '(none)'}`)
    .join('\n')

  // Small local models get only what applies here: CSS help in full context, story formats on stories.
  const onStory = !!(current?.story || current?.chapter)
  const formats = [short ? '' : CSS_FORMATS, onStory || tools ? STORY_FORMATS : '', tools ? TOOL_FORMATS : ''].filter(Boolean).join('\n')
  const cssHelp = short ? '' : CSS_HELP + '\n\n'
  return `You are the writing buddy inside StashWiki, a private wiki app someone uses for their own creative projects (original characters, AUs, stories, worldbuilding). Be a warm, encouraging, creative collaborator: brainstorm, suggest ideas, continue writing in the user's voice and tense, stay consistent with what the wiki already says, and ask a short question when something important is unclear. The wiki is the source of truth for its world; don't contradict it.

You cannot change the wiki yourself. When the user asks you to write into the wiki, change pages or templates, or make new pages, put each change you propose in its own fenced block exactly like this:

\`\`\`stashwiki
{"action": "update_page", "page": "Page title", "section": {"heading": "Background", "html": "<p>New paragraph…</p>"}}
\`\`\`

The user sees every block as a card with Apply and Dismiss buttons, so outside the blocks keep it brief (a sentence or two about what you suggest). For plain brainstorming or questions, just talk; only propose changes when asked or when it clearly helps.

Change formats (JSON, one object per block):
- {"action":"create_page","title":"…","type":"<template name, optional>","body":"<html>","infobox":{"Field label":"value"},"categories":["…"]}
- {"action":"update_page","page":"<existing title>","intro":{"html":"<html>","mode":"append"|"replace"},"sections":[{"heading":"<section heading>","html":"<html>","mode":"append"|"replace"}],"edits":[{"find":"<exact text now on the page>","replace":"<new text>"}],"append":"<html added at the end>","body":"<html replacing the whole text>","infobox":{"Field label":"value"},"add_categories":["…"],"title":"<new title>"}  (include only the parts you change)
- {"action":"update_template","template":"<name>","add_fields":[{"label":"…","type":"text"|"header"|"image","after":"<existing label>"}],"rename_fields":{"Old":"New"},"remove_fields":["…"],"add_sections":["…"]}
- {"action":"create_template","name":"…","color":"#rrggbb","fields":[{"label":"…","type":"text"}],"sections":["…"],"categories":["…"]}
${formats}

Rules for changes:
- Use update_page for any page in the page list below, with its exact title. Use create_page only for a title that is not in the list.
- The introduction is the unlabelled text before the first section; change it with "intro" (same modes as a section).
- To continue or add to a section, use "sections" with mode "append" and put ONLY the new paragraphs in html. Do not copy any of the existing text into it.
- To rewrite a whole section, use mode "replace" and send the complete new section — it replaces the old one. Do this whenever your version includes, rewords or reorders existing text.
- To fix or reword a few sentences, use "edits": each "find" is text copied exactly from the page as it is now (a sentence or a short paragraph), "replace" is what goes there instead.
- "heading" is the section's heading exactly as on the page (without the ##).

${cssHelp}${tools ? TOOLS_GUIDE + '\n\n' : ''}Never write out your reasoning, plans or notes to yourself — only the answer and the change blocks.

Writing rules for html: use <p>, <h3>, <ul><li>, <strong>, <em>, <blockquote>. Never use <h1> or <h2> inside section html (sections are the <h2> headings). Link other pages with [[Page title]] or [[Page title|shown text]]. Infobox values are plain text and may use [[links]]; an infobox label the page doesn't have yet is added to that page only.

Wiki: "${meta.name}"
Templates (page types):
${templates || '(none)'}
Pages (${titles.length}): ${shown.join(' | ')}${titles.length > shown.length ? ' | …' : ''}
${tools ? '\n' + wikiOverview(meta, pages, short ? 2500 : 8000) + '\n' : ''}
${meta.customCss?.trim() ? `Custom CSS for the whole wiki${meta.customCssOff ? ' (switched off right now)' : ''}:\n${cut(meta.customCss, limit.css)}\n\n` : ''}${current && (current.story || current.chapter) ? storyContext(current, pages, meta, short, story) : current ? `The user is looking at this page:\n${describePage(current, meta, limit.page, tools)}` : 'The user is not looking at a particular page right now.'}${extraPages(extra, current, meta, limit, tools)}`
}

/** The extra pages, each cut to fit, until the total budget runs out. */
function extraPages(extra: Page[], current: Page | null, meta: WikiMeta, limit: { extra: number; extraTotal: number }, full = false): string {
  let budget = limit.extraTotal
  const parts: string[] = []
  for (const p of extra) {
    if (p.id === current?.id || budget <= 300) continue
    const text = describePage(p, meta, Math.min(limit.extra, budget), full)
    budget -= text.length
    parts.push(text)
  }
  return parts.length ? '\n\nOther pages the user wants you to know about:\n\n' + parts.join('\n\n---\n\n') : ''
}

const findPage = (pages: Record<string, Page>, title: string): Page | undefined => Object.values(pages).find((p) => titleKey(p.title) === titleKey(title))

const WORDS: Record<WriteLength, number> = { short: 150, medium: 400, long: 800 }

const tail = (text: string, max: number): string => (text.length > max ? '…(earlier part cut)… ' + text.slice(text.length - max).replace(/^\S*\s/, '') : text)
const head = (text: string, max: number): string => (text.length > max ? text.slice(0, max).replace(/\s\S*$/, '') + '…' : text)

/** A line about a character from their wiki page: a few infobox facts and the start of the text. */
function characterBrief(page: Page, meta: WikiMeta, max: number): string {
  const template = meta.templates.find((t) => t.id === page.templateId)
  const facts = template
    ? pageFields(template, page)
        .filter((f) => f.type === 'text' && page.infobox[f.id]?.trim())
        .slice(0, 6)
        .map((f) => `${f.label}: ${page.infobox[f.id].trim()}`)
    : []
  return head([...facts, bodyToText(page.body).replace(/\s+/g, ' ')].filter(Boolean).join('; '), max)
}

/** Everything about the story the buddy needs: details, characters, chapters, and the text being worked on. */
function storyContext(current: Page, pages: Record<string, Page>, meta: WikiMeta, short: boolean, opts?: { mode: StoryMode; length: WriteLength }): string {
  const story = current.story ? current : pages[current.chapter!.storyId]
  if (!story?.story) return `The user is looking at this page:\n${describePage(current, meta, LIMITS[short ? 'short' : 'normal'].page)}`
  const info = story.story
  const chapters = storyChapters(story, pages)
  const n = chapters.findIndex((c) => c.id === current.id)
  const L = short
    ? { brief: 120, chars: 4, summary: 120, prev: 500, text: 3000, about: 600 }
    : { brief: 400, chars: 10, summary: 300, prev: 1800, text: 11000, about: 2500 }

  const lines = [`The user is working on a story in this wiki: "${story.title}" (its page title, for changes: "${story.title}").`]
  const details = [
    `Status: ${info.status === 'complete' ? 'complete' : info.status === 'hiatus' ? 'on hiatus' : 'in progress'}`,
    info.rating && `Rating: ${info.rating}`,
    info.series && `Series: ${info.series}${info.seriesPart ? `, part ${info.seriesPart}` : ''}`,
    info.tags.length && `Tags: ${info.tags.join(', ')}`,
    info.warnings.length && `Content warnings: ${info.warnings.join(', ')}`
  ].filter(Boolean)
  lines.push(details.join(' · '))
  if (info.summary.trim()) lines.push(`Story summary: ${info.summary.trim()}`)

  if (info.characters.length) {
    lines.push('Characters (from their wiki pages):')
    for (const name of info.characters.slice(0, L.chars)) {
      const page = findPage(pages, name)
      lines.push(`- ${name}${page ? `: ${characterBrief(page, meta, L.brief)}` : ''}`)
    }
  }

  lines.push(chapters.length ? 'Chapters in order:' : 'There are no chapters yet.')
  chapters.forEach((c, i) => {
    const about = c.chapter!.summary?.trim() || head(bodyToText(c.body).replace(/\s+/g, ' '), short ? 80 : 180)
    lines.push(`${i + 1}. ${c.chapter!.name} (page title "${c.title}")${c.private ? ' [draft]' : ''}${about ? ` — ${head(about, L.summary)}` : ''}`)
  })

  if (current.chapter && n >= 0) {
    lines.push('', `The user has chapter ${n + 1}, "${current.chapter.name}", open (page title "${current.title}").`)
    const prev = chapters[n - 1]
    if (prev) lines.push(`The previous chapter ("${prev.chapter!.name}") ends like this:\n${tail(bodyToText(prev.body), L.prev)}`)
    if (current.chapter.notesBefore?.trim()) lines.push(`Author's note on this chapter: ${current.chapter.notesBefore.trim()}`)
    const text = bodyToText(current.body).trim()
    lines.push(text ? `This chapter so far:\n${tail(text, L.text)}` : 'This chapter is still empty.')
  } else if (current.story) {
    const about = bodyToText(current.body).trim()
    if (about) lines.push(`About the story (from its page): ${head(about, L.about)}`)
  }

  const mode = opts?.mode ?? 'suggest'
  const target = current.chapter ? `"chapter":"${current.title}"` : `"story":"${story.title}","mode":"new","name":"<a fitting chapter name>"`
  if (mode === 'write') {
    lines.push(
      '',
      `MODE: WRITE WITH ME. Write story prose together with the user.
- Match the voice, tense, point of view and style of the existing chapters exactly. Keep characters consistent with their wiki pages.
- ${current.chapter ? 'Continue from exactly where this chapter ends, unless the user asks for something else.' : 'The user is on the story page: write the start of a new chapter that follows on from the last one.'} Never repeat text that is already written.
- Aim for about ${WORDS[opts?.length ?? 'medium']} words.
- Put the passage in ONE block: {"action":"write_chapter",${target},"html":"<p>…</p>"${current.chapter ? ',"mode":"append"' : ''}}. Paragraphs as <p>…</p>; dialogue in its own paragraphs. No chapter title, heading, author's note, summary or commentary inside the prose.
- Outside the block, write at most one short sentence (or nothing). Never show your reasoning or planning.
- If the user asks to rewrite or fix part of what's written, use an update_page block with "edits" on the chapter page instead.`
    )
  } else if (mode === 'summary') {
    lines.push(
      '',
      `MODE: SUMMARIZE. Write clear summaries in the present tense.
- A chapter summary is 1–3 sentences about what happens. A story summary is a short blurb of 2–4 sentences that makes people want to read it, without spoiling the ending unless asked.
- Propose it as a block the user can apply: {"action":"set_summary","target":"chapter","page":"<chapter page title>","summary":"…"} or {"action":"set_summary","target":"story","page":"${story.title}","summary":"…"}.
- When asked for a recap or "the story so far", you may also just answer in plain text. Never show your reasoning.`
    )
  } else {
    lines.push(
      '',
      `MODE: SUGGEST. Help the user think, rather than writing the story for them.
- Offer specific ideas, options and feedback for THIS story: what could happen next, character motivations and arcs, pacing, foreshadowing, dialogue, and anything that contradicts the wiki or earlier chapters.
- Use short bullet lists; give two or three different options when brainstorming. Point to the exact place in the text when giving feedback.
- If the user asks for concrete fixes, propose them with update_page blocks using "edits" on the chapter page (small rewrites), so they can apply them.`
    )
  }
  return lines.join('\n')
}
