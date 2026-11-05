// "Import from Toyhouse": paste a public character link, and a page is made with the same name, its gallery (with artist
// credits) and, if wanted, its profile text as the introduction, or handed to the writing buddy to sort into the page.
import { useEffect, useState } from 'react'
import DOMPurify from 'dompurify'
import { escapeHtml, newPage, uid } from '@shared/defaults'
import type { Gallery, Page, ToyhouseCharacter, ToyhouseProgress } from '@shared/types'
import { findPage, useStore } from '../store'
import { cleanTitle, titleKey } from '../lib/wikitext'
import { askBuddy, useAi } from '../ai/gate'
import { creditLine, groupGalleries } from '../lib/toyhouse'

/** Toyhouse profile HTML → the wiki's own simple HTML: paragraphs, lists, emphasis, links and headings (as sections). */
export function profileToBody(html: string): string {
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html')
  const root = doc.getElementById('r')!
  // Layout boxes holding only text become paragraphs, so the text keeps its breaks.
  for (const d of [...root.querySelectorAll('div')].reverse()) {
    if (!d.querySelector('p, div, ul, ol, h1, h2, h3, h4, h5, h6, blockquote, table')) {
      const p = doc.createElement('p')
      p.innerHTML = d.innerHTML
      d.replaceWith(p)
    }
  }
  const clean = DOMPurify.sanitize(root.innerHTML, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'hr'],
    ALLOWED_ATTR: ['href'],
    ALLOWED_URI_REGEXP: /^https?:/i
  }) as string
  return clean
    .replace(/<h[12]>/g, '<h2>')
    .replace(/<\/h[12]>/g, '</h2>')
    .replace(/<h[3-6]>/g, '<h3>')
    .replace(/<\/h[3-6]>/g, '</h3>')
    .replace(/<p>(\s|&nbsp;|<br>)*<\/p>/g, '')
    .trim()
}

type TextChoice = 'intro' | 'empty' | 'buddy'

export default function ToyhouseImport({ onClose }: { onClose: () => void }): React.JSX.Element {
  const meta = useStore((s) => s.meta)!
  const pages = useStore((s) => s.pages)
  const wikiId = useStore((s) => s.wikiId)!
  const buddyOn = useAi((s) => !!s.settings?.enabled)
  const [link, setLink] = useState('')
  const [step, setStep] = useState<'link' | 'busy' | 'choose'>('link')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [found, setFound] = useState<ToyhouseCharacter | null>(null)
  const [title, setTitle] = useState('')
  const [templateId, setTemplateId] = useState(() => (meta.templates.find((t) => /character/i.test(t.name)) ?? meta.templates[0])?.id ?? '')
  const [gallery, setGallery] = useState(true)
  const [usePicture, setUsePicture] = useState(true)
  const [text, setText] = useState<TextChoice>('intro')
  const [backLink, setBackLink] = useState(false)

  useEffect(
    () =>
      window.stash.toyhouse.onProgress((p: ToyhouseProgress) =>
        setProgress(
          p.stage === 'profile'
            ? 'Opening the character on Toyhouse…'
            : p.stage === 'gallery'
              ? `Reading the gallery${p.page > 1 ? ` (page ${p.page})` : ''}…`
              : `Downloading pictures (${p.done} of ${p.total})…`
        )
      ),
    []
  )

  const template = meta.templates.find((t) => t.id === templateId)
  const tabs = found ? groupGalleries(found.images).length : 0
  const imageField = template?.fields.find((f) => f.type === 'image')
  const clean = cleanTitle(title)
  const taken = clean ? findPage(pages, clean) : undefined

  const read = async (): Promise<void> => {
    setError('')
    setStep('busy')
    try {
      const c = await window.stash.toyhouse.read(link)
      setFound(c)
      setTitle(c.name)
      setText(c.profileText ? 'intro' : 'empty')
      setStep('choose')
    } catch (e) {
      setError(String((e as Error).message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
      setStep('link')
    }
  }

  const create = async (): Promise<void> => {
    if (!found || !clean || taken) return
    setStep('busy')
    let page: Page = newPage(clean, template ?? null)
    if (gallery && found.images.length) {
      const files = await window.stash.toyhouse.download(wikiId, found.images.map((i) => i.url))
      const images = found.images
        .map((im, n) => ({
          group: im.group,
          image: { id: uid(), file: files[n] ?? '', caption: im.caption, source: creditLine(im.credits), ...(im.spoiler ? { spoiler: true } : {}) }
        }))
        .filter((x) => x.image.file)
      const galleries: Gallery[] = groupGalleries(images).map((g) => ({ id: uid(), title: g.title, autoCollapse: false, images: g.images.map((x) => x.image) }))
      if (galleries.length) {
        page = { ...page, galleries }
        if (usePicture && imageField) page = { ...page, infobox: { ...page.infobox, [imageField.id]: galleries[0].images[0].file } }
      }
    }
    // The page type's own sections stay, after the profile (any the profile already has aren't added twice).
    const profile = text === 'intro' ? profileToBody(found.profileHtml) : ''
    const has = new Set([...profile.matchAll(/<h2>([\s\S]*?)<\/h2>/g)].map((m) => titleKey(m[1].replace(/<[^>]+>/g, ''))))
    const sections = (template?.sections ?? []).filter((s) => !has.has(titleKey(s))).map((s) => `<h2>${escapeHtml(s)}</h2><p></p>`)
    let body = (profile || '<p></p>') + sections.join('')
    if (backLink) body += `<p><a href="${found.url.replace(/"/g, '&quot;')}">${escapeHtml(clean)} on Toyhouse</a></p>`
    page = { ...page, body }
    await useStore.getState().savePage(page)
    useStore.getState().go({ kind: 'page', id: page.id })
    onClose()
    if (text === 'buddy' && found.profileText) {
      askBuddy(
        `This page was just imported from Toyhouse. Here is the character's Toyhouse profile text:\n\n${found.profileText.slice(0, 12000)}\n\n` +
          `Organize it into this page: fill in the infobox fields it answers, write a short introduction, and put the rest into sections with fitting headings. ` +
          `Keep their facts and wording; don't make anything up. Use one update_page block.`
      )
    }
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && step !== 'busy' && onClose()}>
      <div className="modal toyhouse-import">
        <h2>Import from Toyhouse</h2>
        {step === 'link' && (
          <>
            <p className="hint">Paste the link to a public character. StashWiki opens it, then makes a page with its name, gallery and profile.</p>
            <label className="field">
              <span>Character link</span>
              <input
                autoFocus
                value={link}
                placeholder="https://toyhou.se/12345.name"
                onChange={(e) => (setLink(e.target.value), setError(''))}
                onKeyDown={(e) => e.key === 'Enter' && link.trim() && void read()}
              />
            </label>
            {error && <p className="field-error">{error}</p>}
            <p className="hint small">
              This goes online to Toyhouse only now. If Toyhouse shows a content warning or a check, a window opens for you to click through, and the import
              carries on by itself.
            </p>
            <div className="row gap modal-actions">
              <span className="grow" />
              <button className="btn ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn" disabled={!link.trim()} onClick={() => void read()}>
                Find character
              </button>
            </div>
          </>
        )}
        {step === 'busy' && (
          <div className="th-busy">
            <span className="th-spinner" aria-hidden />
            <span>{progress || 'Working…'}</span>
          </div>
        )}
        {step === 'choose' && found && (
          <>
            <p className="th-found">
              Found <strong>{found.name || 'a character'}</strong>
              {found.creator && <> by {found.creator}</>} · {found.images.length} picture{found.images.length === 1 ? '' : 's'}
            </p>
            <label className="field">
              <span>Page title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            {taken && <p className="field-error">There’s already a page called “{taken.title}”. Pick another title.</p>}
            <label className="field">
              <span>Page type</span>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Blank page (no infobox)</option>
                {meta.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {found.images.length > 0 && (
              <div className="th-options">
                <label className="check">
                  <input type="checkbox" checked={gallery} onChange={(e) => setGallery(e.target.checked)} />
                  Import the gallery ({found.images.length} picture{found.images.length === 1 ? '' : 's'}
                  {tabs > 1 ? ` in ${tabs} galleries` : ''}, with artist credits)
                </label>
                {gallery && imageField && (
                  <label className="check">
                    <input type="checkbox" checked={usePicture} onChange={(e) => setUsePicture(e.target.checked)} />
                    Use the first picture in the infobox
                  </label>
                )}
              </div>
            )}
            <div className="field">
              <span>Profile text</span>
              <div className="th-options">
                <label className="check">
                  <input type="radio" checked={text === 'intro'} disabled={!found.profileText} onChange={() => setText('intro')} />
                  Use it as the page’s text
                </label>
                <label className="check">
                  <input type="radio" checked={text === 'empty'} onChange={() => setText('empty')} />
                  Leave the page text empty
                </label>
                {buddyOn && (
                  <label className="check">
                    <input type="radio" checked={text === 'buddy'} disabled={!found.profileText} onChange={() => setText('buddy')} />
                    <span>
                      Let the writing buddy sort it into the infobox and sections <span className="muted">(you Apply what it suggests)</span>
                    </span>
                  </label>
                )}
              </div>
              {found.profileText ? <div className="th-preview">{found.profileText.slice(0, 600)}{found.profileText.length > 600 ? '…' : ''}</div> : <p className="muted small">This profile has no text.</p>}
            </div>
            <label className="check">
              <input type="checkbox" checked={backLink} onChange={(e) => setBackLink(e.target.checked)} />
              Add a link to the Toyhouse profile at the bottom
            </label>
            <div className="row gap modal-actions">
              <button className="link-btn small" onClick={() => setStep('link')}>
                ← Another link
              </button>
              <span className="grow" />
              <button className="btn ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn" disabled={!clean || !!taken} onClick={() => void create()}>
                Create page
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
