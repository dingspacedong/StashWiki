// Cards on category pages: the "Card pictures" menu (one shape for every card, crop or whole picture, what fills
// the space) and, for each page, a window to drag its picture into place, zoom in, or pick a picture just for cards.
import { useRef, useState } from 'react'
import type { CardStyle, Page, PageCardLook } from '@shared/types'
import { useStore } from '../store'
import { CARD_SHAPES, cardGridLook, cardPicStyle, reactStyle } from '../lib/cardPic'
import { imgUrl } from '../lib/theme'
import { pageThumb } from './Infobox'
import { ColorInput, Dropdown } from './ui'

export function CardStyleMenu(): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const style = meta.cardStyle ?? {}
  const set = (patch: Partial<CardStyle>): void => void useStore.getState().saveMeta({ ...meta, cardStyle: { ...style, ...patch } })
  const fill = style.fill ?? 'theme'
  const custom = /^#[0-9a-f]{6}$/i.test(fill)
  return (
    <Dropdown label="Card pictures ▾" title="Make every card the same shape, and choose how pictures fit" align="right">
      {() => (
        <div className="menu card-style-menu">
          <div className="csm-row">
            <span className="csm-label">Shape</span>
            <div className="seg">
              {CARD_SHAPES.map((s) => (
                <button key={s.id} className={(style.shape ?? 'square') === s.id ? 'on' : ''} onClick={() => set({ shape: s.id })}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="csm-row">
            <span className="csm-label">Pictures</span>
            <div className="seg">
              <button className={style.fit !== 'whole' ? 'on' : ''} onClick={() => set({ fit: 'crop' })} title="Cropped to fill the card">
                Fill the card
              </button>
              <button className={style.fit === 'whole' ? 'on' : ''} onClick={() => set({ fit: 'whole' })} title="The whole picture, with the space around it filled">
                Show whole picture
              </button>
            </div>
          </div>
          {style.fit === 'whole' && (
            <div className="csm-row">
              <span className="csm-label">Around it</span>
              <div className="seg">
                <button className={fill === 'theme' ? 'on' : ''} onClick={() => set({ fill: 'theme' })}>
                  Theme color
                </button>
                <button className={fill === 'blur' ? 'on' : ''} onClick={() => set({ fill: 'blur' })}>
                  Blurred picture
                </button>
                <button className={custom ? 'on' : ''} onClick={() => set({ fill: custom ? fill : '#ffffff' })}>
                  A color
                </button>
              </div>
              {custom && <ColorInput value={fill} onChange={(v) => set({ fill: v })} />}
            </div>
          )}
          <p className="hint">For every category page, and in an exported website. Hover a card and click ✥ to choose which part of its picture shows.</p>
        </div>
      )}
    </Dropdown>
  )
}

/** One page's card. */
export function CategoryCard({ page, onOpen }: { page: Page; onOpen: () => void }): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const [adjusting, setAdjusting] = useState(false)
  const thumb = pageThumb(page, meta.templates.find((t) => t.id === page.templateId))
  const blur = meta.cardStyle?.fit === 'whole' && meta.cardStyle.fill === 'blur'
  return (
    <div className="page-card-wrap">
      <button className="page-card" onClick={onOpen}>
        <span className="page-card-img">
          {thumb ? (
            <>
              {blur && <img className="page-card-blur" src={imgUrl(thumb)} alt="" aria-hidden />}
              <img src={imgUrl(thumb)} alt="" style={reactStyle(cardPicStyle(page))} />
            </>
          ) : (
            <span>{page.title.slice(0, 1)}</span>
          )}
        </span>
        <span className="page-card-title">{page.title}</span>
      </button>
      <button className="page-card-adjust" title="Choose which part of the picture shows on this card" onClick={() => setAdjusting(true)}>
        ✥
      </button>
      {adjusting && <AdjustCard page={page} onClose={() => setAdjusting(false)} />}
    </div>
  )
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n))

function AdjustCard({ page, onClose }: { page: Page; onClose: () => void }): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const wikiId = useStore((s) => s.wikiId)!
  const [look, setLook] = useState<PageCardLook>(page.card ?? {})
  const own = pageThumb({ ...page, card: undefined }, meta.templates.find((t) => t.id === page.templateId))
  const pic = look.image || own
  const grid = cardGridLook(meta.cardStyle)
  const blur = meta.cardStyle?.fit === 'whole' && meta.cardStyle.fill === 'blur'
  const frame = useRef<HTMLSpanElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null)

  // Dragging moves the picture under the card: how far a pixel goes depends on how much of it sticks out.
  const onMove = (e: React.PointerEvent): void => {
    const d = drag.current
    const f = frame.current
    const i = img.current
    if (!d || !f || !i?.naturalWidth) return
    const W = f.clientWidth
    const H = f.clientHeight
    const fit = meta.cardStyle?.fit === 'whole' ? Math.min(W / i.naturalWidth, H / i.naturalHeight) : Math.max(W / i.naturalWidth, H / i.naturalHeight)
    const z = look.zoom ?? 1
    const spareX = i.naturalWidth * fit * z - W
    const spareY = i.naturalHeight * fit * z - H
    setLook((l) => ({
      ...l,
      x: Math.abs(spareX) < 1 ? (l.x ?? 50) : Math.round(clamp(d.x - ((e.clientX - d.px) / spareX) * 100, 0, 100)),
      y: Math.abs(spareY) < 1 ? (l.y ?? 50) : Math.round(clamp(d.y - ((e.clientY - d.py) / spareY) * 100, 0, 100))
    }))
  }
  const save = async (): Promise<void> => {
    const card: PageCardLook = {}
    if (look.image) card.image = look.image
    if ((look.x ?? 50) !== 50) card.x = look.x
    if ((look.y ?? 50) !== 50) card.y = look.y
    if ((look.zoom ?? 1) !== 1) card.zoom = look.zoom
    const fresh = useStore.getState().pages[page.id] ?? page
    const { card: _old, ...rest } = fresh
    await useStore.getState().savePage(Object.keys(card).length ? { ...rest, card } : rest, undefined, 'none')
    onClose()
  }
  const pick = async (): Promise<void> => {
    const [file] = await window.stash.pickImages(wikiId, false)
    if (file) setLook({ image: file })
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal adjust-card">
        <h2>Card picture: {page.title}</h2>
        <p className="hint">Drag the picture to choose which part shows, and zoom in if you like. Only the cards change; the page keeps its picture.</p>
        <div className="adjust-split">
          <div className={grid.className + ' adjust-grid'} style={reactStyle(grid.style)}>
            <div className="page-card">
              <span
                className={'page-card-img' + (pic ? ' draggable' : '')}
                ref={frame}
                onPointerDown={(e) => {
                  if (!pic) return
                  e.currentTarget.setPointerCapture(e.pointerId)
                  drag.current = { px: e.clientX, py: e.clientY, x: look.x ?? 50, y: look.y ?? 50 }
                }}
                onPointerMove={onMove}
                onPointerUp={() => (drag.current = null)}
              >
                {pic ? (
                  <>
                    {blur && <img className="page-card-blur" src={imgUrl(pic)} alt="" aria-hidden draggable={false} />}
                    <img ref={img} src={imgUrl(pic)} alt="" draggable={false} style={reactStyle(cardPicStyle({ ...page, card: look }))} />
                  </>
                ) : (
                  <span>{page.title.slice(0, 1)}</span>
                )}
              </span>
              <span className="page-card-title">{page.title}</span>
            </div>
          </div>
          <div className="adjust-controls">
            <label className="field">
              <span>Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={look.zoom ?? 1}
                disabled={!pic}
                onChange={(e) => setLook((l) => ({ ...l, zoom: Number(e.target.value) }))}
              />
            </label>
            <button className="btn ghost small" onClick={() => void pick()}>
              {look.image ? 'Pick another picture…' : 'Use a different picture for cards…'}
            </button>
            {look.image && (
              <button className="link-btn small" onClick={() => setLook({})}>
                {own ? 'Use the page’s own picture again' : 'Remove the card picture'}
              </button>
            )}
            <button className="link-btn small" disabled={!pic} onClick={() => setLook((l) => ({ image: l.image }))}>
              Reset position and zoom
            </button>
          </div>
        </div>
        <div className="row gap modal-actions">
          <span className="grow" />
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
