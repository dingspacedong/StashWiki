import type { FontKey, Page, Template, TemplateField, Theme, WikiMeta } from './types'
import { GOOGLE_FONTS } from './googleFonts'

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** Fonts to pick from: the computer's own, then Google fonts that ship inside the app (grouped by feel). */
export const FONTS: Record<FontKey, { label: string; stack: string; group: string }> = {
  system: { label: 'Clean sans', stack: '"Segoe UI", system-ui, -apple-system, sans-serif', group: 'Basic' },
  classic: { label: 'Classic wiki', stack: '"Linux Libertine", Georgia, "Times New Roman", serif', group: 'Basic' },
  serif: { label: 'Georgia', stack: 'Georgia, "Times New Roman", serif', group: 'Basic' },
  book: { label: 'Storybook', stack: '"Palatino Linotype", "Book Antiqua", Palatino, serif', group: 'Basic' },
  humanist: { label: 'Friendly', stack: '"Trebuchet MS", "Segoe UI", "Avenir Next", sans-serif', group: 'Basic' },
  verdana: { label: 'Verdana', stack: 'Verdana, Geneva, sans-serif', group: 'Basic' },
  hand: { label: 'Handwritten', stack: '"Segoe Print", "Chalkboard SE", "Comic Sans MS", cursive', group: 'Basic' },
  mono: { label: 'Typewriter', stack: 'Consolas, Menlo, "Courier New", monospace', group: 'Basic' },
  ...Object.fromEntries(GOOGLE_FONTS.map((f) => [f.key, { label: f.label, stack: f.stack, group: f.group }]))
}

/** @font-face rules for the bundled Google fonts (all of them, or just `keys`), with files under `base`. */
export function fontFaceCss(base: string, keys?: Iterable<string>): string {
  const want = keys ? new Set(keys) : null
  return GOOGLE_FONTS.filter((f) => !want || want.has(f.key))
    .flatMap((f) =>
      f.faces.map(
        (x) =>
          `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${x.weight};font-display:swap;src:url("${base}${x.file}") format("woff2")${x.range ? `;unicode-range:${x.range}` : ''}}`
      )
    )
    .join('\n')
}

/** The font files the given font keys need. */
export function fontFiles(keys: Iterable<string>): string[] {
  const want = new Set(keys)
  return GOOGLE_FONTS.filter((f) => want.has(f.key)).flatMap((f) => f.faces.map((x) => x.file))
}

export const THEME_PRESETS: { name: string; theme: Theme }[] = [
  {
    name: 'Classic',
    theme: {
      background: '#eef0f3', surface: '#ffffff', panel: '#f8f9fa', text: '#202122', muted: '#54595d',
      link: '#3366cc', redlink: '#d33636', accent: '#36598f', accentText: '#ffffff', border: '#c8ccd1',
      bodyFont: 'system', headingFont: 'classic', backgroundImage: ''
    }
  },
  {
    name: 'Midnight',
    theme: {
      background: '#14151c', surface: '#1e2029', panel: '#262935', text: '#e4e6ee', muted: '#9ba0b3',
      link: '#8ab4ff', redlink: '#ff7b72', accent: '#6b5bd6', accentText: '#ffffff', border: '#363a4a',
      bodyFont: 'system', headingFont: 'system', backgroundImage: ''
    }
  },
  {
    name: 'Parchment',
    theme: {
      background: '#e8dcc4', surface: '#fbf6ea', panel: '#f3ead6', text: '#3b2f22', muted: '#7a6650',
      link: '#8a4b14', redlink: '#b3261e', accent: '#6e4423', accentText: '#fbf6ea', border: '#d6c4a0',
      bodyFont: 'book', headingFont: 'book', backgroundImage: ''
    }
  },
  {
    name: 'Starlight',
    theme: {
      background: '#1b1030', surface: '#261842', panel: '#31205a', text: '#f1eaff', muted: '#b9a8dc',
      link: '#ffb3e6', redlink: '#ff8a80', accent: '#c2418f', accentText: '#ffffff', border: '#4a3378',
      bodyFont: 'humanist', headingFont: 'humanist', backgroundImage: ''
    }
  },
  {
    name: 'Meadow',
    theme: {
      background: '#dfeedd', surface: '#fbfdf9', panel: '#eef6ec', text: '#1f2d1d', muted: '#5b6e58',
      link: '#2f7a3a', redlink: '#c0392b', accent: '#3f7d4a', accentText: '#ffffff', border: '#c3d8bf',
      bodyFont: 'humanist', headingFont: 'serif', backgroundImage: ''
    }
  },
  {
    name: 'Bubblegum',
    theme: {
      background: '#fde4ef', surface: '#fffafd', panel: '#fdeef5', text: '#3d1f2e', muted: '#8a5d73',
      link: '#d6338a', redlink: '#c9302c', accent: '#e05a9d', accentText: '#ffffff', border: '#f5c2da',
      bodyFont: 'humanist', headingFont: 'hand', backgroundImage: ''
    }
  }
]

export const DEFAULT_THEME: Theme = THEME_PRESETS[0].theme

const f = (label: string, type: TemplateField['type'] = 'text'): TemplateField => ({ id: uid(), label, type })

export function defaultTemplates(): Template[] {
  return [
    {
      id: 'character', name: 'Character', headerColor: '#7b4fb8', headerText: '#ffffff',
      fields: [
        f('Image', 'image'), f('Biographical information', 'header'), f('Full name'), f('Also known as'),
        f('Species'), f('Age'), f('Pronouns'), f('Occupation'), f('Affiliation'),
        f('Relationships', 'header'), f('Family'), f('Friends'), f('Enemies'),
        f('Appearances', 'header'), f('First appearance'), f('Created by')
      ],
      sections: ['Appearance', 'Personality', 'Background', 'Abilities', 'Relationships', 'Trivia'],
      categories: ['Characters']
    },
    {
      id: 'location', name: 'Location', headerColor: '#2f7a62', headerText: '#ffffff',
      fields: [
        f('Image', 'image'), f('General information', 'header'), f('Type'), f('Region'),
        f('Ruler'), f('Inhabitants'), f('Notable residents'), f('First appearance')
      ],
      sections: ['Description', 'History', 'Notable places', 'Trivia'],
      categories: ['Locations']
    },
    {
      id: 'episode', name: 'Episode', headerColor: '#b8572f', headerText: '#ffffff',
      fields: [
        f('Image', 'image'), f('Episode information', 'header'), f('Series'), f('Season'),
        f('Episode number'), f('Air date'), f('Written by'),
        f('Episode guide', 'header'), f('Previous episode'), f('Next episode')
      ],
      sections: ['Synopsis', 'Plot', 'Characters', 'Trivia'],
      categories: ['Episodes']
    },
    {
      id: 'movie', name: 'Movie', headerColor: '#9c2f45', headerText: '#ffffff',
      fields: [
        f('Poster', 'image'), f('Film information', 'header'), f('Release date'), f('Runtime'),
        f('Directed by'), f('Starring'), f('Preceded by'), f('Followed by')
      ],
      sections: ['Synopsis', 'Plot', 'Cast', 'Production', 'Trivia'],
      categories: ['Movies']
    },
    {
      id: 'game', name: 'Game', headerColor: '#2f5f9c', headerText: '#ffffff',
      fields: [
        f('Cover art', 'image'), f('Game information', 'header'), f('Developer'), f('Platforms'),
        f('Release date'), f('Genre'), f('Modes')
      ],
      sections: ['Overview', 'Gameplay', 'Story', 'Characters', 'Trivia'],
      categories: ['Games']
    }
  ]
}

export function newPage(title: string, template: Template | null): Page {
  const now = Date.now()
  return {
    id: uid(),
    title,
    categories: template ? [...template.categories] : [],
    templateId: template ? template.id : null,
    infobox: {},
    // The empty paragraph before the first heading is the introduction (shown above the contents).
    body: template ? '<p></p>' + template.sections.map((s) => `<h2>${escapeHtml(s)}</h2><p></p>`).join('') : '<p></p>',
    galleries: [],
    theme: {},
    private: false,
    createdAt: now,
    updatedAt: now
  }
}

export function newWikiMeta(name: string): { meta: WikiMeta; mainPage: Page } {
  const mainPage = newPage('Main Page', null)
  mainPage.body =
    `<p>Welcome to <strong>${escapeHtml(name)}</strong>! This wiki lives only on your computer.</p>` +
    '<h2>Getting started</h2><ul>' +
    '<li><p>Click <strong>Edit</strong> above to change this page.</p></li>' +
    '<li><p>Use <strong>+ New page</strong> to make a character, location, episode or a blank page.</p></li>' +
    '<li><p>Link pages by typing <code>[[Page name]]</code> in the editor. Links to pages that don\'t exist yet show in red.</p></li>' +
    '<li><p>Change templates, colors and fonts from the sidebar.</p></li></ul>'
  const meta: WikiMeta = {
    id: uid(),
    name,
    tagline: `From ${name}`,
    logo: '',
    mainPageId: mainPage.id,
    theme: { ...DEFAULT_THEME },
    templates: defaultTemplates(),
    categories: {},
    createdAt: Date.now()
  }
  return { meta, mainPage }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
