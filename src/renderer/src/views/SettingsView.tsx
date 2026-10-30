import { useEffect, useRef, useState } from 'react'
import type { MixSettings, WikiMeta } from '@shared/types'
import { sortedPages, useStore } from '../store'
import { imgUrl } from '../lib/theme'
import ThemeEditor from '../components/ThemeEditor'
import { AiSettingsSection } from '../ai/gate'
import ShareSection from '../share/ShareSection'
import { usePrefs } from '../lib/prefs'
import UpdatesSection from '../components/UpdatesSection'
import { SamplePreview } from './CssEditor'
import { COLOR_THEMES, MINE, allLogos, mixOn, useMix } from '../lib/mixUp'

/** Color-theme looks to pick from, with two colors each for a little swatch. */
const swatch = (css: string, name: string): string => css.match(new RegExp(`--${name}: ([^;]+);`))?.[1] ?? 'transparent'
const LOOK_CHOICES = COLOR_THEMES.map((t) => ({
  id: t.look.id,
  name: t.look.name,
  bg: swatch(t.look.css, 'bg'),
  accent: swatch(t.look.css, 'accent')
}))

export default function SettingsView(): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const pages = useStore((s) => s.pages)
  const wikiId = useStore((s) => s.wikiId)!
  const dir = useStore((s) => s.dir)
  const simple = usePrefs((s) => s.simple)
  const storyCount = Object.values(pages).filter((p) => p.story).length
  const logos = allLogos(meta)
  const [sample, setSample] = useState(false)
  const themeChoices = [{ id: MINE, name: 'My own colors', bg: meta.theme.background, accent: meta.theme.accent }, ...LOOK_CHOICES]
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
        void window.stash.saveMeta(
          wikiId,
          useStore.getState().wikiId === wikiId && useStore.getState().meta ? useStore.getState().meta! : pendingMeta.current
        )
      }
    },
    [wikiId]
  )

  const setLogos = (all: string[]): void => {
    // Pictures are named by their content, so the same picture added twice is the same file.
    const list = [...new Set(all)]
    const extra = list.slice(1)
    change({ logo: list[0] ?? '', extraLogos: extra, ...(extra.length ? {} : { mix: { ...meta.mix, logos: false } }) })
  }
  const setMix = (patch: Partial<MixSettings>): void => change({ mix: { ...useStore.getState().meta!.mix, ...patch } })

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
          <input
            value={meta.name}
            onChange={(e) => change({ name: e.target.value })}
            onBlur={() => !meta.name.trim() && change({ name: 'My Wiki' })}
          />
        </label>
        <label className="field">
          <span>Tagline under page titles</span>
          <input value={meta.tagline} placeholder="e.g. From the Starfall AU Wiki" onChange={(e) => change({ tagline: e.target.value })} />
        </label>
        <div className="field">
          <span>Logo</span>
          <div className="row gap wrap">
            {logos.length ? (
              logos.map((l, i) => (
                <span key={l + i} className="logo-item">
                  <img className="logo-preview" src={imgUrl(l)} alt="" />
                  <button
                    className="link-btn danger"
                    title="Remove this logo"
                    aria-label="Remove this logo"
                    onClick={() => setLogos(logos.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </span>
              ))
            ) : (
              <span className="muted">None — the first letter of the name is used.</span>
            )}
            <button
              className="btn small"
              onClick={async () => {
                const files = await window.stash.pickImages(wikiId, true)
                if (files.length) setLogos([...allLogos(useStore.getState().meta!), ...files])
              }}
            >
              {logos.length ? 'Add another…' : 'Choose…'}
            </button>
          </div>
          {logos.length > 1 && <span className="muted small">The first one is used, unless “Mix it up” below switches between them.</span>}
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
        <button className="btn small sample-btn" aria-expanded={sample} onClick={() => setSample(!sample)}>
          {sample ? 'Hide the sample page' : 'Preview on a sample page'}
        </button>
        {sample && <SamplePreview />}
      </section>

      <section className="settings-section">
        <h2>Looks &amp; custom CSS</h2>
        <p className="muted">
          Ready-made looks you switch on with a click (rounded infobox, fancy headings, patterns, fun effects…) with a live preview — or write your
          own CSS. Kept every time you export the website. Inside a page, the editor’s Insert → Fancy block adds ready-made banners, boxes and
          effects.
        </p>
        <div className="row gap">
          <button className="btn small" onClick={() => useStore.getState().go({ kind: 'special', name: 'css' })}>
            Choose looks / edit CSS
          </button>
          {meta.customCss?.trim() && (
            <span className="muted small">
              {meta.customCssOff ? 'Custom CSS is switched off.' : `${meta.customCss.split('\n').length} lines of custom CSS in use.`}
            </span>
          )}
        </div>
      </section>

      <section className="settings-section mix-section">
        <h2>Mix it up</h2>
        <p className="muted">
          Just for fun: switch between several logos or color themes now and then, like websites that look a little different on every visit. Nothing
          about your wiki changes; it only picks what to show.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={!!meta.mix?.logos}
            disabled={logos.length < 2 && !meta.mix?.logos}
            onChange={(e) => setMix({ logos: e.target.checked })}
          />
          Switch between my logos
          {logos.length < 2 && <span className="muted small"> (add two or more logos under Wiki first)</span>}
        </label>
        <div className="field">
          <span>
            Switch between these color themes <span className="muted small">(pick two or more)</span>
          </span>
          <div className="mix-themes">
            {themeChoices.map((t) => {
              const on = (meta.mix?.themes ?? []).includes(t.id)
              return (
                <label key={t.id} className={'mix-theme' + (on ? ' on' : '')}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      const rest = (meta.mix?.themes ?? []).filter((x) => x !== t.id)
                      setMix({ themes: e.target.checked ? [...rest, t.id] : rest })
                    }}
                  />
                  <span className="mix-swatch" style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)` }} />
                  {t.name}
                </label>
              )
            })}
          </div>
        </div>
        <label className="field inline">
          <span>Switch</span>
          <select value={meta.mix?.when ?? 'open'} onChange={(e) => setMix({ when: e.target.value as MixSettings['when'] })}>
            <option value="open">each time the wiki opens</option>
            <option value="page">on every page you go to</option>
            <option value="save">every time you save</option>
          </select>
        </label>
        <p className="muted small">
          Color themes show while reading pages, like other looks. An exported website switches on every page it opens.
          {meta.customCssOff && ' Custom CSS is switched off right now, so the color themes won’t switch.'}
        </p>
        {mixOn(meta) && (
          <button className="btn small" onClick={() => useMix.getState().shuffle(meta)}>
            Switch now
          </button>
        )}
      </section>

      <section className="settings-section">
        <h2>Stories</h2>
        <label className="check">
          <input type="checkbox" checked={!meta.storiesOff} onChange={(e) => change({ storiesOff: !e.target.checked })} />
          Use Stories in this wiki
        </label>
        <p className="muted">
          Write fanfic and other stories with chapters, right next to your wiki. Switching it off hides the Stories shelf and everything about stories
          (they also stay out of the exported website) — nothing is deleted, and switching it back on brings it all back.
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
          Everything is plain files in this folder (pages, pictures and the trash). Nothing is uploaded anywhere. To back the wiki up, copy this
          folder somewhere safe; to move it to another PC, copy it over and use “Open a wiki folder”.
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
