// Updating StashWiki from GitHub, with one button. Nothing here runs unless the person asks (or ticks
// "check when StashWiki starts"): it then asks GitHub for the newest release, and if they choose to update,
// downloads only the file this copy needs and puts it in place:
//   Windows installer  → runs the new installer silently, which reopens StashWiki
//   Windows portable   → swaps the .exe once this one has closed, then opens it
//   Mac                → unpacks the new app, signs it for this Mac, swaps it in, then opens it
//   source checkout    → git pull, npm install, rebuild, restart
// Nothing about the person or their wikis is sent; GitHub sees an ordinary download.
import { app, BrowserWindow } from 'electron'
import https from 'https'
import { createWriteStream, existsSync } from 'fs'
import { access, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises'
import { constants } from 'fs'
import { dirname, join } from 'path'
import { execFile, spawn } from 'child_process'
import { tmpdir } from 'os'
import type { UpdateCheck, UpdateInfo, UpdateMode, UpdateProgress, WhatsNew } from '../shared/types'
import { dataRoot, readLibrary } from './store'

export const REPO = 'dingspacedong/StashWiki'
const RELEASES = `https://github.com/${REPO}/releases`

const prefsFile = (): string => join(app.getPath('userData'), 'updates.json')
let lastAsset: { name: string; url: string; size: number } | null = null

/** What kind of copy this is, which decides how it updates. */
function mode(): UpdateMode {
  // Not app.isPackaged: it only checks the program's name, and the Mac app keeps Electron's own name
  // ("Electron"), so it would look unpacked there. A copy run from the source code is started as
  // `electron .`, which is what process.defaultApp means.
  if (process.defaultApp) return existsSync(join(app.getAppPath(), '.git')) ? 'source' : 'manual'
  if (process.platform === 'win32') return process.env.PORTABLE_EXECUTABLE_FILE ? 'portable' : 'setup'
  if (process.platform === 'darwin') return 'mac'
  return 'manual'
}

/** The release file name this copy needs, e.g. "StashWiki-NoAI-Setup-1.2.0.exe". */
function assetPattern(m: UpdateMode): RegExp | null {
  const noai = __AI__ ? '' : 'NoAI-'
  if (m === 'setup') return new RegExp(`^StashWiki-${noai}Setup-[\\d.]+\\.exe$`)
  if (m === 'portable') return new RegExp(`^StashWiki-${noai}Portable-[\\d.]+\\.exe$`)
  if (m === 'mac') return new RegExp(`^StashWiki-[\\d.]+-mac-${process.arch === 'arm64' ? 'AppleSilicon' : 'Intel'}\\.zip$`)
  return null
}

function newerThan(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  }
  return false
}

function get(url: string, redirects = 6): Promise<import('http').IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'StashWiki-updater', Accept: 'application/vnd.github+json' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
        res.resume()
        resolve(get(new URL(res.headers.location, url).toString(), redirects - 1))
      } else if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(res.statusCode === 404 ? 'No releases found yet.' : `GitHub answered ${res.statusCode}.`))
      } else resolve(res)
    })
    req.setTimeout(30000, () => req.destroy(new Error('GitHub took too long to answer.')))
    req.on('error', (e) => reject(new Error(/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ENETUNREACH/.test(String(e)) ? 'Couldn’t reach GitHub. Are you online?' : String(e.message ?? e))))
  })
}

export async function info(): Promise<UpdateInfo> {
  let autoCheck = false
  try {
    autoCheck = !!JSON.parse(await readFile(prefsFile(), 'utf8')).autoCheck
  } catch {
    // never set
  }
  return { current: app.getVersion(), mode: mode(), autoCheck, releasesUrl: RELEASES }
}

/**
 * Whether to show "What's new": only the first time a newer version opens. The version is remembered as soon as it's
 * shown, so it never shows twice. A brand-new install remembers its version without showing anything; a copy from
 * before this was remembered counts as updated when it already has wikis.
 */
export async function whatsNew(): Promise<WhatsNew> {
  const file = join(dataRoot(), 'seen-version.json')
  const current = app.getVersion()
  let seen: string | null = null
  try {
    seen = String(JSON.parse(await readFile(file, 'utf8')).version ?? '') || null
  } catch {
    // never remembered
  }
  const updated = seen ? newerThan(current, seen) : (await readLibrary()).wikis.length > 0
  if (seen !== current) await writeFile(file, JSON.stringify({ version: current })).catch(() => {})
  return { show: updated, current, previous: seen }
}

export async function setAutoCheck(on: boolean): Promise<void> {
  await writeFile(prefsFile(), JSON.stringify({ autoCheck: on }))
}

export async function check(): Promise<UpdateCheck> {
  const res = await get(`https://api.github.com/repos/${REPO}/releases/latest`)
  let body = ''
  for await (const chunk of res) body += chunk
  const rel = JSON.parse(body) as { tag_name: string; body?: string; html_url: string; assets: { name: string; size: number; browser_download_url: string }[] }
  const latest = rel.tag_name.replace(/^v/i, '')
  const m = mode()
  const pattern = assetPattern(m)
  const asset = pattern ? rel.assets.find((a) => pattern.test(a.name)) : undefined
  lastAsset = asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size } : null
  return {
    current: app.getVersion(),
    latest,
    newer: newerThan(latest, app.getVersion()),
    notes: (rel.body ?? '').trim(),
    url: rel.html_url,
    asset: asset ? { name: asset.name, size: asset.size } : undefined,
    mode: m
  }
}

async function download(url: string, dest: string, size: number, progress: (p: UpdateProgress) => void): Promise<void> {
  const res = await get(url)
  const total = Number(res.headers['content-length']) || size || 0
  let got = 0
  let last = -1
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(dest)
    res.on('data', (chunk: Buffer) => {
      got += chunk.length
      const percent = total ? Math.floor((got / total) * 100) : 0
      if (percent !== last) {
        last = percent
        progress({ stage: 'download', percent, message: `Downloading… ${percent}%` })
      }
    })
    res.pipe(out)
    out.on('finish', () => resolve())
    out.on('error', reject)
    res.on('error', reject)
  })
}

const run = (cmd: string, args: string[], cwd?: string): Promise<string> =>
  new Promise((resolve, reject) =>
    execFile(cmd, args, { cwd, shell: process.platform === 'win32', maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) =>
      err ? reject(new Error((stderr || stdout || String(err)).trim().split('\n').slice(-4).join('\n'))) : resolve(stdout)
    )
  )

/** Close StashWiki so a helper can replace it (the helper waits for this process to end). */
function quitSoon(): void {
  setTimeout(() => {
    for (const w of BrowserWindow.getAllWindows()) w.destroy()
    app.quit()
  }, 600)
}

export async function install(progress: (p: UpdateProgress) => void): Promise<void> {
  const m = mode()
  const work = join(tmpdir(), `stashwiki-update-${Date.now()}`)

  if (m === 'source') {
    const dir = app.getAppPath()
    progress({ stage: 'install', message: 'Getting the newest version (git pull)…' })
    await run('git', ['pull', '--ff-only'], dir)
    progress({ stage: 'build', message: 'Installing what it needs (npm install)…' })
    await run('npm', ['install', '--no-audit', '--no-fund'], dir)
    progress({ stage: 'build', message: 'Building…' })
    await run('npm', ['run', 'build'], dir)
    progress({ stage: 'done', message: 'Restarting…' })
    app.relaunch()
    quitSoon()
    return
  }

  if (!lastAsset) throw new Error('Check for updates first.')
  await mkdir(work, { recursive: true })
  const file = join(work, lastAsset.name)
  await download(lastAsset.url, file, lastAsset.size, progress)

  if (m === 'setup') {
    progress({ stage: 'install', message: 'Installing… StashWiki will reopen by itself.' })
    // The installer runs on its own once StashWiki closes, then starts the new version. --updated tells it to
    // keep the existing shortcuts: without it, the old version's uninstaller deletes and recreates them,
    // which also unpins StashWiki from the taskbar.
    spawn(file, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore' }).unref()
    quitSoon()
    return
  }

  if (m === 'portable') {
    const target = process.env.PORTABLE_EXECUTABLE_FILE!
    const script = join(work, 'swap.cmd')
    await writeFile(
      script,
      [
        '@echo off',
        `set PID=${process.pid}`,
        ':wait',
        'tasklist /FI "PID eq %PID%" 2>nul | find "%PID%" >nul && (timeout /t 1 /nobreak >nul & goto wait)',
        'set /a TRIES=0',
        ':swap',
        `copy /Y "${file}" "${target}" >nul 2>&1 && goto open`,
        'set /a TRIES+=1',
        'if %TRIES% GEQ 30 goto open',
        'timeout /t 1 /nobreak >nul',
        'goto swap',
        ':open',
        `start "" "${target}"`
      ].join('\r\n')
    )
    progress({ stage: 'install', message: 'Swapping in the new version… StashWiki will reopen by itself.' })
    spawn('cmd.exe', ['/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
    quitSoon()
    return
  }

  if (m === 'mac') {
    // …/StashWiki.app/Contents/MacOS/Electron → …/StashWiki.app
    const bundle = process.execPath.slice(0, process.execPath.indexOf('.app/') + 4)
    try {
      await access(dirname(bundle), constants.W_OK)
    } catch {
      throw new Error(`StashWiki can’t replace itself in ${dirname(bundle)}. Download the new version from the releases page instead.`)
    }
    progress({ stage: 'install', message: 'Unpacking…' })
    const unpacked = join(work, 'new')
    await mkdir(unpacked)
    await run('/usr/bin/ditto', ['-x', '-k', file, unpacked])
    const name = (await readdir(unpacked)).find((n) => n.endsWith('.app'))
    if (!name) throw new Error('The download didn’t contain the app.')
    const fresh = join(unpacked, name)
    progress({ stage: 'install', message: 'Preparing it for this Mac…' })
    await run('/usr/bin/xattr', ['-cr', fresh]).catch(() => '')
    await run('/usr/bin/codesign', ['--force', '--deep', '--sign', '-', fresh])
    const script = join(work, 'swap.sh')
    await writeFile(
      script,
      [
        '#!/bin/sh',
        `while kill -0 ${process.pid} 2>/dev/null; do sleep 1; done`,
        `rm -rf "${bundle}" && mv "${fresh}" "${bundle}"`,
        `open "${bundle}"`,
        `rm -rf "${work}"`
      ].join('\n')
    )
    progress({ stage: 'install', message: 'Swapping in the new version… StashWiki will reopen by itself.' })
    spawn('/bin/sh', [script], { detached: true, stdio: 'ignore' }).unref()
    quitSoon()
    return
  }

  await rm(work, { recursive: true, force: true })
  throw new Error('This copy can’t update itself. Download the new version from the releases page.')
}
