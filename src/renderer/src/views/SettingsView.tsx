import { useEffect, useRef } from 'react'
import type { WikiMeta } from '@shared/types'
import { sortedPages, useStore } from '../store'
import { imgUrl } from '../lib/theme'
import ThemeEditor from '../components/ThemeEditor'
import { AiSettingsSection } from '../ai/gate'
import ShareSection from '../share/ShareSection'
import { usePrefs } from '../lib/prefs'
import UpdatesSection from '../components/UpdatesSection'

export default function SettingsView(): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const pages = useStore((s) => s.pages)
  const wikiId = useStore((s) => s.wikiId)!
  const dir = useStore((s) => s.dir)
  const simple = usePrefs((s) => s.simple)
  const storyCount = Object.values(pages).filter((p) => p.story).length
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pendingMeta = useRef<WikiMeta | null>(null)

  // Show changes instantly, write them to disk once the user pauses.
  const change = (patch: Partial<WikiMeta>): void => {
    const next = { ...useStore.getState().meta!, ...patch }
    useStore.setState({ meta: next })
    pendingMeta.current = next
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = undefined
      void window.stash.saveMeta(wikiId, useStore.getState().meta ?? next)
    }, 400)
  }
  useEffect(
    () => () => {
      // Leaving (even by closing the wiki): write what's waiting, to this wiki.
      if (timer.current && pendingMeta.current) {
        clearTimeout(timer.current)
        void window.stash.saveMeta(wikiId, useStore.getState().wikiId === wikiId && useStore.getState().meta ? useStore.getState().meta! : pendingMeta.current)
      }
    },
    [wikiId]
  )

  return (
    <div className="settings-view">
      <h1 className="page-title">Look &amp; settings</h1>

      <section className="settings-section editing-style">
        <h2>Editing style</h2>
        <div className="style-choices">
          <button className={'style-choice' + (!simple ? ' on' : '')} onClick={() => usePrefs.getState().setSimple(false)} aria-pressed={!simple}>
            <strong>Classic</strong>
            <span>A full editor for each page: infobox form, sections, galleries and a Save button.</span>
          </button>
          <button className={'style-choice' + (simple ? ' on' : '')} onClick={() => usePrefs.getState().setSimple(true)} aria-pressed={simple}>
            <strong>Simple</strong>
            <span>Type straight onto the page as it looks when reading; it saves by itself. Adds “+ Character”-style buttons to the sidebar.</span>
          </button>
        </div>
        <p className="muted small">Only changes how you edit, on this computer. Pages look the same either way.</p>
      </section>

      <section className="settings-section">
        <h2>Wiki</h2>
        <label className="field">
          <span>Wiki name</span>
          <input value={meta.name} onChange={(e) => change({ name: e.target.value })} onBlur={() => !meta.name.trim() && change({ name: 'My Wiki' })} />
        </label>
        <label className="field">
          <span>Tagline under page titles</span>
          <input value={meta.tagline} placeholder="e.g. From the Starfall AU Wiki" onChange={(e) => change({ tagline: e.target.value })} />
        </label>
        <div className="field">
          <span>Logo</span>
          <div className="row gap">
            {meta.logo ? <img className="logo-preview" src={imgUrl(meta.logo)} alt="" /> : <span className="muted">None — the first letter of the name is used.</span>}
            <button
              className="btn small"
              onClick={async () => {
                const [file] = await window.stash.pickImages(wikiId, false)
                if (file) change({ logo: file })
              }}
            >
              Choose…
            </button>
            {meta.logo && (
              <button className="link-btn danger" onClick={() => change({ logo: '' })}>
                Remove
              </button>
            )}
          </div>
        </div>
        <label className="field">
          <span>Main page</span>
          <select value={meta.mainPageId ?? ''} onChange={(e) => change({ mainPageId: e.target.value || null })}>
            <option value="">(none — opens All pages)</option>
            {sortedPages(pages).map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="settings-section">
        <h2>Colors &amp; fonts</h2>
        <p className="muted">These apply to the whole wiki. Each page can also have its own colors (in the page editor).</p>
        <ThemeEditor
          value={meta.theme}
          base={meta.theme}
          onChange={(t) => change({ theme: { ...meta.theme, ...t, backgroundImage: t.backgroundImage ?? '' } })}
          isPage={false}
          wikiId={wikiId}
        />
      </section>

      <section className="settings-section">
        <h2>Looks &amp; custom CSS</h2>
        <p className="muted">
          Ready-made looks you switch on with a click (rounded infobox, fancy headings, patterns, fun effects…) with a live preview — or write
          your own CSS. Kept every time you export the website. Inside a page, the editor’s Insert → Fancy block adds ready-made banners, boxes
          and effects.
        </p>
        <div className="row gap">
          <button className="btn small" onClick={() => useStore.getState().go({ kind: 'special', name: 'css' })}>
            Choose looks / edit CSS
          </button>
          {meta.customCss?.trim() && (
            <span className="muted small">{meta.customCssOff ? 'Custom CSS is switched off.' : `${meta.customCss.split('\n').length} lines of custom CSS in use.`}</span>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h2>Stories</h2>
        <label className="check">
          <input type="checkbox" checked={!meta.storiesOff} onChange={(e) => change({ storiesOff: !e.target.checked })} />
          Use Stories in this wiki
        </label>
        <p className="muted">
          Write fanfic and other stories with chapters, right next to your wiki. Switching it off hides the Stories shelf and everything about
          stories (they also stay out of the exported website) — nothing is deleted, and switching it back on brings it all back.
          {storyCount > 0 && ` This wiki has ${storyCount} stor${storyCount === 1 ? 'y' : 'ies'}.`}
        </p>
      </section>

      <ShareSection />

      {__AI__ && <AiSettingsSection />}

      <UpdatesSection />

      <section className="settings-section">
        <h2>Where this wiki is stored</h2>
        <p>
          <code className="path">{dir}</code>
        </p>
        <p className="muted">
          Everything is plain files in this folder (pages, pictures and the trash). Nothing is uploaded anywhere. To back the wiki up, copy this folder somewhere safe; to move it to another PC, copy it over and use “Open a wiki folder”.
        </p>
        <div className="row gap">
          <button className="btn small" onClick={() => void window.stash.revealWiki(wikiId)}>
            Show folder
          </button>
          <button className="btn small ghost" onClick={() => useStore.getState().closeWiki()}>
            Switch to another wiki
          </button>
        </div>
      </section>
    </div>
  )
}
