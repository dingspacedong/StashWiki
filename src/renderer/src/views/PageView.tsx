import { useMemo } from 'react'
import { useStore, useTitleIndex } from '../store'
import { renderBody } from '../lib/render'
import { parseCards, renderCardsHtml } from '../lib/cards'
import { titleKey } from '../lib/wikitext'
import { useApplyPageTheme } from '../previewTheme'
import Infobox from '../components/Infobox'
import TopMatter from '../components/TopMatter'
import GalleryView from '../components/GalleryView'
import { openLightbox } from '../components/Lightbox'
import { Dropdown, formatDate, handleLinkClick } from '../components/ui'
import { AppearsIn } from '../components/storyBits'
import StoryView from './StoryView'
import ChapterView from './ChapterView'
import { usePrefs } from '../lib/prefs'
import { autoNavboxes, navboxHtml, navboxTag } from '../lib/navigation'

export default function PageView({ id }: { id: string }): React.JSX.Element {
  const page = useStore((s) => s.pages[id])
  if (page?.story) return <StoryView page={page} />
  if (page?.chapter) return <ChapterView page={page} />
  return <WikiPageView id={id} />
}

function WikiPageView({ id }: { id: string }): React.JSX.Element {
  const page = useStore((s) => s.pages[id])
  const meta = useStore((s) => s.meta)!
  const go = useStore((s) => s.go)
  const simple = usePrefs((s) => s.simple)
  const pages = useStore((s) => s.pages)
  const index = useTitleIndex()
  useApplyPageTheme(page?.theme)

  const rendered = useMemo(() => {
    if (!page) return null
    const all = Object.values(pages)
    const exists = (t: string): boolean => index.has(titleKey(t))
    const box = (id: string): string => navboxHtml(meta.navboxes?.find((b) => b.id === id), all)
    const body = renderBody(page.body, exists, (json) => renderCardsHtml(parseCards(json), (t) => index.get(titleKey(t)), meta), box)
    // Nav boxes set to show on pages in this page's categories go at the bottom.
    const autos = autoNavboxes(meta, page)
    const bottom = autos.length ? renderBody(autos.map((b) => navboxTag(b.id)).join(''), exists, undefined, box).html : ''
    return { ...body, bottom }
  }, [page, index, pages, meta])

  if (!page || !rendered) {
    return (
      <div className="notice-page">
        <h1 className="page-title">Page not found</h1>
        <p>This page was deleted or moved to the trash.</p>
        <button className="btn" onClick={() => go({ kind: 'special', name: 'trash' })}>
          Open the trash
        </button>
      </div>
    )
  }

  const template = meta.templates.find((t) => t.id === page.templateId)
  const isMain = meta.mainPageId === page.id

  const onBodyClick = (e: React.MouseEvent): void => {
    // Spoiler boxes reveal on click (and hide again on a second click).
    const spoiler = (e.target as HTMLElement).closest('div[data-callout="spoiler"]')
    if (spoiler && !(e.target as HTMLElement).closest('a')) {
      spoiler.classList.toggle('revealed')
      return
    }
    const img = (e.target as HTMLElement).closest('.prose > img, .prose p img, .prose li img, .prose .img-fig img')
    if (img) {
      const file = decodeURIComponent(img.getAttribute('src')?.split('/images/')[1] ?? '')
      if (file) openLightbox([{ file, caption: img.getAttribute('alt') ?? '', source: '' }], 0)
      return
    }
    handleLinkClick(e)
  }

  const remove = async (): Promise<void> => {
    if (!window.confirm(`Move “${page.title}” to the trash? You can restore it from Trash later.`)) return
    await useStore.getState().trashPage(page.id)
    useStore.getState().notify(`Moved “${page.title}” to the trash`)
    go({ kind: 'special', name: 'recent' }, { replace: true })
  }

  return (
    <article className="page">
      <div className="page-tabs">
        <button className="tab active">Read</button>
        <button className="tab" onClick={() => go({ kind: 'edit', id: page.id })} title="Edit this page">
          Edit
        </button>
        <Dropdown label="More ▾" className="tab" align="right">
          {(close) => (
            <div className="menu">
              <button
                onClick={() => {
                  close()
                  go({ kind: 'backlinks', id: page.id })
                }}
              >
                What links here
              </button>
              <button
                onClick={() => {
                  close()
                  go({ kind: 'history', id: page.id })
                }}
              >
                Page history (earlier versions)
              </button>
              {!isMain && (
                <button
                  onClick={async () => {
                    close()
                    await useStore.getState().saveMeta({ ...meta, mainPageId: page.id })
                    useStore.getState().notify(`“${page.title}” is now the main page`)
                  }}
                >
                  Make this the main page
                </button>
              )}
              <button className="danger" onClick={() => (close(), void remove())}>
                Move to trash
              </button>
            </div>
          )}
        </Dropdown>
      </div>
      <h1 className="page-title">
        {page.title}
        {page.private && (
          <span className="badge" title="Left out when the wiki is exported as a website">
            Private
          </span>
        )}
      </h1>
      {meta.tagline && <div className="page-sub">{meta.tagline}</div>}

      <div
        className="article"
        onDoubleClick={simple ? () => go({ kind: 'edit', id: page.id }) : undefined}
        title={simple ? 'Double-click to edit' : undefined}
      >
        <TopMatter page={page} />
        {template && <Infobox page={page} template={template} />}
        <div className="prose" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: rendered.html }} />
        {page.galleries.map((g) => (
          <GalleryView key={g.id} gallery={g} />
        ))}
        <div className="clear" />
      </div>
      {rendered.bottom && <div className="prose auto-navboxes" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: rendered.bottom }} />}
      <AppearsIn page={page} />

      {page.categories.length > 0 && (
        <div className="catlinks">
          <span className="catlinks-label">Categories:</span>
          {page.categories.map((c) => (
            <button key={c} className="link-btn" onClick={() => go({ kind: 'category', name: c })}>
              {c}
            </button>
          ))}
        </div>
      )}
      <div className="page-foot">Last edited {formatDate(page.updatedAt)}</div>
    </article>
  )
}
