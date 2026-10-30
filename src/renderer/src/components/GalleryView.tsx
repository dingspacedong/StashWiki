import { useLayoutEffect, useRef, useState } from 'react'
import type { Gallery } from '@shared/types'
import { imgUrl } from '../lib/theme'
import { openLightbox } from './Lightbox'
import { RichInline } from './ui'

export default function GalleryView({ gallery }: { gallery: Gallery }): React.JSX.Element | null {
  const [collapsed, setCollapsed] = useState(gallery.autoCollapse)
  const [hidden, setHidden] = useState(0)
  const [rowHeight, setRowHeight] = useState<number | undefined>()
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
  const items = gallery.images.map((i) => ({ file: i.file, caption: i.caption, source: i.source }))

  return (
    <section className="gallery">
      <div className="gallery-head">
        <h2>{gallery.title || 'Gallery'}</h2>
        <span className="gallery-count">
          {gallery.images.length} image{gallery.images.length === 1 ? '' : 's'}
        </span>
        {hidden > 0 && (
          <button className="link-btn" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? `Show all ${gallery.images.length}` : 'Show less'}
          </button>
        )}
      </div>
      <div
        ref={grid}
        className={'gallery-grid' + (collapsed && hidden > 0 ? ' collapsed' : '')}
        style={{ maxHeight: collapsed && hidden > 0 ? rowHeight : undefined }}
      >
        {gallery.images.map((img, i) => (
          <figure key={img.id} className="g-item">
            <button className="g-thumb" onClick={() => openLightbox(items, i)} title="View larger">
              <img src={imgUrl(img.file)} alt={img.caption} loading="lazy" />
            </button>
            {img.caption && (
              <figcaption>
                <RichInline text={img.caption} />
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  )
}
