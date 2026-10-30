import { useEffect } from 'react'
import { useStore, type Route } from './store'
import { imgUrl, themeVars } from './lib/theme'
import SearchBox from './components/SearchBox'
import PageView from './views/PageView'
import PageEditor from './views/PageEditor'
import NewPage from './views/NewPage'
import { AllPages, Backlinks, Categories, CategoryView, Recent, SearchResults, Trash } from './views/Specials'
import TemplatesView from './views/TemplatesView'
import HistoryView from './views/HistoryView'
import CssEditor from './views/CssEditor'
import StoriesView from './views/StoriesView'
import StoryEditor from './views/StoryEditor'
import ChapterEditor from './views/ChapterEditor'
import { isWikiPage, storiesOn } from './lib/stories'
import SettingsView from './views/SettingsView'
import { usePreviewTheme } from './previewTheme'
import Lightbox from './components/Lightbox'
import { BACK_LABEL, FORWARD_LABEL, isMac } from './lib/platform'
import SimplePage from './simple/SimplePage'
import QuickCreate from './simple/QuickCreate'
import ErrorBoundary from './components/ErrorBoundary'
import { AiPanel, useAi } from './ai/gate'
import { usePrefs } from './lib/prefs'
import { shownLogo, useMix, useMixUp, withMixedTheme } from './lib/mixUp'

export default function Shell(): React.JSX.Element {
  const simple = usePrefs((s) => s.simple)
  const meta = useStore((s) => s.meta)!
  const route = useStore((s) => s.route)
  const pages = useStore((s) => s.pages)
  const past = useStore((s) => s.past)
  const future = useStore((s) => s.future)
  const go = useStore((s) => s.go)
  const pageTheme = usePreviewTheme((s) => s.theme)

  const vars = themeVars(meta.theme, pageTheme ?? {})
  // Custom CSS styles the wiki while reading (and while editing in place on a Mac), never the settings
  // screens, so CSS that hides something can always be fixed.
  const reading =
    route.kind === 'page' ||
    route.kind === 'category' ||
    route.kind === 'search' ||
    route.kind === 'backlinks' ||
    route.kind === 'history' ||
    (route.kind === 'edit' && simple) ||
    (route.kind === 'special' && ['allpages', 'recent', 'categories', 'stories'].includes(route.name))
  const viewing = route.kind === 'page' || route.kind === 'edit' ? pages[route.id] : undefined
  const wikiId = useStore((s) => s.wikiId)
  const mix = useMix()
  useMixUp(meta, wikiId, route)
  const wikiCss = withMixedTheme(meta, meta.customCss ?? '', mix.theme)
  const customCss = reading && !meta.customCssOff ? [wikiCss, viewing?.customCss ?? ''].filter((c) => c.trim()).join('\n') : ''
  const logo = shownLogo(meta, mix.logo)
  const aiOn = useAi((s) => !!s.settings?.enabled)
  const aiOpen = useAi((s) => s.open)

  useEffect(() => {
    if (__AI__) void useAi.getState().loadSettings()
  }, [])

  useEffect(() => {
    document.title = `${routeTitle(route, pages)} — ${meta.name}`
  }, [route, pages, meta.name])

  const goMain = (): void => {
    if (meta.mainPageId && pages[meta.mainPageId]) go({ kind: 'page', id: meta.mainPageId })
    else go({ kind: 'special', name: 'allpages' })
  }
  const random = (): void => {
    const all = Object.values(pages).filter(isWikiPage)
    if (all.length) go({ kind: 'page', id: all[Math.floor(Math.random() * all.length)].id })
  }
  const nav = (r: Route, label: string, active: boolean): React.JSX.Element => (
    <button className={active ? 'nav-link active' : 'nav-link'} onClick={() => go(r)}>
      {label}
    </button>
  )
  const special = (name: string): boolean => route.kind === 'special' && route.name === name

  return (
    <div className="app" style={vars as React.CSSProperties}>
      {customCss && <style id="sw-custom-css">{customCss}</style>}
      <div className="backdrop" />
      <header className="topbar">
        <div className="history-btns">
          <button className="icon-btn" title={`Back (${BACK_LABEL})`} disabled={!past.length} onClick={() => useStore.getState().back()}>
            ‹
          </button>
          <button className="icon-btn" title={`Forward (${FORWARD_LABEL})`} disabled={!future.length} onClick={() => useStore.getState().forward()}>
            ›
          </button>
        </div>
        <button className="wiki-brand" onClick={goMain} title="Main page">
          {logo ? <img src={imgUrl(logo)} alt="" /> : <span className="brand-dot">{meta.name.slice(0, 1)}</span>}
          <span>{meta.name}</span>
        </button>
        <SearchBox />
        {__AI__ && aiOn && (
          <button
            className={'btn ai-btn' + (aiOpen ? ' active' : '')}
            title="Open the writing buddy"
            onClick={() => useAi.getState().setOpen(!aiOpen)}
          >
            ✦ Buddy
          </button>
        )}
        <button className="btn new-page-btn" onClick={() => go({ kind: 'new' })}>
          + New page
        </button>
      </header>
      <div className="layout">
        <aside className="sidebar">
          {simple && <QuickCreate />}
          <div className="nav-group">
            <div className="nav-title">Navigation</div>
            <button className={route.kind === 'page' && route.id === meta.mainPageId ? 'nav-link active' : 'nav-link'} onClick={goMain}>
              Main page
            </button>
            {nav({ kind: 'special', name: 'recent' }, 'Recent changes', special('recent'))}
            {nav({ kind: 'special', name: 'allpages' }, 'All pages', special('allpages'))}
            {nav({ kind: 'special', name: 'categories' }, 'Categories', special('categories') || route.kind === 'category')}
            {storiesOn(meta) && (
              <button
                className={
                  special('stories') || ((route.kind === 'page' || route.kind === 'edit') && (pages[route.id]?.story || pages[route.id]?.chapter))
                    ? 'nav-link active'
                    : 'nav-link'
                }
                onClick={() => go({ kind: 'special', name: 'stories' })}
              >
                Stories
              </button>
            )}
            <button className="nav-link" onClick={random}>
              Random page
            </button>
          </div>
          <div className="nav-group">
            <div className="nav-title">Wiki tools</div>
            {nav({ kind: 'special', name: 'templates' }, 'Templates', special('templates'))}
            {nav({ kind: 'special', name: 'settings' }, 'Look & settings', special('settings'))}
            {nav({ kind: 'special', name: 'trash' }, 'Trash', special('trash'))}
            <button className="nav-link" onClick={() => useStore.getState().closeWiki()}>
              Switch wiki
            </button>
          </div>
          <div className="sidebar-foot">
            {Object.keys(pages).length} page
            {Object.keys(pages).length === 1 ? '' : 's'} · stored only on this {isMac ? 'Mac' : 'PC'}
          </div>
        </aside>
        <main className="content-scroll">
          <div className="content-card">
            <RouteView route={route} />
          </div>
        </main>
        {__AI__ && aiOn && aiOpen && (
          <ErrorBoundary
            fallback={(error, reset) => (
              <aside className="ai-panel ai-crashed">
                <div className="ai-head">
                  <span className="ai-title">✦ Writing buddy</span>
                </div>
                <div className="ai-messages">
                  <p>Something went wrong showing the chat. Your wiki is fine.</p>
                  <p className="muted small">{error.message}</p>
                  <button
                    className="btn small"
                    onClick={() => {
                      useAi.getState().clear()
                      reset()
                    }}
                  >
                    Reset the chat
                  </button>
                </div>
              </aside>
            )}
          >
            <AiPanel />
          </ErrorBoundary>
        )}
      </div>
      <Lightbox />
    </div>
  )
}

function RouteView({ route }: { route: Route }): React.JSX.Element {
  switch (route.kind) {
    case 'page':
      return <PageView key={route.id} id={route.id} />
    case 'edit': {
      const page = useStore.getState().pages[route.id]
      if (page?.story) return <StoryEditor key={route.id} id={route.id} />
      if (page?.chapter) return <ChapterEditor key={route.id} id={route.id} />
      return usePrefs.getState().simple ? (
        <SimplePage key={route.id} id={route.id} />
      ) : (
        <PageEditor key={route.id} id={route.id} draft={route.draft} />
      )
    }
    case 'new':
      return <NewPage key={(route.title ?? '') + (route.templateId ?? '*')} initialTitle={route.title ?? ''} templateId={route.templateId} />
    case 'search':
      return <SearchResults q={route.q} />
    case 'category':
      return <CategoryView key={route.name} name={route.name} />
    case 'backlinks':
      return <Backlinks id={route.id} />
    case 'history':
      return <HistoryView key={route.id} id={route.id} />
    case 'special':
      switch (route.name) {
        case 'allpages':
          return <AllPages />
        case 'recent':
          return <Recent />
        case 'categories':
          return <Categories />
        case 'templates':
          return <TemplatesView />
        case 'settings':
          return <SettingsView />
        case 'trash':
          return <Trash />
        case 'css':
          return <CssEditor />
        case 'stories':
          return <StoriesView />
      }
  }
}

function routeTitle(route: Route, pages: Record<string, { title: string }>): string {
  switch (route.kind) {
    case 'page':
      return pages[route.id]?.title ?? 'Missing page'
    case 'edit':
      return 'Editing ' + (route.draft?.title || pages[route.id]?.title || 'page')
    case 'new':
      return 'New page'
    case 'search':
      return `Search: ${route.q}`
    case 'category':
      return `Category: ${route.name}`
    case 'backlinks':
      return 'What links here'
    case 'history':
      return 'Page history'
    case 'special':
      return {
        allpages: 'All pages',
        recent: 'Recent changes',
        categories: 'Categories',
        templates: 'Templates',
        settings: 'Look & settings',
        trash: 'Trash',
        css: 'Looks & custom CSS',
        stories: 'Stories'
      }[route.name]
  }
}
