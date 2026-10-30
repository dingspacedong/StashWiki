import { useStore } from '../store'
import { STORY_FOCUS_EVENT } from '../views/StoriesView'

/** One-click starting points for new pages, at the top of the sidebar (simple design only). */
export default function QuickCreate(): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const go = useStore((s) => s.go)
  return (
    <div className="nav-group quick-create">
      <div className="nav-title">Create</div>
      {meta.templates.map((t) => (
        <button key={t.id} className="nav-link" onClick={() => go({ kind: 'new', templateId: t.id })}>
          <span className="dot" style={{ background: t.headerColor }} />+ {t.name}
        </button>
      ))}
      <button className="nav-link" onClick={() => go({ kind: 'new', templateId: '' })}>
        <span className="dot" style={{ background: 'var(--border)' }} />+ Blank page
      </button>
      {!meta.storiesOff && (
        <button
          className="nav-link"
          onClick={() => {
            go({ kind: 'special', name: 'stories' })
            setTimeout(() => window.dispatchEvent(new Event(STORY_FOCUS_EVENT)), 50)
          }}
        >
          <span className="dot story-dot" />+ Story
        </button>
      )}
    </div>
  )
}
