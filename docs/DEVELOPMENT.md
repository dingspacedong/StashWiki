# How StashWiki is put together

Electron + [electron-vite](https://electron-vite.org) + React + TypeScript, with [zustand](https://github.com/pmndrs/zustand) for state,
[TipTap](https://tiptap.dev) (ProseMirror) for the editor and plain CSS driven by theme variables.

```
src/
  main/        Electron main process: files on disk, the window, sharing/export, updates, the AI buddy's network calls
  preload/     The small, typed bridge the window uses (window.stash)
  shared/      Types and helpers used on both sides (defaults, fonts, merging share files, AI settings)
  renderer/    The app window (React)
    src/views/       Screens: pages, editors, stories, settings, specials
    src/components/  Editor, infobox, looks picker, fancy blocks, galleries…
    src/simple/      The "Simple" editing style (type on the page as it looks)
    src/lib/         Rules without UI: links, fields, looks, stories, custom HTML, autosave…
    src/ai/          The writing buddy (only reached through ai/gate.ts)
    src/export/      Building the static website
    public/fonts/    Bundled fonts (made by `npm run fonts`)
tests/         Unit tests (vitest)
scripts/       Icons, fonts and the Mac packager
build/         App icons (made from build/icon-source.png by `npm run icon`)
```

## Where things are stored

Each wiki is a folder (by default `Documents/StashWiki/<name>`):

- `wiki.json`: name, theme, templates, category descriptions, custom CSS, settings
- `pages/<id>.json`: one file per page (stories and chapters are pages too, with `story` / `chapter` details)
- `images/`: pictures, named by a hash of their content
- `history/<page id>/`: earlier versions of each page
- `trash/`, `backups/`

Pictures reach the window as `stash://wiki/images/<file>`. The library of wikis, window state, the AI settings
(with the key encrypted by the system keychain) and update settings live in Electron's user-data folder.
`STASHWIKI_DATA_DIR=<folder>` moves all of that into one folder, which is handy for testing.

## Privacy rules in the code

- The window can't reach the internet: every web request from it is blocked in the main process, and the page's
  Content-Security-Policy allows only the app's own files.
- Only the main process goes online, and only when asked: the AI buddy (to the service the person chose) and
  update checks (to GitHub).
- Custom HTML is cleaned with DOMPurify: no scripts, frames, forms or `on…=` handlers.

## Pages and links

- Wiki links are stored as `<a data-wikilink="Title">`. Renaming a page rewrites links on every other page
  (`lib/wikitext.ts`), including links inside page cards, picture-tab captions and story character lists.
- `page.infoboxOverrides` keeps one page's own changes to its template's fields (`lib/fields.ts`), so later template
  edits still reach the page.
- Fancy blocks are stored as `<div data-html="…URL-encoded HTML…">`, page cards as `<div data-cards="…JSON…">`.

## Looks

Ready-made looks (`lib/looks.ts`) are CSS kept in the custom CSS between `/* ✦ look: group/id (Name) */` and
`/* ✦ end */` comments, so they can be swapped or removed, and edited like any other CSS. Custom CSS only applies
on reading screens (and while editing in the Simple style), never on the settings screens, and Ctrl/Cmd+, always
opens settings, so CSS that hides something can always be fixed.

## Stories

A story is a page with `story` details (summary, status, rating, warnings, tags, characters, series, cover and the
ordered list of chapter ids). A chapter is a page with `chapter` details, titled "Story: Chapter name". Rules are in
`lib/stories.ts`, changes that touch several pages in `lib/storyActions.ts`. Story and chapter editors save by
themselves (`lib/useAutosave.ts`).

## The writing buddy

Talks to any OpenAI-compatible `/chat/completions` endpoint from the main process (`main/ai.ts`). The model proposes
changes as fenced ` ```stashwiki ` JSON blocks (`ai/proposals.ts`), shown as cards with Apply / Dismiss / Undo.
Thinking text from reasoning models is removed (`stripThinking` in `shared/ai.ts`).

The rest of the app reaches the buddy only through `ai/gate.ts`. Builds with `STASHWIKI_AI=0` swap that file for
`noai/gate.ts`, so the No-AI versions contain none of the buddy's code.

## Updates

`main/updates.ts` asks GitHub for the latest release and, when the person chooses to update, downloads only the file
that copy needs: the Windows installer (run silently, then StashWiki reopens), the portable `.exe` (swapped in once
the app closes), or the Mac zip (unpacked, signed for that Mac with an ad-hoc signature, swapped in). Copies running
from a git checkout use `git pull`, `npm install` and `npm run build` instead.

Release files must keep these names so updates can find them:
`StashWiki-Setup-x.y.z.exe`, `StashWiki-Portable-x.y.z.exe`, `StashWiki-NoAI-Setup-x.y.z.exe`,
`StashWiki-NoAI-Portable-x.y.z.exe`, `StashWiki-x.y.z-mac-AppleSilicon.zip`, `StashWiki-x.y.z-mac-Intel.zip`,
in a GitHub release tagged `vx.y.z`.

## Mac builds

`scripts/pack-mac.mjs` turns the official Electron macOS zip into `StashWiki.app` from Windows, entirely in memory
(so the framework's symlinks survive): it renames the bundle, rewrites `Info.plist`, adds the icon, `app.asar` and
an `Open Me First.command` helper. The app isn't notarized (that needs a paid Apple Developer account), so the
install steps include a one-time `xattr` + ad-hoc `codesign`.

## Fonts

`npm run fonts` copies the chosen Google Fonts and OpenDyslexic from the `@fontsource` packages into
`src/renderer/public/fonts` and writes `src/shared/googleFonts.ts`. A website export copies only the fonts it uses.
