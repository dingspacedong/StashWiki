// "Import from Toyhouse": reads a public character (name, profile text, gallery with artist credits) and downloads its
// pictures into the wiki. Toyhouse sits behind Cloudflare, which turns away plain downloads, so the pages are opened in a
// real browser window. The window stays hidden unless the person has to click something there themselves (a content
// warning, a Cloudflare check); nothing here clicks those for them. Its session lives in memory only, so nothing about
// Toyhouse is kept once StashWiki closes. Nothing runs unless the person starts an import.
import { app, BrowserWindow, session, type Session } from 'electron'
import type { ToyhouseCharacter, ToyhouseImage, ToyhouseProgress } from '../shared/types'
import { extForMime, storeImage } from './store'

const PARTITION = 'toyhouse'
const MAX_PAGES = 20
const MAX_IMAGE = 40 * 1024 * 1024

let busy = false

/** A character link ("https://toyhou.se/12345.name", with or without https://, /gallery and so on) → its page. */
export function characterUrl(input: string): string | null {
  const m = input.trim().match(/^(?:https?:\/\/)?(?:www\.)?toyhou\.se\/(\d+)(?:\.([^/?#\s]*))?/i)
  return m ? `https://toyhou.se/${m[1]}.${m[2] ?? ''}` : null
}

function thSession(): Session {
  const s = session.fromPartition(PARTITION)
  // The window is the Chrome that Electron is built on; name it that way. With "StashWiki/… Electron/…" in the name,
  // Cloudflare's check on Toyhouse keeps failing even for a person ticking it.
  s.setUserAgent(app.userAgentFallback.replace(/\s(StashWiki|stashwiki|Electron)\/\S+/g, ''))
  s.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
  s.removeAllListeners('will-download')
  s.on('will-download', (e) => e.preventDefault())
  return s
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** What the page is showing: ready (`marker` is there), something to click through, private, missing, or still loading. */
const probe = (marker: string): string => `(() => {
  if (document.readyState !== 'complete') return 'wait'
  if (/just a moment|attention required/i.test(document.title)) return 'blocked'
  if (location.pathname.startsWith('/~account/login')) return 'private'
  const top = (document.body?.innerText || '').slice(0, 4000)
  if (/content warning/i.test(top) && document.querySelector('form button[type=submit], form input[type=submit]')) return 'blocked'
  if (document.querySelector(${JSON.stringify(marker)})) return 'ready'
  if (/not found|404/i.test(document.title) || /this character (is hidden|does not exist)|character not found/i.test(top)) return 'gone'
  return 'wait'
})()`

async function open(w: BrowserWindow, url: string, marker: string, closed: () => boolean): Promise<void> {
  // The page itself didn't load (offline, Toyhouse down…); -3 is only a redirect being replaced.
  let failed = false
  const onFail = (_e: unknown, code: number, _desc: string, _url: string, mainFrame: boolean): void => {
    if (mainFrame && code !== -3) failed = true
  }
  w.webContents.on('did-fail-load', onFail)
  try {
    await waitFor(w, url, marker, closed, () => failed)
  } finally {
    w.webContents.off('did-fail-load', onFail)
  }
}

async function waitFor(w: BrowserWindow, url: string, marker: string, closed: () => boolean, failed: () => boolean): Promise<void> {
  await w.loadURL(url).catch(() => {})
  const start = Date.now()
  for (;;) {
    if (closed()) throw new Error('The import stopped because the Toyhouse window was closed.')
    if (failed()) throw new Error('Couldn’t reach Toyhouse. Are you online?')
    const state = await w.webContents.executeJavaScript(probe(marker)).catch(() => 'wait')
    if (state === 'ready') {
      if (w.isVisible()) w.hide()
      return
    }
    if (state === 'private') throw new Error('That character isn’t public, so it can’t be imported. Make it public for a moment, then try again.')
    if (state === 'gone') throw new Error('Toyhouse couldn’t find that character. Check the link, and that the character is public.')
    // Something only the person can do (a content warning, a Cloudflare check), or a page that won't settle: show it.
    if ((state === 'blocked' || Date.now() - start > 8000) && !w.isVisible()) {
      w.setTitle('Toyhouse: click through here, and the import carries on by itself')
      w.show()
      w.focus()
    }
    if (Date.now() - start > 3 * 60 * 1000) throw new Error('Gave up waiting for Toyhouse.')
    await sleep(500)
  }
}

const READ_PROFILE = `(() => {
  const name = (document.querySelector('.profile-name-info h1, h1.display-4')?.innerText || document.querySelector('.character-name')?.innerText || '').trim()
  const creator = (document.querySelector('.profile-name-info h2')?.innerText || '').trim()
  const box = document.querySelector('.profile-content-content')
  return { name, creator, profileHtml: box ? box.innerHTML : '', profileText: box ? box.innerText.trim() : '' }
})()`

const READ_GALLERY = `(() => {
  const images = [...document.querySelectorAll('li.gallery-item')].map((li) => {
    const a = li.querySelector('a.magnific-item')
    const cap = li.querySelector('.magnific-caption')
    const credits = [...(cap ? cap.querySelectorAll('.image-credits .artist-credit') : [])]
      .map((c) => ({ name: c.innerText.trim(), url: c.querySelector('a')?.href || '' }))
      .filter((c) => c.name)
    const flags = (cap?.querySelector('.image-flags')?.innerText || '').trim()
    return {
      url: a ? a.href : '',
      credit: credits.map((c) => c.name).join(', '),
      creditUrl: credits[0]?.url || '',
      caption: (cap?.querySelector('.image-description, .image-caption')?.innerText || '').trim(),
      spoiler: !!flags || !!li.querySelector('.image-nsfw, .thumb-nsfw, .nsfw, .image-warning')
    }
  }).filter((i) => /\\/file\\/[^/]+\\/images\\//.test(i.url))
  const next = document.querySelector('a[rel=next]') || [...document.querySelectorAll('.pagination a')].find((a) => /›|»|next/i.test(a.textContent))
  return { images, next: next ? next.href : '' }
})()`

/** Read a public character: its name, profile and every picture in its gallery (not downloaded yet). */
export async function readCharacter(parent: BrowserWindow, input: string, progress: (p: ToyhouseProgress) => void): Promise<ToyhouseCharacter> {
  const url = characterUrl(input)
  if (!url) throw new Error('That doesn’t look like a Toyhouse character link. It should look like https://toyhou.se/12345.name')
  if (busy) throw new Error('Another Toyhouse import is still running.')
  busy = true
  const w = new BrowserWindow({
    parent,
    show: false,
    width: 1000,
    height: 760,
    autoHideMenuBar: true,
    title: 'Toyhouse',
    webPreferences: { session: thSession(), sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  let closed = false
  w.on('closed', () => (closed = true))
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  // Toyhouse and its Cloudflare check only.
  w.webContents.on('will-navigate', (e, to) => {
    if (!/^https:\/\/([a-z0-9-]+\.)*(toyhou\.se|cloudflare\.com)\//i.test(to)) e.preventDefault()
  })
  try {
    progress({ stage: 'profile' })
    await open(w, url, '.profile-name-section', () => closed)
    const profile = (await w.webContents.executeJavaScript(READ_PROFILE)) as Omit<ToyhouseCharacter, 'url' | 'images'>
    const images: ToyhouseImage[] = []
    let next = url.replace(/\/?$/, '') + '/gallery'
    for (let page = 1; next && page <= MAX_PAGES; page++) {
      progress({ stage: 'gallery', page })
      await open(w, next, '.character-name', () => closed)
      const got = (await w.webContents.executeJavaScript(READ_GALLERY)) as { images: ToyhouseImage[]; next: string }
      for (const im of got.images) if (!images.some((x) => x.url === im.url)) images.push(im)
      next = got.next && got.next !== next ? got.next : ''
    }
    return { ...profile, url, images }
  } finally {
    busy = false
    if (!closed) w.destroy()
  }
}

/** A picture's type from its first bytes. */
export function pictureType(b: Buffer): string | null {
  if (b.length < 12) return null
  if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return 'png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.toString('ascii', 0, 3) === 'GIF') return 'gif'
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}

/** Download pictures (Toyhouse's own picture server only) into the wiki. Null for any that couldn't be fetched. */
export async function downloadImages(wikiId: string, urls: string[], progress: (p: ToyhouseProgress) => void): Promise<(string | null)[]> {
  const s = thSession()
  const out: (string | null)[] = []
  for (let i = 0; i < urls.length; i++) {
    progress({ stage: 'pictures', done: i, total: urls.length })
    const u = urls[i]
    if (!/^https:\/\/([a-z0-9-]+\.)*toyhou\.se\//i.test(u)) {
      out.push(null)
      continue
    }
    try {
      const res = await s.fetch(u)
      const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : null
      // Toyhouse labels pictures oddly ("PNG32"), so the file itself says what it is.
      const ext = buf ? (pictureType(buf) ?? extForMime(res.headers.get('content-type') ?? '')) : null
      out.push(ext && buf && buf.length <= MAX_IMAGE ? await storeImage(wikiId, buf, ext) : null)
    } catch {
      out.push(null)
    }
  }
  progress({ stage: 'pictures', done: urls.length, total: urls.length })
  return out
}
