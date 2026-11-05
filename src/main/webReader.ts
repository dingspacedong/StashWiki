// Lets the writing buddy read a web page the person linked in a message (when they turned that on). The page opens
// in a hidden browser window with its own in-memory session (nothing is kept), and only its text is taken. If the page
// wants the person to click something first (a content warning, a Cloudflare check), the window is shown for them.
import { app, BrowserWindow, session, type Session } from 'electron'

const PARTITION = 'stash-web'
const MAX_TEXT = 15000

export interface WebPage {
  url: string
  title: string
  text: string
}

function webSession(): Session {
  const s = session.fromPartition(PARTITION)
  s.setUserAgent(app.userAgentFallback.replace(/\s(StashWiki|stashwiki|Electron)\/\S+/g, ''))
  s.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))
  s.removeAllListeners('will-download')
  s.on('will-download', (e) => e.preventDefault())
  return s
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const PROBE = `(() => {
  if (document.readyState !== 'complete') return 'wait'
  if (/just a moment|attention required|performing security verification/i.test(document.title + ' ' + (document.body?.innerText || '').slice(0, 400))) return 'blocked'
  const top = (document.body?.innerText || '').slice(0, 4000)
  if (/content warning/i.test(top) && document.querySelector('form button[type=submit], form input[type=submit]')) return 'blocked'
  return 'ready'
})()`

// The main writing of the page: Toyhouse profiles, then the usual main-content boxes, then the whole page.
const READ = `(() => {
  const el = document.querySelector('.profile-content-content, article, main, [role=main], #content, .content') || document.body
  const name = document.querySelector('.profile-name-info h1')?.innerText
  return { title: document.title, text: ((name ? name + '\\n\\n' : '') + (el?.innerText || '')).replace(/\\n{3,}/g, '\\n\\n').trim() }
})()`

let queue = Promise.resolve()

/** Read one page's text. One at a time, so two windows never wait on the person at once. */
export function readPage(parent: BrowserWindow | null, url: string): Promise<WebPage> {
  const run = queue.then(() => read(parent, url))
  queue = run.then(
    () => {},
    () => {}
  )
  return run
}

async function read(parent: BrowserWindow | null, url: string): Promise<WebPage> {
  if (!/^https?:\/\/[^\s]+$/i.test(url)) throw new Error('Only web links (http or https) can be read.')
  const w = new BrowserWindow({
    ...(parent ? { parent } : {}),
    show: false,
    width: 1000,
    height: 760,
    autoHideMenuBar: true,
    title: 'Reading a page for the writing buddy',
    webPreferences: { session: webSession(), sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  let closed = false
  w.on('closed', () => (closed = true))
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  // The page itself didn't load (no such site, offline…); -3 is only a redirect being replaced.
  let failed = ''
  w.webContents.on('did-fail-load', (_e, code, desc, _url, mainFrame) => {
    if (mainFrame && code !== -3) failed = desc
  })
  try {
    await w.loadURL(url).catch(() => {})
    const start = Date.now()
    let readyAt = 0
    for (;;) {
      if (closed) throw new Error('The window was closed before the page could be read.')
      if (failed) throw new Error(`the page didn’t open (${failed})`)
      const state = await w.webContents.executeJavaScript(PROBE).catch(() => 'wait')
      if (state === 'ready') {
        // Give pages that fill themselves in a moment to do so.
        if (!readyAt) readyAt = Date.now()
        if (Date.now() - readyAt > 1200) break
      } else readyAt = 0
      if (state === 'blocked' && !w.isVisible()) {
        w.setTitle('Click through here, and the writing buddy reads the page by itself')
        w.show()
        w.focus()
      }
      if (Date.now() - start > (w.isVisible() ? 3 * 60 * 1000 : 30 * 1000)) throw new Error('The page took too long to open.')
      await sleep(400)
    }
    const page = (await w.webContents.executeJavaScript(READ)) as { title: string; text: string }
    return { url: w.webContents.getURL() || url, title: page.title.trim(), text: page.text.slice(0, MAX_TEXT) }
  } finally {
    if (!closed) w.destroy()
  }
}
