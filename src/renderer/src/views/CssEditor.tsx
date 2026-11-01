// The wiki's custom CSS: a code box with a live preview of a page beside it. The preview runs in a sealed
// frame, so CSS that goes wrong can't hide this screen; in the rest of the app it only applies while reading.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fontFaceCss } from '@shared/defaults'
import type { Page, WikiMeta } from '@shared/types'
import { useStore } from '../store'
import { buildSite } from '../export/site'
import { SITE_CSS } from '../export/siteAssets'
import { STORY_CSS, STORY_SITE_CSS } from '../lib/storyStyles'
import { CSS_HINTS } from '../lib/customHtml'
import { CodeArea } from '../components/CodeArea'
import LookPicker from '../components/LookPicker'
import { kb } from '../lib/platform'
import { SAMPLE_ID, SAMPLE_NAVBOX, samplePage, sampleImagesUrl } from '../lib/samplePage'

const EXAMPLE = `/* Rounded, glowing infobox */
.infobox { border-radius: 14px; box-shadow: 0 0 18px rgba(150, 90, 255, .35); }

/* Fancy section headings */
.prose h2 { border-bottom: 2px dashed var(--accent); }`

/** A page as the exported website shows it, made to work inside a frame here. `SAMPLE_ID` shows the sample page. */
export function previewDocument(meta: WikiMeta, pages: Record<string, Page>, pageId: string | null): string {
  const all = pageId === SAMPLE_ID ? { ...pages, [SAMPLE_ID]: samplePage(meta) } : pages
  const navboxes = pageId === SAMPLE_ID ? [...(meta.navboxes ?? []), SAMPLE_NAVBOX] : meta.navboxes
  const site = buildSite({ ...meta, customCss: '', customCssOff: false, mix: undefined, navboxes }, all, { only: pageId ?? '-', includePrivate: true })
  const html = (pageId && site.files[site.pageFiles[pageId]]) || site.files['all-pages.html']
  const fonts = new URL('fonts/', document.baseURI).href
  return html
    .replace(
      '<link rel="stylesheet" href="style.css">',
      `<style>${fontFaceCss(fonts)}\n${SITE_CSS}\n${STORY_CSS}\n${STORY_SITE_CSS}</style>\n<style id="sw-custom"></style>`
    )
    .replace(/<script\b[^>]*><\/script>/g, '')
    .replace(/(src|href)="images\/(sw-sample-)/g, `$1="${sampleImagesUrl()}$2`)
    .replace(/(src|href)="images\//g, '$1="stash://wiki/images/')
    .replace(/url\(&quot;images\//g, 'url(&quot;stash://wiki/images/')
}

/**
 * A preview drawn at a desktop window's width and shrunk to fit, so the sidebar shows as it does on a computer
 * (narrower than that, the website switches to its phone layout). `phone` shows the phone layout instead.
 */
function ScaledFrame({
  frameRef,
  boxClass,
  frameClass,
  srcDoc,
  onLoad,
  phone = false
}: {
  frameRef: React.RefObject<HTMLIFrameElement | null>
  boxClass: string
  frameClass: string
  srcDoc: string
  onLoad: () => void
  phone?: boolean
}): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = (): void => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const design = phone ? 390 : Math.max(1100, size.w)
  const scale = size.w ? Math.min(1, size.w / design) : 1
  const left = phone && size.w > design ? (size.w - design) / 2 : 0
  return (
    <div ref={box} className={'preview-box ' + boxClass + (phone ? ' phone' : '')}>
      <iframe
        ref={frameRef}
        className={frameClass}
        title="Preview"
        sandbox="allow-same-origin"
        srcDoc={srcDoc}
        onLoad={onLoad}
        style={{ width: design, height: size.h / scale || '100%', left, transform: `scale(${scale})` }}
      />
    </div>
  )
}

/** The sample page with the wiki's colors and custom CSS, for trying settings out. */
export function SamplePreview(): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const frame = useRef<HTMLIFrameElement>(null)
  const doc = useMemo(() => previewDocument(meta, {}, SAMPLE_ID), [meta.theme, meta.templates, meta.name, meta.logo])
  const push = (): void => {
    const style = frame.current?.contentDocument?.getElementById('sw-custom')
    if (style) style.textContent = meta.customCssOff ? '' : (meta.customCss ?? '')
  }
  useEffect(push, [meta.customCss, meta.customCssOff])
  return (
    <ScaledFrame
      frameRef={frame}
      boxClass="sample-preview-box"
      frameClass="sample-preview"
      srcDoc={doc}
      onLoad={() => {
        push()
        frame.current?.contentDocument?.addEventListener('click', (e) => {
          if ((e.target as Element).closest('a')) e.preventDefault()
        })
      }}
    />
  )
}

export default function CssEditor(): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const pages = useStore((s) => s.pages)
  const [code, setCode] = useState(meta.customCss ?? '')
  const [saved, setSaved] = useState(true)
  // Shown at once; the setting saves in the background.
  const [on, setOn] = useState(!meta.customCssOff)
  const sorted = useMemo(() => Object.values(pages).sort((a, b) => a.title.localeCompare(b.title)), [pages])
  const [pageId, setPageId] = useState<string | null>(SAMPLE_ID)
  const frame = useRef<HTMLIFrameElement>(null)
  const [tab, setTab] = useState<'looks' | 'code'>('looks')
  const [phone, setPhone] = useState(false)
  const latest = useRef(code)
  latest.current = code

  // The wiki this editor belongs to, so a last save still lands there if the wiki is being closed.
  const owner = useRef({ wikiId: useStore.getState().wikiId!, meta })
  owner.current.meta = useStore.getState().meta ?? owner.current.meta
  const save = async (css = latest.current): Promise<void> => {
    const open = useStore.getState().wikiId === owner.current.wikiId ? useStore.getState().meta : null
    const m = open ?? owner.current.meta
    if ((m.customCss ?? '') === css) return setSaved(true)
    if (open) await useStore.getState().saveMeta({ ...m, customCss: css })
    else await window.stash.saveMeta(owner.current.wikiId, { ...m, customCss: css })
    setSaved(true)
  }
  // Saves by itself a moment after typing stops, and when leaving the screen.
  useEffect(() => {
    if (saved) return
    const t = setTimeout(() => void save(), 700)
    return () => clearTimeout(t)
  }, [code, saved])
  useEffect(() => () => void save(), [])

  const doc = useMemo(() => previewDocument(meta, pages, pageId), [pageId, pages, meta.theme, meta.templates, meta.name, meta.logo])
  const push = (): void => {
    const d = frame.current?.contentDocument
    const style = d?.getElementById('sw-custom')
    if (style) style.textContent = on ? latest.current : ''
  }
  useEffect(push, [code, on])

  const onLoad = (): void => {
    push()
    // Links in the preview don't go anywhere.
    frame.current?.contentDocument?.addEventListener('click', (e) => {
      if ((e.target as Element).closest('a')) e.preventDefault()
    })
  }

  return (
    <div className="css-editor">
      <h1 className="page-title">Looks &amp; custom CSS</h1>
      <p className="muted">
        Click ready-made looks to change how the whole wiki looks, and watch the preview on the right. Each one can be taken off again. If you know
        CSS, “Write CSS” shows it all and lets you change anything. It’s used while reading pages and in an exported website (as custom.css), and it
        travels with share files. Pages can have their own looks too (in their editor), and Insert → Fancy block adds ready-made banners, boxes and
        effects inside a page.
      </p>
      <div className="css-toolbar row gap">
        <label className="check">
          <input
            type="checkbox"
            checked={on}
            onChange={(e) => {
              setOn(e.target.checked)
              void useStore.getState().saveMeta({ ...useStore.getState().meta!, customCssOff: !e.target.checked })
            }}
          />
          Use my custom CSS
        </label>
        <span className="muted small">{saved ? 'All changes saved' : 'Saving…'}</span>
        <span className="grow" />
        <div className="seg" title="How wide to show the preview">
          <button className={phone ? '' : 'on'} onClick={() => setPhone(false)}>
            Computer
          </button>
          <button className={phone ? 'on' : ''} onClick={() => setPhone(true)}>
            Phone
          </button>
        </div>
        <button
          className="btn small"
          title="See the HTML and CSS of anything in the preview. You can also right-click something and choose Inspect element."
          onClick={() => void window.stash.openInspector()}
        >
          Inspect element
        </button>
        <label className="field inline">
          <span>Preview</span>
          <select value={pageId ?? ''} onChange={(e) => setPageId(e.target.value || null)}>
            <option value={SAMPLE_ID}>✦ Sample page (one of everything)</option>
            <option value="">All pages list</option>
            {sorted.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="css-split">
        <div className="css-code">
          <div className="seg css-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'looks'} className={tab === 'looks' ? 'on' : ''} onClick={() => setTab('looks')}>
              Ready-made looks
            </button>
            <button role="tab" aria-selected={tab === 'code'} className={tab === 'code' ? 'on' : ''} onClick={() => setTab('code')}>
              Write CSS
            </button>
          </div>
          {tab === 'looks' ? (
            <LookPicker
              css={code}
              onChange={(v) => {
                setCode(v)
                setSaved(false)
              }}
            />
          ) : (
            <>
              <CodeArea
                label="Custom CSS"
                value={code}
                onChange={(v) => {
                  setCode(v)
                  setSaved(false)
                }}
                onSave={() => void save()}
                placeholder={EXAMPLE}
                rows={24}
              />
              <p className="muted small">
                Ready-made looks show up here between “✦ look” comments — change them freely, or delete one whole part to take it off.
              </p>
              {!code && (
                <button className="link-btn small" onClick={() => (setCode(EXAMPLE), setSaved(false))}>
                  Start from an example
                </button>
              )}
            </>
          )}
        </div>
        <ScaledFrame key={phone ? 'phone' : 'computer'} frameRef={frame} boxClass="css-preview-box" frameClass="css-preview" srcDoc={doc} onLoad={onLoad} phone={phone} />
      </div>
      <details className="css-hints" open={tab === 'code'}>
        <summary>What can I style?</summary>
        <table>
          <tbody>
            {CSS_HINTS.map(([sel, what]) => (
              <tr key={sel}>
                <td>
                  <code>{sel}</code>
                </td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          Right-click anything in the preview and choose <b>Inspect element</b> to see its classes and which CSS styles it.
          Colors from Look &amp; settings are available as variables, e.g. <code>var(--accent)</code>, <code>var(--link)</code>,{' '}
          <code>var(--panel)</code>, <code>var(--text)</code>. If your CSS ever hides something you need, press {kb(',')} to come back to Look &amp;
          settings, or untick “Use my custom CSS”.
        </p>
      </details>
    </div>
  )
}
