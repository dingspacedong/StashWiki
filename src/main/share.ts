// Sharing a wiki as one compressed file (.stashwiki, a zip) and bringing it back in, plus writing the
// "export as website" folder. A .stashwiki holds wiki.json, pages/ and images/ (not the trash or backups).
import { app, dialog, type BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'fs/promises'
import { basename, dirname, join } from 'path'
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { uid } from '../shared/defaults'
import { mergeWiki } from '../shared/merge'
import type { ImportMode, ImportResult, Page, ShareInfo, TrashedPage, WikiMeta } from '../shared/types'

export type { ImportMode }
import * as store from './store'

const MANIFEST = 'stashwiki.json'
const SITE_MARKER = 'made-with-stashwiki.txt'
const KEEP_BACKUPS = 10
const SAFE_NAME = /^[\w.-]+$/


interface Unpacked {
  meta: WikiMeta
  pages: Page[]
  images: Map<string, Uint8Array>
  exportedAt: number | null
}

const pending = new Map<string, Unpacked>()
/** Folders this session wrote, which the app may open in Explorer/Finder. */
export const exportedPaths = new Set<string>()

// ---------- writing a .stashwiki ----------

async function packWiki(dir: string): Promise<{ data: Uint8Array; meta: WikiMeta }> {
  const meta = await store.readJson<WikiMeta>(join(dir, 'wiki.json'), null as unknown as WikiMeta)
  if (!meta) throw new Error('This wiki’s wiki.json could not be read.')
  const files: Zippable = {}
  const pageFiles = (await readdir(join(dir, 'pages')).catch(() => [] as string[])).filter((f) => f.endsWith('.json'))
  for (const f of pageFiles) files[`pages/${f}`] = new Uint8Array(await readFile(join(dir, 'pages', f)))
  // Pictures are already compressed; storing them as-is keeps exporting fast.
  for (const f of await readdir(join(dir, 'images')).catch(() => [] as string[])) {
    if (SAFE_NAME.test(f)) files[`images/${f}`] = [new Uint8Array(await readFile(join(dir, 'images', f))), { level: 0 }]
  }
  files['wiki.json'] = strToU8(JSON.stringify(meta, null, 2))
  files[MANIFEST] = strToU8(
    JSON.stringify({ app: 'StashWiki', format: 1, wikiId: meta.id, name: meta.name, pages: pageFiles.length, exportedAt: Date.now() }, null, 2)
  )
  return { data: zipSync(files, { level: 6 }), meta }
}

export async function exportShare(win: BrowserWindow, wikiId: string): Promise<string | null> {
  const dir = await store.wikiDir(wikiId)
  const { data, meta } = await packWiki(dir)
  const res = await dialog.showSaveDialog(win, {
    title: 'Save a share file',
    defaultPath: join(app.getPath('documents'), `${store.folderName(meta.name)}.stashwiki`),
    filters: [{ name: 'StashWiki file', extensions: ['stashwiki'] }]
  })
  if (res.canceled || !res.filePath) return null
  await writeFile(res.filePath, data)
  exportedPaths.add(dirname(res.filePath))
  return res.filePath
}

/** Keep a copy of the wiki as it was before an import changes it. */
async function backupWiki(dir: string, name: string): Promise<string> {
  const { data } = await packWiki(dir)
  const folder = join(dir, 'backups')
  await mkdir(folder, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
  const file = join(folder, `${store.folderName(name)} before import ${stamp}.stashwiki`)
  await writeFile(file, data)
  const old = (await readdir(folder)).filter((f) => f.endsWith('.stashwiki')).sort()
  for (const f of old.slice(0, Math.max(0, old.length - KEEP_BACKUPS))) await rm(join(folder, f), { force: true })
  exportedPaths.add(folder)
  return file
}

// ---------- reading a .stashwiki ----------

function unpack(buf: Uint8Array): Unpacked {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(buf)
  } catch {
    throw new Error('That file isn’t a StashWiki file (it couldn’t be opened as one).')
  }
  // Also accept a zipped wiki folder, where everything sits inside one top folder.
  const metaPath = Object.keys(entries).find((p) => p === 'wiki.json' || /^[^/]+\/wiki\.json$/.test(p))
  if (!metaPath) throw new Error('That file doesn’t contain a StashWiki wiki (no wiki.json inside).')
  const root = metaPath.slice(0, -'wiki.json'.length)
  const meta = store.normalizeMeta(JSON.parse(strFromU8(entries[metaPath])) as WikiMeta)
  if (!meta.id || !meta.name) throw new Error('The wiki inside that file is missing its name or id.')
  let exportedAt: number | null = null
  if (entries[root + MANIFEST]) {
    try {
      exportedAt = JSON.parse(strFromU8(entries[root + MANIFEST])).exportedAt ?? null
    } catch {
      // manifest is optional
    }
  }
  const pages: Page[] = []
  const images = new Map<string, Uint8Array>()
  for (const [path, data] of Object.entries(entries)) {
    if (!path.startsWith(root)) continue
    const rel = path.slice(root.length)
    const m = rel.match(/^pages\/([a-z0-9]+)\.json$/i)
    if (m) {
      try {
        const p = JSON.parse(strFromU8(data)) as Page
        if (p?.id === m[1] && typeof p.title === 'string') pages.push(store.normalizePage(p))
      } catch {
        // skip a damaged page rather than failing the whole import
      }
    }
    const img = rel.match(/^images\/([^/]+)$/)
    if (img && SAFE_NAME.test(img[1])) images.set(img[1], data)
  }
  return { meta, pages, images, exportedAt }
}

export async function inspectShare(win: BrowserWindow, path?: string): Promise<ShareInfo | null> {
  let file = path
  if (!file) {
    const res = await dialog.showOpenDialog(win, {
      title: 'Open a StashWiki file',
      properties: ['openFile'],
      filters: [{ name: 'StashWiki file', extensions: ['stashwiki', 'zip'] }]
    })
    if (res.canceled || !res.filePaths[0]) return null
    file = res.filePaths[0]
  }
  const data = unpack(new Uint8Array(await readFile(file)))
  const token = uid()
  pending.set(token, data)
  const lib = await store.readLibrary()
  const mine = lib.wikis.find((w) => w.id === data.meta.id)
  return {
    token,
    name: data.meta.name,
    pages: data.pages.length,
    images: data.images.size,
    exportedAt: data.exportedAt,
    existing: mine ? { id: mine.id, name: mine.name } : null
  }
}

async function writePages(dir: string, pages: Page[]): Promise<void> {
  for (const p of pages) if (/^[a-z0-9]+$/i.test(p.id)) await store.writeJson(join(dir, 'pages', p.id + '.json'), p)
}

async function writeImages(dir: string, images: Map<string, Uint8Array>): Promise<void> {
  for (const [name, data] of images) {
    const file = join(dir, 'images', name)
    if (!existsSync(file)) await writeFile(file, data)
  }
}

export async function applyShare(token: string, mode: ImportMode): Promise<ImportResult> {
  const data = pending.get(token)
  if (!data) throw new Error('That import has expired; open the file again.')
  pending.delete(token)

  if (mode === 'new' || mode === 'copy') {
    const meta: WikiMeta = mode === 'copy' ? { ...data.meta, id: uid(), name: `${data.meta.name} (copy)` } : data.meta
    const base = store.defaultWikisDir()
    let dir = join(base, store.folderName(meta.name))
    for (let n = 2; existsSync(dir); n++) dir = join(base, `${store.folderName(meta.name)} ${n}`)
    for (const sub of ['pages', 'images', 'trash']) await mkdir(join(dir, sub), { recursive: true })
    await store.writeJson(join(dir, 'wiki.json'), meta)
    await writePages(dir, data.pages)
    await writeImages(dir, data.images)
    const entry = await store.remember({ id: meta.id, name: meta.name, dir, lastOpened: Date.now() })
    return { entry }
  }

  const dir = await store.wikiDir(data.meta.id)
  const local = await store.loadWiki(data.meta.id)
  const backup = await backupWiki(dir, local.meta.name)
  await writeImages(dir, data.images)

  if (mode === 'replace') {
    // Pages only in your copy go to the trash rather than disappearing.
    const keep = new Set(data.pages.map((p) => p.id))
    for (const p of local.pages) if (!keep.has(p.id)) await store.trashPage(local.meta.id, p.id)
    await writePages(dir, data.pages)
    await store.writeJson(join(dir, 'wiki.json'), { ...data.meta, id: local.meta.id })
    const entry = await store.remember({ id: local.meta.id, name: data.meta.name, dir, lastOpened: Date.now() })
    return { entry, backup }
  }

  const trash: TrashedPage[] = await store.listTrash(local.meta.id)
  const result = mergeWiki({ meta: local.meta, pages: local.pages, trash }, { meta: data.meta, pages: data.pages })
  await writePages(dir, result.write)
  await store.writeJson(join(dir, 'wiki.json'), result.meta)
  const entry = await store.remember({ id: local.meta.id, name: result.meta.name, dir, lastOpened: Date.now() })
  return { entry, summary: result.summary, backup }
}

// ---------- export as website ----------

export async function exportSite(
  win: BrowserWindow,
  wikiId: string,
  files: Record<string, string>,
  images: string[],
  fonts: string[] = []
): Promise<string | null> {
  const dir = await store.wikiDir(wikiId)
  const meta = await store.readJson<WikiMeta>(join(dir, 'wiki.json'), null as unknown as WikiMeta)
  const res = await dialog.showOpenDialog(win, {
    title: 'Choose where to put the website folder',
    defaultPath: app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory']
  })
  if (res.canceled || !res.filePaths[0]) return null
  const name = `${store.folderName(meta?.name ?? 'Wiki')} website`
  let target = join(res.filePaths[0], name)
  // Re-exporting replaces a website folder StashWiki made before, and never touches any other folder.
  if (existsSync(target) && existsSync(join(target, SITE_MARKER))) await rm(target, { recursive: true, force: true })
  for (let n = 2; existsSync(target); n++) target = join(res.filePaths[0], `${name} ${n}`)

  await mkdir(join(target, 'images'), { recursive: true })
  for (const [rel, content] of Object.entries(files)) {
    if (!/^[\w./-]+$/.test(rel) || rel.includes('..')) continue
    const out = join(target, rel)
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, content, 'utf8')
  }
  for (const img of new Set(images)) {
    const src = store.imagePath(dir, img)
    if (src && existsSync(src)) await copyFile(src, join(target, 'images', basename(src)))
  }
  // Bundled Google fonts the site uses, with their licenses (free to share and host).
  const fontDir = join(__dirname, '../renderer/fonts')
  const wanted = [...new Set(fonts)].filter((f) => /^[\w.-]+\.woff2$/.test(f) && existsSync(join(fontDir, f)))
  if (wanted.length) {
    await mkdir(join(target, 'fonts'), { recursive: true })
    for (const f of wanted) await copyFile(join(fontDir, f), join(target, 'fonts', f))
    if (existsSync(join(fontDir, 'LICENSES.txt'))) await copyFile(join(fontDir, 'LICENSES.txt'), join(target, 'fonts', 'LICENSES.txt'))
  }
  await writeFile(join(target, SITE_MARKER), 'Made by StashWiki. Re-exporting the website replaces this folder.\n')
  exportedPaths.add(target)
  return target
}
