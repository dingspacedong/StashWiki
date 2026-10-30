// An HTML block in the editor: your own HTML (and <style>), kept exactly as written and shown as-is when
// reading. Edited in a window with a live preview.
import { useEffect, useState } from 'react'
import { Node, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { useTitleIndex } from '../store'
import { decodeHtmlBlock, encodeHtmlBlock, renderHtmlBlock } from '../lib/customHtml'
import { titleKey } from '../lib/wikitext'
import { CodeArea, IsolatedHtml } from './CodeArea'
import { BLOCK_SECTIONS, blockHtml, type BlockTemplate } from '../lib/blockTemplates'
import { matches } from './LookPicker'

export const HtmlBlock = Node.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      html: {
        default: '',
        parseHTML: (el) => decodeHtmlBlock(el.getAttribute('data-html') ?? ''),
        renderHTML: (attrs) => ({
          'data-html': encodeHtmlBlock(attrs.html ?? '')
        })
      }
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-html]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', HTMLAttributes]
  },
  addNodeView() {
    return ReactNodeViewRenderer(HtmlBlockView)
  }
})

function HtmlBlockView({ node, updateAttributes, deleteNode, selected }: NodeViewProps): React.JSX.Element {
  const html = String(node.attrs.html ?? '')
  const [open, setOpen] = useState(false)
  const index = useTitleIndex()
  // A freshly inserted block opens its editor straight away.
  useEffect(() => {
    if (!html) setOpen(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <NodeViewWrapper className={'page-cards-node html-block-node' + (selected ? ' selected' : '')} contentEditable={false}>
      <div className="pcn-bar">
        <span className="pcn-label">Fancy block</span>
        <button className="btn small" onClick={() => setOpen(true)}>
          Edit block
        </button>
        <button className="link-btn danger small" onClick={() => deleteNode()}>
          Remove
        </button>
      </div>
      {html.trim() ? (
        <IsolatedHtml className="hbn-preview" html={renderHtmlBlock(html, (t) => index.has(titleKey(t)))} />
      ) : (
        <div className="pcn-empty">Empty — click “Edit block” to pick a ready-made one or write your own.</div>
      )}
      {open && (
        <HtmlBlockEditor
          initial={html}
          onClose={() => setOpen(false)}
          onSave={(next) => {
            updateAttributes({ html: next })
            setOpen(false)
          }}
        />
      )}
    </NodeViewWrapper>
  )
}

const EXAMPLE = `<div class="glow">✨ Welcome to [[Main page|my wiki]] ✨</div>
<style>
  .glow { text-align: center; font-size: 1.4em; animation: glow 2s infinite alternate; }
  @keyframes glow { from { text-shadow: 0 0 2px #c9f; } to { text-shadow: 0 0 14px #c9f; } }
</style>`

function HtmlBlockEditor({ initial, onSave, onClose }: { initial: string; onSave: (html: string) => void; onClose: () => void }): React.JSX.Element {
  const [code, setCode] = useState(initial)
  const [tab, setTab] = useState<'blocks' | 'code'>(initial.trim() ? 'code' : 'blocks')
  const [words, setWords] = useState(false)
  const [picked, setPicked] = useState('')
  const index = useTitleIndex()
  const use = (t: BlockTemplate): void => {
    if (code.trim() && !window.confirm(`Replace what’s in this block with “${t.name}”?`)) return
    setCode(blockHtml(t))
    setPicked(t.id)
    setWords(true)
  }
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal html-editor">
        <h2>Fancy block</h2>
        <p className="hint">
          Pick a ready-made block, then click its words on the right to change them. If you know HTML, “Write HTML” lets you change anything (
          <code>[[Page name]]</code> links work there too). Scripts, forms and embedded frames are always removed, so the wiki stays safe to share.
        </p>
        <div className="html-editor-split">
          <div>
            <div className="seg css-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'blocks'} className={tab === 'blocks' ? 'on' : ''} onClick={() => setTab('blocks')}>
                Ready-made blocks
              </button>
              <button role="tab" aria-selected={tab === 'code'} className={tab === 'code' ? 'on' : ''} onClick={() => setTab('code')}>
                Write HTML
              </button>
            </div>
            {tab === 'blocks' ? (
              <BlockPicker picked={picked} onPick={use} />
            ) : (
              <CodeArea label="HTML" value={code} onChange={setCode} onSave={() => onSave(code)} placeholder={EXAMPLE} rows={16} />
            )}
          </div>
          <div className="html-editor-preview">
            <div className="seg" role="group" aria-label="Preview mode">
              <button className={!words ? 'on' : ''} onClick={() => setWords(false)}>
                Preview
              </button>
              <button className={words ? 'on' : ''} onClick={() => setWords(true)} disabled={!code.trim()}>
                Change the words
              </button>
            </div>
            {words && code.trim() && (
              <p className="html-editor-tip">
                Click any words below and type. Hidden parts (other tabs, closed fold-outs) are shown open while you do.
              </p>
            )}
            {code.trim() ? (
              <IsolatedHtml html={renderHtmlBlock(code, (t) => index.has(titleKey(t)))} onEdit={words ? setCode : undefined} />
            ) : (
              <p className="muted">Pick a block on the left to see it here.</p>
            )}
          </div>
        </div>
        <div className="row gap modal-actions">
          {!code && tab === 'code' && (
            <button className="link-btn small" onClick={() => setCode(EXAMPLE)}>
              Start from an example
            </button>
          )}
          <span className="grow" />
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => onSave(code)}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function BlockPicker({ picked, onPick }: { picked: string; onPick: (t: BlockTemplate) => void }): React.JSX.Element {
  const [sectionId, setSectionId] = useState(BLOCK_SECTIONS[0].id)
  const [q, setQ] = useState('')
  const section = BLOCK_SECTIONS.find((s) => s.id === sectionId) ?? BLOCK_SECTIONS[0]
  const list = q.trim() ? BLOCK_SECTIONS.flatMap((s) => s.blocks.filter((b) => matches(q, b.name, b.hint, s.title))) : section.blocks
  return (
    <div className="block-picker">
      <input
        className="picker-search"
        type="search"
        placeholder="Search blocks… (e.g. quote, tabs, stats)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search blocks"
      />
      {!q.trim() && (
        <div className="look-sections" role="tablist">
          {BLOCK_SECTIONS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={s.id === section.id}
              className={'chip-btn' + (s.id === section.id ? ' on' : '')}
              onClick={() => setSectionId(s.id)}
            >
              <span aria-hidden>{s.icon}</span> {s.title}
            </button>
          ))}
        </div>
      )}
      {q.trim() && !list.length && <p className="muted">No blocks match “{q}”.</p>}
      <div className="block-list">
        {list.map((b) => (
          <button key={b.id} className={'look-opt' + (picked === b.id ? ' on' : '')} onClick={() => onPick(b)}>
            <strong>{b.name}</strong>
            <span>{b.hint}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
