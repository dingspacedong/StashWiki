import type { Page } from '@shared/types'
import { RichInline } from './ui'

/** The italic notes ("For the 2022 game, see …") and opening quote shown above a page's introduction. */
export default function TopMatter({ page }: { page: Pick<Page, 'hatnotes' | 'quote'> }): React.JSX.Element | null {
  const notes = (page.hatnotes ?? []).filter((n) => n.trim())
  const quote = page.quote?.text.trim() ? page.quote : null
  if (!notes.length && !quote) return null
  return (
    <div className="top-matter">
      {notes.map((n, i) => (
        <div key={i} className="hatnote">
          <RichInline text={n} />
        </div>
      ))}
      {quote && (
        <blockquote className="top-quote">
          <div className="top-quote-text">
            “<RichInline text={quote.text.trim()} />”
          </div>
          {quote.by.trim() && (
            <div className="top-quote-by">
              — <RichInline text={quote.by.trim()} />
            </div>
          )}
        </blockquote>
      )}
    </div>
  )
}

/** Editing the notes and quote. Used by both the page editor and the simple (Mac) editor. */
export function TopMatterEditor({
  hatnotes,
  quote,
  onChange
}: {
  hatnotes: string[] | undefined
  quote: Page['quote']
  onChange: (patch: Pick<Page, 'hatnotes' | 'quote'>) => void
}): React.JSX.Element {
  const notes = hatnotes ?? []
  const setNotes = (next: string[]): void => onChange({ hatnotes: next.length ? next : undefined, quote })
  const setQuote = (q: { text: string; by: string } | undefined): void => onChange({ hatnotes, quote: q })

  return (
    <div className="top-matter-editor">
      {notes.map((n, i) => (
        <div key={i} className="row gap tm-row">
          <input
            className="grow"
            value={n}
            autoFocus={!n}
            placeholder="e.g. For the 2022 game, see [[Modern Warfare II]]."
            onChange={(e) => setNotes(notes.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button className="icon-btn" title="Remove this note" onClick={() => setNotes(notes.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      {quote && (
        <div className="tm-quote">
          <textarea
            rows={2}
            autoFocus={!quote.text}
            value={quote.text}
            placeholder="The quote (no quotation marks needed)"
            onChange={(e) => setQuote({ ...quote, text: e.target.value })}
          />
          <div className="row gap">
            <span className="muted">—</span>
            <input className="grow" value={quote.by} placeholder="Who said it, e.g. [[Wren]], ship's cat" onChange={(e) => setQuote({ ...quote, by: e.target.value })} />
            <button className="icon-btn" title="Remove the quote" onClick={() => setQuote(undefined)}>
              ×
            </button>
          </div>
        </div>
      )}
      <div className="row gap tm-add">
        <button className="link-btn small" onClick={() => setNotes([...notes, ''])} title="An italic line at the very top, like Fandom's “For …, see …” notes">
          + Note at the top (e.g. “For …, see …”)
        </button>
        {!quote && (
          <button className="link-btn small" onClick={() => setQuote({ text: '', by: '' })}>
            + Opening quote
          </button>
        )}
      </div>
    </div>
  )
}
