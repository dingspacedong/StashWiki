// Writing a chapter: the text itself, its name, a short summary, author's notes and a draft switch.
// Saves by itself; focus mode hides everything but the writing.
import { useEffect, useMemo, useRef, useState } from 'react'
import { findPage, useStore } from '../store'
import { chapterTitle, formatCount, storyChapters, wordCount } from '../lib/stories'
import { addChapter } from '../lib/storyActions'
import { SAVE_LABEL, useAutosave } from '../lib/useAutosave'
import { titleKey } from '../lib/wikitext'
import RichEditor from '../components/RichEditor'
import { StoryCrumbs } from '../components/storyBits'
import { askStoryBuddy, useAi } from '../ai/gate'
import { usePrefs } from '../lib/prefs'

export default function ChapterEditor({ id }: { id: string }): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const wikiId = useStore((s) => s.wikiId)!
  const go = useStore((s) => s.go)
  const aiOn = useAi((s) => !!s.settings?.enabled)
  const simple = usePrefs((s) => s.simple)
  const [focus, setFocus] = useState(false)
  const { draft, update, status, flush, version } = useAutosave(id, {
    // The page title follows the chapter's name: "Story: Name".
    beforeSave: (p) => {
      const story = useStore.getState().pages[p.chapter!.storyId]
      if (!story) return p
      const taken = (t: string): boolean => Object.values(useStore.getState().pages).some((x) => x.id !== p.id && titleKey(x.title) === titleKey(t))
      return { ...p, title: chapterTitle(story.title, p.chapter!.name, taken) }
    }
  })
  const startWords = useRef<number | null>(null)
  const titles = useMemo(() => Object.values(pages).map((p) => p.title), [pages])

  // Focus mode: only the writing on screen. Esc leaves it.
  useEffect(() => {
    document.documentElement.classList.toggle('sw-focus', focus)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && focus) setFocus(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('sw-focus')
    }
  }, [focus])

  if (!draft?.chapter) return <p className="muted">This chapter no longer exists.</p>
  const info = draft.chapter
  const set = (patch: Partial<typeof info>): void => update({ chapter: { ...info, ...patch } })
  const story = pages[info.storyId]
  const chapters = story ? storyChapters(story, pages) : []
  const n = chapters.findIndex((c) => c.id === id)
  const words = wordCount(draft.body)
  if (startWords.current === null) startWords.current = words
  const session = words - startWords.current

  const leave = (to: Parameters<typeof go>[0]): void => void flush().then(() => go(to, { force: true }))
  const openLink = (title: string): void => {
    const target = findPage(useStore.getState().pages, title)
    leave(target ? { kind: 'page', id: target.id } : { kind: 'new', title })
  }

  return (
    <article className={'page chapter-editor' + (focus ? ' focus' : '')}>
      <div className="simple-bar">
        <StoryCrumbs story={story} last={n >= 0 ? `Chapter ${n + 1} of ${chapters.length}` : info.name} />
        <span className="grow" />
        <span className="word-count" title="Words in this chapter">
          {formatCount(words)} words
          {session !== 0 && <span className={session > 0 ? 'session up' : 'session'}> {session > 0 ? '+' : ''}{formatCount(session)} this session</span>}
        </span>
        <span className="save-state muted small">{SAVE_LABEL[status]}</span>
        <button className={'btn small ghost' + (focus ? ' on' : '')} onClick={() => setFocus((f) => !f)} title="Hide everything but the writing (Esc to leave)">
          {focus ? 'Leave focus' : 'Focus'}
        </button>
        <button className="btn" onClick={() => leave({ kind: 'page', id })}>
          Done
        </button>
      </div>

      <div className="chapter-edit-head">
        <input className="chapter-name-big" value={info.name} placeholder="Chapter name" aria-label="Chapter name" onChange={(e) => set({ name: e.target.value })} />
        <label className="check draft-check" title="Drafts stay out of a website export until you untick this">
          <input type="checkbox" checked={draft.private} onChange={(e) => update({ private: e.target.checked })} />
          Draft (keep private)
        </label>
      </div>

      <details className="chapter-extras" open={!!(info.notesBefore || info.notesAfter)}>
        <summary>Summary &amp; author’s notes</summary>
        <label className="field">
          <span>
            Summary <span className="muted small">— a line or two, shown in the chapter list{__AI__ ? ' and used by the writing buddy to remember earlier chapters' : ''}</span>
          </span>
          <div className="row gap">
            <textarea rows={2} className="grow" value={info.summary ?? ''} onChange={(e) => set({ summary: e.target.value })} />
            {__AI__ && aiOn && (
              <button className="btn small ghost" title="Ask the writing buddy to summarize this chapter" onClick={() => void flush().then(() => askStoryBuddy('summary', 'Summarize this chapter.'))}>
                ✦ Summarize
              </button>
            )}
          </div>
        </label>
        <label className="field">
          <span>Author’s note (above the chapter)</span>
          <textarea rows={2} value={info.notesBefore ?? ''} placeholder="Thanks for reading! Content notes, shout-outs…" onChange={(e) => set({ notesBefore: e.target.value })} />
        </label>
        <label className="field">
          <span>End note (below the chapter)</span>
          <textarea rows={2} value={info.notesAfter ?? ''} onChange={(e) => set({ notesAfter: e.target.value })} />
        </label>
      </details>

      <div className="chapter-writing">
        <RichEditor key={version} value={draft.body} onChange={(body) => update({ body })} wikiId={wikiId} titles={titles} simple={simple} onOpenLink={openLink} />
      </div>

      <nav className="chapter-nav editing">
        {n > 0 ? (
          <button className="btn ghost" onClick={() => leave({ kind: 'edit', id: chapters[n - 1].id })}>
            ← Edit previous
          </button>
        ) : (
          <span />
        )}
        {n >= 0 && n < chapters.length - 1 ? (
          <button className="btn ghost" onClick={() => leave({ kind: 'edit', id: chapters[n + 1].id })}>
            Edit next →
          </button>
        ) : story ? (
          <button
            className="btn"
            onClick={async () => {
              await flush()
              const ch = await addChapter(story.id, undefined, undefined, id)
              go({ kind: 'edit', id: ch.id }, { force: true })
            }}
          >
            + Write the next chapter
          </button>
        ) : (
          <span />
        )}
      </nav>
    </article>
  )
}

