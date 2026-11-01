import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session, shell } from 'electron'
import { readFile } from 'fs/promises'
import { extname, join } from 'path'
import { pathToFileURL } from 'url'
import * as store from './store'
import { registerAiIpc } from './ai'
import * as share from './share'
import type { Page, WikiMeta } from '../shared/types'
import * as updates from './updates'

// Images are served as stash://wiki/images/<file> from whichever wiki is open.
protocol.registerSchemesAsPrivileged([
  { scheme: 'stash', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
])

let win: BrowserWindow | null = null
let openWikiDir: string | null = null
const devUrl = process.env.ELECTRON_RENDERER_URL

// Test runs keep their own browser data too, so they never collide with an installed copy.
if (process.env.STASHWIKI_DATA_DIR) app.setPath('userData', join(process.env.STASHWIKI_DATA_DIR, 'electron'))

// One StashWiki at a time; double-clicking a .stashwiki file hands it to the running window.
const shareFileIn = (argv: string[]): string | null => argv.find((a) => /\.stashwiki$/i.test(a)) ?? null
let pendingShareFile = shareFileIn(process.argv)
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()
app.on('second-instance', (_e, argv) => {
  const file = shareFileIn(argv)
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
    if (file) win.webContents.send('open-share-file', file)
  }
})
// macOS delivers opened files this way.
app.on('open-file', (e, file) => {
  e.preventDefault()
  if (win) win.webContents.send('open-share-file', file)
  else pendingShareFile = file
})

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

const windowFile = (): string => join(store.dataRoot(), 'window.json')

async function createWindow(): Promise<void> {
  const state = await store.readJson<WindowState>(windowFile(), { width: 1280, height: 860, maximized: false })
  win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 760,
    minHeight: 520,
    title: 'StashWiki',
    backgroundColor: '#eef0f3',
    autoHideMenuBar: true,
    icon: app.isPackaged ? undefined : join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      spellcheck: true
    }
  })
  if (state.maximized) win.maximize()

  win.on('close', () => {
    if (!win) return
    const b = win.getNormalBounds()
    void store.writeJson(windowFile(), { ...b, maximized: win.isMaximized() })
  })

  // Never navigate the app window away; external links open in the default browser.
  win.webContents.on('will-navigate', (e, url) => {
    if (devUrl && url.startsWith(devUrl)) return
    e.preventDefault()
  })
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('context-menu', (_e, params) => {
    const items: Electron.MenuItemConstructorOptions[] = []
    for (const s of params.dictionarySuggestions.slice(0, 5)) {
      items.push({ label: s, click: () => win?.webContents.replaceMisspelling(s) })
    }
    if (params.misspelledWord) {
      items.push({
        label: 'Add to dictionary',
        click: () => win?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      })
    }
    if (items.length) items.push({ type: 'separator' })
    if (params.isEditable) items.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' })
    else if (params.selectionText) items.push({ role: 'copy' })
    // For writing custom CSS: see which classes and styles something has (works inside the looks preview too).
    if (items.length) items.push({ type: 'separator' })
    items.push({ label: 'Inspect element', click: () => win?.webContents.inspectElement(params.x, params.y) })
    Menu.buildFromTemplate(items).popup()
  })

  if (devUrl) await win.loadURL(devUrl)
  else await win.loadFile(join(__dirname, '../renderer/index.html'))
}

function registerIpc(): void {
  ipcMain.handle('library', () => store.readLibrary())
  ipcMain.handle('createWiki', (_e, name: string) => store.createWiki(name))
  ipcMain.handle('openWikiFolder', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Open a StashWiki folder',
      properties: ['openDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return null
    return store.addExistingWiki(res.filePaths[0])
  })
  ipcMain.handle('forgetWiki', (_e, id: string) => store.forgetWiki(id))
  ipcMain.handle('loadWiki', async (_e, id: string) => {
    const data = await store.loadWiki(id)
    openWikiDir = data.dir
    return data
  })
  ipcMain.handle('saveMeta', (_e, id: string, meta: WikiMeta) => store.saveMeta(id, meta))
  ipcMain.handle('savePage', (_e, id: string, page: Page, snapshot?: 'auto' | 'force' | 'none') => store.savePage(id, page, snapshot ?? 'auto'))
  ipcMain.handle('listHistory', (_e, id: string, pageId: string) => store.listHistory(id, pageId))
  ipcMain.handle('readHistory', (_e, id: string, pageId: string, at: number) => store.readHistory(id, pageId, at))
  ipcMain.handle('savePages', async (_e, id: string, pages: Page[]) => {
    for (const p of pages) await store.savePage(id, p, 'none')
  })
  ipcMain.handle('trashPage', (_e, id: string, pageId: string) => store.trashPage(id, pageId))
  ipcMain.handle('listTrash', (_e, id: string) => store.listTrash(id))
  ipcMain.handle('restorePage', (_e, id: string, pageId: string) => store.restorePage(id, pageId))
  ipcMain.handle('purgePage', (_e, id: string, pageId: string) => store.purgePage(id, pageId))

  ipcMain.handle('pickImages', async (_e, id: string, multiple: boolean) => {
    const res = await dialog.showOpenDialog(win!, {
      title: multiple ? 'Add images' : 'Choose an image',
      properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: [{ name: 'Images', extensions: store.IMAGE_EXTS }]
    })
    if (res.canceled) return []
    const out: string[] = []
    for (const p of res.filePaths) out.push(await store.storeImage(id, await readFile(p), extname(p).slice(1)))
    return out
  })
  ipcMain.handle('saveImageData', (_e, id: string, data: ArrayBuffer, mime: string) => {
    const ext = store.extForMime(mime)
    if (!ext) throw new Error('Unsupported image type: ' + mime)
    return store.storeImage(id, Buffer.from(data), ext)
  })
  // Pasted web content can reference online images; download them once so the wiki stays offline.
  ipcMain.handle('fetchImage', async (_e, id: string, url: string) => {
    if (!/^https?:\/\//i.test(url)) return null
    try {
      const res = await session.fromPartition('stash-fetch').fetch(url)
      if (!res.ok) return null
      const ext = store.extForMime(res.headers.get('content-type') ?? '')
      if (!ext) return null
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length > 40 * 1024 * 1024) return null
      return await store.storeImage(id, buf, ext)
    } catch {
      return null
    }
  })
  ipcMain.handle('revealWiki', async (_e, id: string) => {
    await shell.openPath(await store.wikiDir(id))
  })
  ipcMain.handle('exportShare', (_e, id: string) => share.exportShare(win!, id))
  ipcMain.handle('inspectShare', (_e, path?: string) => share.inspectShare(win!, path))
  ipcMain.handle('applyShare', (_e, token: string, mode: share.ImportMode) => share.applyShare(token, mode))
  ipcMain.handle('exportSite', (_e, id: string, files: Record<string, string>, images: string[], fonts?: string[]) =>
    share.exportSite(win!, id, files, images, fonts ?? [])
  )
  ipcMain.handle('takeShareFile', () => {
    const f = pendingShareFile
    pendingShareFile = null
    return f
  })
  // Only folders StashWiki itself just wrote can be opened this way.
  ipcMain.handle('showPath', async (_e, path: string) => {
    if (share.exportedPaths.has(path)) await shell.openPath(path)
  })
  ipcMain.handle('openInspector', (e) => e.sender.openDevTools({ mode: 'right' }))
  ipcMain.handle('openExternal', async (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) await shell.openExternal(url)
  })

  // Updates: only when asked (or when the person ticked "check when StashWiki starts").
  ipcMain.handle('updates:info', () => updates.info())
  ipcMain.handle('updates:setAuto', (_e, on: boolean) => updates.setAutoCheck(!!on))
  ipcMain.handle('updates:check', () => updates.check())
  ipcMain.handle('updates:install', async (e) => {
    try {
      await updates.install((p) => e.sender.send('updates:progress', p))
    } catch (err) {
      e.sender.send('updates:progress', { stage: 'error', message: String((err as Error).message ?? err) })
    }
  })
}

app.whenReady().then(async () => {
  if (!gotLock) return
  protocol.handle('stash', async (req) => {
    const url = new URL(req.url)
    const parts = decodeURIComponent(url.pathname).split('/').filter(Boolean)
    if (url.host !== 'wiki' || parts[0] !== 'images' || parts.length !== 2 || !openWikiDir) {
      return new Response('Not found', { status: 404 })
    }
    const file = store.imagePath(openWikiDir, parts[1])
    if (!file) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })

  // The app window itself never talks to the internet; only the dev server is allowed.
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (details, cb) => {
      const local = /^(https?|wss?):\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(details.url)
      cb({ cancel: !(devUrl && local) })
    }
  )
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false))

  // macOS needs an app menu for Quit and for copy/paste shortcuts to work.
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]))
  }

  registerIpc()
  if (__AI__) registerAiIpc()
  await createWindow()

  // A quiet check a little after start-up, only if the person turned that on.
  if ((await updates.info()).autoCheck) {
    setTimeout(() => {
      updates
        .check()
        .then((c) => c.newer && win?.webContents.send('updates:available', c))
        .catch(() => undefined)
    }, 8000)
  }
})

app.on('window-all-closed', () => app.quit())
