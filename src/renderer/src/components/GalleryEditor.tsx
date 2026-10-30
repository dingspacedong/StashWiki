import { useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { uid } from '@shared/defaults'
import type { Gallery, GalleryImage } from '@shared/types'
import { imgUrl } from '../lib/theme'

interface Props {
  galleries: Gallery[]
  onChange: (g: Gallery[]) => void
  wikiId: string
}

export default function GalleryEditor({ galleries, onChange, wikiId }: Props): React.JSX.Element {
  const update = (id: string, patch: Partial<Gallery>): void =>
    onChange(galleries.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  const move = (i: number, d: number): void => {
    const j = i + d
    if (j < 0 || j >= galleries.length) return
    onChange(arrayMove(galleries, i, j))
  }

  return (
    <div className="gallery-editor">
      {galleries.map((g, i) => (
        <GalleryCard
          key={g.id}
          gallery={g}
          wikiId={wikiId}
          onChange={(patch) => update(g.id, patch)}
          onMove={(d) => move(i, d)}
          first={i === 0}
          last={i === galleries.length - 1}
          onRemove={() => {
            if (!g.images.length || window.confirm(`Remove the gallery “${g.title || 'Gallery'}” and its ${g.images.length} images from this page?`)) {
              onChange(galleries.filter((x) => x.id !== g.id))
            }
          }}
        />
      ))}
      <button
        className="btn ghost"
        onClick={() => onChange([...galleries, { id: uid(), title: galleries.length ? 'More art' : 'Gallery', autoCollapse: true, images: [] }])}
      >
        + Add a gallery
      </button>
    </div>
  )
}

function GalleryCard({
  gallery,
  wikiId,
  onChange,
  onMove,
  onRemove,
  first,
  last
}: {
  gallery: Gallery
  wikiId: string
  onChange: (patch: Partial<Gallery>) => void
  onMove: (d: number) => void
  onRemove: () => void
  first: boolean
  last: boolean
}): React.JSX.Element {
  const [editing, setEditing] = useState<string | null>(null)
  const [dropping, setDropping] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // New images go to the front; drag to rearrange afterwards.
  const prepend = (files: string[]): void => {
    const added: GalleryImage[] = files.map((file) => ({ id: uid(), file, caption: '', source: '' }))
    onChange({ images: [...added, ...gallery.images] })
  }
  const add = async (): Promise<void> => prepend(await window.stash.pickImages(wikiId, true))
  const onDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    setDropping(false)
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))
    const names: string[] = []
    for (const f of files) names.push(await window.stash.saveImageData(wikiId, await f.arrayBuffer(), f.type))
    if (names.length) prepend(names.reverse())
  }
  const onDragEnd = (e: DragEndEvent): void => {
    if (!e.over || e.active.id === e.over.id) return
    const from = gallery.images.findIndex((i) => i.id === e.active.id)
    const to = gallery.images.findIndex((i) => i.id === e.over!.id)
    onChange({ images: arrayMove(gallery.images, from, to) })
  }
  const editImage = gallery.images.find((i) => i.id === editing)

  return (
    <div
      className={'gallery-card' + (dropping ? ' dropping' : '')}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault()
          setDropping(true)
        }
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropping(false)}
      onDrop={(e) => void onDrop(e)}
    >
      <div className="gallery-card-head">
        <input className="gallery-title-input" value={gallery.title} placeholder="Gallery title" onChange={(e) => onChange({ title: e.target.value })} />
        <label className="check" title="When the page opens, show only the first row with a “Show all” button">
          <input type="checkbox" checked={gallery.autoCollapse} onChange={(e) => onChange({ autoCollapse: e.target.checked })} />
          Start collapsed to one row
        </label>
        <span className="grow" />
        <button className="icon-btn" title="Move gallery up" disabled={first} onClick={() => onMove(-1)}>
          ↑
        </button>
        <button className="icon-btn" title="Move gallery down" disabled={last} onClick={() => onMove(1)}>
          ↓
        </button>
        <button className="link-btn danger" onClick={onRemove}>
          Remove gallery
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={gallery.images.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="ge-grid">
            <button className="ge-add" onClick={() => void add()}>
              <span>+</span>
              Add images
              <small>or drop them here</small>
            </button>
            {gallery.images.map((img) => (
              <SortableThumb key={img.id} image={img} onClick={() => setEditing(img.id)} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {gallery.images.length > 1 && <div className="hint">Drag pictures to change their order. Click one to add a description or source.</div>}
      {editImage && (
        <ImageDetails
          image={editImage}
          onClose={() => setEditing(null)}
          onChange={(patch) => onChange({ images: gallery.images.map((i) => (i.id === editImage.id ? { ...i, ...patch } : i)) })}
          onRemove={() => {
            onChange({ images: gallery.images.filter((i) => i.id !== editImage.id) })
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function SortableThumb({ image, onClick }: { image: GalleryImage; onClick: () => void }): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: image.id })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : undefined }
  return (
    <div ref={setNodeRef} style={style} className={'ge-thumb' + (isDragging ? ' dragging' : '')} {...attributes} {...listeners} onClick={onClick}>
      <img src={imgUrl(image.file)} alt="" draggable={false} />
      <div className={'ge-caption' + (image.caption ? '' : ' empty')}>{image.caption || 'Add description'}</div>
    </div>
  )
}

function ImageDetails({
  image,
  onChange,
  onClose,
  onRemove
}: {
  image: GalleryImage
  onChange: (patch: Partial<GalleryImage>) => void
  onClose: () => void
  onRemove: () => void
}): React.JSX.Element {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal image-details">
        <img src={imgUrl(image.file)} alt="" />
        <div className="image-details-form">
          <label className="field">
            <span>Description</span>
            <textarea
              autoFocus
              rows={3}
              value={image.caption}
              placeholder="Shown under the picture in the gallery and in the viewer"
              onChange={(e) => onChange({ caption: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Source / credit</span>
            <input
              value={image.source}
              placeholder="Artist, link, or where it came from — only shown in the viewer"
              onChange={(e) => onChange({ source: e.target.value })}
            />
          </label>
          <div className="row gap">
            <button className="btn" onClick={onClose}>
              Done
            </button>
            <span className="grow" />
            <button className="link-btn danger" onClick={onRemove}>
              Remove from gallery
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
