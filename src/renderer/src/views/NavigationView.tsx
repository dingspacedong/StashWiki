// Wiki tools → Navigation: the wiki's own sidebar sections, and its nav boxes (defined here once, shown on many
// pages, so changing a box here changes it everywhere).
import { useEffect, useMemo, useRef, useState } from 'react'
import { uid } from '@shared/defaults'
import type { NavLink, NavSection, Navbox, NavboxRow, WikiMeta } from '@shared/types'
import { sortedPages, useStore } from '../store'
import { navboxHtml, parseTarget } from '../lib/navigation'
import { cleanTitle, titleKey } from '../lib/wikitext'
import CategoryInput, { useAllCategories } from '../components/CategoryInput'

type Draft = { sidebar: NavSection[]; navboxes: Navbox[] }

const move = <T,>(list: T[], i: number, d: number): T[] => {
  const j = i + d
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export default function NavigationView(): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const [draft, setDraft] = useState<Draft>({ sidebar: meta.sidebar ?? [], navboxes: meta.navboxes ?? [] })
  const [saved, setSaved] = useState(true)
  const latest = useRef(draft)
  latest.current = draft

  // Saves a moment after a change, and when leaving the screen.
  const save = async (): Promise<void> => {
    const m = useStore.getState().meta
    if (!m) return
    await useStore.getState().saveMeta({ ...m, sidebar: latest.current.sidebar, navboxes: latest.current.navboxes } satisfies WikiMeta)
    setSaved(true)
  }
  useEffect(() => {
    if (saved) return
    const t = setTimeout(() => void save(), 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, saved])
  useEffect(
    () => () => {
      const m = useStore.getState().meta
      if (m && (m.sidebar !== latest.current.sidebar || m.navboxes !== latest.current.navboxes)) void save()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const change = (patch: Partial<Draft>): void => {
    setDraft((d) => ({ ...d, ...patch }))
    setSaved(false)
  }

  return (
    <div className="navigation-view">
      <h1 className="page-title">Navigation</h1>
      <p className="muted">
        Add your own sections to the sidebar, and make nav boxes: the box of related links at the bottom of a page. A nav box is set up once here and
        shown on as many pages as you like, so changing it here changes it everywhere. Rows and sidebar links can list a category’s pages by themselves,
        so new pages show up without you adding them. <span className="small">{saved ? 'All changes saved' : 'Saving…'}</span>
      </p>
      <PageTitles />

      <h2 className="nav-h2">Sidebar sections</h2>
      <p className="hint">Shown under Navigation in the sidebar, in the app and in an exported website.</p>
      <div className="nav-cards">
        {draft.sidebar.map((s, i) => (
          <SectionCard
            key={s.id}
            section={s}
            first={i === 0}
            last={i === draft.sidebar.length - 1}
            onChange={(next) => change({ sidebar: draft.sidebar.map((x) => (x.id === s.id ? next : x)) })}
            onMove={(d) => change({ sidebar: move(draft.sidebar, i, d) })}
            onRemove={() => change({ sidebar: draft.sidebar.filter((x) => x.id !== s.id) })}
          />
        ))}
        <button
          className="btn ghost"
          onClick={() =>
            change({ sidebar: [...draft.sidebar, { id: uid(), title: draft.sidebar.length ? 'More' : 'Characters', links: [{ id: uid(), label: '', target: '' }] }] })
          }
        >
          + Add a sidebar section
        </button>
      </div>

      <h2 className="nav-h2">Nav boxes</h2>
      <p className="hint">
        Put one on a page with <b>Insert → Nav box</b> in the editor, or have it show by itself at the bottom of every page in some categories.
      </p>
      <div className="nav-cards">
        {draft.navboxes.map((b, i) => (
          <NavboxCard
            key={b.id}
            box={b}
            first={i === 0}
            last={i === draft.navboxes.length - 1}
            onChange={(next) => change({ navboxes: draft.navboxes.map((x) => (x.id === b.id ? next : x)) })}
            onMove={(d) => change({ navboxes: move(draft.navboxes, i, d) })}
            onRemove={() => {
              if (window.confirm(`Remove the nav box “${b.title || 'Navigation'}”? Pages that show it won’t show it any more.`))
                change({ navboxes: draft.navboxes.filter((x) => x.id !== b.id) })
            }}
          />
        ))}
        <button
          className="btn ghost"
          onClick={() =>
            change({
              navboxes: [
                ...draft.navboxes,
                { id: uid(), title: meta.name, groups: [{ id: uid(), label: 'Characters', pages: [], category: '' }], showOn: [] }
              ]
            })
          }
        >
          + Add a nav box
        </button>
      </div>
    </div>
  )
}

/** Page titles and categories offered while typing a link. */
function PageTitles(): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const cats = useAllCategories()
  const titles = useMemo(() => sortedPages(pages).map((p) => p.title), [pages])
  const library = useStore((s) => s.library)
  const wikiId = useStore((s) => s.wikiId)
  return (
    <>
      <datalist id="nav-targets">
        {titles.map((t) => (
          <option key={t} value={t} />
        ))}
        {cats.map((c) => (
          <option key={'c' + c} value={`Category:${c}`} />
        ))}
        {(library?.wikis ?? [])
          .filter((w) => w.id !== wikiId)
          .map((w) => (
            <option key={'w' + w.id} value={`${w.name}::`} label={`${w.name} (another wiki; add a page name after ::)`} />
          ))}
      </datalist>
      <datalist id="nav-pages">
        {titles.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </>
  )
}

function CardHead({
  title,
  placeholder,
  onTitle,
  first,
  last,
  onMove,
  onRemove,
  removeLabel
}: {
  title: string
  placeholder: string
  onTitle: (t: string) => void
  first: boolean
  last: boolean
  onMove: (d: number) => void
  onRemove: () => void
  removeLabel: string
}): React.JSX.Element {
  return (
    <div className="nav-card-head">
      <input className="nav-card-title" value={title} placeholder={placeholder} onChange={(e) => onTitle(e.target.value)} />
      <span className="grow" />
      <button className="icon-btn" title="Move up" disabled={first} onClick={() => onMove(-1)}>
        ↑
      </button>
      <button className="icon-btn" title="Move down" disabled={last} onClick={() => onMove(1)}>
        ↓
      </button>
      <button className="link-btn danger" onClick={onRemove}>
        {removeLabel}
      </button>
    </div>
  )
}

function SectionCard({
  section,
  onChange,
  onMove,
  onRemove,
  first,
  last
}: {
  section: NavSection
  onChange: (s: NavSection) => void
  onMove: (d: number) => void
  onRemove: () => void
  first: boolean
  last: boolean
}): React.JSX.Element {
  const setLinks = (links: NavLink[]): void => onChange({ ...section, links })
  return (
    <div className="nav-card">
      <CardHead
        title={section.title}
        placeholder="Section header, e.g. Characters"
        onTitle={(title) => onChange({ ...section, title })}
        first={first}
        last={last}
        onMove={onMove}
        onRemove={onRemove}
        removeLabel="Remove section"
      />
      <LinkList links={section.links} onChange={setLinks} depth={0} />
    </div>
  )
}

function LinkList({ links, onChange, depth }: { links: NavLink[]; onChange: (l: NavLink[]) => void; depth: number }): React.JSX.Element {
  const set = (id: string, patch: Partial<NavLink>): void => onChange(links.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  return (
    <div className={depth ? 'nav-links sub' : 'nav-links'}>
      {links.map((l, i) => {
        const target = parseTarget(l.target)
        return (
          <div key={l.id} className="nav-link-edit">
            <div className="nav-link-row">
              <input
                className="nav-target"
                list="nav-targets"
                value={l.target}
                placeholder="Page, Category:Name, Other wiki::Page, or https://…"
                onChange={(e) => set(l.id, { target: e.target.value })}
              />
              <input className="nav-label" value={l.label} placeholder="Text (optional)" onChange={(e) => set(l.id, { label: e.target.value })} />
              {target.kind === 'category' && (
                <label className="check small" title="List every page in this category under it, kept up to date by itself">
                  <input type="checkbox" checked={!!l.listPages} onChange={(e) => set(l.id, { listPages: e.target.checked })} />
                  List its pages
                </label>
              )}
              {depth === 0 && (
                <button
                  className="link-btn small"
                  title="Links that fold out under this one"
                  onClick={() => set(l.id, { children: [...(l.children ?? []), { id: uid(), label: '', target: '' }] })}
                >
                  + Sub-link
                </button>
              )}
              <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => onChange(move(links, i, -1))}>
                ↑
              </button>
              <button className="icon-btn" title="Move down" disabled={i === links.length - 1} onClick={() => onChange(move(links, i, 1))}>
                ↓
              </button>
              <button className="icon-btn" title="Remove link" onClick={() => onChange(links.filter((x) => x.id !== l.id))}>
                ×
              </button>
            </div>
            {!!l.children?.length && <LinkList links={l.children} onChange={(children) => set(l.id, { children })} depth={depth + 1} />}
          </div>
        )
      })}
      <button className="link-btn small" onClick={() => onChange([...links, { id: uid(), label: '', target: '' }])}>
        + {depth ? 'Sub-link' : 'Link'}
      </button>
    </div>
  )
}

function NavboxCard({
  box,
  onChange,
  onMove,
  onRemove,
  first,
  last
}: {
  box: Navbox
  onChange: (b: Navbox) => void
  onMove: (d: number) => void
  onRemove: () => void
  first: boolean
  last: boolean
}): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const all = useMemo(() => Object.values(pages), [pages])
  const setRow = (id: string, patch: Partial<NavboxRow>): void => onChange({ ...box, groups: box.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) })
  return (
    <div className="nav-card">
      <CardHead
        title={box.title}
        placeholder="Nav box title"
        onTitle={(title) => onChange({ ...box, title })}
        first={first}
        last={last}
        onMove={onMove}
        onRemove={onRemove}
        removeLabel="Remove nav box"
      />
      <div className="nb-edit-rows">
        {box.groups.map((g, i) => (
          <div key={g.id} className="nb-edit-row">
            <input className="nb-edit-label" value={g.label} placeholder="Row name, e.g. Places" onChange={(e) => setRow(g.id, { label: e.target.value })} />
            <div className="nb-edit-pages">
              <TitleChips value={g.pages} onChange={(p) => setRow(g.id, { pages: p })} />
              <label className="field inline small nb-edit-cat" title="Every page in this category is listed too, so new ones show up by themselves">
                <span>Also all pages in category</span>
                <CategoryPick value={g.category ?? ''} onChange={(c) => setRow(g.id, { category: c })} />
              </label>
            </div>
            <div className="nb-edit-btns">
              <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => onChange({ ...box, groups: move(box.groups, i, -1) })}>
                ↑
              </button>
              <button className="icon-btn" title="Move down" disabled={i === box.groups.length - 1} onClick={() => onChange({ ...box, groups: move(box.groups, i, 1) })}>
                ↓
              </button>
              <button className="icon-btn" title="Remove row" onClick={() => onChange({ ...box, groups: box.groups.filter((x) => x.id !== g.id) })}>
                ×
              </button>
            </div>
          </div>
        ))}
        <button className="link-btn small" onClick={() => onChange({ ...box, groups: [...box.groups, { id: uid(), label: '', pages: [], category: '' }] })}>
          + Row
        </button>
      </div>
      <div className="nb-edit-show">
        <span className="small">Show by itself at the bottom of every page in:</span>
        <CategoryInput value={box.showOn ?? []} onChange={(showOn) => onChange({ ...box, showOn })} />
      </div>
      <div className="small muted">Preview</div>
      <div className="prose nb-preview" dangerouslySetInnerHTML={{ __html: navboxHtml(box, all) }} />
    </div>
  )
}

/** Page titles as chips; type a title (suggestions from the wiki) and press Enter. */
function TitleChips({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }): React.JSX.Element {
  const [text, setText] = useState('')
  const add = (t: string): void => {
    const title = cleanTitle(t)
    if (title && !value.some((v) => titleKey(v) === titleKey(title))) onChange([...value, title])
    setText('')
  }
  return (
    <div className="chips-input">
      {value.map((t) => (
        <span key={t} className="chip">
          {t}
          <button title="Remove" onClick={() => onChange(value.filter((v) => v !== t))}>
            ×
          </button>
        </span>
      ))}
      <div className="chips-field">
        <input
          list="nav-pages"
          value={text}
          placeholder={value.length ? 'Add another page…' : 'Add a page…'}
          onChange={(e) => {
            // Picking from the list fills the whole title at once.
            const v = e.target.value
            if ((e.nativeEvent as InputEvent).inputType === 'insertReplacementText' || !(e.nativeEvent as InputEvent).inputType) add(v)
            else setText(v)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(text)
            } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
          }}
          onBlur={() => text.trim() && add(text)}
        />
      </div>
    </div>
  )
}

function CategoryPick({ value, onChange }: { value: string; onChange: (v: string) => void }): React.JSX.Element {
  const cats = useAllCategories()
  return (
    <select value={cats.some((c) => titleKey(c) === titleKey(value)) ? cats.find((c) => titleKey(c) === titleKey(value)) : value} onChange={(e) => onChange(e.target.value)}>
      <option value="">(none)</option>
      {value && !cats.some((c) => titleKey(c) === titleKey(value)) && <option value={value}>{value}</option>}
      {cats.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}
