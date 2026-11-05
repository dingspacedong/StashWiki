// The wiki's own sidebar sections (set up under Wiki tools → Navigation): a header with links, and links that
// fold open to show sub-links or a category's pages.
import { useMemo, useState } from 'react'
import { useStore, useTitleIndex } from '../store'
import { shownLinks, type ShownLink } from '../lib/navigation'
import { titleKey } from '../lib/wikitext'
import { openWikiRef } from './ui'

export default function SidebarSections(): React.JSX.Element | null {
  const sections = useStore((s) => s.meta?.sidebar)
  const pages = useStore((s) => s.pages)
  const all = useMemo(() => Object.values(pages), [pages])
  if (!sections?.length) return null
  return (
    <>
      {sections.map((s) => {
        const links = shownLinks(s.links, all)
        if (!links.length && !s.title.trim()) return null
        return (
          <div key={s.id} className="nav-group custom-nav">
            {s.title.trim() && <div className="nav-title">{s.title}</div>}
            {links.map((l, i) => (
              <NavItem key={i} link={l} />
            ))}
          </div>
        )
      })}
    </>
  )
}

function NavItem({ link }: { link: ShownLink }): React.JSX.Element {
  const route = useStore((s) => s.route)
  const go = useStore((s) => s.go)
  const index = useTitleIndex()
  const t = link.target
  const page = t.kind === 'page' ? index.get(titleKey(t.title)) : undefined
  const here = (l: ShownLink): boolean =>
    l.target.kind === 'page'
      ? route.kind === 'page' && index.get(titleKey(l.target.title))?.id === route.id
      : l.target.kind === 'category' && route.kind === 'category' && titleKey(route.name) === titleKey(l.target.name)
  const inside = (l: ShownLink): boolean => l.children.some((c) => here(c) || inside(c))
  // Folded until opened, but open by itself while one of its sub-links is the page being read.
  const [open, setOpen] = useState<boolean | null>(null)
  const shown = open ?? inside(link)

  const click = (): void => {
    if (t.kind === 'page') go(page ? { kind: 'page', id: page.id } : { kind: 'new', title: t.title })
    else if (t.kind === 'category') go({ kind: 'category', name: t.name })
    else if (t.kind === 'url') void window.stash.openExternal(t.url)
    else if (t.kind === 'wiki') void openWikiRef(t.wiki, t.title)
    else setOpen(!shown)
  }
  const cls = 'nav-link' + (here(link) ? ' active' : '') + (t.kind === 'page' && !page ? ' new' : '')
  return (
    <>
      <div className="nav-row">
        <button className={cls} onClick={click} title={t.kind === 'url' ? t.url : t.kind === 'wiki' ? `In ${t.wiki}` : t.kind === 'page' && !page ? `${t.title} (not written yet)` : undefined}>
          {link.label}
          {t.kind === 'url' && ' ↗'}
          {t.kind === 'wiki' && <span className="wikiref-mark"> ⇢</span>}
        </button>
        {link.children.length > 0 && (
          <button className="nav-toggle" title={shown ? 'Fold' : 'Show what’s in here'} onClick={() => setOpen(!shown)}>
            {shown ? '▾' : '▸'}
          </button>
        )}
      </div>
      {shown && link.children.length > 0 && (
        <div className="nav-children">
          {link.children.map((c, i) => (
            <NavItem key={i} link={c} />
          ))}
        </div>
      )}
    </>
  )
}
