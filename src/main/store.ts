import { app } from 'electron'
import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { join, resolve, sep } from 'path'
import { DEFAULT_THEME, defaultTemplates, newWikiMeta } from '../shared/defaults'
import type { Library, LibraryEntry, Page, TrashedPage, WikiData, WikiMeta } from '../shared/types'

/** Where the library list and window state live. STASHWIKI_DATA_DIR redirects everything (for testing). */
export function dataRoot(): string {
  return process.env.STASHWIKI_DATA_DIR || app.getPath('userData')
}

export function defaultWikisDir(): string {
  return process.env.STASHWIKI_DATA_DIR
    ? join(process.env.STASHWIKI_DATA_DIR, 'wikis')
    : join(app.getPath('documents'), 'StashWiki')
}

export async function writeJson(file: string, data: unknown): Promise<void> {
  const text = JSON.stringify(data, null, 2)
  const tmp = file + '.tmp'
  await writeFile(tmp, text, 'utf8')
  try {
    await rename(tmp, file)
  } catch {
    // Antivirus or a sync tool can briefly hold the target; fall back to a direct write.
    await writeFile(file, text, 'utf8')
    await rm(tmp, { force: true })
  }
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

// ---------- library ----------

const libraryFile = (): string => join(dataRoot(), 'library.json')

export async function readLibrary(): Promise<Library> {
  const lib = await readJson<Library>(libraryFile(), { wikis: [], lastWikiId: null })
  lib.wikis = lib.wikis.filter((w) => existsSync(join(w.dir, 'wiki.json')))
  return lib
}

async function writeLibrary(lib: Library): Promise<void> {
  await mkdir(dataRoot(), { recursive: true })
  await writeJson(libraryFile(), lib)
}

export async function remember(entry: LibraryEntry): Promise<LibraryEntry> {
  const lib = await readLibrary()
  lib.wikis = [entry, ...lib.wikis.filter((w) => w.id !== entry.id && resolve(w.dir) !== resolve(entry.dir))]
  lib.lastWikiId = entry.id
  await writeLibrary(lib)
  return entry
}

export async function forgetWiki(wikiId: string): Promise<void> {
  const lib = await readLibrary()
  lib.wikis = lib.wikis.filter((w) => w.id !== wikiId)
  if (lib.lastWikiId === wikiId) lib.lastWikiId = null
  await writeLibrary(lib)
}

export async function wikiDir(wikiId: string): Promise<string> {
  const lib = await readLibrary()
  const entry = lib.wikis.find((w) => w.id === wikiId)
  if (!entry) throw new Error('That wiki is no longer in the library.')
  return entry.dir
}

// ---------- wikis ----------

export function folderName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '')
  return cleaned || 'Wiki'
}

export async function createWiki(name: string): Promise<LibraryEntry> {
  const base = defaultWikisDir()
  let dir = join(base, folderName(name))
  for (let n = 2; existsSync(dir); n++) dir = join(base, `${folderName(name)} ${n}`)
  await mkdir(join(dir, 'pages'), { recursive: true })
  await mkdir(join(dir, 'images'), { recursive: true })
  await mkdir(join(dir, 'trash'), { recursive: true })
  const { meta, mainPage } = newWikiMeta(name.trim() || 'My Wiki')
  await writeJson(join(dir, 'wiki.json'), meta)
  await writeJson(join(dir, 'pages', mainPage.id + '.json'), mainPage)
  return remember({ id: meta.id, name: meta.name, dir, lastOpened: Date.now() })
}

export async function addExistingWiki(dir: string): Promise<LibraryEntry> {
  const meta = await readJson<WikiMeta | null>(join(dir, 'wiki.json'), null)
  if (!meta || !meta.id) throw new Error('That folder is not a StashWiki wiki (no wiki.json found).')
  return remember({ id: meta.id, name: meta.name, dir, lastOpened: Date.now() })
}

export function normalizeMeta(meta: WikiMeta): WikiMeta {
  return {
    ...meta,
    tagline: meta.tagline ?? '',
    logo: meta.logo ?? '',
    theme: { ...DEFAULT_THEME, ...meta.theme },
    templates: meta.templates ?? defaultTemplates(),
    categories: meta.categories ?? {}
  }
}

export function normalizePage(p: Page): Page {
  return {
    ...p,
    categories: p.categories ?? [],
    templateId: p.templateId ?? null,
    infobox: p.infobox ?? {},
    body: p.body ?? '',
    galleries: p.galleries ?? [],
    theme: p.theme ?? {},
    private: !!p.private
  }
}

export async function loadWiki(wikiId: string): Promise<WikiData> {
  const dir = await wikiDir(wikiId)
  const meta = normalizeMeta(await readJson<WikiMeta>(join(dir, 'wiki.json'), null as unknown as WikiMeta))
  if (!meta) throw new Error('wiki.json could not be read.')
  for (const sub of ['pages', 'images', 'trash']) await mkdir(join(dir, sub), { recursive: true })
  const pages: Page[] = []
  for (const name of await readdir(join(dir, 'pages'))) {
    if (!name.endsWith('.json')) continue
    const page = await readJson<Page | null>(join(dir, 'pages', name), null)
    if (page && page.id) pages.push(normalizePage(page))
  }
  await remember({ id: meta.id, name: meta.name, dir, lastOpened: Date.now() })
  return { meta, pages, dir }
}

export async function saveMeta(wikiId: string, meta: WikiMeta): Promise<void> {
  const dir = await wikiDir(wikiId)
  await writeJson(join(dir, 'wiki.json'), { ...meta, updatedAt: Date.now() })
  const lib = await readLibrary()
  const entry = lib.wikis.find((w) => w.id === wikiId)
  if (entry && entry.name !== meta.name) {
    entry.name = meta.name
    await writeLibrary(lib)
  }
}

function safeId(id: string): string {
  if (!/^[a-z0-9]+$/i.test(id)) throw new Error('Bad page id')
  return id
}

/**
 * `snapshot`: keep the version being replaced in the page's history first. 'auto' keeps at most one per
 * 10 minutes (so typing/autosave doesn't flood it); 'force' always keeps one (buddy changes, restores).
 */
export async function savePage(wikiId: string, page: Page, snapshot: 'auto' | 'force' | 'none' = 'auto'): Promise<void> {
  const dir = await wikiDir(wikiId)
  const file = join(dir, 'pages', safeId(page.id) + '.json')
  if (snapshot !== 'none' && existsSync(file)) await keepHistory(dir, page.id, file, snapshot === 'force')
  await writeJson(file, page)
}

const HISTORY_GAP = 10 * 60 * 1000
const HISTORY_KEEP = 50

async function keepHistory(dir: string, pageId: string, file: string, force: boolean): Promise<void> {
  const folder = join(dir, 'history', pageId)
  await mkdir(folder, { recursive: true })
  const saved = (await readdir(folder)).filter((f) => /^\d+\.json$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b))
  const newest = saved.length ? parseInt(saved[saved.length - 1]) : 0
  const now = Date.now()
  if (!force && now - newest < HISTORY_GAP) return
  await writeFile(join(folder, `${now}.json`), await readFile(file))
  for (const old of saved.slice(0, Math.max(0, saved.length + 1 - HISTORY_KEEP))) await rm(join(folder, old), { force: true })
}

export interface HistoryEntry {
  /** When this version was set aside (it was the page's text up to then). */
  at: number
  title: string
  updatedAt: number
  size: number
}

export async function listHistory(wikiId: string, pageId: string): Promise<HistoryEntry[]> {
  const folder = join(await wikiDir(wikiId), 'history', safeId(pageId))
  const out: HistoryEntry[] = []
  for (const f of await readdir(folder).catch(() => [] as string[])) {
    if (!/^\d+\.json$/.test(f)) continue
    const p = await readJson<Page | null>(join(folder, f), null)
    if (p) out.push({ at: parseInt(f), title: p.title, updatedAt: p.updatedAt, size: (p.body ?? '').length })
  }
  return out.sort((a, b) => b.at - a.at)
}

export async function readHistory(wikiId: string, pageId: string, at: number): Promise<Page> {
  const file = join(await wikiDir(wikiId), 'history', safeId(pageId), `${Math.floor(at)}.json`)
  const p = await readJson<Page | null>(file, null)
  if (!p) throw new Error('That version could not be found.')
  return normalizePage(p)
}

export async function trashPage(wikiId: string, pageId: string): Promise<void> {
  const dir = await wikiDir(wikiId)
  const src = join(dir, 'pages', safeId(pageId) + '.json')
  const page = await readJson<Page | null>(src, null)
  if (!page) return
  const entry: TrashedPage = { page, deletedAt: Date.now() }
  await writeJson(join(dir, 'trash', pageId + '.json'), entry)
  await rm(src, { force: true })
}

export async function listTrash(wikiId: string): Promise<TrashedPage[]> {
  const dir = await wikiDir(wikiId)
  const out: TrashedPage[] = []
  for (const name of await readdir(join(dir, 'trash')).catch(() => [] as string[])) {
    if (!name.endsWith('.json')) continue
    const entry = await readJson<TrashedPage | null>(join(dir, 'trash', name), null)
    if (entry?.page) out.push({ ...entry, page: normalizePage(entry.page) })
  }
  return out.sort((a, b) => b.deletedAt - a.deletedAt)
}

export async function restorePage(wikiId: string, pageId: string): Promise<Page> {
  const dir = await wikiDir(wikiId)
  const file = join(dir, 'trash', safeId(pageId) + '.json')
  const entry = await readJson<TrashedPage | null>(file, null)
  if (!entry) throw new Error('That page is no longer in the trash.')
  const page = normalizePage(entry.page)
  await writeJson(join(dir, 'pages', pageId + '.json'), page)
  await rm(file, { force: true })
  return page
}

export async function purgePage(wikiId: string, pageId: string): Promise<void> {
  const dir = await wikiDir(wikiId)
  await rm(join(dir, 'trash', safeId(pageId) + '.json'), { force: true })
}

// ---------- images ----------

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
  'image/svg+xml': 'svg', 'image/avif': 'avif', 'image/bmp': 'bmp'
}
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp']

export function mimeForExt(ext: string): string {
  const e = ext.toLowerCase() === 'jpeg' ? 'jpg' : ext.toLowerCase()
  return Object.entries(EXT_BY_MIME).find(([, v]) => v === e)?.[0] ?? 'application/octet-stream'
}

/** Store image bytes under a content hash so the same picture is only kept once. */
export async function storeImage(wikiId: string, data: Buffer, ext: string): Promise<string> {
  const dir = await wikiDir(wikiId)
  const clean = ext.toLowerCase().replace('jpeg', 'jpg')
  if (!IMAGE_EXTS.includes(clean)) throw new Error('Unsupported image type: ' + ext)
  const name = createHash('sha1').update(data).digest('hex').slice(0, 20) + '.' + clean
  const file = join(dir, 'images', name)
  if (!existsSync(file)) await writeFile(file, data)
  return name
}

export function extForMime(mime: string): string | null {
  return EXT_BY_MIME[mime.split(';')[0].trim().toLowerCase()] ?? null
}

/** Resolve a file inside a wiki's images folder, refusing anything that escapes it. */
export function imagePath(dir: string, file: string): string | null {
  const root = resolve(dir, 'images')
  const full = resolve(root, file)
  return full.startsWith(root + sep) ? full : null
}
