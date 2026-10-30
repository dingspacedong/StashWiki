// Reading a chapter: a calm, book-like page with the author's notes, "Chapter 3 of 12", previous / next,
// a reading-progress bar and the place you stopped remembered for next time.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Page } from '@shared/types'
import { useStore, useTitleIndex } from '../store'
import { renderBody } from '../lib/render'
import { parseCards, renderCardsHtml } from '../lib/cards'
import { renderInlineText, titleKey } from '../lib/wikitext'
import { formatCount, readingTime, storyChapters, wordCount } from '../lib/stories'
import { getProgress, setProgress, trashChapter } from '../lib/storyActions'
import { ReadingMenu, StoryCrumbs, useReading } from '../components/storyBits'
import { openLightbox } from '../components/Lightbox'
import { Dropdown, formatDate, handleLinkClick } from '../components/ui'
import { usePrefs } from '../lib/prefs'

/** Set by "Continue reading" so the chapter opens where the reader stopped. */
let resumeTarget: { chapterId: string; at: number } | null = null
export function openAtProgress(chapterId: string, at: number): void {
  resumeTarget = { chapterId, at }
}

export default function ChapterView({ page }: { page: Page }): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const meta = useStore((s) => s.meta)!
  const go = useStore((s) => s.go)
  const index = useTitleIndex()
  const [prefs] = useReading()
  const simple = usePrefs((s) => s.simple)
  const [progress, setBar] = useState(0)
  const story = pages[page.chapter!.storyId]
  const chapters = story ? storyChapters(story, pages) : [page]
  const n = chapters.findIndex((c) => c.id === page.id)
  const prev = chapters[n - 1]
  const next = chapters[n + 1]
  const words = wordCount(page.body)
  const exists = (t: string): boolean => index.has(titleKey(t))
  const top = useRef<HTMLDivElement>(null)

  const rendered = useMemo(
    () => renderBody(page.body, exists, (json) => renderCardsHtml(parseCards(json), (t) => index.get(titleKey(t)), meta)).html,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page.body, index]
  )

  // Remember how far down the reader is, and pick up there when "Continue reading" brought them here.
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>('.content-scroll')
    if (!scroller) return
    const target = resumeTarget?.chapterId === page.id ? resumeTarget.at : 0
    resumeTarget = null
    requestAnimationFrame(() => {
      const max = scroller.scrollHeight - scroller.clientHeight
      scroller.scrollTop = target > 0.02 ? target * max : 0
    })
    let t: ReturnType<typeof setTimeout> | undefined
    const onScroll = (): void => {
      const max = scroller.scrollHeight - scroller.clientHeight
      const at = max > 0 ? scroller.scrollTop / max : 1
      setBar(at)
      clearTimeout(t)
      t = setTimeout(() => story && setProgress(story.id, page.id, at), 300)
    }
    if (story) setProgress(story.id, page.id, getProgress(story.id)?.chapterId === page.id ? (getProgress(story.id)?.at ?? 0) : 0)
    scroller.addEventListener('scroll', onScroll)
    return () => {
      clearTimeout(t)
      scroller.removeEventListener('scroll', onScroll)
    }
  }, [page.id, story?.id])

  // ← and → turn the page (when not typing somewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const el = e.target as HTMLElement
      if (e.altKey || e.ctrlKey || e.metaKey || el.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'ArrowLeft' && prev) go({ kind: 'page', id: prev.id })
      if (e.key === 'ArrowRight' && next) go({ kind: 'page', id: next.id })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev?.id, next?.id])

  const onBodyClick = (e: React.MouseEvent): void => {
    const spoiler = (e.target as HTMLElement).closest('div[data-callout="spoiler"]')
    if (spoiler && !(e.target as HTMLElement).closest('a')) return void spoiler.classList.toggle('revealed')
    const img = (e.target as HTMLElement).closest('.prose > img, .prose p img')
    if (img) {
      const file = decodeURIComponent(img.getAttribute('src')?.split('/images/')[1] ?? '')
      if (file) return void openLightbox([{ file, caption: img.getAttribute('alt') ?? '', source: '' }], 0)
    }
    handleLinkClick(e)
  }

  const remove = async (): Promise<void> => {
    if (!window.confirm(`Move “${page.chapter!.name}” to the trash? You can restore it from Trash later.`)) return
    await trashChapter(page.id)
    useStore.getState().notify(`Moved “${page.chapter!.name}” to the trash`)
    go(story ? { kind: 'page', id: story.id } : { kind: 'special', name: 'stories' }, { replace: true })
  }

  const note = (text: string | undefined, label: string): React.JSX.Element | null =>
    text?.trim() ? (
      <aside className="author-note" onClick={handleLinkClick}>
        <div className="author-note-label">{label}</div>
        <div dangerouslySetInnerHTML={{ __html: renderInlineText(text.trim(), exists) }} />
      </aside>
    ) : null

  const done = story?.story?.status === 'complete'
  return (
    <article className="page chapter-page">
      <div className="read-progress" aria-hidden>
        <div style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="page-tabs">
        <button className="tab active">Read</button>
        <button className="tab" onClick={() => go({ kind: 'edit', id: page.id })}>
          Edit
        </button>
        <Dropdown label="More ▾" className="tab" align="right">
          {(close) => (
            <div className="menu">
              <button onClick={() => (close(), go({ kind: 'backlinks', id: page.id }))}>What links here</button>
              <button onClick={() => (close(), go({ kind: 'history', id: page.id }))}>Page history (earlier versions)</button>
              <button className="danger" onClick={() => (close(), void remove())}>
                Move chapter to trash
              </button>
            </div>
          )}
        </Dropdown>
      </div>
      <div className="chapter-top" ref={top}>
        <StoryCrumbs story={story} last={story ? `Chapter ${n + 1} of ${chapters.length}` : page.chapter!.name} />
        <ReadingMenu />
      </div>

      <div
        className={`chapter-reader size-${prefs.size} font-${prefs.font} spacing-${prefs.spacing} width-${prefs.width} theme-${prefs.theme}`}
        onDoubleClick={simple ? () => go({ kind: 'edit', id: page.id }) : undefined}
      >
        <header className="chapter-head">
          <div className="chapter-kicker">
            Chapter {n + 1}
            {page.private && <span className="story-badge draft">Draft</span>}
          </div>
          <h1 className="chapter-title">{page.chapter!.name}</h1>
          <div className="chapter-meta">
            {formatCount(words)} words · {readingTime(words)} read · updated {formatDate(page.updatedAt)}
          </div>
        </header>
        {note(page.chapter!.notesBefore, 'Author’s note')}
        <div className="prose chapter-prose" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: rendered }} />
        {note(page.chapter!.notesAfter, 'End note')}
        {!next && story && <div className="chapter-end">{done ? '✦ The End ✦' : 'To be continued…'}</div>}

        <nav className="chapter-nav" aria-label="Chapters">
          {prev ? (
            <button className="btn ghost" onClick={() => go({ kind: 'page', id: prev.id })} title={prev.chapter!.name}>
              ← Previous
            </button>
          ) : (
            <span />
          )}
          {story && (
            <select
              aria-label="Go to chapter"
              value={page.id}
              onChange={(e) => go({ kind: 'page', id: e.target.value })}
            >
              {chapters.map((c, i) => (
                <option key={c.id} value={c.id}>
                  {i + 1}. {c.chapter!.name}
                </option>
              ))}
            </select>
          )}
          {next ? (
            <button className="btn" onClick={() => go({ kind: 'page', id: next.id })} title={next.chapter!.name}>
              Next →
            </button>
          ) : story ? (
            <button className="btn ghost" onClick={() => go({ kind: 'page', id: story.id })}>
              Back to the story
            </button>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </article>
  )
}
