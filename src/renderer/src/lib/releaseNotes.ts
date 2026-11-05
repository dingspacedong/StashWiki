// What changed in each version, shown once after updating ("What's new"). Newest first. Built in, so it works offline.
// `ai` items are about the writing buddy: No-AI builds leave them out (`__AI__`), and `notesSince` skips them too.

export interface NoteItem {
  icon: string
  title: string
  text: string
  ai?: boolean
}

export interface ReleaseNote {
  version: string
  /** A few words for the whole release. */
  headline: string
  items: NoteItem[]
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '0.17.0',
    headline: 'Bring your characters over from Toyhouse',
    items: [
      {
        icon: '⇩',
        title: 'Import from Toyhouse',
        text: 'On the New page screen, paste a public character’s link. You get a page with its name, its gallery (with artist credits) and its profile text.'
      },
      // Left out of No-AI builds altogether (not just hidden).
      ...(__AI__
        ? [
            {
              icon: '✦',
              title: 'Or let the buddy sort it',
              text: 'Choose to have the writing buddy put the profile into the infobox and sections. You Apply what it suggests.',
              ai: true
            },
            {
              icon: '🔗',
              title: 'The buddy can read links',
              text: 'Tick “Read links in my messages” in the buddy, then paste a link in a message and it reads the page.',
              ai: true
            }
          ]
        : [])
    ]
  },
  {
    version: '0.16.0',
    headline: 'Link your wikis together',
    items: [
      {
        icon: '🔗',
        title: 'Links to your other wikis',
        text: 'Type [[Other wiki::Page]], or choose a wiki under “In” in the Page link menu. Clicking the link opens that wiki right at the page.'
      },
      {
        icon: '🧭',
        title: 'Sidebar links to other wikis',
        text: 'In Navigation, a sidebar link like “Other wiki::” opens that wiki’s main page. Add a page name after the :: to open a page.'
      },
      { icon: '🎉', title: 'What’s new, right here', text: 'After each update, this window shows what changed. It only appears once.' }
    ]
  },
  {
    version: '0.15.2',
    headline: 'Find on the page',
    items: [
      {
        icon: '🔍',
        title: 'Ctrl+F',
        text: 'Press Ctrl+F (⌘F on a Mac) to find text on whatever is showing, even in the editor. Enter jumps to the next match.'
      }
    ]
  },
  {
    version: '0.15.1',
    headline: 'A buddy that knows StashWiki',
    // Left out of No-AI builds altogether (not just hidden).
    items: __AI__
      ? [
          {
            icon: '🧪',
            title: 'Knows how StashWiki works (experimental)',
            text: 'Tick it in the writing buddy to let it suggest changes to categories, galleries, nav boxes, the sidebar and stories too.',
            ai: true
          },
          { icon: '🖼️', title: 'Pictures stay put', text: 'When the buddy rewrites a section, the pictures in it are kept.', ai: true }
        ]
      : []
  },
  {
    version: '0.15.0',
    headline: 'More control over categories',
    items: [
      { icon: '➕', title: 'Make and edit categories', text: 'The Categories page has “+ New category”. Hover one to add a subcategory, or to rename, move or remove it.' },
      { icon: '📂', title: 'Subcategories', text: 'Drag a category onto another to put it inside. A category’s page can also show its subcategories’ pages.' }
    ]
  },
  {
    version: '0.14.0',
    headline: 'Tidier category pages',
    items: [
      { icon: '📐', title: 'Same-shape cards', text: 'Every card on a category page is the same shape now. “Card pictures” chooses the shape and how pictures fit.' },
      { icon: '✥', title: 'Adjust any card', text: 'Hover a card and click ✥ to drag its picture into place, zoom in, or pick a picture just for cards.' }
    ]
  }
]

function newer(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  return false
}

/**
 * The notes to show after updating from `previous` to `current`: every version in between, newest first, at most
 * five. Without a previous version, just the newest one up to `current`.
 */
export function notesSince(previous: string | null, current: string, withAi: boolean): ReleaseNote[] {
  const upTo = RELEASE_NOTES.filter((r) => !newer(r.version, current))
    .map((r) => ({ ...r, items: r.items.filter((i) => withAi || !i.ai) }))
    .filter((r) => r.items.length)
  const out = previous ? upTo.filter((r) => newer(r.version, previous)) : upTo.slice(0, 1)
  return out.slice(0, 5)
}
