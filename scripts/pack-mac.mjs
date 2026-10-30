// Builds macOS copies of StashWiki from Windows: StashWiki-<version>-mac-AppleSilicon.zip and -Intel.zip in dist/.
//
// electron-builder can only make Mac apps on a Mac, so this takes the official Electron download for macOS
// and rewrites it as StashWiki.app without ever unpacking it to disk (Windows would break the symlinks
// inside Electron.framework). The result is unsigned, so the zip also holds "Open Me First.command", which
// clears the download quarantine and signs the app locally (the readme gives the same as a Terminal line).
//
// Run: npm run dist:mac (builds first)
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { downloadArtifact } from '@electron/get'
import { createPackage } from '@electron/asar'
import yauzl from 'yauzl'
import yazl from 'yazl'

const require = createRequire(import.meta.url)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const electronVersion = require('electron/package.json').version
const DIST = path.join(ROOT, 'dist')
const STAGE = path.join(DIST, 'mac-stage')

const APP = 'StashWiki'
const ARCHES = [
  { arch: 'arm64', label: 'AppleSilicon' },
  { arch: 'x64', label: 'Intel' }
]

const S_IFMT = 0o170000
const S_IFLNK = 0o120000

// ---------- app.asar ----------

async function buildAsar() {
  fs.rmSync(STAGE, { recursive: true, force: true })
  const appDir = path.join(STAGE, 'app')
  fs.mkdirSync(appDir, { recursive: true })
  fs.cpSync(path.join(ROOT, 'out'), path.join(appDir, 'out'), { recursive: true })
  // Only what Electron needs at runtime; nothing about the machine it was built on.
  const runtimePkg = {
    name: pkg.name,
    productName: pkg.productName,
    version: pkg.version,
    description: pkg.description,
    author: pkg.author,
    main: pkg.main
  }
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(runtimePkg, null, 2))
  const asar = path.join(STAGE, 'app.asar')
  await createPackage(appDir, asar)
  return asar
}

// ---------- Info.plist ----------

function setPlistString(xml, key, value) {
  const re = new RegExp(`(<key>${key}</key>\\s*<string>)[^<]*(</string>)`)
  if (re.test(xml)) return xml.replace(re, `$1${value}$2`)
  const end = xml.lastIndexOf('</dict>')
  return xml.slice(0, end) + `\t<key>${key}</key>\n\t<string>${value}</string>\n` + xml.slice(end)
}

// Only names, ids and versions change. The executable keeps Electron's own name ("Electron") and the icon
// keeps its file name: this matches the packaging already proven to open on the user's Mac.
function rewritePlist(xml) {
  const values = {
    CFBundleDisplayName: APP,
    CFBundleName: APP,
    CFBundleIdentifier: 'app.stashwiki.desktop',
    CFBundleShortVersionString: pkg.version,
    CFBundleVersion: pkg.version,
    LSApplicationCategoryType: 'public.app-category.productivity',
    NSDocumentsFolderUsageDescription: 'StashWiki keeps your wikis in Documents/StashWiki.'
  }
  for (const [k, v] of Object.entries(values)) xml = setPlistString(xml, k, v)
  // Double-clicking a .stashwiki share file opens it in StashWiki.
  if (!xml.includes('<key>CFBundleDocumentTypes</key>')) {
    const end = xml.lastIndexOf('</dict>')
    xml =
      xml.slice(0, end) +
      '\t<key>CFBundleDocumentTypes</key>\n\t<array>\n\t\t<dict>\n' +
      '\t\t\t<key>CFBundleTypeExtensions</key>\n\t\t\t<array>\n\t\t\t\t<string>stashwiki</string>\n\t\t\t</array>\n' +
      '\t\t\t<key>CFBundleTypeName</key>\n\t\t\t<string>StashWiki file</string>\n' +
      '\t\t\t<key>CFBundleTypeRole</key>\n\t\t\t<string>Editor</string>\n' +
      '\t\t\t<key>LSHandlerRank</key>\n\t\t\t<string>Owner</string>\n' +
      '\t\t</dict>\n\t</array>\n' +
      xml.slice(end)
  }
  return xml
}

// Double-click helper shipped next to the app: installs it, clears the download quarantine and signs it locally.
const OPEN_ME_FIRST = `#!/bin/bash
# Run this ONCE (right-click it > Open the first time). It moves StashWiki into
# Applications, lets macOS trust it (it was built on Windows, so it has no
# Apple signature), and opens it.
cd "$(dirname "$0")"
APP="${APP}.app"
if [ -d "$APP" ]; then
  rm -rf "/Applications/$APP" 2>/dev/null
  if mv "$APP" /Applications/ 2>/dev/null; then DEST="/Applications/$APP"; else DEST="$PWD/$APP"; fi
else
  DEST="/Applications/$APP"
fi
echo "Setting up $DEST ..."
xattr -cr "$DEST"
codesign --force --deep --sign - "$DEST" 2>/dev/null
open "$DEST"
echo "Done. From now on open ${APP} from Applications (or Launchpad) like any app."
sleep 3
`

// ---------- zip rewriting ----------

function openZip(file) {
  return new Promise((resolve, reject) =>
    yauzl.open(file, { lazyEntries: true, autoClose: false }, (err, zip) => (err ? reject(err) : resolve(zip)))
  )
}

function readStream(zip, entry) {
  return new Promise((resolve, reject) => zip.openReadStream(entry, (err, s) => (err ? reject(err) : resolve(s))))
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const c of stream) chunks.push(c)
  return Buffer.concat(chunks)
}

/** Map a path inside Electron's zip to its place in ours; null drops it. */
function renamePath(name) {
  if (name === 'version') return null
  if (!name.startsWith('Electron.app/')) return name // license files
  const rest = name.slice('Electron.app/'.length)
  if (rest === 'Contents/Resources/default_app.asar') return null
  if (rest === 'Contents/Resources/electron.icns') return null // replaced with StashWiki's icon below
  return `${APP}.app/${rest}`
}

async function repack(sourceZip, outZip, asarPath, icnsPath) {
  const src = await openZip(sourceZip)
  const out = new yazl.ZipFile()
  const written = new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(outZip)
    out.outputStream.pipe(ws).on('close', resolve).on('error', reject)
  })
  const stats = { files: 0, symlinks: 0, dirs: 0 }

  await new Promise((resolve, reject) => {
    src.on('error', reject)
    src.on('end', resolve)
    src.on('entry', async (entry) => {
      try {
        const name = renamePath(entry.fileName)
        if (!name) return src.readEntry()
        const mode = (entry.externalFileAttributes >>> 16) & 0xffff
        const mtime = entry.getLastModDate()
        const opts = mode ? { mode, mtime } : { mtime }

        if (entry.fileName.endsWith('/')) {
          out.addEmptyDirectory(name, opts)
          stats.dirs++
        } else if ((mode & S_IFMT) === S_IFLNK) {
          // Symlink: the entry's data is the link target.
          out.addBuffer(await streamToBuffer(await readStream(src, entry)), name, { ...opts, compress: false })
          stats.symlinks++
        } else if (entry.fileName === 'Electron.app/Contents/Info.plist') {
          const xml = (await streamToBuffer(await readStream(src, entry))).toString('utf8')
          out.addBuffer(Buffer.from(rewritePlist(xml), 'utf8'), name, opts)
          stats.files++
        } else {
          // Stream straight through, one entry at a time, to keep memory low.
          const stream = await readStream(src, entry)
          const done = new Promise((r, j) => stream.on('end', r).on('error', j))
          out.addReadStream(stream, name, { ...opts, size: entry.uncompressedSize })
          await done
          stats.files++
        }
        src.readEntry()
      } catch (e) {
        reject(e)
      }
    })
    src.readEntry()
  })

  const res = `${APP}.app/Contents/Resources/`
  out.addFile(asarPath, res + 'app.asar', { mode: 0o100644 })
  out.addFile(icnsPath, res + 'electron.icns', { mode: 0o100644 })
  out.addBuffer(Buffer.from(OPEN_ME_FIRST, 'utf8'), 'Open Me First.command', { mode: 0o100755 })
  out.end()
  await written
  src.close()
  return stats
}

// ---------- main ----------

const only = process.argv[2]
const asar = await buildAsar()
const icns = path.join(ROOT, 'build', 'icon.icns')
if (!fs.existsSync(icns)) throw new Error('build/icon.icns is missing; run npm run icon')

for (const { arch, label } of ARCHES) {
  if (only && only !== arch) continue
  console.log(`• Electron ${electronVersion} for macOS ${arch}…`)
  const electronZip = await downloadArtifact({ version: electronVersion, platform: 'darwin', arch, artifactName: 'electron' })
  const outZip = path.join(DIST, `${APP}-${pkg.version}-mac-${label}.zip`)
  const stats = await repack(electronZip, outZip, asar, icns)
  const mb = (fs.statSync(outZip).size / 1024 / 1024).toFixed(1)
  console.log(`  ${path.basename(outZip)}  ${mb} MB  (${stats.files} files, ${stats.symlinks} symlinks, ${stats.dirs} folders)`)
}
fs.rmSync(STAGE, { recursive: true, force: true })
