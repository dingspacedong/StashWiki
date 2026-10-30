// How stories look — used by the app (injected at start-up) and by the exported website, so a story reads
// the same in both. Colors come from the wiki theme variables.

export const STORY_CSS = `
.story-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.02em; border: 1px solid var(--border); background: var(--panel); color: var(--muted); vertical-align: middle; white-space: nowrap; }
.story-badge.status-wip { background: color-mix(in srgb, #e0a12b 16%, var(--panel)); color: #a86a00; border-color: color-mix(in srgb, #e0a12b 45%, var(--border)); }
.story-badge.status-complete { background: color-mix(in srgb, #2e9d57 15%, var(--panel)); color: #1f7a42; border-color: color-mix(in srgb, #2e9d57 45%, var(--border)); }
.story-badge.status-hiatus { color: var(--muted); }
.story-badge.rating-general { color: #1f7a42; }
.story-badge.rating-teen { color: #2a62b8; }
.story-badge.rating-mature { color: #c0601a; }
.story-badge.rating-explicit { color: #c0302b; }
.story-badge.draft { border-style: dashed; }
.story-badge.soft { background: color-mix(in srgb, var(--accent) 12%, var(--panel)); color: var(--accent); border-color: transparent; }
.story-cover { flex: none; display: grid; place-items: center; overflow: hidden; border-radius: 10px; background: linear-gradient(145deg, var(--accent), color-mix(in srgb, var(--accent) 55%, var(--link))); box-shadow: 0 6px 18px rgb(0 0 0 / 0.18); color: var(--accent-text); }
.story-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.story-cover span { font-family: var(--font-heading); font-weight: 700; opacity: 0.9; }
.story-cover.big { width: 180px; aspect-ratio: 2 / 3; }
.story-cover.big span { font-size: 64px; }
.story-cover.small { width: 72px; aspect-ratio: 2 / 3; border-radius: 7px; box-shadow: 0 3px 8px rgb(0 0 0 / 0.15); }
.story-cover.small span { font-size: 28px; }
.story-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); margin: 2px 0 10px; }
.story-crumbs a, .story-crumbs .link-btn { color: var(--link); }
.story-hero { display: flex; gap: 26px; align-items: flex-start; margin: 10px 0 26px; }
.story-hero-text { flex: 1; min-width: 0; }
.story-title { border-bottom: 0; font-size: 34px; margin-bottom: 4px; }
.story-series-line { color: var(--muted); margin-bottom: 4px; }
.story-badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 10px; }
.story-summary { font-size: 15.5px; line-height: 1.65; white-space: pre-wrap; max-width: 72ch; }
.story-stats { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 12px 0; color: var(--muted); font-size: 13.5px; }
.story-stats b { color: var(--text); }
.story-meta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 6px 0; }
.story-meta-label { width: 86px; flex: none; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--panel); font-size: 13px; color: var(--text); }
.chip.warn { background: color-mix(in srgb, #d9822b 12%, var(--panel)); border-color: color-mix(in srgb, #d9822b 40%, var(--border)); }
.chip.link { color: var(--link); cursor: pointer; text-decoration: none; }
.chip.link:hover { border-color: var(--link); }
.chip.missing, .chip.link.missing { color: var(--redlink); }
.story-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.story-chapters h2, .story-series h2 { font-family: var(--font-heading); font-weight: 400; font-size: 23px; border-bottom: 1px solid var(--border); padding-bottom: 3px; }
.chapter-list { list-style: none; padding: 0; margin: 10px 0; display: flex; flex-direction: column; gap: 6px; }
.chapter-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--panel); }
.chapter-row.reading { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.chapter-num { flex: none; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--link) 16%, var(--panel)); color: var(--link); font-weight: 700; font-size: 13px; }
.chapter-row-main { flex: 1; min-width: 0; }
.chapter-row-name { font-weight: 600; font-size: 15px; color: var(--link); text-decoration: none; }
.chapter-row-summary { color: var(--muted); font-size: 13px; margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.chapter-row-meta { flex: none; color: var(--muted); font-size: 12px; text-align: right; white-space: nowrap; }
.story-about { margin-top: 22px; }
.story-series ol { padding-left: 22px; }
.story-shelf { margin: 18px 0 26px; }
.shelf-title { font-family: var(--font-heading); font-weight: 400; font-size: 22px; margin: 0 0 10px; }
.story-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
.story-card { display: flex; gap: 14px; padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: var(--panel); cursor: pointer; color: inherit; text-decoration: none; transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s; }
.story-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgb(0 0 0 / 0.1); border-color: color-mix(in srgb, var(--accent) 45%, var(--border)); }
.story-card-text { min-width: 0; flex: 1; }
.story-card-title { font-family: var(--font-heading); font-size: 18px; font-weight: 600; line-height: 1.25; }
.story-card .story-badges { margin: 6px 0; }
.story-card-summary { margin: 4px 0 6px; font-size: 13.5px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.story-card-meta { color: var(--muted); font-size: 12px; }

.chapter-reader { --read-w: 40em; --read-size: 18px; --read-lh: 1.85; max-width: var(--read-w); margin: 0 auto; font-size: var(--read-size); line-height: var(--read-lh); }
.chapter-head { text-align: center; margin: 14px 0 30px; }
.chapter-kicker { text-transform: uppercase; letter-spacing: 0.22em; font-size: 12px; color: var(--muted); display: flex; justify-content: center; gap: 8px; align-items: center; }
.chapter-title { font-family: var(--font-heading); font-weight: 400; font-size: 2em; line-height: 1.2; margin: 6px 0; border: 0; }
.chapter-meta { color: var(--muted); font-size: 13px; }
.chapter-prose { font-size: inherit; line-height: inherit; }
.chapter-prose p { margin: 0 0 1em; }
.chapter-prose hr { border: 0; text-align: center; margin: 1.6em 0; height: auto; }
.chapter-prose hr::after { content: "✦   ✦   ✦"; color: var(--muted); white-space: pre; }
.author-note { margin: 0 0 26px; padding: 10px 16px; border-left: 3px solid var(--accent); border-radius: 0 10px 10px 0; background: color-mix(in srgb, var(--accent) 7%, var(--panel)); font-size: 0.86em; line-height: 1.6; }
.chapter-prose + .author-note { margin: 26px 0 0; }
.author-note-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--accent); margin-bottom: 2px; }
.chapter-end { text-align: center; margin: 36px 0 6px; font-family: var(--font-heading); font-size: 1.15em; letter-spacing: 0.08em; color: var(--muted); }
.chapter-nav { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; margin-top: 34px; padding-top: 18px; border-top: 1px solid var(--border); font-size: 15px; line-height: 1.4; }
.chapter-nav > :first-child { justify-self: start; }
.chapter-nav > :last-child { justify-self: end; }
.chapter-nav select { max-width: 260px; }
.appears-in { margin-top: 20px; padding: 10px 16px; border: 1px solid var(--border); border-radius: 10px; background: var(--panel); clear: both; }
.appears-in h3 { margin: 2px 0 6px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
.appears-in ul { margin: 0; padding-left: 18px; }
@media (max-width: 700px) {
  .story-hero { flex-direction: column; align-items: center; text-align: center; }
  .story-hero .story-badges, .story-hero .story-stats, .story-hero .story-actions, .story-hero .story-meta-row { justify-content: center; }
  .story-meta-label { width: auto; }
  .chapter-reader { --read-size: 17px; }
  .chapter-nav { grid-template-columns: 1fr 1fr; }
  .chapter-nav select, .chapter-nav > a:not(.btn) { grid-column: 1 / -1; grid-row: 2; justify-self: center; }
}
`

/** Only the exported website needs these (the app has its own buttons). */
export const STORY_SITE_CSS = `
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border-radius: 8px; border: 1px solid var(--accent); background: var(--accent); color: var(--accent-text); font-weight: 600; text-decoration: none; font-size: 14px; }
.btn:hover { filter: brightness(1.08); text-decoration: none; }
.btn.ghost { background: transparent; color: var(--text); border-color: var(--border); }
.btn.ghost:hover { background: var(--panel); }
`
