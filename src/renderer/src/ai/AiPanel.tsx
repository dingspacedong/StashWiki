import { useEffect, useRef, useState } from 'react'
import { AI_PROVIDERS, LOCAL_PROGRAMS, stripThinking } from '@shared/ai'
import { useStore, useTitleIndex } from '../store'
import { renderInlineText, titleKey } from '../lib/wikitext'
import { renderBody, sanitizeHtml } from '../lib/render'
import { handleLinkClick } from '../components/ui'
import { isReady, useAi, useCurrentPage, type ChatMessage, type StoryMode, type WriteLength } from './aiStore'
import ContextPicker from './ContextPicker'
import { IsolatedHtml } from '../components/CodeArea'
import { renderHtmlBlock } from '../lib/customHtml'
import {
  cleanProse,
  describe,
  findPage,
  sectionEffect,
  sectionsOf,
  splitReply,
  toBodyHtml,
  withMode,
  type EditMode,
  type Proposal
} from './proposals'
import { wordCount } from '../lib/stories'

const QUICK = [
  {
    label: 'Continue writing',
    text: 'Continue writing this page. Pick up where it leaves off and keep my style.'
  },
  {
    label: 'Brainstorm',
    text: 'Brainstorm some ideas for this page: things I could add, questions to explore, connections to other pages.'
  },
  {
    label: 'Fill empty fields',
    text: 'Suggest values for the empty infobox fields on this page, based on what the wiki already says.'
  },
  {
    label: 'Proofread',
    text: 'Proofread this page and suggest fixes for spelling, grammar and clarity, without changing my voice.'
  }
]

/** Story helper: what each mode is for, and ready-made requests. */
const STORY_MODES: Record<
  StoryMode,
  {
    label: string
    icon: string
    blurb: string
    placeholder: string
    chips: {
      label: string
      text: string
      story?: boolean
      chapter?: boolean
    }[]
  }
> = {
  write: {
    label: 'Write with me',
    icon: '✍',
    blurb: 'Tell it what happens next — it writes the passage in your style, and you choose whether to add it.',
    placeholder: 'What happens next? e.g. “Wren finds the brass key, but Moss is the one who opens the door.”',
    chips: [
      {
        label: 'Continue from here',
        text: 'Continue the chapter from exactly where it stops.',
        chapter: true
      },
      {
        label: 'Next scene',
        text: 'Write the next scene. Move the story forward.',
        chapter: true
      },
      {
        label: 'More description',
        text: 'Continue, with more description of the place and the mood.',
        chapter: true
      },
      {
        label: 'Add dialogue',
        text: 'Continue with a conversation between the characters in this scene.',
        chapter: true
      },
      {
        label: 'Opening of the next chapter',
        text: 'Write the opening of the next chapter.',
        story: true
      }
    ]
  },
  suggest: {
    label: 'Suggest',
    icon: '💡',
    blurb: 'Ideas and feedback: what could happen next, character moments, pacing, and anything that clashes with the wiki.',
    placeholder: 'Ask for ideas or feedback…',
    chips: [
      {
        label: 'What could happen next?',
        text: 'Give me three different ideas for what could happen next.'
      },
      {
        label: 'Feedback on this chapter',
        text: 'Give me honest, kind feedback on this chapter: what works, and what could be stronger.',
        chapter: true
      },
      {
        label: 'Check it fits the wiki',
        text: 'Check this against the wiki and the earlier chapters. Point out anything that contradicts them.'
      },
      {
        label: 'Character moments',
        text: 'Suggest moments that would show more of the characters’ personalities.'
      },
      {
        label: 'Chapter name ideas',
        text: 'Suggest a few names for this chapter.',
        chapter: true
      },
      {
        label: 'Proofread',
        text: 'Proofread this chapter. Suggest fixes for spelling and grammar as edits, without changing my voice.',
        chapter: true
      }
    ]
  },
  summary: {
    label: 'Summarize',
    icon: '📝',
    blurb: 'Short summaries for the chapter list and story page — they also help the buddy remember earlier chapters.',
    placeholder: 'e.g. “Summarize this chapter” or “Write a blurb for the story”',
    chips: [
      {
        label: 'Summarize this chapter',
        text: 'Summarize this chapter.',
        chapter: true
      },
      {
        label: 'Story summary',
        text: 'Write a short summary (a blurb) for the whole story.'
      },
      {
        label: 'The story so far',
        text: 'Give me a recap of the story so far, chapter by chapter, in plain text.'
      }
    ]
  }
}

/** The writing buddy's chat, docked on the right. Only exists when the buddy is turned on. */
export default function AiPanel(): React.JSX.Element {
  const { settings, messages, busyId, includePage, storyMode, writeLength } = useAi()
  const viewing = useCurrentPage()
  const go = useStore((s) => s.go)
  const [text, setText] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const page = includePage ? viewing : null
  const ready = isReady(settings)
  // On a story or a chapter the buddy becomes a story helper with three ways to help.
  const storyPage = page && (page.story || page.chapter) ? page : null
  const helper = STORY_MODES[storyMode]
  const chips = storyPage ? helper.chips.filter((c) => (page?.chapter ? !c.story : !c.chapter)) : QUICK
  const serviceName = !settings
    ? 'your AI service'
    : settings.provider === 'local'
      ? `${LOCAL_PROGRAMS[settings.localProgram].label} on ${settings.localHost}`
      : AI_PROVIDERS[settings.provider].label

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [messages])

  const send = (): void => {
    if (!text.trim()) return
    void useAi.getState().send(text)
    setText('')
  }

  return (
    <aside className="ai-panel">
      <div className="ai-head">
        <span className="ai-title">✦ Writing buddy</span>
        <span className="ai-model" title={settings ? `${AI_PROVIDERS[settings.provider].label} · ${settings.model}` : ''}>
          {settings?.model}
        </span>
        <span className="grow" />
        {messages.length > 0 && (
          <button className="link-btn small" onClick={() => useAi.getState().clear()}>
            Clear
          </button>
        )}
        <button className="icon-btn" title="Close" onClick={() => useAi.getState().setOpen(false)}>
          ×
        </button>
      </div>

      <label className="ai-context">
        <input type="checkbox" checked={includePage} onChange={(e) => useAi.setState({ includePage: e.target.checked })} />
        {viewing ? (
          <span>
            Let it read <strong>{viewing.title}</strong>
          </span>
        ) : (
          <span>Let it read the page you’re on</span>
        )}
      </label>
      <ContextPicker />
      {settings && (
        <label className="ai-context ai-tools" title="Experimental: tell it how categories, galleries, nav boxes, the sidebar and stories work, so it can suggest changes to them too">
          <input type="checkbox" checked={settings.wikiTools} onChange={(e) => void useAi.getState().saveSettings({ wikiTools: e.target.checked })} />
          <span>Knows how StashWiki works</span>
          <span className="badge tiny">Experimental</span>
        </label>
      )}

      {storyPage && (
        <div className="story-helper">
          <div className="seg story-modes" role="tablist" aria-label="How should the buddy help?">
            {(Object.keys(STORY_MODES) as StoryMode[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={storyMode === m}
                className={storyMode === m ? 'on' : ''}
                onClick={() => useAi.setState({ storyMode: m })}
              >
                <span aria-hidden>{STORY_MODES[m].icon}</span> {STORY_MODES[m].label}
              </button>
            ))}
          </div>
          <div className="story-helper-blurb">{helper.blurb}</div>
          {storyMode === 'write' && (
            <div className="story-length">
              <span className="muted small">Length</span>
              <span className="seg">
                {(['short', 'medium', 'long'] as WriteLength[]).map((l) => (
                  <button
                    key={l}
                    className={writeLength === l ? 'on' : ''}
                    onClick={() => useAi.setState({ writeLength: l })}
                    title={
                      {
                        short: 'About 150 words',
                        medium: 'About 400 words',
                        long: 'About 800 words'
                      }[l]
                    }
                  >
                    {{ short: 'Short', medium: 'Medium', long: 'Long' }[l]}
                  </button>
                ))}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="ai-messages" ref={list}>
        {!ready && (
          <div className="ai-notice">
            Finish setting up first: {settings && AI_PROVIDERS[settings.provider].needsKey ? 'add an API key and ' : ''}
            choose a model.{' '}
            <button className="link-btn" onClick={() => go({ kind: 'special', name: 'settings' })}>
              Open settings
            </button>
          </div>
        )}
        {messages.length === 0 && ready && (
          <div className="ai-empty">
            <p>Ask for ideas, or tell it what to write — like a director:</p>
            <p className="muted">“Continue her biography: she leaves the city after the flood and joins the smugglers.”</p>
            <p className="muted small">It can suggest new pages and changes to pages or templates. Nothing changes until you press Apply.</p>
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
      </div>

      {ready && page && !busyId && (
        <div className="ai-quick">
          {chips.map((q) => (
            <button key={q.label} className="chip-btn" onClick={() => setText(q.text)} title={q.text}>
              {q.label}
            </button>
          ))}
        </div>
      )}

      <div className="ai-input">
        <textarea
          value={text}
          placeholder={
            storyPage ? helper.placeholder : page ? `What should it do with “${page.title}”?` : 'Ask anything, or describe a page to make…'
          }
          rows={3}
          disabled={!ready}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        {busyId ? (
          <button className="btn ghost" onClick={() => useAi.getState().stop()}>
            Stop
          </button>
        ) : (
          <button className="btn" disabled={!ready || !text.trim()} onClick={send}>
            Send
          </button>
        )}
      </div>
      <div className="ai-foot">
        Sends this chat{page ? ' and the pages above' : ''} to {serviceName}. Enter sends, Shift+Enter makes a new line.
      </div>
    </aside>
  )
}

function Message({ m }: { m: ChatMessage }): React.JSX.Element {
  const index = useTitleIndex()
  const exists = (t: string): boolean => index.has(titleKey(t))
  if (m.role === 'user') return <div className="ai-msg user">{m.content}</div>

  let n = 0
  const { text: shown, thinking } = stripThinking(m.content)
  const segs = splitReply(shown, !!m.tools)
  // In "write with me", some models skip the block and just write. Their prose can still be added.
  const loose =
    !m.streaming && m.mode === 'write' && m.target && !segs.some((s) => s.kind !== 'text')
      ? cleanProse(segs.map((s) => (s.kind === 'text' ? s.text : '')).join('\n'))
      : ''
  const fallback: Proposal | null =
    loose && wordCount(toBodyHtml(loose)) >= 40
      ? {
          action: 'write_chapter',
          chapter: m.target,
          html: loose,
          mode: 'append'
        }
      : null
  return (
    <div className="ai-msg assistant" onClick={handleLinkClick}>
      {fallback ? (
        <ProposalCard id={`${m.id}:loose`} p={fallback} retryOf={m.id} />
      ) : (
        segs.map((seg, i) => {
          if (seg.kind === 'text') return <div key={i} className="ai-text" dangerouslySetInnerHTML={{ __html: chatHtml(seg.text, exists) }} />
          if (seg.kind === 'bad')
            return (
              <div key={i} className="ai-card bad">
                <div className="ai-card-title">⚠ {seg.error}</div>
                <pre>{seg.raw}</pre>
              </div>
            )
          const cardId = `${m.id}:${n++}`
          return <ProposalCard key={i} id={cardId} p={seg.proposal} retryOf={m.mode ? m.id : undefined} />
        })
      )}
      {!m.streaming && m.mode && !m.error && !segs.some((s) => s.kind === 'proposal') && !fallback && (
        <button className="link-btn small ai-retry" onClick={() => void useAi.getState().retry(m.id)}>
          ↻ Try again
        </button>
      )}
      {m.streaming && <span className="ai-typing">{thinking ? 'Thinking…' : '●●●'}</span>}
      {m.error && <div className="ai-error">Couldn’t get a reply: {m.error}</div>}
    </div>
  )
}

/** Chat text: escaped, with [[links]], URLs, **bold**, *italic* and line breaks. */
function chatHtml(text: string, exists: (t: string) => boolean): string {
  return renderInlineText(text.trim(), exists)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
}

function ProposalCard({ id, p, retryOf }: { id: string; p: Proposal; retryOf?: string }): React.JSX.Element {
  const card = useAi((s) => s.cards[id])
  const prose = p.action === 'write_chapter' || p.action === 'set_summary'
  const [open, setOpen] = useState(prose)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const index = useTitleIndex()
  const pages = useStore((s) => s.pages)
  // Whether section/intro writing adds to what's there or replaces it: worked out from the text, and the
  // user can switch it before applying.
  const [chosen, setChosen] = useState<EditMode | null>(null)
  const target = p.action === 'update_page' ? findPage(pages, p.page) : undefined
  const effect = sectionEffect(target, p)
  const mode = chosen ?? effect
  const final = chosen ? withMode(p, chosen) : p
  const note =
    card !== undefined
      ? ''
      : p.action === 'create_page' && findPage(pages, p.title)
        ? 'This page already exists. Apply adds this writing and these details to it.'
        : p.action === 'update_page' && !target
          ? 'This page doesn’t exist yet. Apply creates it.'
          : mode === 'replace'
            ? chosen
              ? 'Apply replaces the text there with this version. Undo puts the old text back.'
              : 'This repeats or rewrites text that is already there, so Apply replaces that part with this version instead of adding a second copy. Undo puts the old text back.'
            : mode === 'append'
              ? 'Apply adds this after the text that is already there.'
              : ''

  const apply = async (): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      await useAi.getState().apply(id, final)
      useStore.getState().notify('Change applied', {
        label: 'Undo',
        run: () => void useAi.getState().undo(id)
      })
    } catch (e) {
      setError(String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={'ai-card' + (card ? ' ' + card.status : '')}>
      <div className="ai-card-title">
        <span className="ai-card-icon">
          {p.action === 'write_chapter' ? '✍' : p.action === 'set_summary' ? '📝' : p.action.startsWith('create') ? '＋' : '✎'}
        </span>
        {describe(final)}
      </div>
      {note && <div className="ai-card-note">{note}</div>}
      {card === undefined && effect && (
        <span className="seg ai-mode" role="group" aria-label="Add or replace">
          {(['append', 'replace'] as const).map((m) => (
            <button key={m} className={mode === m ? 'on' : ''} onClick={() => setChosen(m)}>
              {m === 'append' ? 'Add to what’s there' : 'Replace what’s there'}
            </button>
          ))}
        </span>
      )}
      <button className="link-btn small" onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide details' : 'Show details'}
      </button>
      {open && <Preview p={final} exists={(t) => index.has(titleKey(t))} />}
      {error && <div className="ai-error">{error}</div>}
      <div className="ai-card-actions">
        {!card && (
          <>
            <button className="btn small" disabled={busy} onClick={() => void apply()}>
              {p.action === 'write_chapter'
                ? p.mode === 'new'
                  ? 'Create chapter'
                  : p.mode === 'replace'
                    ? 'Replace chapter text'
                    : 'Add to chapter'
                : p.action === 'set_summary'
                  ? 'Use this summary'
                  : 'Apply'}
            </button>
            <button className="btn small ghost" onClick={() => useAi.getState().dismiss(id)}>
              Dismiss
            </button>
            {retryOf && (
              <button className="link-btn small" title="Ask for a different version" onClick={() => void useAi.getState().retry(retryOf)}>
                ↻ Try again
              </button>
            )}
          </>
        )}
        {card?.status === 'applied' && (
          <>
            <span className="ai-status ok">✓ Applied</span>
            <button className="btn small ghost" onClick={() => void useAi.getState().undo(id)} title="Put back what was there before">
              ↶ Undo
            </button>
          </>
        )}
        {card?.status === 'dismissed' && <span className="ai-status">Dismissed</span>}
        {card?.status === 'undone' && <span className="ai-status">Undone</span>}
      </div>
    </div>
  )
}

function Preview({ p, exists }: { p: Proposal; exists: (t: string) => boolean }): React.JSX.Element {
  const html = (s: string): string => renderBody(sanitizeHtml(toBodyHtml(s)), exists).html
  const rows = (o: Record<string, string>): React.JSX.Element => (
    <table className="ai-kv">
      <tbody>
        {Object.entries(o).map(([k, v]) => (
          <tr key={k}>
            <th>{k}</th>
            <td>{v || <em className="muted">(empty)</em>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
  return (
    <div className="ai-preview">
      {p.action === 'create_page' && (
        <>
          {p.infobox && rows(p.infobox)}
          {p.body && <div className="prose" dangerouslySetInnerHTML={{ __html: html(p.body) }} />}
          {p.categories?.length ? <div className="muted small">Categories: {p.categories.join(', ')}</div> : null}
        </>
      )}
      {p.action === 'update_page' && (
        <>
          {p.infobox && rows(p.infobox)}
          {p.intro && (
            <>
              <div className="ai-preview-label">{p.intro.mode === 'replace' ? 'New introduction:' : 'Introduction (above the contents):'}</div>
              <div className="prose" dangerouslySetInnerHTML={{ __html: html(p.intro.html) }} />
            </>
          )}
          {sectionsOf(p).map((x, i) => (
            <div key={i}>
              <div className="ai-preview-label">
                {x.mode === 'replace' ? 'New text for' : 'For'} “{x.heading}”:
              </div>
              <div className="prose" dangerouslySetInnerHTML={{ __html: html(x.html) }} />
            </div>
          ))}
          {p.edits?.map((e, i) => (
            <div key={'e' + i} className="ai-edit">
              <div className="ai-preview-label">Change</div>
              <div className="ai-edit-old">{e.find}</div>
              <div className="ai-preview-label">to</div>
              <div className="ai-edit-new">{e.replace}</div>
            </div>
          ))}
          {p.title && <div className="ai-preview-label">Rename the page to “{p.title}”</div>}
          {p.add_categories?.length ? <div className="muted small">Add categories: {p.add_categories.join(', ')}</div> : null}
          {p.append && (
            <>
              <div className="ai-preview-label">Added at the end:</div>
              <div className="prose" dangerouslySetInnerHTML={{ __html: html(p.append) }} />
            </>
          )}
          {p.body !== undefined && (
            <>
              <div className="ai-preview-label">Whole page text replaced with:</div>
              <div className="prose" dangerouslySetInnerHTML={{ __html: html(p.body) }} />
            </>
          )}
        </>
      )}
      {p.action === 'update_page' && p.html_block && (
        <>
          <div className="ai-preview-label">
            HTML block
            {p.html_block.section ? ` under “${p.html_block.section}”` : ' at the end'}:
          </div>
          <IsolatedHtml className="ai-html-preview" html={renderHtmlBlock(p.html_block.html, exists)} />
          <pre className="ai-json">{p.html_block.html}</pre>
        </>
      )}
      {p.action === 'update_css' && <pre className="ai-json">{p.css}</pre>}
      {p.action === 'write_chapter' && <div className="prose ai-prose" dangerouslySetInnerHTML={{ __html: html(p.html) }} />}
      {p.action === 'set_summary' && <p className="ai-summary">{p.summary}</p>}
      {(p.action === 'update_template' || p.action === 'create_template') && <pre className="ai-json">{JSON.stringify(p, null, 2)}</pre>}
      {p.action === 'update_page' && p.notes?.length ? <div className="muted small">Notes at the top: {p.notes.join(' · ')}</div> : null}
      {p.action === 'update_page' && p.quote?.text ? (
        <div className="muted small">
          Opening quote: “{p.quote.text}”{p.quote.by ? ` — ${p.quote.by}` : ''}
        </div>
      ) : null}
      {p.action === 'update_page' && p.add_cards?.pages.length ? (
        <div className="muted small">
          Page cards{p.add_cards.title ? ` “${p.add_cards.title}”` : ''}: {p.add_cards.pages.join(', ')}
        </div>
      ) : null}
      {p.action === 'create_story' && p.chapter?.html && <div className="prose ai-prose" dangerouslySetInnerHTML={{ __html: html(p.chapter.html) }} />}
      {['update_gallery', 'update_category', 'update_navbox', 'update_sidebar', 'create_story', 'update_story'].includes(p.action) && (
        <pre className="ai-json">{JSON.stringify({ ...p, action: undefined, chapter: undefined }, null, 2)}</pre>
      )}
    </div>
  )
}
