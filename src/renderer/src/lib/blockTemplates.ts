// Ready-made HTML blocks: pick one, then click the words in the preview to change them. Each block carries
// its own <style> with class names starting "swb-", and uses the wiki's theme colors (var(--accent) …),
// so it fits any wiki. "{id}" is swapped for a unique id when a block is added, so two copies of a block
// with tabs on one page don't get mixed up. Nothing here needs JavaScript.

export interface BlockTemplate {
  id: string
  name: string
  hint: string
  html: string
}
export interface BlockSection {
  id: string
  title: string
  icon: string
  blocks: BlockTemplate[]
}

/** Moving effects stop for people who asked their computer to reduce motion. */
const still = (sel: string): string => `@media (prefers-reduced-motion: reduce) { ${sel} { animation: none; } }`

export const BLOCK_SECTIONS: BlockSection[] = [
  {
    id: 'banners',
    title: 'Banners & titles',
    icon: '🎏',
    blocks: [
      {
        id: 'welcome',
        name: 'Welcome banner',
        hint: 'A big colorful greeting for a main page',
        html: `<div class="swb-banner">
  <div class="swb-banner-title">Welcome to my wiki!</div>
  <div class="swb-banner-sub">Everything about my characters and their world.</div>
</div>
<style>
.swb-banner { text-align: center; padding: 30px 18px; margin: 12px 0; border-radius: 16px; color: var(--accent-text); background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 45%, var(--link))); box-shadow: 0 6px 18px rgb(0 0 0 / 0.15); }
.swb-banner-title { font-family: var(--font-heading); font-size: 2em; font-weight: 700; }
.swb-banner-sub { opacity: 0.92; margin-top: 6px; }
</style>`
      },
      {
        id: 'notice',
        name: 'Announcement',
        hint: 'News or an update, in a dashed box',
        html: `<div class="swb-notice"><b>📢 News:</b> Chapter 3 is out! Start reading on [[Main page]].</div>
<style>
.swb-notice { padding: 10px 14px; margin: 12px 0; border: 2px dashed var(--accent); border-radius: 10px; background: color-mix(in srgb, var(--accent) 8%, var(--panel)); }
</style>`
      },
      {
        id: 'ribbon',
        name: 'Ribbon title',
        hint: 'A title on a ribbon',
        html: `<div class="swb-ribbon"><span>Chapter One</span></div>
<style>
.swb-ribbon { text-align: center; margin: 18px 0; }
.swb-ribbon span { display: inline-block; position: relative; padding: 8px 34px; background: var(--accent); color: var(--accent-text); font-family: var(--font-heading); font-size: 1.3em; clip-path: polygon(0 0, 100% 0, 94% 50%, 100% 100%, 0 100%, 6% 50%); }
</style>`
      },
      {
        id: 'divider',
        name: 'Fancy divider',
        hint: 'A decorative line between parts',
        html: `<div class="swb-divider"><span>✦ ✦ ✦</span></div>
<style>
.swb-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; color: var(--accent); }
.swb-divider::before, .swb-divider::after { content: ""; flex: 1; height: 2px; background: linear-gradient(to right, transparent, var(--accent), transparent); }
</style>`
      }
    ]
  },
  {
    id: 'boxes',
    title: 'Boxes',
    icon: '🗂',
    blocks: [
      {
        id: 'icon-box',
        name: 'Box with an icon',
        hint: 'A tidy box for a highlight',
        html: `<div class="swb-iconbox">
  <div class="swb-iconbox-icon">💡</div>
  <div><b>Did you know?</b><br>Wren has never once lost a game of cards.</div>
</div>
<style>
.swb-iconbox { display: flex; gap: 14px; align-items: center; padding: 12px 16px; margin: 12px 0; border-radius: 12px; background: var(--panel); border: 1px solid var(--border); }
.swb-iconbox-icon { font-size: 2em; }
</style>`
      },
      {
        id: 'quote',
        name: 'Quote card',
        hint: 'A memorable line and who said it',
        html: `<figure class="swb-quote">
  <blockquote>I never get lost. The map does.</blockquote>
  <figcaption>— Wren</figcaption>
</figure>
<style>
.swb-quote { margin: 16px 0; padding: 16px 20px 12px 54px; position: relative; border-radius: 14px; background: var(--panel); border: 1px solid var(--border); }
.swb-quote::before { content: "“"; position: absolute; left: 14px; top: -6px; font-size: 64px; color: var(--accent); font-family: Georgia, serif; }
.swb-quote blockquote { margin: 0; font-size: 1.15em; font-style: italic; border: 0; padding: 0; }
.swb-quote figcaption { text-align: right; color: var(--muted); margin-top: 6px; }
</style>`
      },
      {
        id: 'sticky',
        name: 'Sticky note',
        hint: 'A little yellow note, slightly tilted',
        html: `<div class="swb-sticky">Remember: the lighthouse lamp is never turned off.</div>
<style>
.swb-sticky { max-width: 260px; margin: 14px 0; padding: 18px 16px; background: #fff3a8; color: #3a3420; transform: rotate(-2deg); box-shadow: 3px 5px 10px rgb(0 0 0 / 0.18); font-family: "Comic Neue", "Segoe Print", cursive; }
</style>`
      },
      {
        id: 'warning',
        name: 'Content warning',
        hint: 'A warning readers can open to see more',
        html: `<details class="swb-cw">
  <summary>⚠ Content warning — click to read</summary>
  <p>This page mentions injury and loss.</p>
</details>
<style>
.swb-cw { margin: 12px 0; border: 2px solid #d9822b; border-radius: 10px; padding: 8px 14px; background: color-mix(in srgb, #d9822b 8%, var(--panel)); }
.swb-cw summary { cursor: pointer; font-weight: 700; color: #b5651d; }
</style>`
      },
      {
        id: 'chat',
        name: 'Chat bubbles',
        hint: 'A short conversation between two characters',
        html: `<div class="swb-chat">
  <div class="swb-msg"><b>Wren</b>Did you leave the light on?</div>
  <div class="swb-msg swb-me"><b>Moss</b>Always. You know that.</div>
</div>
<style>
.swb-chat { display: flex; flex-direction: column; gap: 8px; margin: 14px 0; }
.swb-msg { max-width: 70%; padding: 8px 12px; border-radius: 16px 16px 16px 4px; background: var(--panel); border: 1px solid var(--border); }
.swb-msg b { display: block; font-size: 0.8em; color: var(--accent); }
.swb-me { align-self: flex-end; border-radius: 16px 16px 4px 16px; background: color-mix(in srgb, var(--accent) 14%, var(--panel)); }
</style>`
      }
    ]
  },
  {
    id: 'layout',
    title: 'Layout',
    icon: '▥',
    blocks: [
      {
        id: 'two-columns',
        name: 'Two columns',
        hint: 'Side-by-side text (stacks on phones)',
        html: `<div class="swb-cols">
  <div><h3>Before</h3><p>Write about the first part here.</p></div>
  <div><h3>After</h3><p>Write about the second part here.</p></div>
</div>
<style>
.swb-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; margin: 12px 0; }
.swb-cols > div { padding: 4px 14px; border-left: 3px solid var(--accent); }
</style>`
      },
      {
        id: 'cards',
        name: 'Three cards',
        hint: 'Small cards in a row, linking to pages',
        html: `<div class="swb-cards">
  <div class="swb-card"><div class="swb-card-icon">🦉</div><b>[[Wren]]</b><p>The lighthouse keeper.</p></div>
  <div class="swb-card"><div class="swb-card-icon">🌿</div><b>[[Moss]]</b><p>Wren's oldest friend.</p></div>
  <div class="swb-card"><div class="swb-card-icon">🏝</div><b>[[The Island]]</b><p>Where it all happens.</p></div>
</div>
<style>
.swb-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 12px 0; }
.swb-card { text-align: center; padding: 14px 12px; border-radius: 14px; background: var(--panel); border: 1px solid var(--border); }
.swb-card-icon { font-size: 2em; }
.swb-card p { margin: 4px 0 0; color: var(--muted); font-size: 0.92em; }
</style>`
      },
      {
        id: 'buttons',
        name: 'Link buttons',
        hint: 'A row of buttons that open pages',
        html: `<div class="swb-buttons">[[Main page|Home]] [[Wren|Characters]] [[The Island|Places]]</div>
<style>
.swb-buttons { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin: 14px 0; }
.swb-buttons a { padding: 8px 18px; border-radius: 999px; background: var(--accent); color: var(--accent-text) !important; text-decoration: none !important; font-weight: 600; }
.swb-buttons a:hover { filter: brightness(1.1); }
</style>`
      },
      {
        id: 'center',
        name: 'Centered text',
        hint: 'A centered, slightly bigger paragraph',
        html: `<p class="swb-center">The sea remembers everything.</p>
<style>
.swb-center { text-align: center; font-size: 1.2em; margin: 18px auto; max-width: 600px; }
</style>`
      }
    ]
  },
  {
    id: 'characters',
    title: 'Character stuff',
    icon: '🧑',
    blocks: [
      {
        id: 'stats',
        name: 'Star ratings',
        hint: 'Stats with stars (change the stars in the preview)',
        html: `<div class="swb-stats">
  <div><span>Strength</span><b>★★★☆☆</b></div>
  <div><span>Speed</span><b>★★★★☆</b></div>
  <div><span>Kindness</span><b>★★★★★</b></div>
  <div><span>Patience</span><b>★★☆☆☆</b></div>
</div>
<style>
.swb-stats { display: inline-grid; gap: 4px; margin: 12px 0; padding: 10px 16px; border-radius: 12px; background: var(--panel); border: 1px solid var(--border); }
.swb-stats div { display: flex; justify-content: space-between; gap: 28px; }
.swb-stats b { color: var(--accent); letter-spacing: 2px; }
</style>`
      },
      {
        id: 'bars',
        name: 'Stat bars',
        hint: 'Bars that fill up (change the % numbers in the HTML)',
        html: `<div class="swb-bars">
  <div class="swb-bar"><span>Strength</span><i><u style="width: 60%"></u></i></div>
  <div class="swb-bar"><span>Magic</span><i><u style="width: 90%"></u></i></div>
  <div class="swb-bar"><span>Luck</span><i><u style="width: 25%"></u></i></div>
</div>
<style>
.swb-bars { display: grid; gap: 6px; max-width: 420px; margin: 12px 0; }
.swb-bar { display: grid; grid-template-columns: 90px 1fr; align-items: center; gap: 10px; }
.swb-bar i { display: block; height: 12px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 15%, var(--panel)); overflow: hidden; }
.swb-bar u { display: block; height: 100%; border-radius: 999px; background: var(--accent); text-decoration: none; }
</style>`
      },
      {
        id: 'palette',
        name: 'Color palette',
        hint: 'A character’s colors (change the # codes in the HTML)',
        html: `<div class="swb-palette">
  <div><i style="background: #2b2d42"></i>Feathers</div>
  <div><i style="background: #f2c14e"></i>Eyes</div>
  <div><i style="background: #8d99ae"></i>Scarf</div>
</div>
<style>
.swb-palette { display: flex; flex-wrap: wrap; gap: 14px; margin: 12px 0; }
.swb-palette div { text-align: center; font-size: 0.9em; }
.swb-palette i { display: block; width: 56px; height: 56px; margin: 0 auto 4px; border-radius: 50%; border: 3px solid var(--panel); box-shadow: 0 0 0 1px var(--border); }
</style>`
      },
      {
        id: 'likes',
        name: 'Likes & dislikes',
        hint: 'Two lists side by side',
        html: `<div class="swb-likes">
  <div><h4>💖 Likes</h4><ul><li>Rainy nights</li><li>Old maps</li><li>Peppermint tea</li></ul></div>
  <div><h4>💔 Dislikes</h4><ul><li>Loud bells</li><li>Being rushed</li><li>Seagulls</li></ul></div>
</div>
<style>
.swb-likes { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 12px 0; }
.swb-likes > div { padding: 6px 14px; border-radius: 12px; background: var(--panel); border: 1px solid var(--border); }
.swb-likes h4 { margin: 6px 0; }
</style>`
      },
      {
        id: 'relationships',
        name: 'Relationships',
        hint: 'Who they know and how they feel about them',
        html: `<div class="swb-rel">
  <div><b>[[Moss]]</b><span>Best friend 💚</span></div>
  <div><b>[[Captain Marigold]]</b><span>Rival ⚔</span></div>
  <div><b>[[Old Pell]]</b><span>Mentor 📖</span></div>
</div>
<style>
.swb-rel { display: grid; gap: 6px; margin: 12px 0; max-width: 480px; }
.swb-rel div { display: flex; justify-content: space-between; gap: 14px; padding: 7px 14px; border-radius: 999px; background: var(--panel); border: 1px solid var(--border); }
.swb-rel span { color: var(--muted); }
</style>`
      },
      {
        id: 'timeline',
        name: 'Timeline',
        hint: 'Events in order, on a line',
        html: `<ul class="swb-timeline">
  <li><b>Year 1</b> Wren arrives on the island.</li>
  <li><b>Year 3</b> The great storm.</li>
  <li><b>Year 7</b> Wren becomes the lighthouse keeper.</li>
</ul>
<style>
.swb-timeline { list-style: none; margin: 14px 0; padding: 0 0 0 22px; border-left: 3px solid var(--accent); }
.swb-timeline li { position: relative; margin: 0 0 12px; }
.swb-timeline li::before { content: ""; position: absolute; left: -31px; top: 4px; width: 13px; height: 13px; border-radius: 50%; background: var(--accent); border: 3px solid var(--surface); }
.swb-timeline b { display: block; color: var(--accent); }
</style>`
      }
    ]
  },
  {
    id: 'text',
    title: 'Text effects',
    icon: '🌈',
    blocks: [
      {
        id: 'rainbow',
        name: 'Rainbow text',
        hint: 'Colors flowing through the words',
        html: `<p class="swb-rainbow">Happy birthday, Wren!</p>
<style>
.swb-rainbow { font-size: 1.6em; font-weight: 800; text-align: center; background: linear-gradient(90deg, #ff5f6d, #ffc371, #47e891, #4facfe, #b06ab3, #ff5f6d); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; animation: swb-rainbow 5s linear infinite; }
@keyframes swb-rainbow { to { background-position: 200% center; } }
${still('.swb-rainbow')}
</style>`
      },
      {
        id: 'glow',
        name: 'Glowing text',
        hint: 'Softly pulsing glow',
        html: `<p class="swb-glow">✨ The lamp is lit ✨</p>
<style>
.swb-glow { text-align: center; font-size: 1.4em; color: var(--accent); animation: swb-glow 2s ease-in-out infinite alternate; }
@keyframes swb-glow { from { text-shadow: 0 0 2px color-mix(in srgb, var(--accent) 60%, transparent); } to { text-shadow: 0 0 16px var(--accent); } }
${still('.swb-glow')}
</style>`
      },
      {
        id: 'typewriter',
        name: 'Typewriter',
        hint: 'Words appear letter by letter',
        html: `<p class="swb-type"><span>Once upon a time, on a small island…</span></p>
<style>
.swb-type span { display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: bottom; border-right: 2px solid var(--accent); font-family: "Courier Prime", Consolas, monospace; animation: swb-typing 3.5s steps(36) both, swb-caret 0.8s step-end infinite; }
@keyframes swb-typing { from { max-width: 0; } to { max-width: 40em; } }
@keyframes swb-caret { 50% { border-color: transparent; } }
${still('.swb-type span')}
</style>`
      },
      {
        id: 'marquee',
        name: 'Scrolling text',
        hint: 'A line that scrolls across',
        html: `<div class="swb-marquee"><span>★ Now showing: The Lighthouse Saga ★ New pages every week ★</span></div>
<style>
.swb-marquee { overflow: hidden; white-space: nowrap; margin: 12px 0; padding: 6px 0; background: var(--accent); color: var(--accent-text); border-radius: 8px; }
.swb-marquee span { display: inline-block; padding-left: 100%; animation: swb-scroll 14s linear infinite; }
@keyframes swb-scroll { to { transform: translateX(-100%); } }
${still('.swb-marquee span')}
</style>`
      },
      {
        id: 'spooky',
        name: 'Shaky spooky text',
        hint: 'Trembling letters',
        html: `<p class="swb-spooky">Something is in the fog…</p>
<style>
.swb-spooky { font-size: 1.4em; text-align: center; color: #7d3c98; text-shadow: 0 0 6px rgb(125 60 152 / 0.6); animation: swb-shake 0.25s infinite; }
@keyframes swb-shake { 25% { transform: translate(1px, -1px); } 50% { transform: translate(-1px, 1px); } 75% { transform: translate(1px, 1px); } }
${still('.swb-spooky')}
</style>`
      },
      {
        id: 'hidden',
        name: 'Hover to reveal',
        hint: 'Blacked-out words that show under the mouse',
        html: `<p>The traitor was <span class="swb-redact">Old Pell</span> all along.</p>
<style>
.swb-redact { background: var(--text); color: transparent; border-radius: 3px; padding: 0 4px; transition: color 0.2s, background 0.2s; }
.swb-redact:hover { background: transparent; color: inherit; }
</style>`
      }
    ]
  },
  {
    id: 'interactive',
    title: 'Click to open',
    icon: '👆',
    blocks: [
      {
        id: 'collapsible',
        name: 'Fold-out section',
        hint: 'Click the title to open or close',
        html: `<details class="swb-fold">
  <summary>Behind the scenes</summary>
  <p>Wren was first drawn on a napkin in 2019.</p>
</details>
<style>
.swb-fold { margin: 12px 0; border-radius: 10px; background: var(--panel); border: 1px solid var(--border); padding: 8px 14px; }
.swb-fold summary { cursor: pointer; font-weight: 700; }
</style>`
      },
      {
        id: 'faq',
        name: 'Questions & answers',
        hint: 'Several fold-out questions',
        html: `<div class="swb-faq">
  <details><summary>Is Wren an owl?</summary><p>Yes — a barn owl.</p></details>
  <details><summary>Where does Wren live?</summary><p>In the lighthouse on [[The Island]].</p></details>
  <details><summary>Can I draw Wren?</summary><p>Of course! Tag me so I can see.</p></details>
</div>
<style>
.swb-faq details { border-bottom: 1px solid var(--border); padding: 8px 4px; }
.swb-faq summary { cursor: pointer; font-weight: 600; }
.swb-faq summary::marker { color: var(--accent); }
</style>`
      },
      {
        id: 'tabs',
        name: 'Tabs',
        hint: 'Switch between versions, like Past / Present',
        html: `<div class="swb-tabs">
  <input type="radio" name="swb-{id}" id="swb-{id}-1" checked><label for="swb-{id}-1">Past</label>
  <input type="radio" name="swb-{id}" id="swb-{id}-2"><label for="swb-{id}-2">Present</label>
  <input type="radio" name="swb-{id}" id="swb-{id}-3"><label for="swb-{id}-3">Future</label>
  <div class="swb-tab">A shy young owl who had never left the nest.</div>
  <div class="swb-tab">The keeper of the island lighthouse.</div>
  <div class="swb-tab">Nobody knows yet…</div>
</div>
<style>
.swb-tabs { margin: 12px 0; }
.swb-tabs input { position: absolute; opacity: 0; pointer-events: none; }
.swb-tabs label { display: inline-block; padding: 6px 16px; margin-right: 4px; border-radius: 10px 10px 0 0; background: var(--panel); border: 1px solid var(--border); border-bottom: 0; cursor: pointer; }
.swb-tabs input:checked + label { background: var(--accent); color: var(--accent-text); }
.swb-tab { display: none; padding: 12px 14px; border: 1px solid var(--border); border-radius: 0 10px 10px 10px; background: var(--panel); }
.swb-tabs input:nth-of-type(1):checked ~ .swb-tab:nth-of-type(1),
.swb-tabs input:nth-of-type(2):checked ~ .swb-tab:nth-of-type(2),
.swb-tabs input:nth-of-type(3):checked ~ .swb-tab:nth-of-type(3) { display: block; }
</style>`
      },
      {
        id: 'flip',
        name: 'Flip card',
        hint: 'Turns over under the mouse to show the back',
        html: `<div class="swb-flip"><div class="swb-flip-in">
  <div class="swb-front">🦉<br><b>Wren</b></div>
  <div class="swb-back">Secretly afraid of the dark.</div>
</div></div>
<style>
.swb-flip { width: 200px; height: 140px; perspective: 800px; margin: 14px auto; }
.swb-flip-in { position: relative; width: 100%; height: 100%; transition: transform 0.6s; transform-style: preserve-3d; }
.swb-flip:hover .swb-flip-in { transform: rotateY(180deg); }
.swb-front, .swb-back { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; padding: 10px; border-radius: 14px; backface-visibility: hidden; border: 1px solid var(--border); }
.swb-front { background: var(--panel); font-size: 1.3em; }
.swb-back { background: var(--accent); color: var(--accent-text); transform: rotateY(180deg); }
</style>`
      }
    ]
  }
]

// ---------- more blocks ----------

const addBlocks = (sectionId: string, blocks: BlockTemplate[]): void => void BLOCK_SECTIONS.find((s) => s.id === sectionId)!.blocks.push(...blocks)

/** A wiki-style notice box: icon on the left, a bold first line, a colored edge. */
const notice = (cls: string, icon: string, color: string, title: string, text: string): string => `<div class="${cls}">
  <div class="${cls}-icon">${icon}</div>
  <div><b>${title}</b><br>${text}</div>
</div>
<style>
.${cls} { display: flex; gap: 12px; align-items: center; margin: 12px 0; padding: 10px 14px; border: 1px solid color-mix(in srgb, ${color} 45%, var(--border)); border-left: 6px solid ${color}; border-radius: 8px; background: color-mix(in srgb, ${color} 9%, var(--panel)); }
.${cls}-icon { font-size: 1.8em; }
</style>`

addBlocks('banners', [
  { id: 'wip', name: 'Work in progress', hint: '“This page is still being written”', html: notice('swb-wip', '🚧', '#e0a12b', 'Work in progress', 'This page is still being written. Check back soon!') },
  { id: 'stub', name: 'Short page (stub)', hint: 'A page that needs more writing', html: notice('swb-stub', '🌱', '#4a9d5b', 'This page is a stub.', 'It only has the basics so far — more is on the way.') },
  { id: 'spoilers', name: 'Spoiler warning', hint: 'Warns readers before spoilers', html: notice('swb-spoilers', '⚠️', '#d6455d', 'Spoilers ahead!', 'This page talks about the ending of Chapter 5.') },
  {
    id: 'disclaimer',
    name: 'Fan-made disclaimer',
    hint: 'For AUs and fan wikis',
    html: notice('swb-disclaimer', 'ℹ️', '#5b7fd6', 'Fan-made', 'This is a fan-made alternate universe. The original characters belong to their creators.')
  },
  {
    id: 'page-header',
    name: 'Page header',
    hint: 'A big title with a little subtitle under it',
    html: `<div class="swb-header">
  <div class="swb-header-kicker">The Lighthouse Saga</div>
  <div class="swb-header-title">Book One: The Storm</div>
  <div class="swb-header-sub">✦ 12 chapters · finished ✦</div>
</div>
<style>
.swb-header { text-align: center; margin: 14px 0 18px; }
.swb-header-kicker { text-transform: uppercase; letter-spacing: 0.2em; font-size: 0.8em; color: var(--muted); }
.swb-header-title { font-family: var(--font-heading); font-size: 2.1em; color: var(--accent); line-height: 1.2; }
.swb-header-sub { color: var(--muted); margin-top: 4px; }
</style>`
  }
])

addBlocks('boxes', [
  { id: 'alert', name: 'Important box (red)', hint: '', html: notice('swb-alert', '❗', '#d64545', 'Important', 'Write something readers really shouldn’t miss.') },
  { id: 'success', name: 'Good news box (green)', hint: '', html: notice('swb-success', '✅', '#2e9d57', 'Finished!', 'This arc is complete.') },
  {
    id: 'letter',
    name: 'Letter or diary page',
    hint: 'Handwriting on lined paper',
    html: `<div class="swb-letter">
  <p>Dear Moss,</p>
  <p>The storm finally passed. I kept the lamp lit all night, just like you said.</p>
  <p class="swb-letter-sign">— Wren</p>
</div>
<style>
.swb-letter { max-width: 520px; margin: 16px auto; padding: 18px 26px; background: #fffdf4 repeating-linear-gradient(transparent 0 29px, #d8e3f0 29px 30px); color: #2b2b3a; font-family: "Caveat", "Segoe Print", cursive; font-size: 1.35em; line-height: 30px; box-shadow: 0 3px 12px rgb(0 0 0 / 0.15); transform: rotate(-0.6deg); }
.swb-letter p { margin: 0 0 30px; }
.swb-letter-sign { text-align: right; }
</style>`
  },
  {
    id: 'lyrics',
    name: 'Song lyrics or poem',
    hint: 'Centered lines with a title',
    html: `<div class="swb-lyrics">
  <div class="swb-lyrics-title">♪ The Keeper's Song</div>
  <p>Light on the water,<br>light on the stone,<br>nobody's lost<br>who's not alone.</p>
</div>
<style>
.swb-lyrics { text-align: center; margin: 16px auto; padding: 14px 20px; max-width: 460px; border-top: 2px solid var(--accent); border-bottom: 2px solid var(--accent); font-style: italic; }
.swb-lyrics-title { font-style: normal; font-weight: 700; color: var(--accent); margin-bottom: 6px; }
</style>`
  },
  {
    id: 'phone',
    name: 'Text messages',
    hint: 'A phone screen with messages',
    html: `<div class="swb-phone">
  <div class="swb-phone-top">Moss 🌿</div>
  <div class="swb-phone-in">u up?</div>
  <div class="swb-phone-out">always. lighthouse duty</div>
  <div class="swb-phone-in">bring snacks tomorrow?</div>
  <div class="swb-phone-out">obviously 🍪</div>
</div>
<style>
.swb-phone { width: 250px; margin: 16px auto; padding: 10px 10px 16px; border: 6px solid #222; border-radius: 28px; background: #f4f4f8; display: flex; flex-direction: column; gap: 6px; font-family: system-ui, sans-serif; font-size: 0.9em; color: #222; }
.swb-phone-top { text-align: center; font-weight: 700; padding: 4px 0 8px; border-bottom: 1px solid #ddd; margin-bottom: 4px; }
.swb-phone-in, .swb-phone-out { max-width: 75%; padding: 6px 10px; border-radius: 16px; }
.swb-phone-in { background: #e4e4ea; align-self: flex-start; }
.swb-phone-out { background: #2f80ff; color: #fff; align-self: flex-end; }
</style>`
  },
  {
    id: 'pull-quote',
    name: 'Big pull quote',
    hint: 'A line pulled out in large letters',
    html: `<p class="swb-pull">“Nobody is lost who is not alone.”</p>
<style>
.swb-pull { margin: 20px auto; max-width: 560px; text-align: center; font-family: var(--font-heading); font-size: 1.6em; line-height: 1.3; color: var(--accent); }
.swb-pull::before, .swb-pull::after { content: ""; display: block; width: 60px; height: 2px; margin: 10px auto; background: var(--accent); }
</style>`
  }
])

addBlocks('layout', [
  {
    id: 'side-box',
    name: 'Small box on the side',
    hint: 'Text flows around it, like a mini infobox',
    html: `<aside class="swb-side">
  <b>Quick facts</b>
  <ul><li>Born in the north</li><li>Afraid of the dark</li><li>Loves peppermint</li></ul>
</aside>
<style>
.swb-side { float: right; clear: right; width: 200px; margin: 4px 0 12px 18px; padding: 10px 14px; border-radius: 12px; background: var(--panel); border: 1px solid var(--border); font-size: 0.92em; }
.swb-side ul { margin: 6px 0 0; padding-left: 18px; }
@media (max-width: 600px) { .swb-side { float: none; width: auto; margin: 10px 0; } }
</style>`
  },
  {
    id: 'icon-grid',
    name: 'Icon grid',
    hint: 'Four little tiles with emoji and labels',
    html: `<div class="swb-grid">
  <div><span>🏠</span>[[Main page|Home]]</div>
  <div><span>🦉</span>[[Wren|Characters]]</div>
  <div><span>🗺</span>[[The Island|Places]]</div>
  <div><span>📖</span>[[Chapter One|Story]]</div>
</div>
<style>
.swb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin: 14px 0; }
.swb-grid div { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px 8px; border-radius: 14px; background: var(--panel); border: 1px solid var(--border); font-weight: 600; }
.swb-grid span { font-size: 2em; }
</style>`
  },
  {
    id: 'facts-table',
    name: 'Facts table',
    hint: 'A neat two-column table',
    html: `<table class="swb-facts">
  <tr><th>First seen</th><td>Chapter 1</td></tr>
  <tr><th>Voice</th><td>Soft, a little raspy</td></tr>
  <tr><th>Favorite place</th><td>The lamp room</td></tr>
</table>
<style>
.swb-facts { border-collapse: separate; border-spacing: 0; margin: 12px 0; min-width: 300px; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
.swb-facts th, .swb-facts td { padding: 7px 12px; text-align: left; border: 0; border-bottom: 1px solid var(--border); }
.swb-facts tr:last-child th, .swb-facts tr:last-child td { border-bottom: 0; }
.swb-facts th { background: color-mix(in srgb, var(--accent) 12%, var(--panel)); width: 40%; }
</style>`
  },
  {
    id: 'split-banner',
    name: 'Big emoji with text',
    hint: 'A large emoji beside a paragraph',
    html: `<div class="swb-split">
  <div class="swb-split-art">🌊</div>
  <div><h3>The Island</h3><p>A small rocky island with one lighthouse, two goats and far too many seagulls.</p></div>
</div>
<style>
.swb-split { display: flex; gap: 18px; align-items: center; margin: 14px 0; padding: 14px 18px; border-radius: 16px; background: var(--panel); border: 1px solid var(--border); }
.swb-split-art { font-size: 4em; line-height: 1; }
.swb-split h3 { margin: 0 0 4px; }
.swb-split p { margin: 0; }
</style>`
  }
])

addBlocks('characters', [
  {
    id: 'traits',
    name: 'Personality tags',
    hint: 'Little pills like “Brave” and “Stubborn”',
    html: `<div class="swb-tags"><span>Brave</span><span>Stubborn</span><span>Night owl</span><span>Kind</span><span>Secretly funny</span></div>
<style>
.swb-tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
.swb-tags span { padding: 4px 12px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 15%, var(--panel)); border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border)); font-size: 0.9em; }
</style>`
  },
  {
    id: 'theme-song',
    name: 'Theme song',
    hint: 'A song that fits the character',
    html: `<div class="swb-song">
  <div class="swb-song-icon">♫</div>
  <div><b>Theme song</b><br>“Lighthouse” — The Night Birds</div>
</div>
<style>
.swb-song { display: inline-flex; gap: 12px; align-items: center; margin: 12px 0; padding: 10px 18px 10px 12px; border-radius: 999px; background: var(--accent); color: var(--accent-text); }
.swb-song-icon { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; background: rgb(255 255 255 / 0.2); font-size: 1.3em; }
</style>`
  },
  {
    id: 'birthday',
    name: 'Birthday card',
    hint: 'Birthday, star sign and age',
    html: `<div class="swb-bday">
  <div class="swb-bday-date">🎂 14 March</div>
  <div>Pisces ♓ · 19 years old</div>
</div>
<style>
.swb-bday { display: inline-block; margin: 12px 0; padding: 12px 20px; border-radius: 14px; text-align: center; background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, var(--panel)), var(--panel)); border: 1px solid var(--border); }
.swb-bday-date { font-size: 1.4em; font-weight: 700; color: var(--accent); }
</style>`
  },
  {
    id: 'alignment',
    name: 'Alignment chart',
    hint: 'The 3×3 good/evil chart (the ★ marks theirs)',
    html: `<div class="swb-align">
  <div>Lawful good</div><div>Neutral good ★</div><div>Chaotic good</div>
  <div>Lawful neutral</div><div>True neutral</div><div>Chaotic neutral</div>
  <div>Lawful evil</div><div>Neutral evil</div><div>Chaotic evil</div>
</div>
<style>
.swb-align { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; max-width: 420px; margin: 12px 0; }
.swb-align div { padding: 10px 6px; text-align: center; font-size: 0.85em; border-radius: 6px; background: var(--panel); border: 1px solid var(--border); }
</style>`
  },
  {
    id: 'family',
    name: 'Family tree',
    hint: 'Parents above, children below',
    html: `<div class="swb-tree"><ul>
  <li><span>[[Old Pell]] & [[Maren]]</span>
    <ul>
      <li><span>[[Wren]]</span></li>
      <li><span>[[Moss]]</span></li>
      <li><span>[[Kit]]</span></li>
    </ul>
  </li>
</ul></div>
<style>
.swb-tree { margin: 14px 0; overflow-x: auto; }
.swb-tree ul { display: flex; justify-content: center; padding: 18px 0 0; margin: 0; position: relative; list-style: none; }
.swb-tree > ul { padding-top: 0; }
.swb-tree li { position: relative; padding: 18px 6px 0; text-align: center; }
.swb-tree li::before, .swb-tree li::after { content: ""; position: absolute; top: 0; right: 50%; width: 50%; height: 18px; border-top: 2px solid var(--border); }
.swb-tree li::after { right: auto; left: 50%; border-left: 2px solid var(--border); }
.swb-tree li:only-child::before, .swb-tree li:only-child::after { display: none; }
.swb-tree li:only-child { padding-top: 0; }
.swb-tree li:first-child::before, .swb-tree li:last-child::after { border: 0; }
.swb-tree li:last-child::before { border-right: 2px solid var(--border); }
.swb-tree ul ul::before { content: ""; position: absolute; top: 0; left: 50%; height: 18px; border-left: 2px solid var(--border); }
.swb-tree span { display: inline-block; padding: 6px 12px; border-radius: 10px; background: var(--panel); border: 1px solid var(--border); white-space: nowrap; }
</style>`
  }
])

addBlocks('text', [
  {
    id: 'neon',
    name: 'Neon sign',
    hint: 'Glowing tube letters',
    html: `<p class="swb-neon">OPEN ALL NIGHT</p>
<style>
.swb-neon { text-align: center; margin: 16px 0; padding: 14px; border-radius: 12px; background: #120a1c; color: #fff; font-family: "Audiowide", sans-serif; font-size: 1.6em; letter-spacing: 0.08em; text-shadow: 0 0 4px #fff, 0 0 10px #ff4fd8, 0 0 22px #ff4fd8, 0 0 40px #ff4fd8; animation: swb-flicker 4s infinite; }
@keyframes swb-flicker { 0%, 92%, 100% { opacity: 1; } 93% { opacity: 0.6; } 95% { opacity: 1; } 97% { opacity: 0.7; } }
${still('.swb-neon')}
</style>`
  },
  {
    id: 'glitch',
    name: 'Glitch text',
    hint: 'Shaky digital color split',
    html: `<p class="swb-glitch">SIGNAL LOST</p>
<style>
.swb-glitch { text-align: center; font-family: "VT323", monospace; font-size: 2em; letter-spacing: 0.1em; text-shadow: 2px 0 #ff2a6d, -2px 0 #05d9e8; animation: swb-glitch 1.5s infinite; }
@keyframes swb-glitch { 0%, 88%, 100% { transform: none; text-shadow: 2px 0 #ff2a6d, -2px 0 #05d9e8; } 90% { transform: translate(-2px, 1px); text-shadow: -3px 0 #ff2a6d, 3px 0 #05d9e8; } 94% { transform: translate(2px, -1px); } }
${still('.swb-glitch')}
</style>`
  },
  {
    id: 'marker',
    name: 'Highlighter pen',
    hint: 'Words marked with a highlighter',
    html: `<p>She never <mark class="swb-marker">once</mark> let the lamp go out.</p>
<style>
.swb-marker { background: linear-gradient(transparent 50%, #ffe46b 50%); color: inherit; padding: 0 2px; }
</style>`
  },
  {
    id: 'handwritten',
    name: 'Handwritten note',
    hint: 'A note in handwriting',
    html: `<p class="swb-hand">Don't forget to feed the goats!! — W</p>
<style>
.swb-hand { font-family: "Caveat", "Segoe Print", cursive; font-size: 1.6em; color: var(--accent); transform: rotate(-1.5deg); margin: 14px 0; }
</style>`
  },
  {
    id: 'gradient-text',
    name: 'Gradient heading',
    hint: 'A big heading in two colors',
    html: `<p class="swb-gradtext">Chapter Two</p>
<style>
.swb-gradtext { font-family: var(--font-heading); font-size: 2.2em; font-weight: 700; margin: 12px 0; background: linear-gradient(90deg, var(--accent), var(--link)); -webkit-background-clip: text; background-clip: text; color: transparent; }
</style>`
  },
  {
    id: 'pixel',
    name: 'Pixel game text',
    hint: 'Like an old video game',
    html: `<p class="swb-pixel">★ LEVEL UP! ★</p>
<style>
.swb-pixel { display: inline-block; margin: 12px 0; padding: 10px 16px; background: #222; color: #ffe14d; font-family: "Press Start 2P", monospace; font-size: 0.85em; box-shadow: 4px 4px 0 #000; }
</style>`
  }
])

addBlocks('interactive', [
  {
    id: 'spoiler-click',
    name: 'Click to reveal',
    hint: 'A hidden secret readers click to see',
    html: `<details class="swb-reveal">
  <summary>🔒 Click to reveal the secret</summary>
  <p>Wren was the one who rang the bell.</p>
</details>
<style>
.swb-reveal { margin: 12px 0; }
.swb-reveal summary { display: inline-block; cursor: pointer; padding: 6px 14px; border-radius: 8px; background: var(--text); color: var(--surface); list-style: none; }
.swb-reveal summary::-webkit-details-marker { display: none; }
.swb-reveal[open] summary { background: var(--panel); color: var(--muted); }
.swb-reveal p { padding: 8px 2px; }
</style>`
  },
  {
    id: 'hover-caption',
    name: 'Hover to learn more',
    hint: 'A tile that shows a caption under the mouse',
    html: `<div class="swb-hover">
  <div class="swb-hover-face">🗝<br><b>The Brass Key</b></div>
  <div class="swb-hover-caption">Opens the lamp room. Nobody knows who made it.</div>
</div>
<style>
.swb-hover { position: relative; width: 220px; height: 150px; margin: 14px auto; border-radius: 14px; overflow: hidden; background: var(--panel); border: 1px solid var(--border); }
.swb-hover-face { height: 100%; display: grid; place-items: center; text-align: center; font-size: 1.2em; }
.swb-hover-caption { position: absolute; inset: auto 0 0 0; padding: 10px 12px; background: color-mix(in srgb, var(--accent) 92%, transparent); color: var(--accent-text); transform: translateY(100%); transition: transform 0.25s; }
.swb-hover:hover .swb-hover-caption { transform: none; }
</style>`
  },
  {
    id: 'plus-accordion',
    name: 'Fold-outs with + signs',
    hint: 'Neat sections that open with a +',
    html: `<div class="swb-acc">
  <details><summary>Early life</summary><p>Grew up on the mainland.</p></details>
  <details><summary>Arrival</summary><p>Came to the island in a storm.</p></details>
  <details><summary>Today</summary><p>Keeps the lighthouse.</p></details>
</div>
<style>
.swb-acc { margin: 12px 0; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.swb-acc details + details { border-top: 1px solid var(--border); }
.swb-acc summary { list-style: none; cursor: pointer; padding: 10px 14px; font-weight: 600; background: var(--panel); display: flex; justify-content: space-between; }
.swb-acc summary::-webkit-details-marker { display: none; }
.swb-acc summary::after { content: "+"; color: var(--accent); font-weight: 700; }
.swb-acc details[open] summary::after { content: "−"; }
.swb-acc p { margin: 0; padding: 10px 14px; }
</style>`
  }
])

BLOCK_SECTIONS.splice(BLOCK_SECTIONS.findIndex((s) => s.id === 'layout') + 1, 0, {
  id: 'navigation',
  title: 'Navigation',
  icon: '🧭',
  blocks: [
    {
      id: 'navbox',
      name: 'Navigation box',
      hint: 'The box of related links at the bottom of a page',
      html: `<div class="swb-navbox">
  <div class="swb-navbox-title">The Lighthouse Saga</div>
  <div class="swb-navbox-row"><b>Characters</b><span>[[Wren]] · [[Moss]] · [[Old Pell]] · [[Captain Marigold]]</span></div>
  <div class="swb-navbox-row"><b>Places</b><span>[[The Island]] · [[The Lighthouse]] · [[The Mainland]]</span></div>
  <div class="swb-navbox-row"><b>Story</b><span>[[Chapter One]] · [[Chapter Two]] · [[Chapter Three]]</span></div>
</div>
<style>
.swb-navbox { clear: both; margin: 18px 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; font-size: 0.92em; }
.swb-navbox-title { text-align: center; font-weight: 700; padding: 6px; background: var(--accent); color: var(--accent-text); }
.swb-navbox-row { display: grid; grid-template-columns: 120px 1fr; border-top: 1px solid var(--border); }
.swb-navbox-row b { padding: 6px 10px; background: color-mix(in srgb, var(--accent) 12%, var(--panel)); text-align: right; }
.swb-navbox-row span { padding: 6px 10px; }
</style>`
    },
    {
      id: 'breadcrumbs',
      name: 'Breadcrumbs',
      hint: 'Home › Characters › Wren',
      html: `<div class="swb-crumbs">[[Main page|Home]] <i>›</i> [[Characters]] <i>›</i> Wren</div>
<style>
.swb-crumbs { font-size: 0.9em; color: var(--muted); margin: 0 0 10px; }
.swb-crumbs i { font-style: normal; margin: 0 4px; }
</style>`
    },
    {
      id: 'prev-next',
      name: 'Previous / next',
      hint: 'Buttons to the chapter before and after',
      html: `<div class="swb-prevnext">
  <span>← [[Chapter One]]</span>
  <span>[[Chapter Three]] →</span>
</div>
<style>
.swb-prevnext { display: flex; justify-content: space-between; gap: 10px; margin: 18px 0; }
.swb-prevnext span { padding: 8px 16px; border-radius: 10px; background: var(--panel); border: 1px solid var(--border); }
</style>`
    },
    {
      id: 'see-also',
      name: 'See also',
      hint: 'A short list of related pages',
      html: `<div class="swb-seealso"><b>See also</b>
  <ul><li>[[Moss]]</li><li>[[The Lighthouse]]</li><li>[[The Great Storm]]</li></ul>
</div>
<style>
.swb-seealso { margin: 14px 0; padding: 8px 14px; border-left: 4px solid var(--accent); background: var(--panel); border-radius: 0 10px 10px 0; }
.swb-seealso ul { margin: 4px 0; columns: 2; }
</style>`
    },
    {
      id: 'main-article',
      name: '“Main article” line',
      hint: 'Points to a page with the full story',
      html: `<p class="swb-main">Main article: [[The Great Storm]]</p>
<style>
.swb-main { font-style: italic; padding-left: 1.6em; color: var(--muted); }
</style>`
    },
    {
      id: 'tag-cloud',
      name: 'Link pills',
      hint: 'Pages as little rounded tags',
      html: `<div class="swb-pills">[[Wren]] [[Moss]] [[Old Pell]] [[Kit]] [[Captain Marigold]] [[Maren]]</div>
<style>
.swb-pills { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
.swb-pills a { padding: 3px 12px; border-radius: 999px; border: 1px solid var(--border); background: var(--panel); text-decoration: none !important; }
.swb-pills a:hover { border-color: var(--accent); }
</style>`
    }
  ]
})

/** A block's HTML, ready to add (with its own ids). */
export function blockHtml(t: BlockTemplate): string {
  const id = Math.random().toString(36).slice(2, 7)
  return t.html.replace(/\{id\}/g, id)
}

export const ALL_BLOCKS = BLOCK_SECTIONS.flatMap((s) => s.blocks)
