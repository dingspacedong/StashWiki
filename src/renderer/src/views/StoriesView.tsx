// The Stories shelf: every story, grouped by series, with search, a status filter and sorting.
import { useEffect, useRef, useState } from 'react'
import type { Page, StoryStatus } from '@shared/types'
import { useStore } from '../store'
import { STATUS_LABELS, allStories, formatCount, storiesOn, storyChapters, storyUpdated, storyWords } from '../lib/stories'
import { createStory, getProgress } from '../lib/storyActions'
import { Cover, RatingBadge, StatusBadge } from '../components/storyBits'
import { formatDate } from '../components/ui'
import { openAtProgress } from './ChapterView'

type Sort = 'updated' | 'title' | 'longest'

/** Lets "+ Story" elsewhere (the Mac sidebar) open the shelf ready to name a new story. */
export const STORY_FOCUS_EVENT = 'sw-new-story'

export default function StoriesView(): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  if (!storiesOn(meta)) return <StoriesOff />
  return <Shelf />
}

/** Shown if someone reaches the shelf while Stories are switched off. */
function StoriesOff(): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const count = useStore((s) => Object.values(s.pages).filter((p) => p.story).length)
  return (
    <div className="stories-empty">
      <div className="stories-empty-art">📖</div>
      <h2>Stories are switched off for this wiki</h2>
      <p className="muted">{count ? `Your ${count} stor${count === 1 ? 'y is' : 'ies are'} still here, just hidden.` : 'Turn them on to write fanfic and other stories with chapters.'}</p>
      <button className="btn" onClick={() => void useStore.getState().saveMeta({ ...meta, storiesOff: false })}>
        Turn Stories on
      </button>
    </div>
  )
}

function Shelf(): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const go = useStore((s) => s.go)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StoryStatus | ''>('')
  const [sort, setSort] = useState<Sort>('updated')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focus = (): void => input.current?.focus()
    window.addEventListener(STORY_FOCUS_EVENT, focus)
    return () => window.removeEventListener(STORY_FOCUS_EVENT, focus)
  }, [])

  const create = async (): Promise<void> => {
    const r = await createStory(title)
    if (typeof r === 'string') return setError(r)
    setTitle('')
    setError('')
    go({ kind: 'edit', id: r.id })
  }

  const stories = allStories(pages)
    .filter((s) => !status || s.story!.status === status)
    .filter((s) => {
      const t = q.trim().toLowerCase()
      return !t || [s.title, s.story!.summary, s.story!.series ?? '', ...s.story!.tags, ...s.story!.characters].join(' ').toLowerCase().includes(t)
    })
    .sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title) : sort === 'longest' ? storyWords(b, pages) - storyWords(a, pages) : storyUpdated(b, pages) - storyUpdated(a, pages)
    )

  // Series together (in part order), then the stories on their own.
  const groups = new Map<string, Page[]>()
  for (const s of stories) {
    const key = s.story!.series?.trim() || ''
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const order = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
  const total = allStories(pages).length

  return (
    <div className="stories-view">
      <div className="stories-head">
        <h1 className="page-title">Stories</h1>
        <div className="new-story">
          <input
            ref={input}
            value={title}
            placeholder="Title of a new story…"
            onChange={(e) => (setTitle(e.target.value), setError(''))}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
            aria-label="New story title"
          />
          <button className="btn" disabled={!title.trim()} onClick={() => void create()}>
            + New story
          </button>
        </div>
      </div>
      {error && <div className="field-error">{error}</div>}

      {total === 0 ? (
        <div className="stories-empty">
          <div className="stories-empty-art">📖</div>
          <h2>Write stories right inside your wiki</h2>
          <p>
            Fanfic, one-shots, whole series: each story gets its own page with a summary, tags and a chapter list, and chapters read like a
            book. Link to your characters with <code>[[Name]]</code> and their pages show which stories they appear in.
          </p>
          <p className="muted">Type a title above to start your first one.</p>
        </div>
      ) : (
        <>
          <div className="stories-filters">
            <input type="search" placeholder="Search stories, tags, characters…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search stories" />
            <span className="seg">
              {(['', 'wip', 'complete', 'hiatus'] as const).map((s) => (
                <button key={s || 'all'} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>
                  {s ? STATUS_LABELS[s] : 'All'}
                </button>
              ))}
            </span>
            <label className="field inline">
              <span>Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="updated">Recently updated</option>
                <option value="title">Title</option>
                <option value="longest">Longest</option>
              </select>
            </label>
          </div>
          {!stories.length && <p className="muted">No stories match.</p>}
          {order.map((series) => {
            const list = groups.get(series)!
            if (series) list.sort((a, b) => (a.story!.seriesPart ?? 999) - (b.story!.seriesPart ?? 999))
            return (
              <section key={series || '-'} className="story-shelf">
                {series ? <h2 className="shelf-title">📚 {series}</h2> : order.length > 1 && <h2 className="shelf-title">Stories</h2>}
                <div className="story-cards">
                  {list.map((s) => (
                    <StoryCard key={s.id} story={s} />
                  ))}
                </div>
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}

function StoryCard({ story }: { story: Page }): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const go = useStore((s) => s.go)
  const info = story.story!
  const chapters = storyChapters(story, pages)
  const progress = getProgress(story.id)
  const reading = progress ? chapters.find((c) => c.id === progress.chapterId) : undefined
  return (
    <div className="story-card" role="button" tabIndex={0} onClick={() => go({ kind: 'page', id: story.id })} onKeyDown={(e) => e.key === 'Enter' && go({ kind: 'page', id: story.id })}>
      <Cover story={story} size="small" />
      <div className="story-card-text">
        <div className="story-card-title">
          {info.seriesPart ? <span className="muted">{info.seriesPart}. </span> : null}
          {story.title}
        </div>
        <div className="story-badges">
          <StatusBadge status={info.status} />
          <RatingBadge rating={info.rating} />
          {story.private && <span className="story-badge draft">Private</span>}
        </div>
        {info.summary && <p className="story-card-summary">{info.summary.replace(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g, (_m, a: string, b?: string) => b || a)}</p>}
        <div className="story-card-meta">
          {chapters.length} chapter{chapters.length === 1 ? '' : 's'} · {formatCount(storyWords(story, pages))} words · {formatDate(storyUpdated(story, pages))}
        </div>
        {reading && (
          <button
            className="link-btn small continue-link"
            onClick={(e) => {
              e.stopPropagation()
              openAtProgress(reading.id, progress!.at)
              go({ kind: 'page', id: reading.id })
            }}
          >
            ▶ Continue: {reading.chapter!.name}
          </button>
        )}
      </div>
    </div>
  )
}
