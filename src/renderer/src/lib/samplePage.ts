// A made-up page with one of everything (infobox, contents, note boxes, page cards, a fancy block, a table,
// a gallery…), so looks can be tried out before a wiki has pages that use them all. Only ever shown in
// previews; it is never saved. Its pictures ship with the app (public/sample).
import type { Page, WikiMeta } from '@shared/types'
import { escapeHtml } from '@shared/defaults'
import { pageFields } from './fields'
import { ALL_BLOCKS, blockHtml } from './blockTemplates'
import { htmlBlockTag } from './customHtml'

export const SAMPLE_ID = 'sw-sample-page'
export const SAMPLE_TITLE = 'Sample page'
const PIC = { portrait: 'sw-sample-portrait.svg', landscape: 'sw-sample-landscape.svg', house: 'sw-sample-house.svg' }
const VALUES = [
  'Ash Emberly',
  'Ash, Little Spark',
  'Fox',
  'Seventeen',
  'they/them',
  'Lantern keeper',
  'The Night Watch',
  'Rowan (sister)',
  'Pip, Juno',
  'The Fog King'
]

const p = (html: string): string => `<p>${html}</p>`
const link = (title: string, text?: string): string => `<a data-wikilink="${escapeHtml(title)}">${escapeHtml(text ?? title)}</a>`
const callout = (kind: string, text: string): string => `<div class="callout" data-callout="${kind}">${p(text)}</div>`

export function samplePage(meta: WikiMeta): Page {
  const template =
    meta.templates.find((t) => t.id === 'character') ?? meta.templates.find((t) => t.fields.some((f) => f.type === 'image')) ?? meta.templates[0]
  const infobox: Record<string, string> = {}
  let n = 0
  for (const f of template ? pageFields(template, {}) : []) {
    if (f.type === 'image') {
      infobox[f.id] = PIC.portrait
      infobox[`${f.id}.caption`] = 'A picture with a caption'
    } else if (f.type === 'text') infobox[f.id] = VALUES[n++ % VALUES.length]
  }
  const banner = ALL_BLOCKS.find((b) => b.id === 'welcome')
  const cards = {
    groups: [
      {
        title: 'Page cards',
        cards: [
          { page: SAMPLE_TITLE, tag: 'You are here' },
          { page: 'Willowmere', image: PIC.landscape },
          { page: 'The Lighthouse', image: PIC.house }
        ]
      }
    ]
  }
  const body = [
    p(
      `This is the <strong>introduction</strong>, above the contents box. It can have <em>italics</em>, <strong>bold</strong>, ${link(SAMPLE_TITLE, 'links to pages')} and ${link('A page that doesn’t exist yet', 'red links')} to pages that don’t exist yet.`
    ),
    '<h2>A section</h2>',
    p(
      'A paragraph of ordinary writing, the kind most of a wiki is made of. Long enough to wrap onto a second line, so you can see the spacing between lines and how the text sits next to the infobox.'
    ),
    '<h3>A smaller heading</h3>',
    '<ul><li>A list</li><li>with a few</li><li>points in it</li></ul>',
    '<ol><li>And a numbered one</li><li>second</li></ol>',
    '<blockquote><p>A quote inside the page.</p></blockquote>',
    '<h2>Boxes</h2>',
    callout('note', 'A note box.'),
    callout('tip', 'A tip box.'),
    callout('warning', 'A warning box.'),
    callout('spoiler', 'A spoiler: hidden until it’s clicked.'),
    '<h2>Page cards</h2>',
    `<div data-cards="${escapeHtml(JSON.stringify(cards))}"></div>`,
    ...(banner ? ['<h2>A fancy block</h2>', htmlBlockTag(blockHtml(banner))] : []),
    '<h2>A table</h2>',
    '<table><tbody><tr><th>Name</th><th>Role</th></tr><tr><td>Ash</td><td>Lantern keeper</td></tr><tr><td>Rowan</td><td>Cartographer</td></tr></tbody></table>'
  ].join('\n')
  return {
    id: SAMPLE_ID,
    title: SAMPLE_TITLE,
    categories: ['Sample category'],
    templateId: template?.id ?? null,
    infobox,
    hatnotes: ['A sample with one of everything, for trying out looks. It isn’t part of your wiki.'],
    quote: { text: 'Every wiki starts with a single page.', by: 'Someone wise' },
    body,
    galleries: [
      {
        id: 'sample-gallery',
        title: 'Gallery',
        autoCollapse: false,
        images: [
          { id: 'g1', file: PIC.portrait, caption: 'A caption', source: '' },
          { id: 'g2', file: PIC.landscape, caption: 'Another caption', source: '' },
          { id: 'g3', file: PIC.house, caption: 'A third picture', source: '' }
        ]
      }
    ],
    theme: {},
    private: false,
    createdAt: 0,
    updatedAt: 0
  }
}

/** Sample pictures come from the app, not the wiki's images folder. */
export const sampleImagesUrl = (): string => new URL('sample/', document.baseURI).href
