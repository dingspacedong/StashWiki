import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Props<T extends { id: string }> {
  items: T[]
  onReorder: (items: T[]) => void
  /** Render one row; place `handle` where the drag grip should go. */
  render: (item: T, handle: React.ReactNode, index: number) => React.ReactNode
  className?: string
}

/** A vertical list whose rows are reordered by dragging their ⠿ grip. */
export default function SortableRows<T extends { id: string }>({ items, onReorder, render, className }: Props<T>): React.JSX.Element {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const onDragEnd = (e: DragEndEvent): void => {
    if (!e.over || e.active.id === e.over.id) return
    const from = items.findIndex((i) => i.id === e.active.id)
    const to = items.findIndex((i) => i.id === e.over!.id)
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, i) => (
            <Row key={item.id} id={item.id}>
              {(handle) => render(item, handle, i)}
            </Row>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function Row({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }): React.JSX.Element {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 10 : undefined
  }
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="drag-handle"
      title="Drag to move"
      aria-label="Drag to move"
      {...attributes}
      {...listeners}
    >
      ⠿
    </button>
  )
  return (
    <div ref={setNodeRef} style={style} className={'sortable-row' + (isDragging ? ' dragging' : '')}>
      {children(handle)}
    </div>
  )
}
