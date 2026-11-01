import type { AiApi } from './ai'
import type { MergeSummary } from './merge'

// Data model shared by the main process and the renderer.
// A wiki lives in its own folder: wiki.json, pages/<id>.json, images/, trash/.

export type FieldType = 'text' | 'image' | 'header'

export interface TemplateField {
  id: string
  label: string
  type: FieldType
}

export interface Template {
  id: string
  name: string
  headerColor: string
  headerText: string
  fields: TemplateField[]
  /** Section headings a new page starts with. */
  sections: string[]
  /** Categories a new page is put in. */
  categories: string[]
}

/** A key of FONTS: a built-in font stack, or 'g-<id>' for a Google font that ships with the app. */
export type FontKey = string

export interface Theme {
  background: string
  surface: string
  panel: string
  text: string
  muted: string
  link: string
  redlink: string
  accent: string
  accentText: string
  border: string
  bodyFont: FontKey
  headingFont: FontKey
  /** Image file in the wiki's images folder, shown behind everything. */
  backgroundImage: string
  /** How the backdrop picture is laid out: stretched to fill, or repeated as tiles. */
  backgroundMode?: 'fill' | 'tile'
  /** Sidebar color ('' = none), how solid it is (0–100) and whether its edge fades out. */
  sidebarColor?: string
  sidebarOpacity?: string
  sidebarEdge?: 'hard' | 'soft'
  /** How big the sidebar and pages are drawn, in percent (100 = normal). Some fonts look small at the same size. */
  textSize?: string
}

/** Per-page color overrides; anything left out falls back to the wiki theme. */
export type PageTheme = Partial<Theme> & {
  infoboxHeader?: string
  infoboxHeaderText?: string
}

export interface GalleryImage {
  id: string
  file: string
  caption: string
  source: string
  /** Blurred until a reader clicks it. */
  spoiler?: boolean
}

export interface Gallery {
  id: string
  title: string
  /** Collapse to a single row when the page is opened. */
  autoCollapse: boolean
  /** The whole gallery stays covered until a reader clicks it. */
  spoiler?: boolean
  images: GalleryImage[]
}

/**
 * One page's changes to its template's infobox. Kept as changes (not a copy) so fields added to the
 * template later still show up on the page.
 */
export interface InfoboxOverrides {
  /** Renamed labels, by field id. */
  labels?: Record<string, string>
  /** Template fields taken off this page. */
  hidden?: string[]
  /** Fields only this page has. */
  extra?: TemplateField[]
  /** This page's field order (field ids). */
  order?: string[]
}

export interface Page {
  id: string
  title: string
  categories: string[]
  templateId: string | null
  /** Infobox values by field id. Image fields also use `<fieldId>.caption`. */
  infobox: Record<string, string>
  infoboxOverrides?: InfoboxOverrides
  /** Short italic lines at the very top, e.g. “For the 2022 game, see [[…]].” */
  hatnotes?: string[]
  /** An optional opening quote, shown above the introduction. */
  quote?: { text: string; by: string }
  /** Rich text body as HTML produced by the editor. */
  body: string
  galleries: Gallery[]
  theme: PageTheme
  /** Extra CSS for just this page. */
  customCss?: string
  /** Set on a story's main page (its details and the order of its chapters). */
  story?: StoryInfo
  /** Set on a chapter: which story it belongs to, and its own name and notes. */
  chapter?: ChapterInfo
  /** Left out of the (future) website export. */
  private: boolean
  createdAt: number
  updatedAt: number
}

export type StoryStatus = 'wip' | 'complete' | 'hiatus'
export type StoryRating = '' | 'general' | 'teen' | 'mature' | 'explicit'

export interface StoryInfo {
  summary: string
  status: StoryStatus
  rating: StoryRating
  warnings: string[]
  tags: string[]
  /** Wiki page titles of the characters in it. */
  characters: string[]
  /** Chapter page ids in reading order. */
  chapters: string[]
  /** Stories with the same series name are shown together, ordered by part. */
  series?: string
  seriesPart?: number
  /** Cover picture (a file in the wiki's images folder). */
  cover?: string
}

export interface ChapterInfo {
  storyId: string
  /** The chapter's own name, e.g. "The Storm" (the page title is "Story: The Storm"). */
  name: string
  /** A short summary: shown in the chapter list and given to the writing buddy. */
  summary?: string
  /** Author's notes shown above and below the chapter. */
  notesBefore?: string
  notesAfter?: string
}

export interface CategoryInfo {
  description: string
}

export interface WikiMeta {
  id: string
  name: string
  tagline: string
  logo: string
  mainPageId: string | null
  theme: Theme
  templates: Template[]
  categories: Record<string, CategoryInfo>
  createdAt: number
  /** Last time the wiki's own settings or templates changed (used when merging shared copies). */
  updatedAt?: number
  /** Extra CSS for the whole wiki (app reading view and exported website). */
  customCss?: string
  /** Keeps the custom CSS but stops using it (a way back if it hides something important). */
  customCssOff?: boolean
  /** Stories switched off for this wiki: hidden everywhere, but nothing is deleted. */
  storiesOff?: boolean
  /** What "Export website" includes: the wiki and its stories (default), just the wiki, or just the stories. */
  siteContent?: 'all' | 'wiki' | 'stories'
  /** More logos besides `logo`, for switching between them (see `mix`). */
  extraLogos?: string[]
  /** Just for fun: switch between logos and/or color themes now and then. */
  mix?: MixSettings
  /** The wiki's own sidebar sections (a header with links), shown below Navigation. */
  sidebar?: NavSection[]
  /** Nav boxes: defined once, shown on many pages, so changing one changes it everywhere. */
  navboxes?: Navbox[]
  /** Fancy blocks saved for reuse ("My blocks" among the ready-made ones). */
  myBlocks?: MyBlock[]
}

export interface NavLink {
  id: string
  /** Shown text; empty uses the target's name. */
  label: string
  /** A page title, "Category:Name", or a web address. */
  target: string
  /** For a category: list its pages under it as well. */
  listPages?: boolean
  children?: NavLink[]
}

export interface NavSection {
  id: string
  title: string
  links: NavLink[]
}

export interface Navbox {
  id: string
  title: string
  groups: NavboxRow[]
  /** Shown by itself at the bottom of every page in these categories. */
  showOn?: string[]
}

export interface NavboxRow {
  id: string
  label: string
  /** Page titles picked by hand. */
  pages: string[]
  /** Also every page in this category (kept up to date by itself). */
  category?: string
}

export interface MyBlock {
  id: string
  name: string
  html: string
}

export interface MixSettings {
  /** Switch between `logo` and `extraLogos`. */
  logos?: boolean
  /** Color-theme looks to switch between ('mine' = the wiki's own colors). Needs two or more. */
  themes?: string[]
  /** When to switch in the app (an exported website switches on every page it opens). */
  when?: 'open' | 'page' | 'save'
}

export interface WikiData {
  meta: WikiMeta
  pages: Page[]
  dir: string
}

export interface LibraryEntry {
  id: string
  name: string
  dir: string
  lastOpened: number
}

export interface Library {
  wikis: LibraryEntry[]
  lastWikiId: string | null
}

export interface TrashedPage {
  page: Page
  deletedAt: number
}

export interface StashApi {
  library(): Promise<Library>
  createWiki(name: string): Promise<LibraryEntry>
  openWikiFolder(): Promise<LibraryEntry | null>
  forgetWiki(wikiId: string): Promise<void>
  loadWiki(wikiId: string): Promise<WikiData>
  saveMeta(wikiId: string, meta: WikiMeta): Promise<void>
  /** `snapshot: 'force'` always keeps the replaced version in the page history. */
  savePage(wikiId: string, page: Page, snapshot?: 'auto' | 'force' | 'none'): Promise<void>
  listHistory(wikiId: string, pageId: string): Promise<HistoryEntry[]>
  readHistory(wikiId: string, pageId: string, at: number): Promise<Page>
  savePages(wikiId: string, pages: Page[]): Promise<void>
  trashPage(wikiId: string, pageId: string): Promise<void>
  listTrash(wikiId: string): Promise<TrashedPage[]>
  restorePage(wikiId: string, pageId: string): Promise<Page>
  purgePage(wikiId: string, pageId: string): Promise<void>
  pickImages(wikiId: string, multiple: boolean): Promise<string[]>
  saveImageData(wikiId: string, data: ArrayBuffer, mime: string): Promise<string>
  fetchImage(wikiId: string, url: string): Promise<string | null>
  revealWiki(wikiId: string): Promise<void>
  openExternal(url: string): Promise<void>
  /** Opens the inspector (Chromium's developer tools) for looking at the page's HTML and CSS. */
  openInspector(): Promise<void>
  exportShare(wikiId: string): Promise<string | null>
  inspectShare(path?: string): Promise<ShareInfo | null>
  applyShare(token: string, mode: ImportMode): Promise<ImportResult>
  exportSite(wikiId: string, files: Record<string, string>, images: string[], fonts?: string[]): Promise<string | null>
  updates: UpdatesApi
  /** A .stashwiki file the app was opened with (double-click), once. */
  takeShareFile(): Promise<string | null>
  onShareFile(cb: (path: string) => void): () => void
  showPath(path: string): Promise<void>
  /** Missing in the no-AI build. */
  ai?: AiApi
}

export interface HistoryEntry {
  /** When this version was set aside. */
  at: number
  title: string
  updatedAt: number
  size: number
}

export interface ShareInfo {
  token: string
  name: string
  pages: number
  images: number
  exportedAt: number | null
  /** Your copy of the same wiki, if you have one. */
  existing: { id: string; name: string } | null
}

export type ImportMode = 'new' | 'copy' | 'merge' | 'replace'

export interface ImportResult {
  entry: LibraryEntry
  summary?: MergeSummary
  backup?: string
}

// ---------- updates ----------
export type UpdateMode = 'setup' | 'portable' | 'mac' | 'source' | 'manual'
export interface UpdateInfo {
  current: string
  mode: UpdateMode
  autoCheck: boolean
  releasesUrl: string
}
export interface UpdateCheck {
  current: string
  latest: string
  newer: boolean
  notes: string
  url: string
  asset?: { name: string; size: number }
  mode: UpdateMode
}
export interface UpdateProgress {
  stage: 'download' | 'install' | 'build' | 'done' | 'error'
  percent?: number
  message: string
}
export interface UpdatesApi {
  info(): Promise<UpdateInfo>
  setAutoCheck(on: boolean): Promise<void>
  check(): Promise<UpdateCheck>
  install(): Promise<void>
  onProgress(cb: (p: UpdateProgress) => void): () => void
  onAvailable(cb: (c: UpdateCheck) => void): () => void
}
