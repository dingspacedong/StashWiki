import { useState } from 'react'
import { useStore } from '../store'
import { buildSite } from '../export/site'
import { startImport } from './importFlow'

/** “Share & export” in Look & settings. */
export default function ShareSection(): React.JSX.Element {
  const wikiId = useStore((s) => s.wikiId)!
  const pages = useStore((s) => s.pages)
  const meta = useStore((s) => s.meta)!
  const hasStories = Object.values(pages).some((p) => p.story)
  const [busy, setBusy] = useState('')
  const [done, setDone] = useState<{ text: string; path: string } | null>(null)
  const privateCount = Object.values(pages).filter((p) => p.private).length

  const run = async (label: string, job: () => Promise<{ text: string; path: string } | null>): Promise<void> => {
    setBusy(label)
    setDone(null)
    try {
      const res = await job()
      if (res) setDone(res)
    } catch (e) {
      window.alert(String((e as Error).message ?? e))
    } finally {
      setBusy('')
    }
  }

  const exportSite = (): Promise<void> =>
    run('website', async () => {
      const s = useStore.getState()
      const site = buildSite(s.meta!, s.pages)
      const path = await window.stash.exportSite(wikiId, site.files, site.images, site.fonts)
      return path ? { text: `Website saved: ${site.pageCount} pages, ${site.images.length} pictures.`, path } : null
    })

  const exportShare = (): Promise<void> =>
    run('share', async () => {
      const path = await window.stash.exportShare(wikiId)
      return path ? { text: 'Share file saved.', path: path.replace(/[\\/][^\\/]+$/, '') } : null
    })

  return (
    <section className="settings-section share-section">
      <h2>Share &amp; export</h2>

      <div className="share-row">
        <div>
          <strong>Export as a website</strong>
          <p className="muted">
            Makes a folder of web pages you can upload as-is to Neocities, Nekoweb or your own site, or open in a browser.
            {privateCount > 0 && ` Your ${privateCount} private page${privateCount === 1 ? '' : 's'} (and links to them) are left out.`}
          </p>
        </div>
        <button className="btn" disabled={!!busy} onClick={() => void exportSite()}>
          {busy === 'website' ? 'Exporting…' : 'Export website…'}
        </button>
      </div>
      {!meta.storiesOff && hasStories && (
        <div className="site-content">
          <span className="muted small">Include</span>
          <span className="seg" role="group" aria-label="What the website includes">
            {(
              [
                ['all', 'Wiki and stories'],
                ['wiki', 'Just the wiki'],
                ['stories', 'Just the stories']
              ] as const
            ).map(([v, label]) => (
              <button key={v} className={(meta.siteContent ?? 'all') === v ? 'on' : ''} onClick={() => void useStore.getState().saveMeta({ ...meta, siteContent: v })}>
                {label}
              </button>
            ))}
          </span>
          <span className="muted small">
            {(meta.siteContent ?? 'all') === 'all'
              ? 'One website: stories link to character pages and back.'
              : (meta.siteContent ?? 'all') === 'wiki'
                ? 'Stories are left out.'
                : 'A reading site with just your stories; links to wiki pages become plain text.'}
          </span>
        </div>
      )}

      <div className="share-row">
        <div>
          <strong>Share file (.stashwiki)</strong>
          <p className="muted">
            The whole wiki in one compressed file — pages, pictures, templates and look — to send to a friend or keep as a backup. They open it in
            StashWiki. To work on a wiki together, pass the newest file back and forth: opening it merges the changes.
          </p>
        </div>
        <div className="share-buttons">
          <button className="btn" disabled={!!busy} onClick={() => void exportShare()}>
            {busy === 'share' ? 'Saving…' : 'Save share file…'}
          </button>
          <button className="btn ghost" disabled={!!busy} onClick={() => void startImport()}>
            Open a share file…
          </button>
        </div>
      </div>

      {done && (
        <div className="share-done">
          ✓ {done.text}{' '}
          <button className="link-btn" onClick={() => void window.stash.showPath(done.path)}>
            Show folder
          </button>
        </div>
      )}
    </section>
  )
}
