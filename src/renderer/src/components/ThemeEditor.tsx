import { FONTS, THEME_PRESETS } from '@shared/defaults'
import type { FontKey, PageTheme, Theme } from '@shared/types'
import { COLOR_FIELDS, imgUrl } from '../lib/theme'
import { ColorInput } from './ui'

interface Props {
  /** For a page: only the overridden values. For the wiki: the full theme. */
  value: PageTheme
  /** What unset values fall back to (the wiki theme). */
  base: Theme
  onChange: (v: PageTheme) => void
  isPage: boolean
  wikiId: string
}

export default function ThemeEditor({ value, base, onChange, isPage, wikiId }: Props): React.JSX.Element {
  const set = (k: keyof PageTheme, v: string | undefined): void => {
    const next = { ...value }
    if (v === undefined || v === '') delete next[k]
    else (next as Record<string, string>)[k] = v
    onChange(next)
  }
  const applyPreset = (t: Theme): void => {
    const { backgroundImage: _keep, ...colors } = t
    onChange({ ...value, ...colors })
  }
  const overridden = Object.keys(value).length > 0

  return (
    <div className="theme-editor">
      <div className="presets">
        {THEME_PRESETS.map((p) => (
          <button key={p.name} className="preset" onClick={() => applyPreset(p.theme)} title={`Use the ${p.name} colors`}>
            <span className="preset-swatch" style={{ background: p.theme.background }}>
              <span style={{ background: p.theme.accent }} />
              <span style={{ background: p.theme.surface }} />
              <span style={{ background: p.theme.link }} />
            </span>
            {p.name}
          </button>
        ))}
      </div>

      <div className="color-grid">
        {COLOR_FIELDS.map((f) => (
          <div key={f.key} className="color-row">
            <div>
              <div className="color-label">{f.label}</div>
              {f.hint && <div className="color-hint">{f.hint}</div>}
            </div>
            <ColorInput
              value={(value[f.key] as string) ?? (isPage ? '' : (base[f.key] as string))}
              placeholder={base[f.key] as string}
              onChange={(v) => set(f.key, v)}
            />
            {isPage && value[f.key] && (
              <button className="icon-btn" title="Use the wiki color" onClick={() => set(f.key, undefined)}>
                ×
              </button>
            )}
          </div>
        ))}
        {isPage && (
          <>
            <div className="color-row">
              <div>
                <div className="color-label">Infobox title</div>
                <div className="color-hint">Overrides the template color</div>
              </div>
              <ColorInput value={value.infoboxHeader ?? ''} placeholder="#7b4fb8" onChange={(v) => set('infoboxHeader', v)} />
              {value.infoboxHeader && (
                <button className="icon-btn" title="Use the template color" onClick={() => set('infoboxHeader', undefined)}>
                  ×
                </button>
              )}
            </div>
            <div className="color-row">
              <div>
                <div className="color-label">Infobox title text</div>
              </div>
              <ColorInput value={value.infoboxHeaderText ?? ''} placeholder="#ffffff" onChange={(v) => set('infoboxHeaderText', v)} />
              {value.infoboxHeaderText && (
                <button className="icon-btn" title="Use the template color" onClick={() => set('infoboxHeaderText', undefined)}>
                  ×
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="font-row">
        <FontSelect label="Body font" value={value.bodyFont} fallback={isPage ? undefined : base.bodyFont} onChange={(v) => set('bodyFont', v)} />
        <FontSelect label="Heading font" value={value.headingFont} fallback={isPage ? undefined : base.headingFont} onChange={(v) => set('headingFont', v)} />
        <label className="field inline" title="Makes the sidebar and pages bigger or smaller, pictures included, like zooming in">
          <span>Text size</span>
          <select value={value.textSize ?? (isPage ? '' : base.textSize ?? '100')} onChange={(e) => set('textSize', e.target.value || undefined)}>
            {isPage && <option value="">Wiki default</option>}
            {['80', '90', '100', '110', '120', '135', '150'].map((n) => (
              <option key={n} value={n}>
                {n === '100' ? 'Normal (100%)' : `${n}%`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bg-row">
        <span className="color-label">Backdrop picture</span>
        {value.backgroundImage ? (
          <img className="bg-thumb" src={imgUrl(value.backgroundImage)} alt="" />
        ) : (
          <span className="muted">{isPage && base.backgroundImage ? 'Using the wiki backdrop' : 'None'}</span>
        )}
        <button
          className="btn small"
          onClick={async () => {
            const [file] = await window.stash.pickImages(wikiId, false)
            if (file) set('backgroundImage', file)
          }}
        >
          Choose…
        </button>
        {value.backgroundImage && (
          <button className="link-btn danger" onClick={() => set('backgroundImage', undefined)}>
            Remove
          </button>
        )}
        <span className="seg" role="group" aria-label="Picture layout" title="Fill stretches one picture over the whole window; Tile repeats it like wallpaper">
          {(['fill', 'tile'] as const).map((m) => (
            <button
              key={m}
              className={(value.backgroundMode ?? (isPage ? undefined : 'fill')) === m ? 'on' : ''}
              onClick={() => set('backgroundMode', m)}
            >
              {m === 'fill' ? 'Fill' : 'Tile'}
            </button>
          ))}
        </span>
        {isPage && value.backgroundMode && (
          <button className="icon-btn" title="Use the wiki's layout" onClick={() => set('backgroundMode', undefined)}>
            ×
          </button>
        )}
      </div>

      <div className="bg-row sidebar-row">
        <span className="color-label" title="Gives the sidebar its own background so its links stay readable on a busy backdrop picture">
          Sidebar background
        </span>
        <ColorInput
          value={value.sidebarColor ?? ''}
          placeholder={isPage ? base.sidebarColor || '#ffffff' : '#ffffff'}
          onChange={(v) => set('sidebarColor', v)}
        />
        {(value.sidebarColor || (!isPage && base.sidebarColor)) ? (
          <>
            <label className="field inline sidebar-opacity" title="How solid the sidebar is: lower lets more of the backdrop show through">
              <span>See-through</span>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={100 - Number(value.sidebarOpacity ?? base.sidebarOpacity ?? 85)}
                onChange={(e) => set('sidebarOpacity', String(100 - Number(e.target.value)))}
              />
            </label>
            <label className="check" title="Fades the sidebar out towards its right edge">
              <input
                type="checkbox"
                checked={(value.sidebarEdge ?? base.sidebarEdge) === 'soft'}
                onChange={(e) => set('sidebarEdge', e.target.checked ? 'soft' : 'hard')}
              />
              Soft edge
            </label>
            <button
              className="link-btn danger"
              onClick={() => {
                const next = { ...value }
                delete next.sidebarColor
                delete next.sidebarOpacity
                delete next.sidebarEdge
                onChange(isPage ? next : { ...next, sidebarColor: '', sidebarOpacity: undefined, sidebarEdge: undefined })
              }}
            >
              {isPage ? 'Use the wiki’s sidebar' : 'No sidebar background'}
            </button>
          </>
        ) : (
          <span className="muted small">None — pick a color to give the sidebar its own background.</span>
        )}
      </div>

      {isPage && overridden && (
        <button className="link-btn" onClick={() => onChange({})}>
          Reset this page to the wiki’s look
        </button>
      )}
    </div>
  )
}

function FontSelect({
  label,
  value,
  fallback,
  onChange
}: {
  label: string
  value: FontKey | undefined
  fallback: FontKey | undefined
  onChange: (v: string | undefined) => void
}): React.JSX.Element {
  return (
    <label className="field inline">
      <span>{label}</span>
      <select value={value ?? fallback ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        {!fallback && <option value="">Wiki default</option>}
        {[...new Set(Object.values(FONTS).map((f) => f.group))].map((group) => (
          <optgroup key={group} label={group === 'Basic' ? 'Basic' : `${group} (Google Fonts)`}>
            {(Object.keys(FONTS) as FontKey[])
              .filter((k) => FONTS[k].group === group)
              .map((k) => (
                <option key={k} value={k} style={{ fontFamily: FONTS[k].stack }}>
                  {FONTS[k].label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
