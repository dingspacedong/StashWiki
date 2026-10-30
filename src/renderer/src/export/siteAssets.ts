// The stylesheet and script shipped with an exported website. Plain CSS/JS with no outside files, so the
// folder works on Neocities, Nekoweb, any static host, or straight from the disk.

export const SITE_CSS = `/* Made with StashWiki */
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  font-family: var(--font-body);
  font-size: 15px;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}
img { max-width: 100%; }
a { color: var(--link); text-decoration: none; }
a:hover { text-decoration: underline; }
.backdrop { position: fixed; inset: 0; background-image: var(--bg-image); background-size: var(--bg-size, cover); background-repeat: var(--bg-repeat, no-repeat); background-position: var(--bg-position, center); pointer-events: none; z-index: 0; }
.topbar, .layout { position: relative; z-index: 1; }
.topbar { z-index: 10; }

.topbar { display: flex; align-items: center; gap: 14px; min-height: 54px; padding: 6px 18px; background: var(--accent); color: var(--accent-text); box-shadow: 0 1px 4px rgb(0 0 0 / 0.18); }
.wiki-brand { display: flex; align-items: center; gap: 10px; color: inherit; font-family: var(--font-heading); font-size: 20px; font-weight: 600; text-decoration: none !important; }
.wiki-brand img { height: 36px; width: 36px; object-fit: contain; border-radius: 6px; }
.brand-dot { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: var(--accent-text); color: var(--accent); font-size: 17px; }
.search { position: relative; flex: 1; max-width: 440px; margin-left: auto; }
.search input { width: 100%; height: 34px; border-radius: 17px; border: 0; padding: 0 16px; background: rgb(255 255 255 / 0.92); color: #202122; font: inherit; font-size: 14px; outline: none; }
.search-drop { position: absolute; top: 40px; left: 0; right: 0; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 28px rgb(0 0 0 / 0.2); overflow: hidden; z-index: 30; }
.search-drop a { display: block; padding: 8px 14px; color: var(--text); text-decoration: none; }
.search-drop a:hover, .search-drop a.sel { background: var(--panel); }
.search-drop small { display: block; color: var(--muted); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.menu-btn { display: none; border: 0; background: none; color: inherit; font-size: 22px; cursor: pointer; }

.layout { display: flex; align-items: flex-start; max-width: 1400px; margin: 0 auto; font-family: var(--font-body); }
.sidebar { width: 190px; flex: none; padding: 20px 10px; position: sticky; top: 0; align-self: stretch; background: var(--sidebar-bg, transparent); }
.nav-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); padding: 0 10px 4px; font-weight: 600; }
.sidebar a { display: block; padding: 5px 10px; border-radius: 6px; }
.sidebar a:hover { background: color-mix(in srgb, var(--surface) 70%, transparent); text-decoration: none; }
.content { flex: 1; min-width: 0; padding: 18px 22px 30px 4px; }
.content-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 20px 32px 32px; box-shadow: 0 1px 3px rgb(0 0 0 / 0.06); }
.site-foot { text-align: center; color: var(--muted); font-size: 12px; margin-top: 14px; }

.page-title { font-family: var(--font-heading); font-weight: 400; font-size: 30px; line-height: 1.25; margin: 0 0 4px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.page-sub { color: var(--muted); font-size: 12.5px; margin-bottom: 14px; }
.page-foot { margin-top: 18px; color: var(--muted); font-size: 12px; }
.muted { color: var(--muted); }
.clear { clear: both; }
.top-matter { margin: 0 0 12px; }
.hatnote { font-style: italic; padding-left: 1.6em; margin: 2px 0; }
.top-quote { margin: 10px 0 0 1.6em; font-style: italic; }
.top-quote-by { font-style: normal; margin-top: 2px; padding-left: 0.4em; }

.prose { line-height: 1.65; }
.prose h2, .prose h3, .prose h4 { font-family: var(--font-heading); }
.prose h2 { overflow: hidden; font-size: 23px; font-weight: 400; border-bottom: 1px solid var(--border); padding-bottom: 3px; margin: 26px 0 10px; }
.prose h3 { font-size: 18px; margin: 20px 0 6px; }
.prose h4 { font-size: 15.5px; margin: 16px 0 4px; }
.prose > :first-child { margin-top: 0; }
.prose p { margin: 0 0 10px; }
.prose ul, .prose ol { margin: 0 0 10px; padding-left: 26px; }
.prose li p { margin: 0 0 2px; }
.prose blockquote { margin: 12px 0; padding: 8px 16px; background: var(--panel); border-left: 4px solid var(--accent); border-radius: 0 6px 6px 0; }
.prose hr { border: 0; border-top: 1px solid var(--border); margin: 18px 0; }
.prose a.external::after { content: "↗"; font-size: 0.75em; margin-left: 1px; vertical-align: super; }
.prose .missing { color: inherit; }
.prose mark { border-radius: 2px; padding: 0 1px; color: inherit; }
.prose table { border-collapse: collapse; margin: 12px 0; min-width: 40%; }
.prose th, .prose td { border: 1px solid var(--border); padding: 6px 10px; vertical-align: top; text-align: left; }
.prose th { background: var(--panel); }
.prose td p, .prose th p { margin: 0; }
.prose img { display: block; border-radius: 4px; cursor: zoom-in; height: auto; }
.prose img[data-align="center"] { margin: 12px auto; }
.prose img[data-align="left"] { float: left; margin: 4px 18px 10px 0; }
.prose img[data-align="right"] { float: right; margin: 4px 0 10px 18px; }
.prose img[data-size="small"] { width: 180px; }
.prose img[data-size="medium"] { width: 320px; }
.prose img[data-size="large"] { width: 520px; }
.prose img[data-size="full"] { width: 100%; float: none; margin: 12px 0; }

.toc { display: inline-block; min-width: 220px; background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 8px 16px 8px 12px; margin: 6px 0 14px; font-size: 13.5px; }
.toc summary { font-weight: 700; cursor: pointer; }
.toc ul { list-style: none; padding: 0; margin: 6px 0 0; }
.toc li { margin: 2px 0; }
.toc .toc-l1 { padding-left: 18px; }
.toc .toc-l2 { padding-left: 36px; }
.toc-num { color: var(--muted); margin-right: 4px; }

.infobox { float: right; clear: right; width: 290px; margin: 0 0 16px 22px; background: var(--panel); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; font-size: 13.5px; }
.ib-title { background: var(--ib-head); color: var(--ib-head-text); font-family: var(--font-heading); font-size: 18px; font-weight: 600; text-align: center; padding: 9px 10px; }
.ib-header { background: color-mix(in srgb, var(--ib-head) 22%, var(--panel)); font-weight: 700; text-align: center; padding: 5px 10px; font-size: 13px; }
.ib-image { margin: 0; padding: 8px; text-align: center; }
.ib-image img { display: block; margin: 0 auto; max-height: 360px; border-radius: 4px; cursor: zoom-in; }
.ib-image figcaption { font-size: 12.5px; color: var(--muted); margin-top: 6px; }
.ib-tabs { display: flex; background: color-mix(in srgb, var(--ib-head) 14%, var(--panel)); border-bottom: 1px solid var(--border); margin: -8px -8px 8px; }
.ib-tabs button { flex: 1; border: 0; border-bottom: 3px solid transparent; background: none; padding: 7px 6px 5px; font: inherit; font-weight: 600; font-size: 13px; color: var(--muted); cursor: pointer; }
.ib-tabs button:hover { color: var(--text); }
.ib-tabs button.active { color: var(--text); border-bottom-color: var(--ib-head); background: color-mix(in srgb, var(--ib-head) 10%, transparent); }
.ib-row { display: grid; grid-template-columns: 38% 1fr; gap: 8px; padding: 6px 10px; border-top: 1px solid var(--border); }
.ib-label { font-weight: 700; }

.gallery { clear: both; margin-top: 26px; }
.gallery-head { display: flex; align-items: baseline; gap: 12px; border-bottom: 1px solid var(--border); padding-bottom: 3px; margin-bottom: 12px; }
.gallery-head h2 { font-family: var(--font-heading); font-weight: 400; font-size: 23px; margin: 0; }
.gallery-count { color: var(--muted); font-size: 12.5px; }
.gallery-toggle { margin-left: auto; border: 0; background: none; color: var(--link); font: inherit; font-size: 13px; cursor: pointer; }
.gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; align-items: start; }
.gallery-grid.collapsed { overflow: hidden; }
.g-item { margin: 0; }
.g-thumb { display: block; aspect-ratio: 1; border: 1px solid var(--border); background: var(--panel); border-radius: 6px; overflow: hidden; cursor: zoom-in; }
.g-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.2s; }
.g-thumb:hover img { transform: scale(1.04); }
.g-item figcaption { font-size: 12.5px; color: var(--muted); text-align: center; margin-top: 5px; line-height: 1.35; }
.lb-data { display: none; }
/* note / tip / warning / spoiler boxes */
.callout { position: relative; margin: 12px 0; padding: 10px 14px 10px 16px; border-radius: 6px; border: 1px solid var(--border); border-left-width: 5px; background: var(--panel); }
.callout::before { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 2px; }
.callout > :last-child { margin-bottom: 0; }
.callout[data-callout="note"] { border-left-color: #3b82c4; }
.callout[data-callout="note"]::before { content: "ⓘ Note"; color: #3b82c4; }
.callout[data-callout="tip"] { border-left-color: #2e9d57; }
.callout[data-callout="tip"]::before { content: "✦ Tip"; color: #2e9d57; }
.callout[data-callout="warning"] { border-left-color: #d9822b; background: color-mix(in srgb, #d9822b 8%, var(--panel)); }
.callout[data-callout="warning"]::before { content: "⚠ Warning"; color: #d9822b; }
.callout[data-callout="spoiler"] { border-left-color: var(--muted); cursor: pointer; }
.callout[data-callout="spoiler"]::before { content: "Spoiler — click to show"; color: var(--muted); }
.callout[data-callout="spoiler"].revealed::before { content: "Spoiler — click to hide"; }
.callout[data-callout="spoiler"]:not(.revealed) > * { filter: blur(6px); user-select: none; }

/* page cards */
.page-cards { margin: 14px 0; display: flex; flex-direction: column; gap: 10px; clear: both; }
.pc-group { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.pc-head { background: var(--accent); color: var(--accent-text); text-align: center; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 10px; font-size: 14px; }
.pc-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; padding: 10px; }
.page-cards .pc-card { position: relative; width: 130px; display: flex; flex-direction: column; border: 3px solid var(--text); border-radius: 4px; overflow: hidden; background: var(--surface); text-decoration: none !important; cursor: pointer; color: inherit; }
.page-cards .pc-card:hover { border-color: var(--link); transform: translateY(-2px); transition: transform 0.15s; }
.pc-img { aspect-ratio: 1; display: grid; place-items: center; background: color-mix(in srgb, var(--accent) 14%, var(--panel)); overflow: hidden; }
.pc-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pc-letter { font-family: var(--font-heading); font-size: 42px; color: var(--accent); }
.pc-tag { position: absolute; top: 3px; left: 3px; background: rgb(0 0 0 / 0.65); color: #fff; font-size: 11px; padding: 1px 5px; border-radius: 3px; }
.pc-name { background: color-mix(in srgb, var(--accent) 80%, black); color: var(--accent-text); font-weight: 700; text-align: center; padding: 6px 4px; font-size: 13px; line-height: 1.25; }
.page-cards .missing .pc-name, .page-cards .pc-card.new .pc-name { background: var(--muted); }


.catlinks { clear: both; margin-top: 26px; padding: 8px 12px; border: 1px solid var(--border); background: var(--panel); border-radius: 6px; font-size: 13px; }
.catlinks b { margin-right: 8px; }
.catlinks a:not(:last-child)::after { content: "|"; color: var(--border); margin: 0 8px; }
.letter-groups { columns: 3 220px; column-gap: 28px; }
.letter-group { break-inside: avoid; margin-bottom: 14px; }
.letter-group h3 { margin: 0 0 4px; font-family: var(--font-heading); border-bottom: 1px solid var(--border); }
.letter-group ul, .category-list { list-style: none; padding: 0; margin: 0; }
.letter-group li { padding: 2px 0; }
.category-list li { padding: 5px 0; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; margin-top: 10px; }
.page-card { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--panel); text-align: center; text-decoration: none !important; }
.page-card:hover { border-color: var(--link); }
.page-card-img { aspect-ratio: 1; display: grid; place-items: center; background: color-mix(in srgb, var(--accent) 12%, var(--panel)); font-family: var(--font-heading); font-size: 40px; color: var(--accent); }
.page-card-img img { width: 100%; height: 100%; object-fit: cover; }
.page-card-title { padding: 7px; font-size: 13.5px; }

.lightbox { position: fixed; inset: 0; background: rgb(10 10 14 / 0.88); display: grid; place-items: center; z-index: 200; padding: 30px 70px; }
.lightbox[hidden] { display: none; }
.lb-figure { margin: 0; display: flex; flex-direction: column; align-items: center; max-height: 100%; max-width: 100%; }
.lb-figure img { max-height: calc(100vh - 170px); max-width: 100%; object-fit: contain; border-radius: 4px; }
.lb-figure figcaption { color: #eee; text-align: center; margin-top: 14px; max-width: 760px; line-height: 1.5; }
.lb-figure figcaption a { color: #9cc3ff; }
.lb-source { font-size: 12.5px; color: #aaa; margin-top: 4px; }
.lb-count { font-size: 12px; color: #888; margin-top: 6px; }
.lb-close, .lb-nav { position: absolute; border: 0; background: rgb(255 255 255 / 0.1); color: #fff; border-radius: 50%; cursor: pointer; font-size: 26px; }
.lb-close { top: 16px; right: 18px; width: 40px; height: 40px; }
.lb-nav { top: 50%; width: 48px; height: 48px; transform: translateY(-50%); }
.lb-prev { left: 14px; }
.lb-next { right: 14px; }

@media (max-width: 760px) {
  .menu-btn { display: block; }
  .search { max-width: none; }
  .wiki-brand span:last-child { display: none; }
  .layout { display: block; }
  .sidebar { display: none; position: static; width: auto; background: var(--surface); border-bottom: 1px solid var(--border); padding: 10px; }
  .sidebar.open { display: block; }
  .content { padding: 10px; }
  .content-card { padding: 16px; }
  .infobox { float: none; width: 100%; margin: 0 0 16px; }
  .prose img[data-align] { float: none; margin: 12px auto; }
  .lightbox { padding: 20px 10px; }
  .lb-nav { display: none; }
}

/* Long words with no spaces wrap instead of pushing out of their box. */
body { overflow-wrap: break-word; }
.ib-row { grid-template-columns: 38% minmax(0, 1fr); }
.ib-title, .ib-header, .ib-label, .ib-value, .ib-tabs button, .pc-name, .pc-tag, .prose td, .prose th,
.page-title, .hatnote, .top-quote, .catlinks a, .toc a, .nav-link, .search-drop a {
  overflow-wrap: anywhere;
  min-width: 0;
}
/* …but a table cell next to a long one still keeps room for its own short words. */
.prose td, .prose th { min-width: 5em; }
/* Note boxes, quotes and fancy blocks sit beside the infobox instead of running under it. */
.prose .callout, .prose > blockquote, .prose .html-block { display: flow-root; }
`

export const SITE_JS = `/* Made with StashWiki: search, random page, picture viewer, infobox tabs, collapsible galleries. */
(function () {
  var pages = window.SW_PAGES || [];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Menu on phones
  var menu = document.querySelector('.menu-btn');
  if (menu) menu.addEventListener('click', function () { document.querySelector('.sidebar').classList.toggle('open'); });

  // A different logo on every page, never the same one twice in a row
  var logo = document.querySelector('.wiki-brand img[data-logos]');
  if (logo) {
    var logos = JSON.parse(logo.getAttribute('data-logos')), last = -1;
    try { var seen = sessionStorage.getItem('sw-logo'); if (seen !== null) last = +seen; } catch (e) {}
    var pick = Math.floor(Math.random() * logos.length);
    if (pick === last) pick = (pick + 1) % logos.length;
    try { sessionStorage.setItem('sw-logo', pick); } catch (e) {}
    logo.src = 'images/' + logos[pick];
  }

  // Random page
  var random = document.getElementById('sw-random');
  if (random) random.addEventListener('click', function (e) {
    e.preventDefault();
    if (pages.length) location.href = pages[Math.floor(Math.random() * pages.length)].u;
  });

  // Search
  var input = document.getElementById('sw-search'), drop = document.querySelector('.search-drop'), sel = 0, hits = [];
  function find(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    var a = [], b = [];
    pages.forEach(function (p) {
      var t = p.t.toLowerCase();
      if (t.indexOf(q) === 0) a.push(p); else if (t.indexOf(q) > -1 || p.s.toLowerCase().indexOf(q) > -1) b.push(p);
    });
    return a.concat(b).slice(0, 8);
  }
  function show() {
    if (!hits.length) { drop.hidden = true; return; }
    drop.innerHTML = hits.map(function (p, i) {
      return '<a href="' + esc(p.u) + '"' + (i === sel ? ' class="sel"' : '') + '>' + esc(p.t) + '<small>' + esc(p.s.slice(0, 90)) + '</small></a>';
    }).join('');
    drop.hidden = false;
  }
  if (input) {
    input.addEventListener('input', function () { hits = find(input.value); sel = 0; show(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, hits.length - 1); show(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); show(); }
      else if (e.key === 'Enter' && hits[sel]) location.href = hits[sel].u;
      else if (e.key === 'Escape') { drop.hidden = true; input.blur(); }
    });
    input.addEventListener('blur', function () { setTimeout(function () { drop.hidden = true; }, 150); });
  }

  // Infobox picture tabs
  document.querySelectorAll('.ib-image[data-tabs]').forEach(function (fig) {
    var buttons = fig.querySelectorAll('.ib-tabs button'), panes = fig.querySelectorAll('.ib-pane');
    buttons.forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b, n) { b.classList.toggle('active', n === i); b.setAttribute('aria-selected', n === i); });
        panes.forEach(function (p, n) { p.hidden = n !== i; });
      });
    });
  });

  // Galleries that start as one row
  document.querySelectorAll('.gallery[data-collapse="1"]').forEach(function (g) {
    var grid = g.querySelector('.gallery-grid'), btn = g.querySelector('.gallery-toggle'), open = false;
    function measure() {
      var kids = grid.children;
      if (!kids.length) return;
      var top = kids[0].offsetTop, h = 0, hidden = 0;
      for (var i = 0; i < kids.length; i++) { if (kids[i].offsetTop <= top + 2) h = Math.max(h, kids[i].offsetHeight); else hidden++; }
      btn.hidden = hidden === 0;
      grid.classList.toggle('collapsed', !open && hidden > 0);
      grid.style.maxHeight = !open && hidden > 0 ? h + 'px' : '';
      btn.textContent = open ? 'Show less' : 'Show all ' + kids.length;
    }
    btn.addEventListener('click', function () { open = !open; measure(); });
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    measure();
  });

  // Picture viewer
  var lb = document.querySelector('.lightbox');
  if (!lb) return;
  var lbImg = lb.querySelector('img'), lbCap = lb.querySelector('figcaption'), group = [], at = 0;
  function render() {
    var it = group[at];
    lbImg.src = it.src;
    lbCap.innerHTML = (it.caption || '') + (it.source ? '<div class="lb-source">Source: ' + it.source + '</div>' : '') +
      (group.length > 1 ? '<div class="lb-count">' + (at + 1) + ' / ' + group.length + '</div>' : '');
    lb.querySelectorAll('.lb-nav').forEach(function (b) { b.hidden = group.length < 2; });
  }
  function item(el) {
    var data = el.closest('[data-lb]') ? el.closest('[data-lb]').querySelector('.lb-data') : null;
    return {
      src: el.getAttribute('data-full') || el.src,
      caption: data ? (data.querySelector('.lb-caption') || {}).innerHTML || '' : esc(el.alt || ''),
      source: data ? (data.querySelector('.lb-src') || {}).innerHTML || '' : ''
    };
  }
  document.addEventListener('click', function (e) {
    var spoiler = e.target.closest('[data-callout="spoiler"]');
    if (spoiler && !e.target.closest('a')) { spoiler.classList.toggle('revealed'); return; }
    var img = e.target.closest('.g-thumb img, .ib-image img, .prose img');
    if (!img || img.closest('.pc-card')) return;
    e.preventDefault();
    var set = img.closest('[data-group]');
    var all = set ? Array.prototype.slice.call(set.querySelectorAll('img[data-full]')) : [img];
    group = all.map(item);
    at = Math.max(0, all.indexOf(img));
    render();
    lb.hidden = false;
  });
  function step(d) { at = (at + d + group.length) % group.length; render(); }
  lb.querySelector('.lb-prev').addEventListener('click', function () { step(-1); });
  lb.querySelector('.lb-next').addEventListener('click', function () { step(1); });
  lb.querySelector('.lb-close').addEventListener('click', function () { lb.hidden = true; });
  lb.addEventListener('click', function (e) { if (e.target === lb) lb.hidden = true; });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') lb.hidden = true;
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });
})();
`
