// Editing a story's details: title, cover, summary, status, rating, warnings, tags, characters, series,
// the chapter list and an optional "about" section. Saves by itself.
import { useMemo, useState } from 'react'
import type { StoryRating, StoryStatus } from '@shared/types'
import { findPage, useStore } from '../store'
import { cleanTitle, titleKey } from '../lib/wikitext'
import { COMMON_WARNINGS, RATING_LABELS, STATUS_LABELS, allStories, formatCount, isWikiPage, storyChapters, wordCount } from '../lib/stories'
import { addChapter, renameChapter, reorderChapters, retitleChapters, trashChapter } from '../lib/storyActions'
import { SAVE_LABEL, useAutosave } from '../lib/useAutosave'
import { imgUrl } from '../lib/theme'
import RichEditor from '../components/RichEditor'
import SortableRows from '../components/SortableRows'
import { ChipInput, StoryCrumbs } from '../components/storyBits'
import { usePrefs } from '../lib/prefs'

export default function StoryEditor({ id }: { id: string }): React.JSX.Element {
  const pages = useStore((s) => s.pages)
  const wikiId = useStore((s) => s.wikiId)!
  const go = useStore((s) => s.go)
  const [titleText, setTitleText] = useState(pages[id]?.title ?? '')
  const [pick, setPick] = useState('')
  const simple = usePrefs((s) => s.simple)
  const { draft, update, status, flush, version } = useAutosave(id, {
    afterSave: async (saved, previous) => {
      if (previous !== saved.title) await retitleChapters(saved.id)
    }
  })
  const titles = useMemo(() => Object.values(pages).map((p) => p.title), [pages])
  const allTags = useMemo(() => [...new Set(allStories(pages).flatMap((s) => s.story!.tags))].sort(), [pages])
  const allSeries = useMemo(() => [...new Set(allStories(pages).map((s) => s.story!.series?.trim()).filter(Boolean) as string[])].sort(), [pages])
  const wikiPages = useMemo(() => Object.values(pages).filter(isWikiPage).map((p) => p.title).sort(), [pages])

  if (!draft?.story) return <p className="muted">This story no longer exists.</p>
  const info = draft.story
  const set = (patch: Partial<typeof info>): void => update({ story: { ...info, ...patch } })
  const stored = pages[id]
  const chapters = stored ? storyChapters(stored, pages) : []

  const t = cleanTitle(titleText)
  const clash = t ? findPage(pages, t) : undefined
  const titleError = !t ? 'Give the story a title.' : clash && clash.id !== id ? `There is already a page called “${clash.title}”.` : ''

  const chooseCover = async (): Promise<void> => {
    const [file] = await window.stash.pickImages(wikiId, false)
    if (file) set({ cover: file })
  }
  const addCharacter = (name: string): void => {
    const n = name.trim()
    if (n && !info.characters.some((c) => titleKey(c) === titleKey(n))) set({ characters: [...info.characters, n] })
    setPick('')
  }

  return (
    <article className="page story-editor">
      <div className="simple-bar">
        <StoryCrumbs story={draft} last="Editing details" />
        <span className="grow" />
        <span className="save-state muted small">{SAVE_LABEL[status]}</span>
        <button className="btn" onClick={() => void flush().then(() => go({ kind: 'page', id }, { force: true }))}>
          Done
        </button>
      </div>

      <div className="story-editor-grid">
        <div className="story-editor-cover">
          {info.cover ? <img src={imgUrl(info.cover)} alt="" /> : <div className="story-cover big"><span>{draft.title.slice(0, 1)}</span></div>}
          <div className="row gap">
            <button className="btn small" onClick={() => void chooseCover()}>
              {info.cover ? 'Change cover' : 'Add a cover'}
            </button>
            {info.cover && (
              <button className="link-btn danger small" onClick={() => set({ cover: undefined })}>
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="story-editor-fields">
          <label className="field">
            <span>Title</span>
            <input
              className="story-title-input"
              value={titleText}
              onChange={(e) => {
                setTitleText(e.target.value)
                const v = cleanTitle(e.target.value)
                const c = v ? findPage(useStore.getState().pages, v) : undefined
                if (v && (!c || c.id === id)) update({ title: v })
              }}
            />
            {titleError && <span className="field-error">{titleError}</span>}
          </label>
          <label className="field">
            <span>Summary</span>
            <textarea
              rows={4}
              value={info.summary}
              placeholder="What is the story about? Shown on the story page and the Stories shelf. [[Links]] work."
              onChange={(e) => set({ summary: e.target.value })}
            />
          </label>
          <div className="row gap wrap">
            <div className="field">
              <span>Status</span>
              <span className="seg">
                {(Object.keys(STATUS_LABELS) as StoryStatus[]).map((s) => (
                  <button key={s} className={info.status === s ? 'on' : ''} onClick={() => set({ status: s })}>
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </span>
            </div>
            <label className="field inline">
              <span>Rating</span>
              <select value={info.rating} onChange={(e) => set({ rating: e.target.value as StoryRating })}>
                {(Object.keys(RATING_LABELS) as StoryRating[]).map((r) => (
                  <option key={r} value={r}>
                    {RATING_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <section className="editor-section">
        <h3>Content warnings</h3>
        <div className="warning-grid">
          {COMMON_WARNINGS.map((w) => (
            <label key={w} className="check">
              <input
                type="checkbox"
                checked={info.warnings.includes(w)}
                onChange={(e) => set({ warnings: e.target.checked ? [...info.warnings, w] : info.warnings.filter((x) => x !== w) })}
              />
              {w}
            </label>
          ))}
        </div>
        <ChipInput value={info.warnings.filter((w) => !COMMON_WARNINGS.includes(w))} onChange={(own) => set({ warnings: [...info.warnings.filter((w) => COMMON_WARNINGS.includes(w)), ...own] })} placeholder="Add your own warning…" />
      </section>

      <section className="editor-section">
        <h3>Tags</h3>
        <ChipInput value={info.tags} onChange={(tags) => set({ tags })} placeholder="Add a tag (Enter)… e.g. hurt/comfort, found family, AU" suggestions={allTags} />
      </section>

      <section className="editor-section">
        <h3>Characters</h3>
        <p className="hint">Their wiki pages will list this story under “Appears in”.</p>
        <div className="chip-input">
          {info.characters.map((c) => (
            <span key={c} className="chip">
              {c}
              <button aria-label={`Remove ${c}`} onClick={() => set({ characters: info.characters.filter((x) => x !== c) })}>
                ×
              </button>
            </span>
          ))}
          <input
            list="story-characters"
            value={pick}
            placeholder="Add a character…"
            onChange={(e) => {
              // Picking from the list adds straight away; typing waits for Enter.
              const picked = !(e.nativeEvent as InputEvent).inputType || (e.nativeEvent as InputEvent).inputType === 'insertReplacementText'
              if (picked && wikiPages.includes(e.target.value)) addCharacter(e.target.value)
              else setPick(e.target.value)
            }}
            onKeyDown={(e) => e.key === 'Enter' && addCharacter(pick)}
          />
          <datalist id="story-characters">
            {wikiPages.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
      </section>

      <section className="editor-section">
        <h3>Series (optional)</h3>
        <div className="row gap wrap">
          <label className="field inline grow">
            <span>Series name</span>
            <input list="story-series" value={info.series ?? ''} placeholder="e.g. The Lighthouse Saga" onChange={(e) => set({ series: e.target.value || undefined })} />
            <datalist id="story-series">
              {allSeries.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </label>
          <label className="field inline">
            <span>Part</span>
            <input
              type="number"
              min={1}
              className="part-input"
              value={info.seriesPart ?? ''}
              onChange={(e) => set({ seriesPart: e.target.value ? Math.max(1, Number(e.target.value)) : undefined })}
            />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={draft.private} onChange={(e) => update({ private: e.target.checked })} />
          Keep the whole story private (never in a website export)
        </label>
      </section>

      <section className="editor-section">
        <h3>Chapters</h3>
        {chapters.length > 0 && (
          <SortableRows
            className="chapter-list editing"
            items={chapters}
            onReorder={(list) => void reorderChapters(id, list.map((c) => c.id))}
            render={(c, handle, i) => (
              <div className="chapter-row">
                {handle}
                <span className="chapter-num">{i + 1}</span>
                <input
                  className="chapter-name-input"
                  defaultValue={c.chapter!.name}
                  aria-label={`Name of chapter ${i + 1}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== c.chapter!.name) void renameChapter(c.id, v)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
                <span className="chapter-row-meta">{formatCount(wordCount(c.body))} words</span>
                <button className="btn small ghost" onClick={() => void flush().then(() => go({ kind: 'edit', id: c.id }, { force: true }))}>
                  Write
                </button>
                <button
                  className="icon-btn"
                  title="Move this chapter to the trash"
                  onClick={() => {
                    if (window.confirm(`Move “${c.chapter!.name}” to the trash?`)) void trashChapter(c.id)
                  }}
                >
                  🗑
                </button>
              </div>
            )}
          />
        )}
        <button
          className="btn small"
          onClick={async () => {
            await flush()
            const ch = await addChapter(id)
            go({ kind: 'edit', id: ch.id }, { force: true })
          }}
        >
          + Add a chapter
        </button>
      </section>

      <section className="editor-section">
        <h3>About this story (optional)</h3>
        <p className="hint">Anything else for the story page: inspirations, playlists, a fancy banner (Insert → Fancy block)…</p>
        <div className="editor-prose-wrap">
          <RichEditor
            key={version}
            value={draft.body}
            onChange={(body) => update({ body })}
            wikiId={wikiId}
            titles={titles}
            simple={simple}
            onOpenLink={(title) => {
              void flush()
              const target = findPage(useStore.getState().pages, title)
              go(target ? { kind: 'page', id: target.id } : { kind: 'new', title }, { force: true })
            }}
          />
        </div>
      </section>
    </article>
  )
}
