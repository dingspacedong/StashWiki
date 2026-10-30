// A story's front page: cover, summary, details, the chapter list and where to carry on reading.
import { useMemo, useState } from 'react'
import type { Page } from '@shared/types'
import { findPage, useStore, useTitleIndex } from '../store'
import { renderBody } from '../lib/render'
import { parseCards, renderCardsHtml } from '../lib/cards'
import { renderInlineText, titleKey } from '../lib/wikitext'
import { formatCount, readingTime, seriesStories, storyChapters, storyUpdated, storyWords, wordCount } from '../lib/stories'
import { addChapter, getProgress, reorderChapters, trashStory } from '../lib/storyActions'
import { Cover, RatingBadge, StatusBadge, StoryCrumbs } from '../components/storyBits'
import SortableRows from '../components/SortableRows'
import { Dropdown, formatDate, handleLinkClick } from '../components/ui'
import { openAtProgress } from './ChapterView'

export default function StoryView({ page }: { page: Page }): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const meta = useStore((s) => s.meta)!
  const go = useStore((s) => s.go)
  const index = useTitleIndex()
  const [busy, setBusy] = useState(false)
  const info = page.story!
  const chapters = storyChapters(page, pages)
  const words = storyWords(page, pages)
  const progress = getProgress(page.id)
  const resumeAt = progress ? chapters.findIndex((c) => c.id === progress.chapterId) : -1
  const exists = (t: string): boolean => index.has(titleKey(t))
  const series = info.series ? seriesStories(info.series, pages) : []
  const about = useMemo(
    () => (page.body.replace(/<p>\s*<\/p>/g, '').trim() ? renderBody(page.body, exists, (json) => renderCardsHtml(parseCards(json), (t) => index.get(titleKey(t)), meta)).html : ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [page.body, index]
  )

  const newChapter = async (): Promise<void> => {
    setBusy(true)
    const ch = await addChapter(page.id)
    setBusy(false)
    go({ kind: 'edit', id: ch.id })
  }
  const remove = async (): Promise<void> => {
    if (!window.confirm(`Move “${page.title}” and its ${chapters.length} chapter${chapters.length === 1 ? '' : 's'} to the trash? You can restore them from Trash later.`)) return
    await trashStory(page.id)
    useStore.getState().notify(`Moved “${page.title}” to the trash`)
    go({ kind: 'special', name: 'stories' }, { replace: true })
  }

  return (
    <article className="page story-page">
      <div className="page-tabs">
        <button className="tab active">Story</button>
        <button className="tab" onClick={() => go({ kind: 'edit', id: page.id })}>
          Edit details
        </button>
        <Dropdown label="More ▾" className="tab" align="right">
          {(close) => (
            <div className="menu">
              <button onClick={() => (close(), go({ kind: 'backlinks', id: page.id }))}>What links here</button>
              <button onClick={() => (close(), go({ kind: 'history', id: page.id }))}>Page history (earlier versions)</button>
              <button className="danger" onClick={() => (close(), void remove())}>
                Move story to trash
              </button>
            </div>
          )}
        </Dropdown>
      </div>
      <StoryCrumbs story={page} />

      <header className="story-hero">
        <Cover story={page} />
        <div className="story-hero-text">
          <h1 className="page-title story-title">
            {page.title}
            {page.private && <span className="badge">Private</span>}
          </h1>
          {info.series && (
            <div className="story-series-line">
              {info.seriesPart ? `Part ${info.seriesPart} of ` : 'Part of '}
              <strong>{info.series}</strong>
            </div>
          )}
          <div className="story-badges">
            <StatusBadge status={info.status} />
            <RatingBadge rating={info.rating} />
          </div>
          {info.summary.trim() ? (
            <div className="story-summary" onClick={handleLinkClick} dangerouslySetInnerHTML={{ __html: renderInlineText(info.summary.trim(), exists) }} />
          ) : (
            <p className="muted">No summary yet — add one in “Edit details”.</p>
          )}
          <div className="story-stats">
            <span>
              <b>{chapters.length}</b> chapter{chapters.length === 1 ? '' : 's'}
            </span>
            <span>
              <b>{formatCount(words)}</b> words
            </span>
            <span>
              <b>{readingTime(words)}</b> read
            </span>
            <span>updated {formatDate(storyUpdated(page, pages))}</span>
          </div>
          {info.warnings.length > 0 && (
            <div className="story-meta-row">
              <span className="story-meta-label">Warnings</span>
              {info.warnings.map((w) => (
                <span key={w} className="chip warn">
                  {w}
                </span>
              ))}
            </div>
          )}
          {info.characters.length > 0 && (
            <div className="story-meta-row">
              <span className="story-meta-label">Characters</span>
              {info.characters.map((c) => {
                const target = findPage(pages, c)
                return (
                  <button key={c} className={'chip link' + (target ? '' : ' missing')} onClick={() => go(target ? { kind: 'page', id: target.id } : { kind: 'new', title: c })}>
                    {c}
                  </button>
                )
              })}
            </div>
          )}
          {info.tags.length > 0 && (
            <div className="story-meta-row">
              <span className="story-meta-label">Tags</span>
              {info.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="story-actions">
            {chapters.length > 0 &&
              (resumeAt > 0 || (resumeAt === 0 && progress!.at > 0.05) ? (
                <>
                  <button
                    className="btn"
                    onClick={() => {
                      openAtProgress(progress!.chapterId, progress!.at)
                      go({ kind: 'page', id: progress!.chapterId })
                    }}
                  >
                    ▶ Continue: {chapters[resumeAt].chapter!.name}
                    {progress!.at > 0.05 && progress!.at < 0.97 ? ` (${Math.round(progress!.at * 100)}%)` : ''}
                  </button>
                  <button className="btn ghost" onClick={() => go({ kind: 'page', id: chapters[0].id })}>
                    Start from the beginning
                  </button>
                </>
              ) : (
                <button className="btn" onClick={() => go({ kind: 'page', id: chapters[0].id })}>
                  ▶ Start reading
                </button>
              ))}
            <button className={chapters.length ? 'btn ghost' : 'btn'} disabled={busy} onClick={() => void newChapter()}>
              ✎ {chapters.length ? 'Write a new chapter' : 'Write the first chapter'}
            </button>
          </div>
        </div>
      </header>

      <section className="story-chapters">
        <h2>Chapters</h2>
        {chapters.length === 0 ? (
          <p className="muted">No chapters yet.</p>
        ) : (
          <SortableRows
            className="chapter-list"
            items={chapters}
            onReorder={(list) => void reorderChapters(page.id, list.map((c) => c.id))}
            render={(c, handle, i) => {
              const w = wordCount(c.body)
              return (
                <div className={'chapter-row' + (progress?.chapterId === c.id ? ' reading' : '')}>
                  {handle}
                  <span className="chapter-num">{i + 1}</span>
                  <div className="chapter-row-main">
                    <button className="link-btn chapter-row-name" onClick={() => go({ kind: 'page', id: c.id })}>
                      {c.chapter!.name}
                    </button>
                    {c.private && <span className="story-badge draft">Draft</span>}
                    {progress?.chapterId === c.id && <span className="story-badge soft">reading</span>}
                    {c.chapter!.summary?.trim() && <div className="chapter-row-summary">{c.chapter!.summary}</div>}
                  </div>
                  <span className="chapter-row-meta">
                    {formatCount(w)} words
                    <br />
                    {formatDate(c.updatedAt)}
                  </span>
                  <button className="icon-btn" title="Edit this chapter" onClick={() => go({ kind: 'edit', id: c.id })}>
                    ✎
                  </button>
                </div>
              )
            }}
          />
        )}
      </section>

      {about && (
        <section className="story-about">
          <div className="prose" onClick={handleLinkClick} dangerouslySetInnerHTML={{ __html: about }} />
        </section>
      )}

      {series.length > 1 && (
        <section className="story-series">
          <h2>{info.series}</h2>
          <ol>
            {series.map((s) => (
              <li key={s.id} className={s.id === page.id ? 'current' : ''}>
                {s.id === page.id ? (
                  <strong>{s.title}</strong>
                ) : (
                  <button className="link-btn" onClick={() => go({ kind: 'page', id: s.id })}>
                    {s.title}
                  </button>
                )}
                <span className="muted small">
                  {' '}
                  · {storyChapters(s, pages).length} chapter{storyChapters(s, pages).length === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  )
}
