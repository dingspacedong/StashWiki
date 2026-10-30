import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Locked-down content policy for the built app: nothing loads from the internet.
// Left out of dev because the dev server injects inline scripts.
const csp: Plugin = {
  name: 'stashwiki-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' stash: data: blob:; connect-src 'self'; font-src 'self' file: data:; object-src 'none'; base-uri 'none'" />`
    )
}

// STASHWIKI_AI=0 builds a version with the AI writing buddy left out entirely.
const AI = JSON.stringify(process.env.STASHWIKI_AI !== '0')

export default defineConfig({
  main: {
    define: { __AI__: AI },
    build: { externalizeDeps: true }
  },
  preload: {
    define: { __AI__: AI },
    build: { externalizeDeps: true }
  },
  renderer: {
    resolve: {
      alias: [
        { find: '@shared', replacement: resolve('src/shared') },
        // The no-AI build gets empty stand-ins instead of the writing buddy, so none of its code is included.
        ...(AI === 'false' ? [{ find: /^(\.\.?\/)+ai\/gate$/, replacement: resolve('src/renderer/src/noai/gate.ts') }] : [])
      ]
    },
    define: { __AI__: AI },
    plugins: [react(), csp]
  }
})
