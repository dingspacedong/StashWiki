// Makes the app icons from build/icon-source.png (the StashWiki logo on a white square):
// build/icon.png (Windows), build/icon.icns (macOS) and src/renderer/public/logo.png (shown in the app).
// The white around the outside becomes see-through; the white pages inside the logo stay white.
// Run: npm run icon
const { app, BrowserWindow, nativeImage } = require('electron')
const fs = require('fs')
const path = require('path')

const BUILD = path.join(__dirname, '../build')

/**
 * In a hidden window: clear the outer white (flood fill from the edges, un-blending the soft edge of the
 * outline from white), crop to the logo, and draw it at `size` px with `pad` (fraction of the size) of margin.
 */
async function render(source, size, pad) {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<html><body></body></html>'))
  const src = 'data:image/png;base64,' + source.toString('base64')
  const dataUrl = await win.webContents.executeJavaScript(`new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = img.width, h = img.height
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, w, h)
      const px = data.data
      const minC = (i) => Math.min(px[i], px[i + 1], px[i + 2])
      // 1. Outside: near-white pixels reachable from the border.
      const outside = new Uint8Array(w * h)
      const stack = []
      for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x)
      for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1)
      while (stack.length) {
        const p = stack.pop()
        if (outside[p] || minC(p * 4) < 235) continue
        outside[p] = 1
        const x = p % w, y = (p - x) / w
        if (x > 0) stack.push(p - 1)
        if (x < w - 1) stack.push(p + 1)
        if (y > 0) stack.push(p - w)
        if (y < h - 1) stack.push(p + w)
      }
      // 2. The soft edge next to the outside: work out how much of the pixel is outline and how much is white.
      const near = (p) => {
        const x = p % w, y = (p - x) / w
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && outside[yy * w + xx]) return true
        }
        return false
      }
      const INK = 60 // the darkest channel of the outline color
      for (let p = 0; p < w * h; p++) {
        const i = p * 4
        if (outside[p]) { px[i + 3] = 0; continue }
        if (!near(p)) continue
        const a = Math.min(1, Math.max(0, (255 - minC(i)) / (255 - INK)))
        if (a >= 1) continue
        for (let k = 0; k < 3; k++) px[i + k] = Math.max(0, Math.min(255, Math.round((px[i + k] - (1 - a) * 255) / Math.max(a, 0.01))))
        px[i + 3] = Math.round(a * 255)
      }
      ctx.putImageData(data, 0, 0)
      // 3. Crop to the logo and center it in a square with the margin.
      let x0 = w, y0 = h, x1 = 0, y1 = 0
      for (let p = 0; p < w * h; p++) if (px[p * 4 + 3] > 8) {
        const x = p % w, y = (p - x) / w
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1
      const out = document.createElement('canvas')
      out.width = out.height = ${size}
      const inner = ${size} * (1 - 2 * ${pad})
      const scale = inner / Math.max(bw, bh)
      const o = out.getContext('2d')
      o.imageSmoothingQuality = 'high'
      o.drawImage(c, x0, y0, bw, bh, (${size} - bw * scale) / 2, (${size} - bh * scale) / 2, bw * scale, bh * scale)
      resolve(out.toDataURL('image/png'))
    }
    img.src = ${JSON.stringify(src)}
  })`)
  win.destroy()
  return nativeImage.createFromDataURL(dataUrl)
}

// icns entries that hold PNG data, by pixel size.
const ICNS_TYPES = [
  ['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128], ['ic08', 256], ['ic09', 512], ['ic10', 1024],
  ['ic11', 32], ['ic12', 64], ['ic13', 256], ['ic14', 512]
]

function icns(pngBySize) {
  const chunks = ICNS_TYPES.map(([type, size]) => {
    const data = pngBySize[size]
    const head = Buffer.alloc(8)
    head.write(type, 0, 'ascii')
    head.writeUInt32BE(data.length + 8, 4)
    return Buffer.concat([head, data])
  })
  const body = Buffer.concat(chunks)
  const head = Buffer.alloc(8)
  head.write('icns', 0, 'ascii')
  head.writeUInt32BE(body.length + 8, 4)
  return Buffer.concat([head, body])
}

// Rendering opens and closes one window per size; don't quit in between.
app.on('window-all-closed', () => {})

app.whenReady().then(async () => {
  const source = fs.readFileSync(path.join(BUILD, 'icon-source.png'))
  fs.writeFileSync(path.join(BUILD, 'icon.png'), (await render(source, 512, 0.02)).toPNG())
  fs.writeFileSync(path.join(__dirname, '../src/renderer/public/logo.png'), (await render(source, 192, 0.02)).toPNG())
  // macOS icons sit inside a margin (about 10% each side) so they line up with other Dock icons.
  const big = await render(source, 1024, 0.09)
  const pngBySize = {}
  for (const size of [16, 32, 64, 128, 256, 512, 1024]) {
    pngBySize[size] = (size === 1024 ? big : big.resize({ width: size, height: size, quality: 'best' })).toPNG()
  }
  fs.writeFileSync(path.join(BUILD, 'icon.icns'), icns(pngBySize))
  fs.writeFileSync(path.join(BUILD, 'icon-mac-preview.png'), pngBySize[256])
  app.quit()
})
