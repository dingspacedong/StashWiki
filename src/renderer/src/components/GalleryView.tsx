import { useLayoutEffect, useRef, useState } from 'react'
import type { Gallery } from '@shared/types'
import { imgUrl } from '../lib/theme'
import { openLightbox } from './Lightbox'
import { RichInline } from './ui'

export default function GalleryView({ gallery }: { gallery: Gallery }): React.JSX.Element | null {
  const [collapsed, setCollapsed] = useState(gallery.autoCollapse)
  const [hidden, setHidden] = useState(0)
  const [rowHeight, setRowHeight] = useState<number | undefined>()
  // Spoilers: the whole gallery stays covered until clicked; otherwise each spoiler picture is blurred on its own.
  const [uncovered, setUncovered] = useState(false)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const grid = useRef<HTMLDivElement>(null)

  // Work out how many images sit below the first row, and how tall that row is.
  useLayoutEffect(() => {
    const el = grid.current
    if (!el) return
    const measure = (): void => {
      const kids = [...el.children] as HTMLElement[]
      if (!kids.length) return
      const top = kids[0].offsetTop
      const firstRow = kids.filter((k) => k.offsetTop <= top + 2)
      setHidden(kids.length - firstRow.length)
      setRowHeight(Math.max(...firstRow.map((k) => k.offsetHeight)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [gallery.images])

  if (!gallery.images.length) return null
  const covered = !!gallery.spoiler && !uncovered
  // A covered gallery only needs one row behind its cover.
  const short = (collapsed || covered) && hidden > 0
  const blurred = (id: string, spoiler?: boolean): boolean => !gallery.spoiler && !!spoiler && !revealed.has(id)
  const reveal = (id: string): void => setRevealed((r) => new Set(r).add(id))
  const items = gallery.images.map((i) => ({
    file: i.file,
    caption: i.caption,
    source: i.source,
    spoiler: blurred(i.id, i.spoiler),
    reveal: () => reveal(i.id)
  }))

  return (
    <section className={'gallery' + (gallery.spoiler ? ' spoiler-gallery' : '') + (covered ? ' covered' : '')}>
      <div className="gallery-head">
        <h2>{gallery.title || 'Gallery'}</h2>
        <span className="gallery-count">
          {gallery.images.length} image{gallery.images.length === 1 ? '' : 's'}
        </span>
        {gallery.spoiler && uncovered && (
          <button className="link-btn gallery-rehide" onClick={() => setUncovered(false)}>
            Hide spoilers
          </button>
        )}
        {hidden > 0 && !covered && (
          <button className="link-btn" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? `Show all ${gallery.images.length}` : 'Show less'}
          </button>
        )}
      </div>
      <div className="gallery-body">
        <div
          ref={grid}
          className={'gallery-grid' + (short ? ' collapsed' : '')}
          style={{ maxHeight: short ? rowHeight : undefined }}
          inert={covered}
        >
          {gallery.images.map((img, i) => {
            const blur = blurred(img.id, img.spoiler)
            return (
              <figure key={img.id} className={'g-item' + (blur ? ' g-spoiler' : '')}>
                <button
                  className="g-thumb"
                  onClick={() => (blur ? reveal(img.id) : openLightbox(items, i))}
                  title={blur ? 'Spoiler: click to show' : 'View larger'}
                >
                  <img src={imgUrl(img.file)} alt={blur ? 'Spoiler' : img.caption} loading="lazy" />
                </button>
                {img.caption && (
                  <figcaption>
                    <RichInline text={img.caption} />
                  </figcaption>
                )}
              </figure>
            )
          })}
        </div>
        {covered && (
          <button className="gallery-cover" onClick={() => setUncovered(true)}>
            <strong>Spoilers</strong>
            <span>Click to show {gallery.images.length === 1 ? 'this picture' : `these ${gallery.images.length} pictures`}</span>
          </button>
        )}
      </div>
    </section>
  )
}
