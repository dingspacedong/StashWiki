// Copies the Google Fonts StashWiki offers (from the @fontsource packages) into src/renderer/public/fonts and
// writes src/shared/googleFonts.ts describing them. The fonts ship inside the app, so nothing is ever fetched
// from Google, and an exported website gets its own copies. Run with `npm run fonts` after changing the list.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

// [id, label, group, fallback stack]
const LIST = [
  // Not from Google, but free for anyone to use and share (SIL Open Font License); listed with the basic fonts.
  ['opendyslexic', 'OpenDyslexic (easier to read with dyslexia)', 'Basic', 'sans-serif'],
  ['inter', 'Inter', 'Clean', 'sans-serif'],
  ['nunito', 'Nunito', 'Clean', 'sans-serif'],
  ['poppins', 'Poppins', 'Clean', 'sans-serif'],
  ['quicksand', 'Quicksand', 'Clean', 'sans-serif'],
  ['rubik', 'Rubik', 'Clean', 'sans-serif'],
  ['lexend', 'Lexend', 'Clean', 'sans-serif'],
  ['atkinson-hyperlegible', 'Atkinson Hyperlegible (easy to read)', 'Clean', 'sans-serif'],
  ['merriweather', 'Merriweather', 'Bookish', 'serif'],
  ['lora', 'Lora', 'Bookish', 'serif'],
  ['playfair-display', 'Playfair Display', 'Bookish', 'serif'],
  ['eb-garamond', 'EB Garamond', 'Bookish', 'serif'],
  ['cormorant-garamond', 'Cormorant Garamond', 'Bookish', 'serif'],
  ['libre-baskerville', 'Libre Baskerville', 'Bookish', 'serif'],
  ['crimson-pro', 'Crimson Pro', 'Bookish', 'serif'],
  ['cinzel', 'Cinzel', 'Fantasy & old world', 'serif'],
  ['cinzel-decorative', 'Cinzel Decorative', 'Fantasy & old world', 'serif'],
  ['im-fell-english', 'IM Fell English', 'Fantasy & old world', 'serif'],
  ['uncial-antiqua', 'Uncial Antiqua', 'Fantasy & old world', 'serif'],
  ['medievalsharp', 'MedievalSharp', 'Fantasy & old world', 'serif'],
  ['pirata-one', 'Pirata One', 'Fantasy & old world', 'serif'],
  ['almendra', 'Almendra', 'Fantasy & old world', 'serif'],
  ['caveat', 'Caveat', 'Handwritten', 'cursive'],
  ['patrick-hand', 'Patrick Hand', 'Handwritten', 'cursive'],
  ['kalam', 'Kalam', 'Handwritten', 'cursive'],
  ['indie-flower', 'Indie Flower', 'Handwritten', 'cursive'],
  ['dancing-script', 'Dancing Script', 'Handwritten', 'cursive'],
  ['pacifico', 'Pacifico', 'Handwritten', 'cursive'],
  ['shadows-into-light', 'Shadows Into Light', 'Handwritten', 'cursive'],
  ['amatic-sc', 'Amatic SC', 'Handwritten', 'cursive'],
  ['fredoka', 'Fredoka', 'Playful', 'sans-serif'],
  ['comfortaa', 'Comfortaa', 'Playful', 'sans-serif'],
  ['baloo-2', 'Baloo 2', 'Playful', 'sans-serif'],
  ['righteous', 'Righteous', 'Playful', 'sans-serif'],
  ['bangers', 'Bangers (comic)', 'Playful', 'sans-serif'],
  ['comic-neue', 'Comic Neue (like Comic Sans)', 'Playful', 'cursive'],
  ['comic-relief', 'Comic Relief (like Comic Sans)', 'Playful', 'cursive'],
  ['orbitron', 'Orbitron', 'Sci-fi & games', 'sans-serif'],
  ['audiowide', 'Audiowide', 'Sci-fi & games', 'sans-serif'],
  ['exo-2', 'Exo 2', 'Sci-fi & games', 'sans-serif'],
  ['press-start-2p', 'Press Start 2P (pixel)', 'Sci-fi & games', 'monospace'],
  ['silkscreen', 'Silkscreen (pixel)', 'Sci-fi & games', 'monospace'],
  ['vt323', 'VT323 (old terminal)', 'Sci-fi & games', 'monospace'],
  ['creepster', 'Creepster (spooky)', 'Spooky', 'cursive'],
  ['special-elite', 'Special Elite (old typewriter)', 'Spooky', 'monospace'],
  ['courier-prime', 'Courier Prime', 'Typewriter & code', 'monospace'],
  ['space-mono', 'Space Mono', 'Typewriter & code', 'monospace'],
  ['jetbrains-mono', 'JetBrains Mono', 'Typewriter & code', 'monospace']
]

const root = fileURLToPath(new URL('..', import.meta.url))
const out = join(root, 'src/renderer/public/fonts')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const fonts = []
const licenses = []
for (const [id, label, group, fallback] of LIST) {
  const pkg = join(root, 'node_modules/@fontsource', id)
  const meta = JSON.parse(readFileSync(join(pkg, 'metadata.json'), 'utf8'))
  const ranges = JSON.parse(readFileSync(join(pkg, 'unicode.json'), 'utf8'))
  // Regular and bold; fonts that only come in one weight use that one for both.
  const weights = [400, 700].map((w) => (meta.weights.includes(w) ? w : meta.weights.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a))))
  const faces = []
  for (const weight of [...new Set(weights)]) {
    for (const subset of ['latin', 'latin-ext']) {
      const file = `${id}-${subset}-${weight}-normal.woff2`
      if (!meta.subsets.includes(subset) || !existsSync(join(pkg, 'files', file))) continue
      copyFileSync(join(pkg, 'files', file), join(out, file))
      faces.push(ranges[subset] ? { weight, file, range: ranges[subset] } : { weight, file })
    }
  }
  if (!faces.length) throw new Error('No font files for ' + id)
  fonts.push({ key: 'g-' + id, label, group, family: meta.family, stack: `"${meta.family}", ${fallback}`, faces })
  licenses.push(`${meta.family}: ${meta.license.type} (${meta.license.url}). ${meta.license.attribution ?? ''}`.trim())
}

writeFileSync(
  join(out, 'LICENSES.txt'),
  'These fonts (from Google Fonts, plus OpenDyslexic) are free to use and share under the SIL Open Font\n' +
    'License 1.1 (https://openfontlicense.org) or the Apache License 2.0 as listed.\n\n' +
    licenses.join('\n') +
    '\n'
)
writeFileSync(
  join(root, 'src/shared/googleFonts.ts'),
  '// Made by scripts/fonts.mjs. Do not edit by hand.\n' +
    'export interface GoogleFontFace { weight: number; file: string; range?: string }\n' +
    'export interface GoogleFont { key: string; label: string; group: string; family: string; stack: string; faces: GoogleFontFace[] }\n' +
    `export const GOOGLE_FONTS: GoogleFont[] = ${JSON.stringify(fonts, null, 1)}\n`
)
console.log(`${fonts.length} fonts, ${fonts.reduce((n, f) => n + f.faces.length, 0)} files`)
