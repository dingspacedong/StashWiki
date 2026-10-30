import { useEffect } from 'react'
import { create } from 'zustand'
import { imgUrl } from '../lib/theme'
import { RichInline } from './ui'

export interface LightboxItem {
  file: string
  caption: string
  source: string
}

export const useLightbox = create<{ items: LightboxItem[]; index: number }>(() => ({ items: [], index: 0 }))

export function openLightbox(items: LightboxItem[], index: number): void {
  useLightbox.setState({ items, index })
}

export default function Lightbox(): React.JSX.Element | null {
  const { items, index } = useLightbox()
  const item = items[index]

  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') useLightbox.setState({ items: [] })
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item])

  if (!item) return null
  const close = (): void => useLightbox.setState({ items: [] })

  return (
    <div className="lightbox" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <button className="lb-close" onClick={close} title="Close (Esc)">
        ×
      </button>
      {items.length > 1 && (
        <>
          <button className="lb-nav prev" onClick={() => step(-1)} title="Previous">
            ‹
          </button>
          <button className="lb-nav next" onClick={() => step(1)} title="Next">
            ›
          </button>
        </>
      )}
      <figure className="lb-figure">
        <img src={imgUrl(item.file)} alt={item.caption} />
        {(item.caption || item.source || items.length > 1) && (
          <figcaption>
            {item.caption && <RichInline className="lb-caption" text={item.caption} />}
            {item.source && (
              <div className="lb-source">
                Source: <RichInline text={item.source} />
              </div>
            )}
            {items.length > 1 && (
              <div className="lb-count">
                {index + 1} / {items.length}
              </div>
            )}
          </figcaption>
        )}
      </figure>
    </div>
  )
}

function step(d: number): void {
  const { items, index } = useLightbox.getState()
  if (items.length) useLightbox.setState({ index: (index + d + items.length) % items.length })
}
