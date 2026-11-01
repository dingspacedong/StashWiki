// Extra blocks the editor can insert: note/tip/warning/spoiler boxes and "page cards" (picture links to pages).
import { useEffect, useMemo, useState } from 'react'
import { Node, NodeViewWrapper, ReactNodeViewRenderer, mergeAttributes, type NodeViewProps } from '@tiptap/react'
import { uid } from '@shared/defaults'
import { useStore, useTitleIndex } from '../store'
import { emptyCards, parseCards, renderCardsHtml, type CardsData, type PageCard } from '../lib/cards'
import { imgUrl } from '../lib/theme'
import { titleKey } from '../lib/wikitext'
import { pageThumb } from './Infobox'
import { navboxHtml } from '../lib/navigation'
import { useAllCategories } from './CategoryInput'
import PagePicker from './PagePicker'
import SortableRows from './SortableRows'
import { Dropdown } from './ui'

export type CalloutKind = 'note' | 'tip' | 'warning' | 'spoiler'
export const CALLOUT_LABELS: Record<CalloutKind, string> = { note: 'Note', tip: 'Tip', warning: 'Warning', spoiler: 'Spoiler' }

/** A colored box around some writing. Spoiler boxes stay blurred until a reader clicks them. */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      kind: {
        default: 'note',
        parseHTML: (el) => el.getAttribute('data-callout') || 'note',
        renderHTML: (attrs) => ({ 'data-callout': attrs.kind })
      }
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'callout' }, HTMLAttributes), 0]
  }
})

/** Grouped picture cards linking to pages; edited in a window, previewed in place. */
export const PageCards = Node.create({
  name: 'pageCards',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      data: {
        default: JSON.stringify(emptyCards()),
        parseHTML: (el) => el.getAttribute('data-cards') ?? '',
        renderHTML: (attrs) => ({ 'data-cards': attrs.data })
      }
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-cards]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'page-cards-block' }, HTMLAttributes)]
  },
  addNodeView() {
    return ReactNodeViewRenderer(PageCardsView)
  }
})

function PageCardsView({ node, updateAttributes, deleteNode, selected }: NodeViewProps): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const index = useTitleIndex()
  const data = parseCards(node.attrs.data)
  const empty = !data.groups.some((g) => g.cards.length)
  const [open, setOpen] = useState(false)
  // A freshly inserted block opens its editor straight away.
  useEffect(() => {
    if (empty) setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const html = renderCardsHtml(data, (t) => index.get(titleKey(t)), meta)

  return (
    <NodeViewWrapper className={'page-cards-node' + (selected ? ' selected' : '')} contentEditable={false}>
      <div className="pcn-bar">
        <span className="pcn-label">Page cards</span>
        <button className="btn small" onClick={() => setOpen(true)}>
          Edit page cards
        </button>
        <button className="link-btn danger small" onClick={() => deleteNode()}>
          Remove
        </button>
      </div>
      {empty ? (
        <div className="pcn-empty">No pages yet — click “Edit page cards” to add some.</div>
      ) : (
        <div className="pcn-preview" dangerouslySetInnerHTML={{ __html: html }} />
      )}
      {open && (
        <CardsEditor
          initial={data}
          onClose={() => setOpen(false)}
          onSave={(next) => {
            updateAttributes({ data: JSON.stringify(next) })
            setOpen(false)
          }}
        />
      )}
    </NodeViewWrapper>
  )
}

type EditCard = PageCard & { id: string }
type EditGroup = { id: string; title: string; cards: EditCard[] }

function CardsEditor({ initial, onSave, onClose }: { initial: CardsData; onSave: (d: CardsData) => void; onClose: () => void }): React.JSX.Element {
  const [groups, setGroups] = useState<EditGroup[]>(() =>
    initial.groups.map((g) => ({ id: uid(), title: g.title, cards: g.cards.map((c) => ({ ...c, id: uid() })) }))
  )
  const setGroup = (id: string, patch: Partial<EditGroup>): void => setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  const moveGroup = (i: number, d: number): void =>
    setGroups((gs) => {
      const j = i + d
      if (j < 0 || j >= gs.length) return gs
      const next = [...gs]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const save = (): void =>
    onSave({ groups: groups.map((g) => ({ title: g.title, cards: g.cards.map(({ id: _id, ...c }) => c) })) })

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal cards-editor">
        <h2>Page cards</h2>
        <p className="hint">Pictures that link to pages, in groups — like a wiki’s “Appearances” section. Each card uses the page’s own picture unless you pick another.</p>
        <div className="ce-groups">
          {groups.map((g, i) => (
            <GroupEditor
              key={g.id}
              group={g}
              first={i === 0}
              last={i === groups.length - 1}
              onChange={(patch) => setGroup(g.id, patch)}
              onMove={(d) => moveGroup(i, d)}
              onRemove={() => setGroups((gs) => gs.filter((x) => x.id !== g.id))}
            />
          ))}
        </div>
        <button className="btn small ghost" onClick={() => setGroups((gs) => [...gs, { id: uid(), title: 'New group', cards: [] }])}>
          + Add a group
        </button>
        <div className="row gap modal-actions">
          <span className="grow" />
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={save}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function GroupEditor({
  group,
  first,
  last,
  onChange,
  onMove,
  onRemove
}: {
  group: EditGroup
  first: boolean
  last: boolean
  onChange: (patch: Partial<EditGroup>) => void
  onMove: (d: number) => void
  onRemove: () => void
}): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const meta = useStore((s) => s.meta)!
  const index = useTitleIndex()
  const categories = useAllCategories()
  const titles = group.cards.map((c) => c.page)
  const setCard = (id: string, patch: Partial<EditCard>): void => onChange({ cards: group.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  const addTitles = (list: string[]): void => {
    const have = new Set(titles.map(titleKey))
    onChange({ cards: [...group.cards, ...list.filter((t) => !have.has(titleKey(t))).map((page) => ({ id: uid(), page }))] })
  }
  const inCategory = useMemo(
    () => (name: string) =>
      Object.values(pages)
        .filter((p) => p.categories.some((c) => titleKey(c) === titleKey(name)))
        .map((p) => p.title)
        .sort((a, b) => a.localeCompare(b)),
    [pages]
  )

  return (
    <div className="ce-group">
      <div className="ce-group-head">
        <input className="ce-title" value={group.title} placeholder="Group title, e.g. Characters" onChange={(e) => onChange({ title: e.target.value })} />
        <button className="icon-btn" title="Move group up" disabled={first} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button className="icon-btn" title="Move group down" disabled={last} onClick={() => onMove(1)}>
          ↓
        </button>
        <button className="link-btn danger small" onClick={onRemove}>
          Remove group
        </button>
      </div>
      <SortableRows
        items={group.cards}
        onReorder={(cards) => onChange({ cards })}
        className="ce-cards"
        render={(c, handle) => {
          const page = index.get(titleKey(c.page))
          const pic = c.image || (page ? pageThumb(page, meta.templates.find((t) => t.id === page.templateId)) : null)
          return (
            <div className="ce-card">
              {handle}
              <span className="ce-thumb">{pic ? <img src={imgUrl(pic)} alt="" /> : <span>{c.page.slice(0, 1)}</span>}</span>
              <span className={'ce-name' + (page ? '' : ' missing')} title={page ? '' : 'This page doesn’t exist yet'}>
                {c.page}
              </span>
              <input className="ce-tag" value={c.tag ?? ''} placeholder="Tag (e.g. Debut)" onChange={(e) => setCard(c.id, { tag: e.target.value || undefined })} />
              <button
                className="link-btn small"
                title="Use a different picture for this card"
                onClick={async () => {
                  const [file] = await window.stash.pickImages(useStore.getState().wikiId!, false)
                  if (file) setCard(c.id, { image: file })
                }}
              >
                Picture…
              </button>
              {c.image && (
                <button className="link-btn small" title="Go back to the page's own picture" onClick={() => setCard(c.id, { image: undefined })}>
                  Reset
                </button>
              )}
              <button className="icon-btn" title="Remove this card" onClick={() => onChange({ cards: group.cards.filter((x) => x.id !== c.id) })}>
                ×
              </button>
            </div>
          )
        }}
      />
      <div className="row gap ce-add">
        <Dropdown label="+ Add a page" className="btn small ghost" title="Add one page">
          {(close) => (
            <PagePicker
              exclude={titles}
              onPick={(t) => {
                addTitles([t])
                close()
              }}
            />
          )}
        </Dropdown>
        {categories.length > 0 && (
          <select
            className="ce-cat"
            value=""
            onChange={(e) => {
              if (e.target.value) addTitles(inCategory(e.target.value))
            }}
            title="Add every page in a category"
          >
            <option value="">+ Add a whole category…</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}

/** A nav box placed on the page. Only its id is stored: the box itself lives in the wiki's settings, so it stays in step everywhere. */
export const NavboxBlock = Node.create({
  name: 'navboxBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-navbox') ?? '',
        renderHTML: (attrs) => ({ 'data-navbox': attrs.id })
      }
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-navbox]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ class: 'navbox-block' }, HTMLAttributes)]
  },
  addNodeView() {
    return ReactNodeViewRenderer(NavboxView)
  }
})

function NavboxView({ node, updateAttributes, deleteNode, selected }: NodeViewProps): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const pages = useStore((s) => s.pages)
  const all = useMemo(() => Object.values(pages), [pages])
  const boxes = meta.navboxes ?? []
  const box = boxes.find((b) => b.id === node.attrs.id)
  const make = async (): Promise<void> => {
    const fresh = { id: uid(), title: meta.name, groups: [{ id: uid(), label: 'Characters', pages: [], category: '' }], showOn: [] }
    await useStore.getState().saveMeta({ ...meta, navboxes: [...boxes, fresh] })
    updateAttributes({ id: fresh.id })
  }
  return (
    <NodeViewWrapper className={'page-cards-node navbox-node' + (selected ? ' selected' : '')} contentEditable={false}>
      <div className="pcn-bar">
        <span className="pcn-label">Nav box</span>
        {boxes.length > 0 && (
          <select value={box ? box.id : ''} onChange={(e) => updateAttributes({ id: e.target.value })} title="Which nav box to show here">
            {!box && <option value="">Pick a nav box…</option>}
            {boxes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title || 'Navigation'}
              </option>
            ))}
          </select>
        )}
        <button className="link-btn small" onClick={() => void make()}>
          + New nav box
        </button>
        <button className="link-btn danger small" onClick={() => deleteNode()}>
          Remove
        </button>
      </div>
      {box ? (
        <div className="prose nbn-preview" dangerouslySetInnerHTML={{ __html: navboxHtml(box, all) }} />
      ) : (
        <div className="pcn-empty">{boxes.length ? 'Pick which nav box goes here.' : 'No nav boxes yet. Click “+ New nav box”.'}</div>
      )}
      <div className="hint nbn-hint">Change what’s in it under Wiki tools → Navigation; every page showing it changes too.</div>
    </NodeViewWrapper>
  )
}
