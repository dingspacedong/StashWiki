// Ready-made looks: bits of CSS anyone can switch on with a click. Each one sits in the custom CSS between
// marker comments, so it can be found again, swapped for another in the same group, or removed — and people
// who know CSS can still edit it like any other CSS. Colors come from the wiki's theme (var(--accent) …),
// so every look matches whatever colors the wiki already has. Moving effects respect "reduce motion".

export interface Look {
  id: string
  name: string
  hint: string
  css: string
}
export interface LookGroup {
  id: string
  title: string
  /** 'one': picking a look replaces the group's other look. 'any': mix and match. */
  pick: 'one' | 'any'
  looks: Look[]
}
export interface LookSection {
  id: string
  title: string
  icon: string
  groups: LookGroup[]
}

/** Wraps animations so they only play for people who haven't asked their computer to reduce motion. */
const moving = (css: string): string => `@media (prefers-reduced-motion: no-preference) {\n${css}\n}`
const LINKS = '.sidebar .nav-link, .sidebar a'

export const LOOK_SECTIONS: LookSection[] = [
  {
    id: 'infobox',
    title: 'Infobox',
    icon: '▤',
    groups: [
      {
        id: 'infobox-shape',
        title: 'Shape',
        pick: 'one',
        looks: [
          { id: 'rounded', name: 'Rounded corners', hint: 'Soft, round corners', css: '.infobox { border-radius: 16px; }' },
          { id: 'square', name: 'Sharp & square', hint: 'No rounding at all', css: '.infobox, .infobox .ib-image img { border-radius: 0; }' },
          {
            id: 'shadow',
            name: 'Floating shadow',
            hint: 'Lifted off the page',
            css: '.infobox { border-color: transparent; border-radius: 12px; box-shadow: 0 8px 22px rgb(0 0 0 / 0.2); }'
          },
          {
            id: 'glow',
            name: 'Glowing outline',
            hint: 'A soft glow in the infobox color',
            css: '.infobox { border: 2px solid var(--ib-head, var(--accent)); border-radius: 12px; box-shadow: 0 0 16px color-mix(in srgb, var(--ib-head, var(--accent)) 55%, transparent); }'
          },
          {
            id: 'double',
            name: 'Classic double border',
            hint: 'Old-fashioned wiki style',
            css: '.infobox { border: 4px double var(--border); border-radius: 3px; }'
          },
          {
            id: 'sticker',
            name: 'Sticker',
            hint: 'Thick outline and a hard shadow',
            css: '.infobox { border: 3px solid var(--text); border-radius: 10px; box-shadow: 6px 6px 0 var(--text); }'
          }
        ]
      },
      {
        id: 'infobox-title',
        title: 'Title bar',
        pick: 'one',
        looks: [
          {
            id: 'gradient',
            name: 'Gradient',
            hint: 'Fades from dark to light',
            css: '.ib-title { background: linear-gradient(135deg, var(--ib-head), color-mix(in srgb, var(--ib-head) 50%, white)); }'
          },
          { id: 'big', name: 'Big title', hint: 'Larger name at the top', css: '.ib-title { font-size: 24px; padding: 14px 10px; }' },
          {
            id: 'stripes',
            name: 'Stripes',
            hint: 'Diagonal candy stripes',
            css: '.ib-title { background: repeating-linear-gradient(45deg, var(--ib-head) 0 12px, color-mix(in srgb, var(--ib-head) 78%, white) 12px 24px); text-shadow: 0 1px 3px rgb(0 0 0 / 0.4); }'
          },
          {
            id: 'plain',
            name: 'Plain with a line',
            hint: 'No color block, just a line under the name',
            css: '.ib-title { background: none; color: var(--text); border-bottom: 3px solid var(--ib-head); }'
          },
          {
            id: 'caps',
            name: 'Spaced capitals',
            hint: 'TITLE IN CAPITALS',
            css: '.ib-title { text-transform: uppercase; letter-spacing: 0.14em; font-size: 15px; }'
          }
        ]
      },
      {
        id: 'infobox-size',
        title: 'Width',
        pick: 'one',
        looks: [
          { id: 'narrow', name: 'Narrower', hint: 'More room for writing', css: '.infobox { width: 250px; }' },
          { id: 'wide', name: 'Wider', hint: 'More room for the details', css: '.infobox { width: 340px; }' }
        ]
      },
      {
        id: 'infobox-details',
        title: 'Details',
        pick: 'any',
        looks: [
          {
            id: 'zebra',
            name: 'Striped rows',
            hint: 'Every other row tinted',
            css: '.ib-row:nth-of-type(even) { background: color-mix(in srgb, var(--ib-head, var(--accent)) 9%, transparent); }'
          },
          { id: 'no-lines', name: 'No lines between rows', hint: 'Cleaner look', css: '.ib-row { border-top: 0; }' },
          {
            id: 'labels',
            name: 'Colored labels',
            hint: 'Field names in the infobox color',
            css: '.ib-label { color: var(--ib-head, var(--accent)); }'
          },
          {
            id: 'pill-headers',
            name: 'Pill section headers',
            hint: 'Rounded headers inside the infobox',
            css: '.ib-header { border-radius: 999px; margin: 6px 8px; }'
          },
          {
            id: 'round-picture',
            name: 'Round picture',
            hint: 'Main picture in a circle',
            css: '.ib-image img { border-radius: 50%; aspect-ratio: 1; object-fit: cover; max-width: 230px; }'
          }
        ]
      }
    ]
  },
  {
    id: 'headings',
    title: 'Headings',
    icon: 'H',
    groups: [
      {
        id: 'headings-style',
        title: 'Section headings',
        pick: 'one',
        looks: [
          {
            id: 'accent-line',
            name: 'Colored underline',
            hint: 'Thick line in the accent color',
            css: '.prose h2 { border-bottom: 3px solid var(--accent); }'
          },
          {
            id: 'side-bar',
            name: 'Side bar',
            hint: 'A colored bar on the left',
            css: '.prose h2 { border-bottom: 0; border-left: 6px solid var(--accent); padding: 2px 0 2px 12px; }'
          },
          {
            id: 'banner',
            name: 'Banner',
            hint: 'Heading on a colored strip',
            css: '.prose h2 { border-bottom: 0; background: var(--accent); color: var(--accent-text); padding: 6px 14px; border-radius: 8px; }'
          },
          {
            id: 'ornament',
            name: 'Centered with ornaments',
            hint: '❦ Fancy, like a storybook ❦',
            css: '.prose h2 { border-bottom: 0; text-align: center; }\n.prose h2::before { content: "❦ "; color: var(--accent); }\n.prose h2::after { content: " ❦"; color: var(--accent); }'
          },
          {
            id: 'fade',
            name: 'Fading line',
            hint: 'A line that fades out to the right',
            css: '.prose h2 { border-bottom: 0; padding-bottom: 6px; background: linear-gradient(to right, var(--accent), transparent) bottom / 100% 3px no-repeat; }'
          },
          { id: 'dotted', name: 'Dotted line', hint: 'Dotted underline', css: '.prose h2 { border-bottom: 2px dotted var(--accent); }' },
          {
            id: 'small-caps',
            name: 'Small capitals',
            hint: 'Elegant small capitals',
            css: '.prose h2 { font-variant: small-caps; letter-spacing: 0.08em; }'
          }
        ]
      },
      {
        id: 'subheadings',
        title: 'Smaller headings',
        pick: 'one',
        looks: [
          { id: 'accent', name: 'In the accent color', hint: '', css: '.prose h3 { color: var(--accent); }' },
          { id: 'arrow', name: 'With an arrow', hint: '▸ Like this', css: '.prose h3::before { content: "▸ "; color: var(--accent); }' },
          {
            id: 'underline',
            name: 'Underlined',
            hint: '',
            css: '.prose h3 { text-decoration: underline 2px var(--accent); text-underline-offset: 4px; }'
          }
        ]
      }
    ]
  },
  {
    id: 'title',
    title: 'Page title',
    icon: 'T',
    groups: [
      {
        id: 'title-style',
        title: 'Page name',
        pick: 'one',
        looks: [
          { id: 'big', name: 'Big & bold', hint: '', css: '.page-title { font-size: 40px; font-weight: 700; }' },
          {
            id: 'gradient',
            name: 'Gradient letters',
            hint: 'Letters fade between two colors',
            css: '.page-title { background: linear-gradient(90deg, var(--accent), var(--link)); -webkit-background-clip: text; background-clip: text; color: transparent; }'
          },
          {
            id: 'glow',
            name: 'Glowing',
            hint: 'A soft glow around the letters',
            css: '.page-title { text-shadow: 0 0 12px color-mix(in srgb, var(--accent) 75%, transparent); }'
          },
          {
            id: 'outline',
            name: 'Shadowed',
            hint: 'A colored shadow behind the letters',
            css: '.page-title { text-shadow: 3px 3px 0 color-mix(in srgb, var(--accent) 45%, transparent); }'
          }
        ]
      },
      {
        id: 'title-extras',
        title: 'Extras',
        pick: 'any',
        looks: [
          { id: 'center', name: 'Centered', hint: '', css: '.page-title { text-align: center; }' },
          { id: 'no-line', name: 'No line underneath', hint: '', css: '.page-title { border-bottom: 0; }' },
          { id: 'caps', name: 'Capitals', hint: '', css: '.page-title { text-transform: uppercase; letter-spacing: 0.08em; }' }
        ]
      }
    ]
  },
  {
    id: 'links',
    title: 'Links',
    icon: '🔗',
    groups: [
      {
        id: 'links-style',
        title: 'Links in the writing',
        pick: 'one',
        looks: [
          { id: 'underline', name: 'Always underlined', hint: '', css: '.prose a { text-decoration: underline; text-underline-offset: 3px; }' },
          { id: 'dotted', name: 'Dotted underline', hint: '', css: '.prose a { text-decoration: underline dotted; text-underline-offset: 3px; }' },
          { id: 'bold', name: 'Bold', hint: '', css: '.prose a { font-weight: 600; }' },
          {
            id: 'highlight',
            name: 'Highlight on hover',
            hint: 'A soft highlight under the mouse',
            css: '.prose a:hover { background: color-mix(in srgb, var(--link) 16%, transparent); border-radius: 3px; text-decoration: none; }'
          },
          {
            id: 'wavy',
            name: 'Wavy on hover',
            hint: 'A wavy underline under the mouse',
            css: '.prose a:hover { text-decoration: underline wavy; text-underline-offset: 3px; }'
          }
        ]
      },
      {
        id: 'links-extras',
        title: 'Extras',
        pick: 'any',
        looks: [
          {
            id: 'sparkle',
            name: 'Sparkle on hover',
            hint: 'A ✦ appears next to page links',
            css: '.prose a.wikilink:hover::after { content: " ✦"; color: var(--accent); }'
          },
          {
            id: 'red-dashed',
            name: 'Dashed missing links',
            hint: 'Pages not written yet look unfinished',
            css: '.prose a.new { text-decoration: underline dashed; }'
          }
        ]
      }
    ]
  },
  {
    id: 'page',
    title: 'Page & background',
    icon: '▢',
    groups: [
      {
        id: 'card',
        title: 'The page card',
        pick: 'one',
        looks: [
          {
            id: 'rounded',
            name: 'Rounded with a shadow',
            hint: '',
            css: '.content-card { border: 0; border-radius: 18px; box-shadow: 0 8px 30px rgb(0 0 0 / 0.14); }'
          },
          {
            id: 'glass',
            name: 'Frosted glass',
            hint: 'See-through, blurring the background picture',
            css: '.content-card { background: color-mix(in srgb, var(--surface) 70%, transparent); backdrop-filter: blur(10px); border-color: rgb(255 255 255 / 0.35); border-radius: 14px; }'
          },
          { id: 'flat', name: 'Flat', hint: 'No border or shadow', css: '.content-card { border: 0; box-shadow: none; border-radius: 0; }' },
          {
            id: 'paper',
            name: 'Old paper',
            hint: 'Warm cream paper',
            css: '.content-card { --surface: #fbf5e6; --panel: #f3ead2; --text: #3b3326; --border: #e2d4b2; color: var(--text); box-shadow: 0 3px 12px rgb(80 60 20 / 0.22); }'
          },
          {
            id: 'dark',
            name: 'Dark page',
            hint: 'Light text on a dark page',
            css: '.content-card { --surface: #1e2029; --panel: #282b37; --text: #e8e8f0; --muted: #a3a6b8; --border: #3b3f50; --link: #93b6ff; --redlink: #ff8f8f; color: var(--text); }'
          },
          {
            id: 'retro',
            name: 'Retro boxes',
            hint: 'Thick outlines and hard shadows',
            css: '.content-card { border: 3px solid var(--text); border-radius: 0; box-shadow: 6px 6px 0 var(--text); }'
          }
        ]
      },
      {
        id: 'width',
        title: 'Page width',
        pick: 'one',
        looks: [
          {
            id: 'narrow',
            name: 'Narrow (easier to read)',
            hint: '',
            css: '.content-card { max-width: 900px; margin-left: auto; margin-right: auto; }'
          },
          { id: 'wide', name: 'Full width', hint: '', css: '.content-card { max-width: none; }' }
        ]
      },
      {
        id: 'pattern',
        title: 'Background pattern (instead of a picture)',
        pick: 'one',
        looks: [
          {
            id: 'dots',
            name: 'Polka dots',
            hint: '',
            css: '.backdrop { background-image: radial-gradient(color-mix(in srgb, var(--accent) 28%, transparent) 2px, transparent 2.5px); background-size: 24px 24px; background-repeat: repeat; }'
          },
          {
            id: 'grid',
            name: 'Graph paper',
            hint: '',
            css: '.backdrop { background-image: linear-gradient(color-mix(in srgb, var(--accent) 16%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--accent) 16%, transparent) 1px, transparent 1px); background-size: 26px 26px; background-repeat: repeat; }'
          },
          {
            id: 'stripes',
            name: 'Soft stripes',
            hint: '',
            css: '.backdrop { background-image: repeating-linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent) 0 18px, transparent 18px 36px); background-repeat: repeat; background-size: auto; }'
          },
          {
            id: 'stars',
            name: 'Starry night',
            hint: 'Little stars scattered around',
            css: '.backdrop { background-color: #12142a; background-image: radial-gradient(1.5px 1.5px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 60%, #fff, transparent), radial-gradient(1.5px 1.5px at 40% 80%, #cdf, transparent), radial-gradient(1px 1px at 85% 15%, #fff, transparent), radial-gradient(2px 2px at 55% 40%, #ffd, transparent); background-size: 180px 180px; background-repeat: repeat; }'
          },
          {
            id: 'drift',
            name: 'Slowly shifting colors',
            hint: 'A gentle moving gradient',
            css:
              '.backdrop { background-image: linear-gradient(120deg, color-mix(in srgb, var(--accent) 35%, var(--bg)), var(--bg), color-mix(in srgb, var(--link) 30%, var(--bg))); background-size: 300% 300%; background-repeat: no-repeat; }\n' +
              moving(
                '  .backdrop { animation: sw-drift 18s ease-in-out infinite alternate; }\n  @keyframes sw-drift { from { background-position: 0% 50%; } to { background-position: 100% 50%; } }'
              )
          }
        ]
      },
      {
        id: 'picture',
        title: 'Background picture',
        pick: 'any',
        looks: [
          { id: 'dim', name: 'Fainter', hint: 'Makes the picture see-through', css: '.backdrop { opacity: 0.45; }' },
          { id: 'blur', name: 'Blurred', hint: 'Softly out of focus', css: '.backdrop { filter: blur(6px); transform: scale(1.04); }' }
        ]
      }
    ]
  },
  {
    id: 'menus',
    title: 'Sidebar & top bar',
    icon: '☰',
    groups: [
      {
        id: 'topbar',
        title: 'Top bar',
        pick: 'one',
        looks: [
          {
            id: 'gradient',
            name: 'Gradient',
            hint: '',
            css: '.topbar { background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 45%, var(--link))); }'
          },
          {
            id: 'glass',
            name: 'See-through',
            hint: 'Lets the background show',
            css: '.topbar { background: color-mix(in srgb, var(--accent) 65%, transparent); backdrop-filter: blur(8px); }'
          },
          { id: 'flat', name: 'Flat, no shadow', hint: '', css: '.topbar { box-shadow: none; }' }
        ]
      },
      {
        id: 'sidebar',
        title: 'Sidebar',
        pick: 'any',
        looks: [
          {
            id: 'panel',
            name: 'On a panel',
            hint: 'A rounded box behind the menu',
            css: '.sidebar { background: var(--panel); border-radius: 0 16px 16px 0; margin: 12px 0; }'
          },
          {
            id: 'pills',
            name: 'Pill buttons',
            hint: 'Menu links light up as pills',
            css: `${LINKS} { border-radius: 999px; }\n.sidebar .nav-link:hover, .sidebar a:hover { background: var(--accent); color: var(--accent-text); }`
          },
          { id: 'big', name: 'Bigger links', hint: '', css: `${LINKS} { font-size: 16px; padding: 7px 12px; }` },
          { id: 'hide', name: 'Hide the sidebar', hint: 'Ctrl/Cmd + , still opens Look & settings', css: '.sidebar { display: none; }' }
        ]
      }
    ]
  },
  {
    id: 'contents',
    title: 'Contents box',
    icon: '≡',
    groups: [
      {
        id: 'toc-look',
        title: 'Look',
        pick: 'one',
        looks: [
          {
            id: 'tinted',
            name: 'Rounded & tinted',
            hint: '',
            css: '.toc { border-radius: 14px; background: color-mix(in srgb, var(--accent) 10%, var(--panel)); border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); }'
          },
          {
            id: 'minimal',
            name: 'Minimal',
            hint: 'No box, just the list',
            css: '.toc { background: none; border: 0; border-left: 3px solid var(--accent); border-radius: 0; }'
          },
          { id: 'hidden', name: 'Hide it', hint: 'No contents box on pages', css: '.toc { display: none; }' }
        ]
      },
      {
        id: 'toc-extras',
        title: 'Extras',
        pick: 'any',
        looks: [{ id: 'no-numbers', name: 'No numbers', hint: '', css: '.toc-num { display: none; }' }]
      }
    ]
  },
  {
    id: 'pictures',
    title: 'Pictures & cards',
    icon: '🖼',
    groups: [
      {
        id: 'gallery',
        title: 'Galleries',
        pick: 'any',
        looks: [
          { id: 'rounded', name: 'Rounded pictures', hint: '', css: '.g-thumb, .g-thumb img { border-radius: 12px; }' },
          {
            id: 'polaroid',
            name: 'Polaroid photos',
            hint: 'White frames, slightly tilted',
            css: '.g-item { background: #fff; padding: 8px 8px 4px; box-shadow: 0 2px 8px rgb(0 0 0 / 0.2); color: #333; }\n.g-item:nth-child(odd) { transform: rotate(-1.5deg); }\n.g-item:nth-child(even) { transform: rotate(1.2deg); }'
          },
          { id: 'zoom', name: 'Zoom on hover', hint: '', css: '.g-thumb:hover img { transform: scale(1.12); }' },
          {
            id: 'grey',
            name: 'Black & white until hover',
            hint: '',
            css: '.g-thumb img { filter: grayscale(1); transition: filter 0.3s; }\n.g-thumb:hover img { filter: none; }'
          }
        ]
      },
      {
        id: 'cards',
        title: 'Page cards',
        pick: 'any',
        looks: [
          {
            id: 'round',
            name: 'Round pictures',
            hint: '',
            css: '.page-cards .pc-img { border-radius: 50%; margin: 8px; }\n.page-cards .pc-card { border-radius: 12px; }'
          },
          {
            id: 'lift',
            name: 'Tilt on hover',
            hint: '',
            css: '.page-cards .pc-card { transition: transform 0.15s, box-shadow 0.15s; }\n.page-cards .pc-card:hover { transform: translateY(-4px) rotate(-2deg); box-shadow: 0 8px 16px rgb(0 0 0 / 0.2); }'
          },
          {
            id: 'soft',
            name: 'Soft cards',
            hint: 'Thin borders, rounded',
            css: '.page-cards .pc-card { border-width: 1px; border-color: var(--border); border-radius: 12px; }'
          },
          {
            id: 'plain-names',
            name: 'Plain names',
            hint: 'Names without the dark strip',
            css: '.page-cards .pc-name { background: none; color: var(--text); }'
          }
        ]
      }
    ]
  },
  {
    id: 'text',
    title: 'Text',
    icon: 'Aa',
    groups: [
      {
        id: 'text',
        title: 'Writing',
        pick: 'any',
        looks: [
          { id: 'bigger', name: 'Bigger text', hint: '', css: '.prose { font-size: 17px; }' },
          { id: 'spacing', name: 'More space between lines', hint: '', css: '.prose { line-height: 1.9; }' },
          {
            id: 'drop-cap',
            name: 'Big first letter',
            hint: 'Like the start of a storybook',
            css: '.prose > p:first-of-type::first-letter { float: left; font-family: var(--font-heading); font-size: 3.2em; line-height: 0.9; padding: 4px 8px 0 0; color: var(--accent); }'
          },
          { id: 'justify', name: 'Even edges', hint: 'Text lines up on both sides', css: '.prose p { text-align: justify; hyphens: auto; }' },
          {
            id: 'selection',
            name: 'Colored highlighting',
            hint: 'Selected text uses the accent color',
            css: '::selection { background: var(--accent); color: var(--accent-text); }'
          }
        ]
      },
      {
        id: 'top',
        title: 'Notes & quote at the top',
        pick: 'any',
        looks: [
          {
            id: 'quote-card',
            name: 'Quote in a box',
            hint: '',
            css: '.top-quote { border-left: 4px solid var(--accent); padding: 8px 14px; background: var(--panel); border-radius: 0 10px 10px 0; font-size: 1.08em; }'
          },
          {
            id: 'big-quote',
            name: 'Big quotation mark',
            hint: '',
            css: '.top-quote { position: relative; padding-left: 34px; }\n.top-quote::before { content: "“"; position: absolute; left: 0; top: -12px; font-size: 52px; color: var(--accent); font-family: Georgia, serif; }'
          },
          {
            id: 'notes-line',
            name: 'Notes with a line',
            hint: '',
            css: '.hatnote { border-left: 3px solid var(--border); padding-left: 10px; margin-left: 1.2em; }'
          }
        ]
      }
    ]
  },
  {
    id: 'boxes',
    title: 'Note boxes',
    icon: '☐',
    groups: [
      {
        id: 'callouts',
        title: 'Note, tip, warning & spoiler boxes',
        pick: 'any',
        looks: [
          { id: 'rounded', name: 'Rounder', hint: '', css: '.callout { border-radius: 14px; }' },
          {
            id: 'tinted',
            name: 'Tinted backgrounds',
            hint: 'Each kind gets a light color',
            css: '.callout[data-callout="note"] { background: color-mix(in srgb, #3b82c4 10%, var(--panel)); }\n.callout[data-callout="tip"] { background: color-mix(in srgb, #2e9d57 10%, var(--panel)); }'
          },
          { id: 'shadow', name: 'With a shadow', hint: '', css: '.callout { box-shadow: 0 3px 10px rgb(0 0 0 / 0.12); }' },
          {
            id: 'dashed-spoiler',
            name: 'Dashed spoiler boxes',
            hint: '',
            css: '.callout[data-callout="spoiler"] { border-style: dashed; border-left-style: solid; }'
          }
        ]
      }
    ]
  },
  {
    id: 'fun',
    title: 'Fun effects',
    icon: '✨',
    groups: [
      {
        id: 'fun',
        title: 'Effects',
        pick: 'any',
        looks: [
          {
            id: 'rainbow-title',
            name: 'Rainbow page title',
            hint: 'Colors flowing through the title',
            css:
              '.page-title { background: linear-gradient(90deg, #ff5f6d, #ffc371, #47e891, #4facfe, #b06ab3, #ff5f6d); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; }\n' +
              moving(
                '  .page-title { animation: sw-rainbow 6s linear infinite; }\n  @keyframes sw-rainbow { to { background-position: 200% center; } }'
              )
          },
          {
            id: 'fade-in',
            name: 'Pages fade in',
            hint: 'Each page slides gently into view',
            css: moving(
              '  .content-card { animation: sw-fade-in 0.5s ease both; }\n  @keyframes sw-fade-in { from { opacity: 0; transform: translateY(10px); } }'
            )
          },
          {
            id: 'float',
            name: 'Floating infobox',
            hint: 'Bobs up and down slowly',
            css: moving('  .infobox { animation: sw-float 4s ease-in-out infinite; }\n  @keyframes sw-float { 50% { transform: translateY(-6px); } }')
          },
          {
            id: 'wiggle',
            name: 'Wiggly headings',
            hint: 'Headings wiggle under the mouse',
            css: moving(
              '  .prose h2:hover { animation: sw-wiggle 0.4s; }\n  @keyframes sw-wiggle { 25% { transform: rotate(-1.5deg); } 75% { transform: rotate(1.5deg); } }'
            )
          },
          {
            id: 'star-cursor',
            name: 'Star mouse pointer',
            hint: '',
            css: `body, .app { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ctext y='18' font-size='18'%3E%E2%AD%90%3C/text%3E%3C/svg%3E") 12 12, auto; }`
          },
          {
            id: 'scrollbar',
            name: 'Colorful scrollbars',
            hint: '',
            css: '::-webkit-scrollbar { width: 12px; height: 12px; }\n::-webkit-scrollbar-thumb { background: var(--accent); border-radius: 8px; border: 3px solid transparent; background-clip: padding-box; }'
          },
          {
            id: 'smooth',
            name: 'Smooth scrolling',
            hint: 'Contents links glide instead of jump',
            css: 'html, .content-scroll { scroll-behavior: smooth; }'
          }
        ]
      }
    ]
  }
]

// ---------- more looks ----------
// Kept as additions to the sections above so each part of the page stays in one place in the picker.

const W = '.prose > ' // the page's own writing, not what's inside fancy blocks or note boxes

/** A whole color scheme (and fonts), for everything inside the window. Replaces the color settings while on. */
const theme = (v: Record<string, string>, sidebar?: { link: string; muted: string }): string =>
  themeCss(v) + (sidebar ? `\n.sidebar { --link: ${sidebar.link}; --muted: ${sidebar.muted}; }` : '')
const themeCss = (v: Record<string, string>): string =>
  `.topbar, .layout, .backdrop {\n${Object.entries(v)
    .map(([k, x]) => `  --${k}: ${x};`)
    .join('\n')}\n}\n.backdrop { background-color: var(--bg); }\n.layout { color: var(--text); }`

/** A layer of little shapes drifting down (or up) the background. */
const falling = (name: string, dots: string, size: number, seconds: number, up = false): string =>
  `.backdrop::after { content: ""; position: absolute; inset: 0; background-image: ${dots}; background-size: ${size}px ${size}px; }\n` +
  moving(
    `  .backdrop::after { animation: sw-${name} ${seconds}s linear infinite; }\n  @keyframes sw-${name} { to { background-position: 0 ${up ? '-' : ''}${size * 3}px; } }`
  )

const svgPattern = (svg: string): string => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}")`

const THEMES: Look[] = [
  {
    id: 'cottage',
    name: 'Cozy cottage',
    hint: 'Cream, moss green, warm wood',
    css: theme({
      bg: '#efe6d2',
      surface: '#fffaf0',
      panel: '#f5ecd9',
      text: '#3e3426',
      muted: '#85765e',
      link: '#5f7d3a',
      redlink: '#b4553a',
      accent: '#6b8f47',
      'accent-text': '#ffffff',
      border: '#e0d3b8',
      'font-body': '"Nunito", sans-serif',
      'font-heading': '"Lora", serif'
    })
  },
  {
    id: 'night',
    name: 'Night sky',
    hint: 'Deep blue with starlight text',
    css: theme({
      bg: '#0f1226',
      surface: '#171b33',
      panel: '#1f2442',
      text: '#e6e8f5',
      muted: '#9da3c7',
      link: '#9ab8ff',
      redlink: '#ff8fa3',
      accent: '#3a3f8f',
      'accent-text': '#ffffff',
      border: '#2e3460',
      'font-heading': '"Cinzel", serif'
    })
  },
  {
    id: 'pastel',
    name: 'Pastel dream',
    hint: 'Soft pinks and lilacs',
    css: theme({
      bg: '#fdeef6',
      surface: '#fffafd',
      panel: '#f6ecff',
      text: '#4a3f55',
      muted: '#8d80a0',
      link: '#9a5fd0',
      redlink: '#e0607e',
      accent: '#f4a6c8',
      'accent-text': '#4a2440',
      border: '#ecd9f2',
      'font-body': '"Quicksand", sans-serif',
      'font-heading': '"Quicksand", sans-serif'
    })
  },
  {
    id: 'neon',
    name: 'Neon arcade',
    hint: 'Black with glowing pink and cyan',
    css: theme({
      bg: '#0a0a12',
      surface: '#12121f',
      panel: '#1b1b2e',
      text: '#e9f8ff',
      muted: '#8aa0b4',
      link: '#2ef2ff',
      redlink: '#ff4f9a',
      accent: '#ff2fb3',
      'accent-text': '#ffffff',
      border: '#2b2b48',
      'font-heading': '"Orbitron", sans-serif'
    })
  },
  {
    id: 'library',
    name: 'Old library',
    hint: 'Parchment pages, leather and ink',
    css: theme(
      {
        bg: '#2b2118',
        surface: '#f4ead5',
        panel: '#ebdfc4',
        text: '#2f2416',
        muted: '#7a6a52',
        link: '#7b3f1d',
        redlink: '#a3271f',
        accent: '#5a3a22',
        'accent-text': '#f4ead5',
        border: '#d6c4a0',
        'font-body': '"Crimson Pro", serif',
        'font-heading': '"EB Garamond", serif'
      },
      { link: '#ecd3a8', muted: '#b8a584' }
    )
  },
  {
    id: 'modern',
    name: 'Clean modern',
    hint: 'Crisp white and charcoal',
    css: theme({
      bg: '#f4f5f7',
      surface: '#ffffff',
      panel: '#f7f8fa',
      text: '#1d2330',
      muted: '#6b7385',
      link: '#2f6fed',
      redlink: '#d64545',
      accent: '#1d2330',
      'accent-text': '#ffffff',
      border: '#e3e6ec',
      'font-body': '"Inter", sans-serif',
      'font-heading': '"Inter", sans-serif'
    })
  },
  {
    id: 'forest',
    name: 'Forest',
    hint: 'Pine green and soft sage',
    css: theme(
      {
        bg: '#1f2d24',
        surface: '#f3f6ef',
        panel: '#e6eedd',
        text: '#22301f',
        muted: '#5d6e57',
        link: '#2f7d4a',
        redlink: '#b5482e',
        accent: '#2f5d3a',
        'accent-text': '#f3f6ef',
        border: '#cfdcc3',
        'font-heading': '"Merriweather", serif'
      },
      { link: '#b9dfb0', muted: '#93ad8c' }
    )
  },
  {
    id: 'ocean',
    name: 'Ocean',
    hint: 'Sea blue and foam',
    css: theme({
      bg: '#d9eef5',
      surface: '#f7fcfe',
      panel: '#e6f4f9',
      text: '#12313d',
      muted: '#557885',
      link: '#0f7aa3',
      redlink: '#d1495b',
      accent: '#146b8c',
      'accent-text': '#ffffff',
      border: '#c3e0ea',
      'font-body': '"Rubik", sans-serif'
    })
  },
  {
    id: 'spooky',
    name: 'Spooky',
    hint: 'Purple dark with pumpkin orange',
    css: theme({
      bg: '#120c16',
      surface: '#1c1420',
      panel: '#261b2c',
      text: '#eadff0',
      muted: '#a090ab',
      link: '#ff9f43',
      redlink: '#ff5c7a',
      accent: '#5b2a6e',
      'accent-text': '#ffd9a8',
      border: '#3a2a44',
      'font-heading': '"Creepster", cursive'
    })
  },
  {
    id: 'candy',
    name: 'Candy shop',
    hint: 'Bubblegum pink and cream',
    css: theme({
      bg: '#fff4e8',
      surface: '#ffffff',
      panel: '#fff0f5',
      text: '#4a2c3a',
      muted: '#9b7385',
      link: '#e04f8c',
      redlink: '#e0603a',
      accent: '#ff7eb6',
      'accent-text': '#ffffff',
      border: '#ffd6e5',
      'font-heading': '"Fredoka", sans-serif'
    })
  },
  {
    id: 'comic',
    name: 'Comic book',
    hint: 'Bold yellow, black outlines',
    css:
      theme({
        bg: '#ffe14d',
        surface: '#ffffff',
        panel: '#fff7cc',
        text: '#111111',
        muted: '#555555',
        link: '#d7263d',
        redlink: '#8a2be2',
        accent: '#111111',
        'accent-text': '#ffe14d',
        border: '#111111',
        'font-heading': '"Bangers", sans-serif',
        'font-body': '"Comic Neue", sans-serif'
      }) + '\n.content-card, .infobox { border: 3px solid #111; box-shadow: 5px 5px 0 #111; }'
  }
]

const addSection = (section: LookSection, at: number): void => void LOOK_SECTIONS.splice(at, 0, section)
const addGroup = (sectionId: string, group: LookGroup): void => void LOOK_SECTIONS.find((s) => s.id === sectionId)!.groups.push(group)
const addLooks = (groupId: string, looks: Look[]): void =>
  void LOOK_SECTIONS.flatMap((s) => s.groups)
    .find((g) => g.id === groupId)!
    .looks.push(...looks)

addSection(
  {
    id: 'themes',
    title: 'Color themes',
    icon: '🎨',
    groups: [{ id: 'color-theme', title: 'Whole-wiki colors & fonts (replaces your color settings while on)', pick: 'one', looks: THEMES }]
  },
  0
)

addLooks('infobox-details', [
  {
    id: 'accent-headers',
    name: 'Bold section headers',
    hint: 'Headers inside the infobox in the accent color',
    css: '.ib-header { background: var(--accent); color: var(--accent-text); }'
  },
  { id: 'compact', name: 'Compact', hint: 'Smaller text and rows', css: '.infobox { font-size: 12.5px; }\n.ib-row { padding: 3px 10px; }' },
  { id: 'top-stripe', name: 'Colored top edge', hint: '', css: '.infobox { border-top: 5px solid var(--ib-head, var(--accent)); }' },
  {
    id: 'framed-picture',
    name: 'Framed picture',
    hint: 'White frame and a shadow',
    css: '.ib-image img { border: 5px solid #fff; box-shadow: 0 2px 8px rgb(0 0 0 / 0.25); }'
  }
])
addGroup('infobox', {
  id: 'infobox-side',
  title: 'Side',
  pick: 'one',
  looks: [
    {
      id: 'left',
      name: 'On the left',
      hint: 'Writing flows around it on the right',
      css: '.infobox { float: left; clear: left; margin: 0 22px 16px 0; }'
    }
  ]
})

addLooks('headings-style', [
  {
    id: 'highlighter',
    name: 'Highlighter pen',
    hint: 'Like it was marked with a highlighter',
    css: '.prose h2 { border-bottom: 0; width: fit-content; padding: 0 6px; background: linear-gradient(transparent 55%, color-mix(in srgb, var(--accent) 35%, transparent) 55%); }'
  },
  {
    id: 'numbered',
    name: 'Numbered',
    hint: '1. 2. 3. before each heading',
    css: '.prose { counter-reset: sw-h2; }\n.prose h2::before { counter-increment: sw-h2; content: counter(sw-h2) ". "; color: var(--accent); }'
  },
  { id: 'icon', name: 'With a sparkle', hint: '✦ Before each heading', css: '.prose h2::before { content: "✦ "; color: var(--accent); }' },
  { id: 'caps', name: 'Capitals', hint: 'SPACED CAPITALS', css: '.prose h2 { text-transform: uppercase; letter-spacing: 0.1em; font-size: 19px; }' },
  { id: 'big', name: 'Bigger', hint: '', css: '.prose h2 { font-size: 30px; }' },
  {
    id: 'neon',
    name: 'Neon glow',
    hint: 'Glowing headings (best on dark pages)',
    css: '.prose h2 { border-bottom-color: var(--accent); text-shadow: 0 0 6px var(--accent), 0 0 14px var(--accent); }'
  }
])

addLooks('title-style', [
  {
    id: 'stroke',
    name: 'Outlined letters',
    hint: 'Hollow letters with a colored edge',
    css: '.page-title { color: transparent; -webkit-text-stroke: 1.5px var(--accent); }'
  },
  { id: 'small-caps', name: 'Small capitals', hint: '', css: '.page-title { font-variant: small-caps; letter-spacing: 0.05em; }' },
  {
    id: 'marker',
    name: 'Highlighter pen',
    hint: '',
    css: '.page-title { width: fit-content; padding: 0 8px; background: linear-gradient(transparent 55%, color-mix(in srgb, var(--accent) 35%, transparent) 55%); border-bottom: 0; }'
  }
])
addLooks('title-extras', [
  { id: 'accent-line', name: 'Colored line underneath', hint: '', css: '.page-title { border-bottom: 3px solid var(--accent); }' }
])

addLooks('links-style', [
  { id: 'color-hover', name: 'Change color on hover', hint: 'Links turn the accent color', css: '.prose a:hover { color: var(--accent); }' },
  {
    id: 'grow-underline',
    name: 'Growing underline',
    hint: 'An underline slides in under the mouse',
    css: '.prose a { background: linear-gradient(currentColor, currentColor) 0 100% / 0 1.5px no-repeat; transition: background-size 0.25s; }\n.prose a:hover { background-size: 100% 1.5px; text-decoration: none; }'
  }
])
addLooks('links-extras', [{ id: 'no-arrow', name: 'No ↗ on web links', hint: '', css: '.prose a.external::after { display: none; }' }])

addLooks('card', [
  { id: 'dashed', name: 'Dashed outline', hint: '', css: '.content-card { border: 2px dashed var(--accent); }' },
  {
    id: 'notebook',
    name: 'Notebook paper',
    hint: 'Ruled lines and a red margin',
    css: '.content-card { background-color: var(--surface); background-image: linear-gradient(90deg, transparent 22px, rgb(230 90 90 / 0.35) 22px 24px, transparent 24px), repeating-linear-gradient(transparent 0 27px, color-mix(in srgb, var(--link) 18%, transparent) 27px 28px); }'
  }
])
addLooks('pattern', [
  {
    id: 'checkers',
    name: 'Checkerboard',
    hint: '',
    css: '.backdrop { background-image: conic-gradient(color-mix(in srgb, var(--accent) 14%, transparent) 25%, transparent 0 50%, color-mix(in srgb, var(--accent) 14%, transparent) 0 75%, transparent 0); background-size: 40px 40px; background-repeat: repeat; }'
  },
  {
    id: 'hearts',
    name: 'Little hearts',
    hint: '',
    css: `.backdrop { background-image: ${svgPattern("<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><text x='12' y='30' font-size='18' fill='#e88' opacity='.5'>♥</text></svg>")}; background-size: 48px 48px; background-repeat: repeat; }`
  },
  {
    id: 'pastel',
    name: 'Pastel gradient',
    hint: 'Pink, blue and mint',
    css: '.backdrop { background-image: linear-gradient(135deg, #ffd6e8, #d6e4ff, #d6fff1); background-size: cover; }'
  },
  {
    id: 'sunset',
    name: 'Sunset gradient',
    hint: 'Orange to purple',
    css: '.backdrop { background-image: linear-gradient(180deg, #ffb347, #ff6f91 50%, #6a4c93); background-size: cover; }'
  }
])
addLooks('picture', [
  { id: 'vignette', name: 'Dark edges', hint: 'The corners fade to dark', css: '.backdrop { box-shadow: inset 0 0 200px rgb(0 0 0 / 0.5); }' }
])

addLooks('sidebar', [
  { id: 'line', name: 'Line beside the menu', hint: '', css: '.sidebar { border-right: 2px solid var(--border); }' },
  {
    id: 'active-accent',
    name: 'Current page in color',
    hint: '',
    css: '.sidebar .nav-link.active { background: var(--accent); color: var(--accent-text); }'
  },
  { id: 'titles-accent', name: 'Colored menu titles', hint: '', css: '.sidebar .nav-title { color: var(--accent); }' }
])
addLooks('topbar', [
  {
    id: 'stripes',
    name: 'Striped',
    hint: '',
    css: '.topbar { background: repeating-linear-gradient(135deg, var(--accent) 0 16px, color-mix(in srgb, var(--accent) 85%, white) 16px 32px); }'
  },
  { id: 'line', name: 'Colored line underneath', hint: '', css: '.topbar { box-shadow: 0 3px 0 var(--link); }' }
])
addGroup('menus', {
  id: 'brand',
  title: 'Wiki name & logo',
  pick: 'any',
  looks: [
    {
      id: 'spin',
      name: 'Logo spins on hover',
      hint: '',
      css: moving(
        '  .wiki-brand img, .wiki-brand .brand-dot { transition: transform 0.6s; }\n  .wiki-brand:hover img, .wiki-brand:hover .brand-dot { transform: rotate(360deg); }'
      )
    },
    { id: 'round', name: 'Round logo', hint: '', css: '.wiki-brand img { border-radius: 50%; object-fit: cover; }' },
    { id: 'big-name', name: 'Bigger wiki name', hint: '', css: '.wiki-brand { font-size: 1.25em; }' }
  ]
})

addSection(
  {
    id: 'tables',
    title: 'Tables & lists',
    icon: '▦',
    groups: [
      {
        id: 'tables',
        title: 'Tables in the writing',
        pick: 'any',
        looks: [
          {
            id: 'striped',
            name: 'Striped rows',
            hint: '',
            css: `${W}table tr:nth-child(even) td { background: color-mix(in srgb, var(--accent) 7%, transparent); }`
          },
          { id: 'accent-head', name: 'Colored header row', hint: '', css: `${W}table th { background: var(--accent); color: var(--accent-text); }` },
          {
            id: 'rounded',
            name: 'Rounded',
            hint: '',
            css: `${W}table { border-collapse: separate; border-spacing: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }\n${W}table th, ${W}table td { border: 0; border-bottom: 1px solid var(--border); }`
          },
          {
            id: 'hover',
            name: 'Highlight row under the mouse',
            hint: '',
            css: `${W}table tr:hover td { background: color-mix(in srgb, var(--link) 10%, transparent); }`
          },
          { id: 'full', name: 'Full width', hint: '', css: `${W}table { width: 100%; }` },
          {
            id: 'open',
            name: 'No side lines',
            hint: 'Only lines between rows',
            css: `${W}table th, ${W}table td { border-left: 0; border-right: 0; }`
          },
          { id: 'center', name: 'Centered text', hint: '', css: `${W}table th, ${W}table td { text-align: center; }` }
        ]
      },
      {
        id: 'bullets',
        title: 'Bullet points',
        pick: 'one',
        looks: [
          { id: 'stars', name: '★ Stars', hint: '', css: `${W}ul > li::marker { content: "★  "; color: var(--accent); }` },
          { id: 'hearts', name: '♥ Hearts', hint: '', css: `${W}ul > li::marker { content: "♥  "; color: var(--accent); }` },
          { id: 'sparkles', name: '✦ Sparkles', hint: '', css: `${W}ul > li::marker { content: "✦  "; color: var(--accent); }` },
          { id: 'arrows', name: '➤ Arrows', hint: '', css: `${W}ul > li::marker { content: "➤  "; color: var(--accent); }` },
          { id: 'checks', name: '✓ Ticks', hint: '', css: `${W}ul > li::marker { content: "✓  "; color: var(--accent); font-weight: 700; }` },
          { id: 'flowers', name: '✿ Flowers', hint: '', css: `${W}ul > li::marker { content: "✿  "; color: var(--accent); }` },
          { id: 'colored', name: 'Colored dots', hint: '', css: `${W}ul > li::marker { color: var(--accent); }` }
        ]
      },
      {
        id: 'lists',
        title: 'Lists',
        pick: 'any',
        looks: [
          { id: 'spacing', name: 'More space between items', hint: '', css: `${W}ul > li, ${W}ol > li { margin-bottom: 6px; }` },
          { id: 'numbers', name: 'Bold colored numbers', hint: '', css: `${W}ol > li::marker { color: var(--accent); font-weight: 700; }` }
        ]
      }
    ]
  },
  LOOK_SECTIONS.findIndex((s) => s.id === 'contents') + 1
)

addGroup('pictures', {
  id: 'writing-pictures',
  title: 'Pictures in the writing',
  pick: 'any',
  looks: [
    { id: 'rounded', name: 'Rounded corners', hint: '', css: '.prose img { border-radius: 14px; }' },
    { id: 'shadow', name: 'Shadow', hint: '', css: '.prose img { box-shadow: 0 4px 14px rgb(0 0 0 / 0.25); }' },
    { id: 'frame', name: 'White photo frame', hint: '', css: '.prose img { border: 6px solid #fff; box-shadow: 0 1px 6px rgb(0 0 0 / 0.25); }' }
  ]
})

addGroup('text', {
  id: 'quotes',
  title: 'Quotes in the writing',
  pick: 'one',
  looks: [
    {
      id: 'big-mark',
      name: 'Big quotation mark',
      hint: '',
      css: `${W}blockquote { position: relative; padding-left: 46px; }\n${W}blockquote::before { content: "“"; position: absolute; left: 10px; top: -6px; font-size: 54px; color: var(--accent); font-family: Georgia, serif; }`
    },
    {
      id: 'centered',
      name: 'Centered & large',
      hint: '',
      css: `${W}blockquote { border: 0; background: none; text-align: center; font-size: 1.2em; font-style: italic; }`
    },
    {
      id: 'card',
      name: 'Quote card',
      hint: '',
      css: `${W}blockquote { border: 1px solid var(--border); border-left: 6px solid var(--accent); border-radius: 12px; box-shadow: 0 3px 10px rgb(0 0 0 / 0.08); }`
    }
  ]
})
addLooks('text', [
  {
    id: 'first-line',
    name: 'First line in small capitals',
    hint: '',
    css: `${W}p:first-of-type::first-line { font-variant: small-caps; letter-spacing: 0.04em; }`
  },
  { id: 'measure', name: 'Shorter lines', hint: 'Easier to read on wide screens', css: `${W}p { max-width: 72ch; }` },
  {
    id: 'fancy-rule',
    name: 'Fading divider lines',
    hint: 'For the — divider in the editor',
    css: '.prose hr { border: 0; height: 2px; background: linear-gradient(to right, transparent, var(--accent), transparent); }'
  }
])

addGroup('fun', {
  id: 'weather',
  title: 'Weather & sparkles (on the background)',
  pick: 'one',
  looks: [
    {
      id: 'snow',
      name: 'Falling snow',
      hint: 'Best on darker backgrounds',
      css: falling(
        'snow',
        'radial-gradient(3px 3px at 20px 30px, #fff, transparent), radial-gradient(2px 2px at 90px 120px, #fff, transparent), radial-gradient(3px 3px at 150px 60px, #fff, transparent), radial-gradient(2px 2px at 120px 170px, #fff, transparent), radial-gradient(2.5px 2.5px at 50px 150px, #fff, transparent)',
        200,
        14
      )
    },
    {
      id: 'petals',
      name: 'Falling petals',
      hint: 'Little pink blossoms',
      css: falling(
        'petals',
        'radial-gradient(4px 3px at 30px 40px, #ffb7d0, transparent), radial-gradient(3px 4px at 140px 90px, #ffc9dc, transparent), radial-gradient(4px 3px at 90px 170px, #ff9fc0, transparent)',
        200,
        18
      )
    },
    {
      id: 'fireflies',
      name: 'Fireflies',
      hint: 'Warm glowing dots drifting up',
      css: falling(
        'fireflies',
        'radial-gradient(3px 3px at 40px 60px, #ffe58a, transparent), radial-gradient(2px 2px at 160px 140px, #fff3b0, transparent), radial-gradient(3px 3px at 100px 20px, #ffd95e, transparent)',
        220,
        20,
        true
      )
    },
    {
      id: 'bubbles',
      name: 'Bubbles',
      hint: 'Floating up',
      css: falling(
        'bubbles',
        'radial-gradient(circle at 50px 80px, transparent 5px, rgb(255 255 255 / 0.6) 6px, transparent 7px), radial-gradient(circle at 150px 160px, transparent 8px, rgb(255 255 255 / 0.5) 9px, transparent 10px)',
        220,
        16,
        true
      )
    }
  ]
})
addLooks('fun', [
  {
    id: 'rainbow-links',
    name: 'Rainbow links on hover',
    hint: '',
    css: moving('  .prose a:hover { animation: sw-hue 1.2s linear infinite; }\n  @keyframes sw-hue { to { filter: hue-rotate(360deg); } }')
  },
  {
    id: 'heart-cursor',
    name: 'Heart mouse pointer',
    hint: '',
    css: `body, .app { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ctext y='18' font-size='18'%3E%F0%9F%92%97%3C/text%3E%3C/svg%3E") 12 12, auto; }`
  },
  {
    id: 'bounce-cards',
    name: 'Bouncy page cards',
    hint: '',
    css: moving(
      '  .page-cards .pc-card:hover { animation: sw-bounce 0.5s; }\n  @keyframes sw-bounce { 40% { transform: translateY(-8px); } 70% { transform: translateY(-2px); } }'
    )
  }
])

// ---------- more color themes and fun effects (0.11) ----------

addLooks('color-theme', [
  {
    id: 'sunset',
    name: 'Sunset glow',
    hint: 'Peach, coral and a dusky sky',
    css:
      theme(
        {
          bg: '#ffb88c',
          surface: '#fffaf6',
          panel: '#ffeee3',
          text: '#43262a',
          muted: '#94706a',
          link: '#c43d52',
          redlink: '#8e3fb3',
          accent: '#d64f4a',
          'accent-text': '#ffffff',
          border: '#f6cdbd',
          'font-body': '"Poppins", sans-serif',
          'font-heading': '"Righteous", sans-serif'
        },
        { link: '#4a1f3a', muted: '#5e3550' }
      ) + '\n.backdrop { background-image: linear-gradient(180deg, #ffb88c 0%, #ff8fa3 55%, #a57fd1 100%); }'
  },
  {
    id: 'retro',
    name: 'Retro computer',
    hint: 'Green glowing text on a black screen',
    css:
      theme({
        bg: '#050a05',
        surface: '#0b140b',
        panel: '#102010',
        text: '#9dff9d',
        muted: '#5fbf6a',
        link: '#d8ff5c',
        redlink: '#ff7a6b',
        accent: '#123d17',
        'accent-text': '#9dff9d',
        border: '#1f4a24',
        'font-body': '"VT323", monospace',
        'font-heading': '"Press Start 2P", monospace'
      }) +
      '\n.layout { text-shadow: 0 0 4px rgb(157 255 157 / 0.35); }\n.prose, .infobox { font-size: 19px; }\n.page-title { font-size: 26px; line-height: 1.5; }\n.prose h2 { font-size: 17px; line-height: 1.6; }'
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    hint: 'Purple dusk, pink and teal',
    css:
      theme(
        {
          bg: '#2b1a4a',
          surface: '#fdf5ff',
          panel: '#f2e6ff',
          text: '#2d1e48',
          muted: '#7e6a9e',
          link: '#c42f8f',
          redlink: '#e2574c',
          accent: '#4cc9c0',
          'accent-text': '#1d1236',
          border: '#e5d2f5',
          'font-body': '"Rubik", sans-serif',
          'font-heading': '"Audiowide", sans-serif'
        },
        { link: '#7ff3ec', muted: '#d7c4f2' }
      ) + '\n.backdrop { background-image: linear-gradient(180deg, #2b1a4a 0%, #7b2f7f 60%, #ff7eb3 100%); }'
  },
  {
    id: 'fairy',
    name: 'Fairy garden',
    hint: 'Mint, lilac and storybook letters',
    css: theme({
      bg: '#e7f5ec',
      surface: '#fcfffd',
      panel: '#eef7f4',
      text: '#2e3b3a',
      muted: '#6f8580',
      link: '#7a4fc0',
      redlink: '#d0577c',
      accent: '#8fcfb0',
      'accent-text': '#1f3b30',
      border: '#d3eadf',
      'font-body': '"Nunito", sans-serif',
      'font-heading': '"Almendra", serif'
    })
  },
  {
    id: 'royal',
    name: 'Royal court',
    hint: 'Deep red velvet and gold',
    css:
      theme(
        {
          bg: '#2a0d16',
          surface: '#fbf6ea',
          panel: '#f3e9d2',
          text: '#2a1a14',
          muted: '#7c6550',
          link: '#8a1c33',
          redlink: '#b8441c',
          accent: '#6e1028',
          'accent-text': '#f2d27a',
          border: '#e3d1a6',
          'font-body': '"EB Garamond", serif',
          'font-heading': '"Cinzel Decorative", serif'
        },
        { link: '#f2d27a', muted: '#cbb48a' }
      ) + '\n.infobox { border: 2px solid #c9a646; }\n.page-title { color: #6e1028; }'
  },
  {
    id: 'pirate',
    name: 'Pirate map',
    hint: 'Old sea charts and sandy paper',
    css: theme(
      {
        bg: '#3b2a1a',
        surface: '#f2e3c2',
        panel: '#e8d4a8',
        text: '#3a2814',
        muted: '#7a6142',
        link: '#8b3a12',
        redlink: '#a3271f',
        accent: '#2c4a52',
        'accent-text': '#f2e3c2',
        border: '#cdb383',
        'font-body': '"IM Fell English", serif',
        'font-heading': '"Pirata One", serif'
      },
      { link: '#f2d9a0', muted: '#c4ab80' }
    )
  },
  {
    id: 'winter',
    name: 'Winter frost',
    hint: 'Icy blue and snow white',
    css: theme({
      bg: '#dfeef8',
      surface: '#fbfdff',
      panel: '#eef6fc',
      text: '#1e3346',
      muted: '#6d8499',
      link: '#2f78c4',
      redlink: '#c8506a',
      accent: '#7fb2dd',
      'accent-text': '#0e2a42',
      border: '#d3e5f2',
      'font-body': '"Nunito", sans-serif',
      'font-heading': '"Comfortaa", sans-serif'
    })
  },
  {
    id: 'coffee',
    name: 'Coffee house',
    hint: 'Espresso, cream and caramel',
    css: theme(
      {
        bg: '#3a2a22',
        surface: '#fbf4ea',
        panel: '#f1e4d3',
        text: '#33241b',
        muted: '#866d5c',
        link: '#9a4f22',
        redlink: '#b23a3a',
        accent: '#6b4430',
        'accent-text': '#fbf4ea',
        border: '#e2cfb9',
        'font-body': '"Lora", serif',
        'font-heading': '"Libre Baskerville", serif'
      },
      { link: '#f1c99a', muted: '#c9ad93' }
    )
  },
  {
    id: 'notebook',
    name: 'School notebook',
    hint: 'Lined paper and handwriting',
    css:
      theme({
        bg: '#e9eef5',
        surface: '#ffffff',
        panel: '#f4f7fb',
        text: '#24324a',
        muted: '#6c7a90',
        link: '#2a5bd7',
        redlink: '#d63e3e',
        accent: '#2a5bd7',
        'accent-text': '#ffffff',
        border: '#d5deeb',
        'font-body': '"Patrick Hand", cursive',
        'font-heading': '"Kalam", cursive'
      }) + '\n.content-card { background-image: repeating-linear-gradient(transparent 0 31px, #dbe6f5 31px 32px); }\n.prose { font-size: 18px; }'
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    hint: 'Deep space, purple nebula and stars',
    css:
      theme({
        bg: '#0b0618',
        surface: '#140c26',
        panel: '#1d1236',
        text: '#ece6ff',
        muted: '#a99cc9',
        link: '#c58bff',
        redlink: '#ff7aa2',
        accent: '#5b2bb5',
        'accent-text': '#ffffff',
        border: '#2c2050',
        'font-body': '"Lexend", sans-serif',
        'font-heading': '"Exo 2", sans-serif'
      }) +
      '\n.backdrop { background-image: radial-gradient(1px 1px at 20px 30px, #fff, transparent), radial-gradient(1.5px 1.5px at 120px 80px, #e6d7ff, transparent), radial-gradient(1px 1px at 200px 170px, #fff, transparent), radial-gradient(ellipse at 70% 20%, rgb(140 70 255 / 0.3), transparent 60%); background-size: 240px 240px, 240px 240px, 240px 240px, 100% 100%; background-repeat: repeat, repeat, repeat, no-repeat; }'
  },
  {
    id: 'lemonade',
    name: 'Summer lemonade',
    hint: 'Sunny yellow and fresh green',
    css: theme({
      bg: '#fff8c9',
      surface: '#ffffff',
      panel: '#fffbe3',
      text: '#3b3a1e',
      muted: '#8a8656',
      link: '#3f8a2f',
      redlink: '#e2543b',
      accent: '#f7c934',
      'accent-text': '#3b2f00',
      border: '#f1e7a6',
      'font-body': '"Quicksand", sans-serif',
      'font-heading': '"Baloo 2", sans-serif'
    })
  },
  {
    id: 'typewriter',
    name: 'Typewriter',
    hint: 'Paper and ink, like a typed page',
    css:
      theme({
        bg: '#d9d4c7',
        surface: '#fbf8f0',
        panel: '#f1ece0',
        text: '#1e1c18',
        muted: '#6f695d',
        link: '#8a2c1e',
        redlink: '#b3261e',
        accent: '#2b2a27',
        'accent-text': '#fbf8f0',
        border: '#d8d0bf',
        'font-body': '"Courier Prime", monospace',
        'font-heading': '"Special Elite", monospace'
      }) + '\n.prose a { text-decoration: underline; }'
  },
  {
    id: 'sakura',
    name: 'Cherry blossom',
    hint: 'Soft pink petals on white',
    css: theme({
      bg: '#fbe7ee',
      surface: '#fffafb',
      panel: '#fdf0f4',
      text: '#4b3236',
      muted: '#9a7a80',
      link: '#b83d66',
      redlink: '#d0643a',
      accent: '#c9577c',
      'accent-text': '#ffffff',
      border: '#f5d3df',
      'font-body': '"Lora", serif',
      'font-heading': '"Cormorant Garamond", serif'
    })
  },
  {
    id: 'mint',
    name: 'Mint chocolate',
    hint: 'Mint green and dark chocolate',
    css: theme(
      {
        bg: '#4a2f27',
        surface: '#f2fbf6',
        panel: '#ddf3e7',
        text: '#3a2620',
        muted: '#7d6a62',
        link: '#2e8a63',
        redlink: '#c0463a',
        accent: '#7fd1ad',
        'accent-text': '#3a2620',
        border: '#c6e9d6',
        'font-body': '"Nunito", sans-serif',
        'font-heading': '"Fredoka", sans-serif'
      },
      { link: '#a8ecc9', muted: '#cdb8ae' }
    )
  },
  {
    id: 'dragon',
    name: 'Dragon’s hoard',
    hint: 'Ember red, gold and old runes',
    css:
      theme({
        bg: '#1a0a08',
        surface: '#22100d',
        panel: '#2e1612',
        text: '#f3e2c9',
        muted: '#b89a7a',
        link: '#f2b84b',
        redlink: '#ff6a4d',
        accent: '#8c1c13',
        'accent-text': '#ffd37a',
        border: '#4a221a',
        'font-body': '"EB Garamond", serif',
        'font-heading': '"Uncial Antiqua", serif'
      }) + '\n.infobox, .content-card { box-shadow: 0 0 24px rgb(242 184 75 / 0.12); }'
  }
])

/** A mouse pointer made of an emoji. */
const emojiCursor = (emoji: string): string =>
  `body, .app { cursor: url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><text y='18' font-size='18'>${emoji}</text></svg>`).replace(/'/g, '%27')}") 12 12, auto; }`

addLooks('fun', [
  { id: 'sparkle-cursor', name: 'Sparkle mouse pointer', hint: '', css: emojiCursor('✨') },
  { id: 'paw-cursor', name: 'Paw print mouse pointer', hint: '', css: emojiCursor('🐾') },
  { id: 'flower-cursor', name: 'Flower mouse pointer', hint: '', css: emojiCursor('🌸') },
  { id: 'sword-cursor', name: 'Sword mouse pointer', hint: '', css: emojiCursor('🗡️') },
  {
    id: 'glow-title',
    name: 'Glowing page title',
    hint: 'A soft glow that pulses',
    css:
      '.page-title { text-shadow: 0 0 8px color-mix(in srgb, var(--accent) 60%, transparent); }\n' +
      moving(
        '  .page-title { animation: sw-glow 2.5s ease-in-out infinite; }\n  @keyframes sw-glow { 50% { text-shadow: 0 0 18px var(--accent), 0 0 4px var(--accent); } }'
      )
  },
  {
    id: 'type-title',
    name: 'Title types itself in',
    hint: 'Letter by letter, like a typewriter',
    css: moving('  .page-title { animation: sw-type 1.4s steps(28) both; }\n  @keyframes sw-type { from { clip-path: inset(0 100% 0 0); } }')
  },
  {
    id: 'pop-infobox',
    name: 'Infobox pops in',
    hint: 'Springs into place when a page opens',
    css: moving(
      '  .infobox { animation: sw-pop 0.5s cubic-bezier(0.3, 1.6, 0.6, 1) both; }\n  @keyframes sw-pop { from { transform: scale(0.85); opacity: 0; } }'
    )
  },
  {
    id: 'spin-logo',
    name: 'Logo spins under the mouse',
    hint: '',
    css: moving(
      '  .wiki-brand:hover img, .wiki-brand:hover .brand-dot { animation: sw-spin 0.8s ease; }\n  @keyframes sw-spin { to { transform: rotate(360deg); } }'
    )
  },
  {
    id: 'zoom-pictures',
    name: 'Pictures zoom under the mouse',
    hint: 'Gallery, page card and infobox pictures',
    css: '.g-item img, .pc-img img, .ib-image img { transition: transform 0.25s ease; }\n.g-item img:hover, .pc-card:hover .pc-img img, .ib-image img:hover { transform: scale(1.06); }'
  },
  {
    id: 'star-headings',
    name: 'Twinkling stars by headings',
    hint: '',
    css:
      '.prose h2::after { content: " ✦"; color: var(--accent); }\n' +
      moving(
        '  .prose h2::after { display: inline-block; animation: sw-twinkle-h 2s ease-in-out infinite; }\n  @keyframes sw-twinkle-h { 50% { opacity: 0.25; transform: scale(0.7) rotate(20deg); } }'
      )
  },
  {
    id: 'highlight',
    name: 'Colored text highlight',
    hint: 'Selected text in the accent color',
    css: '::selection { background: var(--accent); color: var(--accent-text); }'
  },
  {
    id: 'hue-shift',
    name: 'Color-shifting background',
    hint: 'The background slowly cycles through colors',
    css: moving('  .backdrop { animation: sw-hue-bg 40s linear infinite; }\n  @keyframes sw-hue-bg { to { filter: hue-rotate(360deg); } }')
  }
])

addLooks('weather', [
  {
    id: 'confetti',
    name: 'Confetti',
    hint: 'Party colors falling',
    css: falling(
      'confetti',
      'radial-gradient(3px 5px at 20px 30px, #ff5f6d, transparent), radial-gradient(4px 3px at 90px 110px, #ffc371, transparent), radial-gradient(3px 4px at 150px 50px, #47e891, transparent), radial-gradient(4px 3px at 60px 160px, #4facfe, transparent), radial-gradient(3px 5px at 170px 140px, #b06ab3, transparent)',
      180,
      14
    )
  },
  {
    id: 'leaves',
    name: 'Autumn leaves',
    hint: 'Orange and red, drifting down',
    css: falling(
      'leaves',
      'radial-gradient(6px 4px at 40px 50px, #e07a2e, transparent), radial-gradient(5px 4px at 160px 120px, #c94a2a, transparent), radial-gradient(6px 4px at 100px 190px, #e8a33d, transparent)',
      220,
      26
    )
  },
  {
    id: 'rain',
    name: 'Rain',
    hint: 'Quick falling drops',
    css: falling(
      'rain',
      'radial-gradient(1px 9px at 20px 20px, rgb(170 200 255 / 0.7), transparent), radial-gradient(1px 9px at 70px 80px, rgb(170 200 255 / 0.6), transparent), radial-gradient(1px 9px at 110px 40px, rgb(170 200 255 / 0.7), transparent)',
      120,
      3
    )
  },
  {
    id: 'twinkle',
    name: 'Twinkling night sky',
    hint: 'Best on darker backgrounds',
    css:
      '.backdrop::after { content: ""; position: absolute; inset: 0; background-image: radial-gradient(2px 2px at 30px 40px, #fff, transparent), radial-gradient(1.5px 1.5px at 130px 90px, #fff6c9, transparent), radial-gradient(2px 2px at 200px 180px, #fff, transparent); background-size: 230px 230px; }\n' +
      moving('  .backdrop::after { animation: sw-twinkle 3s ease-in-out infinite; }\n  @keyframes sw-twinkle { 50% { opacity: 0.3; } }')
  },
  {
    id: 'hearts',
    name: 'Floating hearts',
    hint: 'Drifting up',
    css: falling(
      'hearts',
      svgPattern(
        "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><text x='30' y='60' font-size='18' opacity='0.55'>💗</text><text x='130' y='150' font-size='14' opacity='0.45'>💖</text></svg>"
      ),
      200,
      24,
      true
    )
  }
])

const MARK = /\/\* ✦ look: ([\w-]+)\/([\w-]+)[^*]*\*\/\n?([\s\S]*?)\/\* ✦ end \*\/\n?/g

/** Which looks are in the CSS, as "group/look". */
export function activeLooks(css: string): Set<string> {
  return new Set([...css.matchAll(MARK)].map((m) => `${m[1]}/${m[2]}`))
}

/** Take a look (or, without `lookId`, every look of the group) out of the CSS. */
export function removeLook(css: string, groupId: string, lookId?: string): string {
  return css
    .replace(MARK, (all, g: string, l: string) => (g === groupId && (!lookId || l === lookId) ? '' : all))
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+/, '')
}

/** Put a look into the CSS (replacing the group's other look when only one can be picked). */
export function addLook(css: string, group: LookGroup, look: Look): string {
  const base = (group.pick === 'one' ? removeLook(css, group.id) : removeLook(css, group.id, look.id)).replace(/\s*$/, '')
  const block = `/* ✦ look: ${group.id}/${look.id} (${look.name}) */\n${look.css}\n/* ✦ end */\n`
  return (base ? base + '\n\n' : '') + block
}

/** Every look, for checks and the buddy. */
export const ALL_LOOKS = LOOK_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.looks.map((l) => ({ section: s, group: g, look: l }))))
