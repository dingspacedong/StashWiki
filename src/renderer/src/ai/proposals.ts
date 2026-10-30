// The writing buddy never edits the wiki itself. It proposes changes as JSON in ```stashwiki blocks;
// each becomes a card the user can Apply or Dismiss. This file parses those blocks and works out the result.
import { escapeHtml, newPage, uid } from '@shared/defaults'
import type { FieldType, Page, Template, TemplateField, WikiMeta } from '@shared/types'
import { addField, pageFields } from '../lib/fields'
import { cleanTitle, titleKey } from '../lib/wikitext'
import { bodyToText } from './context'
import { htmlBlockTag } from '../lib/customHtml'
import { makeChapter, storyChapters, wordCount } from '../lib/stories'
import { stripThinking } from '@shared/ai'

export type EditMode = 'append' | 'replace'
export interface SectionEdit {
  heading: string
  html: string
  mode?: EditMode
  /** The person chose the mode on the card, so it's followed exactly (no guessing from the text). */
  forced?: boolean
}
/** Swap one bit of text on the page for another (a sentence or a paragraph). */
export interface TextEdit {
  find: string
  replace: string
}

export type Proposal =
  | {
      action: 'create_page'
      title: string
      type?: string
      body?: string
      infobox?: Record<string, string>
      categories?: string[]
    }
  | {
      action: 'update_page'
      page: string
      title?: string
      body?: string
      append?: string
      section?: SectionEdit
      /** Several sections at once (a reply may use either). */
      sections?: SectionEdit[]
      /** The introduction above the first section. */
      intro?: { html: string; mode?: EditMode; forced?: boolean }
      edits?: TextEdit[]
      /** Raw HTML (kept as written) added at the end of the page or of a section. */
      html_block?: { html: string; section?: string }
      infobox?: Record<string, string>
      add_categories?: string[]
    }
  | {
      action: 'update_template'
      template: string
      add_fields?: { label: string; type?: FieldType; after?: string }[]
      rename_fields?: Record<string, string>
      remove_fields?: string[]
      add_sections?: string[]
    }
  | {
      /** Story prose: added to a chapter, replacing it, or as a new chapter. */
      action: 'write_chapter'
      chapter?: string
      story?: string
      html: string
      mode?: 'append' | 'replace' | 'new'
      /** The new chapter's name. */
      name?: string
    }
  | {
      action: 'set_summary'
      target: 'chapter' | 'story'
      page: string
      summary: string
    }
  | {
      action: 'update_css'
      target: 'wiki' | 'page'
      page?: string
      css: string
      mode?: EditMode
    }
  | {
      action: 'create_template'
      name: string
      color?: string
      fields?: { label: string; type?: FieldType }[]
      sections?: string[]
      categories?: string[]
    }

export type Segment = { kind: 'text'; text: string } | { kind: 'proposal'; proposal: Proposal } | { kind: 'bad'; raw: string; error: string }

const ACTIONS = new Set(['create_page', 'update_page', 'update_template', 'create_template', 'update_css', 'write_chapter', 'set_summary'])
/** Other names models use for the actions. */
const ACTION_ALIASES: Record<string, string> = {
  edit_page: 'update_page',
  modify_page: 'update_page',
  rewrite_page: 'update_page',
  change_page: 'update_page',
  update: 'update_page',
  edit: 'update_page',
  replace_text: 'update_page',
  update_section: 'update_page',
  replace_section: 'update_page',
  rewrite_section: 'update_page',
  edit_section: 'update_page',
  new_page: 'create_page',
  add_page: 'create_page',
  create: 'create_page',
  edit_template: 'update_template',
  css: 'update_css',
  set_css: 'update_css',
  add_css: 'update_css',
  edit_css: 'update_css',
  update_style: 'update_css',
  update_styles: 'update_css',
  custom_css: 'update_css',
  update_custom_css: 'update_css',
  add_html_block: 'update_page',
  write: 'write_chapter',
  continue: 'write_chapter',
  continue_chapter: 'write_chapter',
  continue_story: 'write_chapter',
  append_chapter: 'write_chapter',
  add_to_chapter: 'write_chapter',
  write_story: 'write_chapter',
  new_chapter: 'write_chapter',
  create_chapter: 'write_chapter',
  add_chapter: 'write_chapter',
  summary: 'set_summary',
  summarize: 'set_summary',
  update_summary: 'set_summary',
  set_chapter_summary: 'set_summary',
  set_story_summary: 'set_summary',
  add_html: 'update_page',
  new_template: 'create_template'
}
const BLOCK = /```(?:stashwiki|json)?[ \t]*\r?\n([\s\S]*?)```/g

/** Split an assistant reply into plain text and proposal blocks. A block still being streamed stays text. */
export function splitReply(text: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of text.matchAll(BLOCK)) {
    const raw = m[1].trim()
    let parsed: unknown
    try {
      parsed = parseLenient(raw)
    } catch {
      // A ```json block that isn't a proposal is just shown as text.
      if (!m[0].startsWith('```stashwiki')) continue
      pushText(out, text.slice(last, m.index))
      out.push({ kind: 'bad', raw, error: 'This suggestion was not valid JSON.' })
      last = m.index! + m[0].length
      continue
    }
    const items = (Array.isArray(parsed) ? parsed : [parsed]).map((p) => (p && typeof p === 'object' ? normalize(p as Raw) : p))
    if (!items.every((p) => p && typeof p === 'object' && ACTIONS.has((p as { action?: string }).action ?? ''))) continue
    pushText(out, text.slice(last, m.index))
    for (const p of items) {
      const err = validate(p as Proposal)
      out.push(err ? { kind: 'bad', raw: m[1].trim(), error: err } : { kind: 'proposal', proposal: p as Proposal })
    }
    last = m.index! + m[0].length
  }
  pushText(out, text.slice(last))
  return out
}

/**
 * JSON as models actually write it: allows trailing commas, whole-line // comments, and several objects
 * one after another (one per line or back to back) instead of an array.
 */
export function parseLenient(raw: string): unknown {
  const attempts = [
    raw,
    raw.replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'),
  ]
  for (const a of attempts) {
    try {
      return JSON.parse(a)
    } catch {
      // try the next form
    }
  }
  const cleaned = attempts[1].trim()
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length > 1 && lines.every((l) => l.startsWith('{') && l.endsWith('}'))) {
    try {
      return lines.map((l) => JSON.parse(l))
    } catch {
      // fall through
    }
  }
  if (/^\{[\s\S]*\}$/.test(cleaned)) return JSON.parse('[' + cleaned.replace(/\}\s*,?\s*\{/g, '},{') + ']')
  throw new Error('not JSON')
}

function pushText(out: Segment[], text: string): void {
  if (text.trim()) out.push({ kind: 'text', text })
}

function validate(p: Proposal): string | null {
  switch (p.action) {
    case 'create_page':
      return typeof p.title === 'string' && cleanTitle(p.title) ? null : 'A new page needs a title.'
    case 'update_page':
      if (!(typeof p.page === 'string' && p.page.trim())) return 'It did not say which page to change.'
      if (sectionsOf(p).some((x) => !x.heading)) return 'It did not say which section to change.'
      return hasChanges(p)
        ? null
        : 'This suggestion didn’t include any changes StashWiki understands, so there is nothing to apply. Ask the buddy to try again.'
    case 'update_template':
      return typeof p.template === 'string' && p.template.trim() ? null : 'It did not say which template to change.'
    case 'create_template':
      return typeof p.name === 'string' && p.name.trim() ? null : 'A new template needs a name.'
    case 'write_chapter':
      if (!p.html.trim()) return 'It didn’t include any writing.'
      return p.chapter || p.story ? null : 'It did not say which story or chapter the writing is for.'
    case 'set_summary':
      if (!p.summary.trim()) return 'It didn’t include a summary.'
      return p.page.trim() ? null : 'It did not say what the summary is for.'
    case 'update_css':
      if (typeof p.css !== 'string' || (!p.css.trim() && p.mode !== 'replace')) return 'It didn’t include any CSS.'
      return p.target === 'page' && !p.page?.trim() ? 'It did not say which page the CSS is for.' : null
  }
}

// ---------- reading what models actually send ----------

type Raw = Record<string, unknown>
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const obj = (v: unknown): Raw | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Raw) : undefined)
const TEXT_KEYS = ['html', 'text', 'content', 'body', 'markdown', 'new_text', 'new_html', 'new_content', 'value', 'paragraphs']

/** The writing inside a section/intro object, whatever the model called it. */
function textOf(o: Raw): string | undefined {
  for (const k of TEXT_KEYS) {
    const v = o[k]
    if (typeof v === 'string') return v
    if (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string')) return v.map((x) => (HAS_HTML.test(x) ? x : `<p>${x}</p>`)).join('')
  }
  return undefined
}

function modeOf(v: unknown): EditMode | undefined {
  const m = String(v ?? '').toLowerCase()
  if (/replace|rewrite|overwrite|swap/.test(m)) return 'replace'
  if (/append|add|continue|extend|expand/.test(m)) return 'append'
  return undefined
}

function sectionOf(v: unknown, mode: EditMode | undefined): SectionEdit | null {
  const o = obj(v)
  if (!o) return null
  const html = textOf(o)
  if (html === undefined) return null
  const heading = str(o.heading) ?? str(o.section) ?? str(o.title) ?? str(o.name) ?? str(o.header) ?? ''
  return { heading: heading.replace(/^#+\s*/, '').trim(), html, mode: modeOf(o.mode ?? o.operation) ?? mode }
}

function editsOf(o: Raw): TextEdit[] {
  const one = (v: unknown): TextEdit | null => {
    const e = obj(v)
    if (!e) return null
    const find = str(e.find) ?? str(e.old) ?? str(e.old_text) ?? str(e.from) ?? str(e.original) ?? str(e.search) ?? str(e.before)
    const replace = str(e.replace) ?? str(e.new) ?? str(e.new_text) ?? str(e.with) ?? str(e.to) ?? str(e.replacement) ?? str(e.after)
    return find && replace !== undefined ? { find, replace } : null
  }
  const list = [o.edits, o.replacements, o.rewrites, o.changes, Array.isArray(o.replace) ? o.replace : undefined]
    .flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []))
    .map(one)
  if (typeof o.find === 'string' && typeof o.replace === 'string') list.push({ find: o.find, replace: o.replace })
  return list.filter((e): e is TextEdit => !!e)
}

/** Bring a proposal into the shape described to the model, accepting the other names and shapes models use. */
export function normalize(raw: Raw): Raw {
  const action = String(raw.action ?? '').toLowerCase().trim()
  const o: Raw = { ...raw, action: ACTION_ALIASES[action] ?? action }
  if (o.action === 'create_page') {
    const p: Raw = { ...o, title: str(o.title) ?? str(o.name) ?? str(o.page) }
    if (typeof p.body !== 'string') p.body = textOf({ ...o, body: undefined })
    if (!obj(p.infobox) && obj(o.fields)) p.infobox = o.fields
    return p
  }
  if (o.action === 'write_chapter') {
    const mode = /^(new|create|add)_?chapter$/.test(action) || /new/i.test(String(o.mode ?? '')) ? 'new' : (modeOf(o.mode ?? o.operation) ?? 'append')
    const text = str(o.html) ?? str(o.text) ?? str(o.content) ?? str(o.prose) ?? str(o.passage) ?? str(o.body) ?? str(o.writing) ?? ''
    return {
      action: 'write_chapter',
      chapter: str(o.chapter) ?? str(o.page) ?? str(o.chapter_title),
      story: str(o.story) ?? str(o.story_title),
      html: cleanProse(text),
      mode,
      name: str(o.name) ?? str(o.chapter_name) ?? str(o.title)
    }
  }
  if (o.action === 'set_summary') {
    const target = /story|blurb/i.test(String(o.target ?? o.for ?? '')) || (!o.chapter && !!o.story && !o.page) ? 'story' : 'chapter'
    return {
      action: 'set_summary',
      target,
      page: str(o.page) ?? str(o.chapter) ?? str(o.story) ?? '',
      summary: cleanProse(str(o.summary) ?? str(o.text) ?? str(o.content) ?? str(o.blurb) ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }
  if (o.action === 'update_css') {
    const where = String(o.target ?? o.scope ?? o.for ?? '').toLowerCase()
    const page = str(o.page) ?? str(o.page_title)
    return {
      action: 'update_css',
      target: /page/.test(where) || (page && !/wiki|site|global|all/.test(where)) ? 'page' : 'wiki',
      page,
      css: str(o.css) ?? str(o.code) ?? str(o.style) ?? str(o.styles) ?? str(o.content) ?? str(o.text) ?? '',
      mode: modeOf(o.mode ?? o.operation) ?? 'append'
    }
  }
  if (o.action !== 'update_page') return o
  const top = modeOf(o.mode ?? o.operation)
  const p: Raw = { action: 'update_page', page: str(o.page) ?? str(o.page_title) ?? str(o.target) ?? str(o.title) }
  if (str(o.new_title)) p.title = o.new_title
  else if (str(o.page) && str(o.title)) p.title = o.title

  const sections: SectionEdit[] = []
  let usedTopText = false
  for (const v of [o.section, o.sections].flatMap((x) => (Array.isArray(x) ? x : x === undefined ? [] : [x]))) {
    if (typeof v === 'string') {
      // "section": "Personality" with the writing next to it.
      const html = textOf(o)
      if (html !== undefined) {
        sections.push({ heading: v.replace(/^#+\s*/, '').trim(), html, mode: top })
        usedTopText = true
      }
    } else if (obj(v) && textOf(v as Raw) === undefined && !('heading' in (v as Raw))) {
      // "sections": {"Personality": "<p>…</p>"}
      for (const [heading, html] of Object.entries(v as Raw)) if (typeof html === 'string') sections.push({ heading, html, mode: top })
    } else {
      const s = sectionOf(v, top)
      if (s) sections.push(s)
    }
  }
  if (sections.length) p.sections = sections

  const intro = o.intro ?? o.introduction ?? o.lead
  if (typeof intro === 'string') p.intro = { html: intro, mode: top }
  else if (obj(intro) && textOf(intro as Raw) !== undefined) p.intro = { html: textOf(intro as Raw), mode: modeOf((intro as Raw).mode) ?? top }

  const edits = editsOf(o)
  if (edits.length) p.edits = edits

  const block = o.html_block ?? o.htmlBlock ?? o.custom_html ?? o.raw_html ?? (raw.action === 'add_html_block' || raw.action === 'add_html' ? o.html : undefined)
  if (typeof block === 'string') p.html_block = { html: block, section: str(o.section) }
  else if (obj(block)) {
    const b = block as Raw
    const html = str(b.html) ?? str(b.code) ?? str(b.content)
    if (html !== undefined) p.html_block = { html, section: str(b.section) ?? str(b.heading) ?? str(o.section) }
  }
  if (p.html_block) {
    // The writing of the block isn't loose page text too.
    if (o.html === (p.html_block as { html: string }).html) delete o.html
    if (typeof o.section === 'string') {
      delete p.sections
      usedTopText = true
    }
  }

  if (typeof o.append === 'string') p.append = o.append
  else if (obj(o.append) && textOf(o.append as Raw) !== undefined) p.append = textOf(o.append as Raw)
  if (!usedTopText) {
    if (typeof o.body === 'string') p.body = o.body
    else {
      // Loose writing with no place given: added at the end, or the whole text when it says to replace.
      const loose = str(o.html) ?? str(o.text) ?? str(o.content) ?? str(o.new_text) ?? str(o.markdown)
      if (loose !== undefined) {
        if (top === 'replace') p.body = loose
        else p.append = (str(p.append) ?? '') + loose
      }
    }
  }
  const infobox = obj(o.infobox) ?? obj(o.fields) ?? obj(o.infobox_fields)
  if (infobox) p.infobox = Object.fromEntries(Object.entries(infobox).map(([k, v]) => [k, v == null ? '' : String(v)]))
  const cats = o.add_categories ?? o.categories
  if (Array.isArray(cats)) p.add_categories = cats.filter((c) => typeof c === 'string')
  return p
}

/** Story text without any of the model's thinking, and without a stray chapter heading at the top. */
export function cleanProse(text: string): string {
  return stripThinking(text)
    .text.replace(/<\/?(think|thinking|reasoning)>/gi, '')
    .replace(/^\s*(?:<h[1-4][^>]*>\s*)?chapter\s+\d+[^<\n]*(?:<\/h[1-4]>)?\s*\n?/i, '')
    .trim()
}

function hasChanges(p: Extract<Proposal, { action: 'update_page' }>): boolean {
  return !!(
    p.title ||
    p.body !== undefined ||
    p.append ||
    p.intro ||
    sectionsOf(p).length ||
    p.edits?.length ||
    p.html_block?.html.trim() ||
    (p.infobox && Object.keys(p.infobox).length) ||
    p.add_categories?.length
  )
}

/** All section changes of an update, whether sent as `section` or `sections`. */
export function sectionsOf(p: Extract<Proposal, { action: 'update_page' }>): SectionEdit[] {
  return [...(p.section ? [p.section] : []), ...(p.sections ?? [])]
}

/** The same proposal with every section/intro change set to add or to replace. */
export function withMode(p: Proposal, mode: EditMode): Proposal {
  if (p.action !== 'update_page') return p
  return {
    ...p,
    section: undefined,
    sections: sectionsOf(p).map((x) => ({ ...x, mode, forced: true })),
    intro: p.intro ? { ...p.intro, mode, forced: true } : undefined
  }
}

// ---------- text → page HTML ----------

const HAS_HTML = /<\/?(p|h[1-6]|ul|ol|li|strong|em|b|i|blockquote|br|a|div|span|table)\b/i

/** Turn the buddy's writing (HTML, or Markdown-ish text) into page HTML with [[links]] made into wiki links. */
export function toBodyHtml(text: string): string {
  const html = HAS_HTML.test(text) ? text : markdownLite(text)
  return linkify(html)
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
}

function markdownLite(text: string): string {
  const out: string[] = []
  let list: string[] = []
  let para: string[] = []
  const flushList = (): void => {
    if (list.length) out.push('<ul>' + list.map((l) => `<li><p>${inline(l)}</p></li>`).join('') + '</ul>')
    list = []
  }
  const flushPara = (): void => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`)
    para = []
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    const li = line.match(/^[-*•]\s+(.*)$/)
    if (!line) {
      flushPara()
      flushList()
    } else if (h) {
      flushPara()
      flushList()
      const level = Math.min(4, Math.max(2, h[1].length))
      out.push(`<h${level}>${inline(h[2])}</h${level}>`)
    } else if (li) {
      flushPara()
      list.push(li[1])
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara()
  flushList()
  return out.join('')
}

/** [[Page]] / [[Page|text]] in text (not inside tags) → wiki link anchors. */
function linkify(html: string): string {
  return html
    .split(/(<[^>]*>)/)
    .map((part) =>
      part.startsWith('<')
        ? part
        : part.replace(/\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]/g, (_m, target: string, label?: string) => {
            const t = cleanTitle(target)
            return `<a data-wikilink="${escapeHtml(t)}" class="wikilink">${label ? label.trim() : t}</a>`
          })
    )
    .join('')
}

const VOID = new Set(['br', 'hr', 'img', 'input', 'col', 'wbr'])

/** Split HTML into its top-level blocks (<p>, <ul>, <h3>, <table>…), keeping nesting intact. */
export function splitBlocks(html: string): string[] {
  const blocks: string[] = []
  let depth = 0
  let start = 0
  for (const m of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/gi)) {
    const [tag, close, name, selfClose] = m
    const at = m.index!
    if (depth === 0 && at > start && html.slice(start, at).trim()) {
      blocks.push(html.slice(start, at))
      start = at
    }
    if (depth === 0) start = at
    if (close) depth = Math.max(0, depth - 1)
    else if (!selfClose && !VOID.has(name.toLowerCase())) depth++
    if (depth === 0) {
      blocks.push(html.slice(start, at + tag.length))
      start = at + tag.length
    }
  }
  if (html.slice(start).trim()) blocks.push(html.slice(start))
  return blocks
}

const blockText = (b: string): string =>
  b
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

/**
 * Add new writing after existing writing without repeating it. Models often resend what was already
 * there: identical paragraphs are skipped, and a paragraph that repeats an old one and carries on
 * replaces the old one instead of being added twice.
 */
export function appendWithoutRepeats(existing: string, addition: string): string {
  const old = splitBlocks(existing).filter((b) => !/^<p>\s*<\/p>$/.test(b.trim()))
  const oldText = old.map(blockText)
  const added: string[] = []
  for (const b of splitBlocks(addition)) {
    const t = blockText(b)
    if (!t) {
      if (!/^<p>\s*<\/p>$/.test(b.trim())) added.push(b)
      continue
    }
    if (oldText.includes(t)) continue
    const extended = oldText.findIndex((o) => o.length >= 20 && t.startsWith(o))
    if (extended >= 0) {
      old[extended] = b
      oldText[extended] = t
      continue
    }
    if (t.length >= 20 && oldText.some((o) => o.includes(t))) continue
    added.push(b)
  }
  return [...old, ...added].join('')
}

const decodeBasic = (s: string): string =>
  s.replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
const headKey = (h: string): string =>
  titleKey(decodeBasic(h.replace(/<[^>]+>/g, '')).replace(/^[\s#\d.)\-–—:]+/, '').replace(/[\s:.!?]+$/, ''))

/**
 * Where a section's text sits: after its heading (<h2>, or an <h3>/<h4> subsection) up to the next heading,
 * or with `withSubsections` up to the next heading of the same or a higher level. Forgiving about case,
 * numbering and punctuation, and about a heading the model shortened or lengthened when only one fits.
 */
export function findSection(body: string, heading: string, withSubsections = false): { start: number; end: number } | null {
  const heads = [...body.matchAll(/<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/g)]
  const key = headKey(heading)
  if (!key) return null
  let i = heads.findIndex((h) => h[1] === '2' && headKey(h[2]) === key)
  if (i < 0) i = heads.findIndex((h) => headKey(h[2]) === key)
  if (i < 0) {
    const near = heads.map((h, n) => [headKey(h[2]), n] as const).filter(([k]) => k && (k.includes(key) || key.includes(k)))
    if (near.length === 1) i = near[0][1]
  }
  if (i < 0) return null
  const level = Number(heads[i][1])
  const start = heads[i].index! + heads[i][0].length
  const next = withSubsections ? heads.slice(i + 1).find((h) => Number(h[1]) <= level) : heads[i + 1]
  return { start, end: next ? next.index! : body.length }
}

/** Add to (or replace) the part of a page under a heading; adds the section if it isn't there. */
export function setSection(body: string, heading: string, html: string, mode: EditMode = 'append', forced = false): string {
  // The model sometimes repeats the heading inside the section text; drop it.
  const own = html.replace(new RegExp(`^\\s*<h[2-4][^>]*>\\s*${escapeRe(heading.trim())}\\s*</h[2-4]>`, 'i'), '')
  // Plain text goes with the section's own paragraphs; a version with its own subheadings stands in for them too.
  const at = findSection(body, heading, /<h[34]\b/i.test(own))
  if (!at) return body + `<h2>${escapeHtml(heading)}</h2>` + own
  const { start, end } = at
  const existing = body.slice(start, end)
  // Models often send the whole section back (old text, maybe reworded, plus new) even when asked to add.
  // Then the new version replaces the old one instead of stacking a second copy under it.
  const replace = mode === 'replace' || (!forced && resendsExisting(existing, own))
  const middle = replace ? own : appendWithoutRepeats(existing, own)
  return body.slice(0, start) + middle + body.slice(end)
}

const words = (s: string): string[] => blockText(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1)

function sentences(html: string): string[][] {
  return splitBlocks(html)
    .map(blockText)
    .join(' ')
    .split(/(?<=[.!?…])\s+|\n+/)
    .map(words)
    .filter((w) => w.length >= 3)
}

/** How alike two word lists are (shared words / all words). */
function overlap(a: string[], b: string[]): number {
  const A = new Set(a)
  const B = new Set(b)
  let shared = 0
  for (const w of A) if (B.has(w)) shared++
  return shared / (A.size + B.size - shared || 1)
}

/**
 * Does `addition` repeat what is already in `existing` (word for word or reworded)? True when at least
 * half of the existing sentences have a close match in the addition.
 */
export function resendsExisting(existing: string, addition: string): boolean {
  const old = sentences(existing)
  if (!old.length) return false
  const fresh = sentences(addition)
  if (!fresh.length) return false
  const repeated = old.filter((s) => fresh.some((f) => overlap(s, f) >= 0.6)).length
  return repeated / old.length >= 0.5
}

/** The page's introduction: everything before the first section heading. */
export function setIntro(body: string, html: string, mode: EditMode = 'append', forced = false): string {
  const first = body.search(/<h2\b/)
  const lead = first < 0 ? body : body.slice(0, first)
  const rest = first < 0 ? '' : body.slice(first)
  const replace = mode === 'replace' || (!forced && resendsExisting(lead, html))
  return (replace ? html : appendWithoutRepeats(lead, html)) + rest
}

/**
 * For the card: will the section/intro changes add to the text there, or replace it? Null when there is
 * no text there yet to add to or replace (no such page, or only new or empty sections).
 */
export function sectionEffect(page: Page | undefined, p: Proposal): EditMode | null {
  if (p.action !== 'update_page' || !page) return null
  const parts: { existing: string; html: string; mode?: EditMode; forced?: boolean }[] = []
  if (p.intro) {
    const first = page.body.search(/<h2\b/)
    const lead = first < 0 ? page.body : page.body.slice(0, first)
    if (blockText(lead)) parts.push({ existing: lead, html: p.intro.html, mode: p.intro.mode, forced: p.intro.forced })
  }
  for (const x of sectionsOf(p)) {
    const at = findSection(page.body, x.heading)
    if (at && blockText(page.body.slice(at.start, at.end))) parts.push({ existing: page.body.slice(at.start, at.end), html: x.html, mode: x.mode, forced: x.forced })
  }
  if (!parts.length) return null
  // Models often say "append" while sending the old text back reworded; that still replaces, unless the person chose.
  const replaces = (x: (typeof parts)[number]): boolean => x.mode === 'replace' || (!x.forced && resendsExisting(x.existing, toBodyHtml(x.html)))
  return parts.some(replaces) ? 'replace' : 'append'
}

/** A pattern for `s` that doesn't mind case, spacing or curly vs straight quotes. */
const flexible = (s: string): RegExp =>
  new RegExp(
    s
      .trim()
      .split(/\s+/)
      .map((w) => escapeRe(w).replace(/["“”]/g, '["“”]').replace(/['‘’]/g, "['‘’]"))
      .join('\\s+'),
    'i'
  )

/**
 * Swap `find` for `replace` on the page. Tries the HTML as it is, then goes paragraph by paragraph through
 * the readable text (so [[links]], quotes and spacing don't have to match exactly).
 */
export function applyEdit(body: string, edit: TextEdit, sanitize: (html: string) => string = (h) => h): string {
  const find = edit.find.trim()
  if (!find) return body
  if (body.includes(find)) return body.replace(find, () => edit.replace)
  const blocks = splitBlocks(body)
  for (let n = 0; n < blocks.length; n++) {
    // HTML blocks and page cards are only changed as a whole.
    if (/^<div\b[^>]*data-(html|cards)=/.test(blocks[n])) continue
    const text = bodyToText(blocks[n])
    const m = text.match(flexible(find)) ?? text.match(flexible(bodyToText(toBodyHtml(find))))
    if (!m) continue
    const changed = text.slice(0, m.index) + edit.replace.trim() + text.slice(m.index! + m[0].length)
    const tag = blocks[n].match(/^<(h[2-4]|blockquote)\b/i)?.[1]
    let html = toBodyHtml(tag ? changed.replace(/^#+\s*/, '') : changed)
    if (tag) html = `<${tag}>${html.replace(/^<p>([\s\S]*)<\/p>$/, '$1')}</${tag}>`
    blocks[n] = sanitize(html)
    return blocks.join('')
  }
  throw new Error(`Couldn’t find this on the page to change it: “${find.length > 80 ? find.slice(0, 80) + '…' : find}”`)
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Fold a whole drafted page into an existing one: the part before the first heading goes to the top, each section into its namesake. */
export function mergeBody(body: string, draft: string): string {
  const parts = draft.split(/(?=<h2\b)/)
  let out = body
  for (const part of parts) {
    const h = part.match(/^<h2\b[^>]*>([\s\S]*?)<\/h2>/)
    if (h) {
      out = setSection(out, h[1].replace(/<[^>]+>/g, '').trim(), part.slice(h[0].length), 'append')
    } else if (part.trim()) {
      const first = out.search(/<h2\b/)
      const lead = first < 0 ? out : out.slice(0, first)
      out = appendWithoutRepeats(lead, part) + (first < 0 ? '' : out.slice(first))
    }
  }
  return out
}

// ---------- working out the change ----------

export interface Plan {
  /** Pages to write (new or changed). */
  pages: Page[]
  /** New wiki settings, when templates change. */
  meta?: WikiMeta
  /** Pages this plan creates (undo moves them to the trash). */
  created: string[]
  /** Where to go afterwards. */
  openPageId?: string
}

export interface PlanContext {
  pages: Record<string, Page>
  meta: WikiMeta
  /** Cleans HTML before it goes into a page (DOMPurify in the app). */
  sanitize: (html: string) => string
}

/** A page by title, forgiving what models get wrong: case, quotes, or leaving off a "(…)" part like "Juniper" for "Juniper (wolf)". */
export function findPage(pages: Record<string, Page>, title: string): Page | undefined {
  const all = Object.values(pages)
  const key = titleKey(String(title ?? '').replace(/^["“”']+|["“”']+$/g, ''))
  const exact = all.find((p) => titleKey(p.title) === key)
  if (exact) return exact
  const base = (t: string): string => titleKey(t.replace(/\s*\([^)]*\)\s*$/, ''))
  const loose = all.filter((p) => base(p.title) === base(key))
  return loose.length === 1 ? loose[0] : undefined
}
const findTemplate = (meta: WikiMeta, name: string): Template | undefined =>
  meta.templates.find((t) => titleKey(t.name) === titleKey(name))

/** Put infobox values on a page by field label; labels the page doesn't have become fields on this page only. */
function applyInfobox(page: Page, template: Template | undefined, values: Record<string, string>): Page {
  if (!template) return page
  let overrides = page.infoboxOverrides
  const infobox = { ...page.infobox }
  for (const [label, value] of Object.entries(values)) {
    let field = pageFields(template, { infoboxOverrides: overrides }).find((f) => f.type !== 'header' && titleKey(f.label) === titleKey(label))
    if (!field) {
      field = { id: uid(), label: label.trim(), type: 'text' }
      overrides = addField(overrides, field)
    }
    infobox[field.id] = String(value ?? '')
  }
  return { ...page, infobox, infoboxOverrides: overrides }
}

export function plan(p: Proposal, ctx: PlanContext): Plan {
  const html = (s: string): string => ctx.sanitize(toBodyHtml(s))
  switch (p.action) {
    case 'create_page': {
      const title = cleanTitle(p.title)
      const existing = findPage(ctx.pages, title)
      if (existing) {
        // The page is already there: add the drafted writing and details to it instead of failing.
        const merged = plan(
          { action: 'update_page', page: existing.title, infobox: p.infobox, add_categories: p.categories },
          ctx
        )
        const page = merged.pages[0]
        if (p.body) page.body = mergeBody(page.body, html(p.body))
        if (!page.templateId && p.type) {
          const t = findTemplate(ctx.meta, p.type)
          if (t) return plan({ ...p, title: existing.title }, { ...ctx, pages: { ...ctx.pages, [page.id]: { ...page, templateId: t.id } } })
        }
        return merged
      }
      const template = p.type ? findTemplate(ctx.meta, p.type) : undefined
      if (p.type && !template) throw new Error(`There is no “${p.type}” template.`)
      let page = newPage(title, template ?? null)
      if (p.body) page.body = html(p.body)
      if (p.infobox) page = applyInfobox(page, template, p.infobox)
      if (p.categories?.length) page.categories = [...new Set([...page.categories, ...p.categories.map(cleanTitle).filter(Boolean)])]
      return { pages: [page], created: [page.id], openPageId: page.id }
    }
    case 'update_page': {
      const existing = findPage(ctx.pages, p.page)
      if (!existing) {
        // Writing for a page that doesn't exist yet: make it.
        const body = [
          p.intro ? toBodyHtml(p.intro.html) : '',
          p.body ? toBodyHtml(p.body) : '',
          ...sectionsOf(p).map((x) => `<h2>${escapeHtml(x.heading)}</h2>${toBodyHtml(x.html)}`),
          p.html_block?.html.trim() ? htmlBlockTag(p.html_block.html) : '',
          p.append ? toBodyHtml(p.append) : ''
        ].join('')
        return plan({ action: 'create_page', title: p.page, body, infobox: p.infobox, categories: p.add_categories }, ctx)
      }
      let page: Page = { ...existing }
      if (p.title && cleanTitle(p.title) && titleKey(p.title) !== titleKey(existing.title)) {
        if (findPage(ctx.pages, p.title)) throw new Error(`There is already a page called “${cleanTitle(p.title)}”.`)
        page.title = cleanTitle(p.title)
      }
      if (p.body !== undefined) page.body = html(p.body)
      if (p.intro) page.body = setIntro(page.body, html(p.intro.html), p.intro.mode, p.intro.forced)
      for (const x of sectionsOf(p)) page.body = setSection(page.body, x.heading, html(x.html), x.mode, x.forced)
      for (const e of p.edits ?? []) page.body = applyEdit(page.body, e, ctx.sanitize)
      if (p.html_block?.html.trim()) {
        const tag = htmlBlockTag(p.html_block.html)
        const at = p.html_block.section ? findSection(page.body, p.html_block.section, true) : null
        page.body = at ? page.body.slice(0, at.end) + tag + page.body.slice(at.end) : page.body + tag
      }
      if (p.append) page.body = appendWithoutRepeats(page.body, html(p.append))
      if (p.infobox) page = applyInfobox(page, ctx.meta.templates.find((t) => t.id === page.templateId), p.infobox)
      if (p.add_categories?.length) page.categories = [...new Set([...page.categories, ...p.add_categories.map(cleanTitle).filter(Boolean)])]
      return { pages: [page], created: [], openPageId: page.id }
    }
    case 'update_template': {
      const t = findTemplate(ctx.meta, p.template)
      if (!t) throw new Error(`There is no “${p.template}” template.`)
      let fields: TemplateField[] = t.fields.map((f) => {
        const renamed = Object.entries(p.rename_fields ?? {}).find(([from]) => titleKey(from) === titleKey(f.label))
        return renamed ? { ...f, label: renamed[1] } : f
      })
      const remove = new Set((p.remove_fields ?? []).map(titleKey))
      fields = fields.filter((f) => !remove.has(titleKey(f.label)))
      for (const a of p.add_fields ?? []) {
        if (!a?.label || fields.some((f) => titleKey(f.label) === titleKey(a.label))) continue
        const field: TemplateField = { id: uid(), label: a.label.trim(), type: a.type === 'header' || a.type === 'image' ? a.type : 'text' }
        const at = a.after ? fields.findIndex((f) => titleKey(f.label) === titleKey(a.after!)) : -1
        if (at >= 0) fields.splice(at + 1, 0, field)
        else fields.push(field)
      }
      const sections = [...t.sections, ...(p.add_sections ?? []).filter((s) => !t.sections.some((x) => titleKey(x) === titleKey(s)))]
      const templates = ctx.meta.templates.map((x) => (x.id === t.id ? { ...t, fields, sections } : x))
      return { pages: [], created: [], meta: { ...ctx.meta, templates } }
    }
    case 'write_chapter': {
      const prose = html(p.html)
      const target =
        p.mode === 'new' ? undefined : findPage(ctx.pages, p.chapter ?? '') ?? findChapterByName(ctx.pages, p.story, p.chapter)
      if (target?.chapter) {
        const body = p.mode === 'replace' || !blockText(target.body) ? prose : appendWithoutRepeats(target.body, prose)
        return { pages: [{ ...target, body }], created: [], openPageId: target.id }
      }
      // A new chapter, at the end of its story.
      const story =
        findPage(ctx.pages, p.story ?? '') ??
        (target?.story ? target : undefined) ??
        (() => {
          const ch = findPage(ctx.pages, p.chapter ?? '')
          return ch?.chapter ? ctx.pages[ch.chapter.storyId] : undefined
        })()
      if (!story?.story) throw new Error(`There is no story called “${p.story ?? p.chapter}”.`)
      const existing = storyChapters(story, ctx.pages)
      const taken = (t: string): boolean => Object.values(ctx.pages).some((x) => titleKey(x.title) === titleKey(t))
      const chapter = makeChapter(story, p.name?.trim() || `Chapter ${existing.length + 1}`, taken)
      chapter.body = prose
      return {
        pages: [chapter, { ...story, story: { ...story.story, chapters: [...existing.map((c) => c.id), chapter.id] } }],
        created: [chapter.id],
        openPageId: chapter.id
      }
    }
    case 'set_summary': {
      const target = findPage(ctx.pages, p.page) ?? findChapterByName(ctx.pages, undefined, p.page)
      if (!target) throw new Error(`There is no page called “${p.page}”.`)
      if (target.story) return { pages: [{ ...target, story: { ...target.story, summary: p.summary } }], created: [], openPageId: target.id }
      if (target.chapter) return { pages: [{ ...target, chapter: { ...target.chapter, summary: p.summary } }], created: [], openPageId: target.id }
      throw new Error(`“${target.title}” isn’t a story or a chapter.`)
    }
    case 'update_css': {
      const join = (old: string | undefined): string =>
        p.mode === 'replace' || !old?.trim() ? p.css : old.replace(/\s*$/, '') + '\n\n' + p.css
      if (p.target === 'wiki') return { pages: [], created: [], meta: { ...ctx.meta, customCss: join(ctx.meta.customCss) } }
      const existing = findPage(ctx.pages, p.page ?? '')
      if (!existing) throw new Error(`There is no page called “${p.page}”.`)
      return { pages: [{ ...existing, customCss: join(existing.customCss) }], created: [], openPageId: existing.id }
    }
    case 'create_template': {
      if (findTemplate(ctx.meta, p.name)) throw new Error(`There is already a “${p.name}” template.`)
      const t: Template = {
        id: uid(),
        name: p.name.trim(),
        headerColor: /^#[0-9a-f]{6}$/i.test(p.color ?? '') ? p.color! : '#5a6b8c',
        headerText: '#ffffff',
        fields: (p.fields ?? [])
          .filter((f) => f?.label)
          .map((f) => ({ id: uid(), label: f.label.trim(), type: f.type === 'header' || f.type === 'image' ? f.type : 'text' })),
        sections: (p.sections ?? []).filter(Boolean),
        categories: (p.categories ?? []).map(cleanTitle).filter(Boolean)
      }
      return { pages: [], created: [], meta: { ...ctx.meta, templates: [...ctx.meta.templates, t] } }
    }
  }
}

/** One-line description for the card. */
export function describe(p: Proposal): string {
  switch (p.action) {
    case 'create_page':
      return `Create ${p.type ? `${p.type} ` : ''}page “${cleanTitle(p.title)}”`
    case 'update_page': {
      const parts: string[] = []
      if (p.title) parts.push(`rename to “${cleanTitle(p.title)}”`)
      if (p.body !== undefined) parts.push('rewrite the text')
      if (p.intro) parts.push(p.intro.mode === 'replace' ? 'rewrite the introduction' : 'add to the introduction')
      for (const x of sectionsOf(p)) parts.push(`${x.mode === 'replace' ? 'rewrite' : 'add to'} “${x.heading}”`)
      if (p.edits?.length) parts.push(`reword ${p.edits.length === 1 ? 'one part' : `${p.edits.length} parts`}`)
      if (p.html_block) parts.push(`add an HTML block${p.html_block.section ? ` under “${p.html_block.section}”` : ''}`)
      if (p.append) parts.push('add text at the end')
      if (p.infobox) parts.push(`fill ${Object.keys(p.infobox).length} infobox field${Object.keys(p.infobox).length === 1 ? '' : 's'}`)
      if (p.add_categories?.length) parts.push(`add categor${p.add_categories.length === 1 ? 'y' : 'ies'} ${p.add_categories.join(', ')}`)
      return `“${p.page}”: ${parts.join(', ') || 'no changes'}`
    }
    case 'update_template': {
      const parts: string[] = []
      if (p.add_fields?.length) parts.push(`add ${p.add_fields.map((f) => f.label).join(', ')}`)
      if (p.rename_fields && Object.keys(p.rename_fields).length) parts.push(`rename ${Object.entries(p.rename_fields).map(([a, b]) => `${a} → ${b}`).join(', ')}`)
      if (p.remove_fields?.length) parts.push(`remove ${p.remove_fields.join(', ')}`)
      if (p.add_sections?.length) parts.push(`add sections ${p.add_sections.join(', ')}`)
      return `${p.template} template: ${parts.join('; ') || 'no changes'}`
    }
    case 'create_template':
      return `New template “${p.name}” with ${(p.fields ?? []).length} fields`
    case 'write_chapter': {
      const words = wordCount(toBodyHtml(p.html))
      if (p.mode === 'new') return `New chapter${p.name ? ` “${p.name}”` : ''} (${words} words)`
      // "Story: Chapter name" → just the chapter's name.
      const where = (p.chapter ?? p.story ?? '').replace(/^[^:]+:\s+/, '')
      return `${p.mode === 'replace' ? 'Rewrite' : 'Add'} ${words} words ${p.mode === 'replace' ? 'of' : 'to'} “${where}”`
    }
    case 'set_summary':
      return `${p.target === 'story' ? 'Story summary' : 'Chapter summary'} for “${p.target === 'story' ? p.page : p.page.replace(/^[^:]+:\s+/, '')}”`
    case 'update_css': {
      const lines = p.css.trim() ? p.css.trim().split('\n').length : 0
      const where = p.target === 'wiki' ? 'the wiki’s custom CSS' : `“${p.page}” page CSS`
      return p.mode === 'replace' ? `Replace ${where} (${lines} line${lines === 1 ? '' : 's'})` : `Add ${lines} line${lines === 1 ? '' : 's'} to ${where}`
    }
  }
}

/** Does a planned page differ from what is there now? */
export function changesPage(before: Page | undefined, after: Page): boolean {
  if (!before) return true
  const key = (a: Page): string =>
    JSON.stringify([a.title, a.body, a.infobox, a.infoboxOverrides ?? null, a.categories, a.story ?? null, a.chapter ?? null, a.customCss ?? null])
  return key(before) !== key(after)
}

/** Every page title a proposal touches (to avoid clashing with a page open in the editor). */
export function touchedTitles(p: Proposal): string[] {
  if (p.action === 'update_page' || p.action === 'set_summary') return [p.page]
  if (p.action === 'write_chapter') return [p.chapter ?? '', p.story ?? ''].filter(Boolean)
  return p.action === 'update_css' && p.target === 'page' && p.page ? [p.page] : []
}

/** A chapter by its own name ("Chapter 3", "The Storm") or number, within a story (or any story). */
function findChapterByName(pages: Record<string, Page>, story: string | undefined, name: string | undefined): Page | undefined {
  if (!name) return undefined
  const key = titleKey(name.replace(/^["“”']+|["“”']+$/g, ''))
  const owner = story ? findPage(pages, story) : undefined
  const pool = owner?.story ? storyChapters(owner, pages) : Object.values(pages).filter((x) => x.chapter)
  const num = /^(?:chapter\s*)?(\d+)$/i.exec(name.trim())
  if (num && owner?.story) return pool[Number(num[1]) - 1]
  const hits = pool.filter((c) => titleKey(c.chapter!.name) === key || titleKey(c.title).endsWith(': ' + key))
  return hits.length === 1 ? hits[0] : undefined
}
