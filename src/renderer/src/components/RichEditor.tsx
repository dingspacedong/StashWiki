import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, Extension, InputRule, Mark, mergeAttributes, useEditor, type Editor } from '@tiptap/react'
import { NodeSelection, Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node as PMNode } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Placeholder } from '@tiptap/extensions'
import { imgUrl } from '../lib/theme'
import { cleanTitle, titleKey } from '../lib/wikitext'
import { Dropdown } from './ui'
import { CALLOUT_LABELS, Callout, PageCards, type CalloutKind } from './editorBlocks'
import { HtmlBlock } from './htmlBlock'
import { emptyCards } from '../lib/cards'
import { isMac, kb } from '../lib/platform'

// ---------- extensions ----------

/** [[Page]] links. Stored as <a data-wikilink="Page">text</a>. */
const WikiLink = Mark.create({
  name: 'wikiLink',
  priority: 1001,
  inclusive: false,
  excludes: 'link',
  addAttributes() {
    return {
      page: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-wikilink'),
        renderHTML: (attrs) => ({ 'data-wikilink': attrs.page })
      }
    }
  },
  parseHTML() {
    return [{ tag: 'a[data-wikilink]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['a', mergeAttributes({ class: 'wikilink' }, HTMLAttributes), 0]
  },
  addInputRules() {
    const type = this.type
    return [
      new InputRule({
        find: /\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]$/,
        handler: ({ state, range, match }) => {
          const page = cleanTitle(match[1])
          if (!page) return null
          const text = (match[2] ?? match[1]).trim()
          state.tr.replaceWith(range.from, range.to, state.schema.text(text, [type.create({ page })]))
          state.tr.removeStoredMark(type)
        }
      })
    ]
  }
})

/** Colors links to pages that don't exist yet, like red links when reading. */
const missingKey = new PluginKey<DecorationSet>('missingLinks')
const MissingLinks = Extension.create<{ exists: () => (title: string) => boolean }>({
  name: 'missingLinks',
  addOptions() {
    return { exists: () => () => true }
  },
  addProseMirrorPlugins() {
    const getExists = this.options.exists
    const build = (doc: PMNode): DecorationSet => {
      const exists = getExists()
      const decos: Decoration[] = []
      doc.descendants((node, pos) => {
        const mark = node.isText ? node.marks.find((m) => m.type.name === 'wikiLink') : undefined
        if (mark && !exists(mark.attrs.page)) decos.push(Decoration.inline(pos, pos + node.nodeSize, { class: 'missing' }))
      })
      return DecorationSet.create(doc, decos)
    }
    return [
      new Plugin({
        key: missingKey,
        state: {
          init: (_, { doc }) => build(doc),
          apply: (tr, old) => (tr.docChanged || tr.getMeta(missingKey) ? build(tr.doc) : old)
        },
        props: {
          decorations: (state) => missingKey.getState(state)
        }
      })
    ]
  }
})

export type ImageAlign = 'center' | 'left' | 'right'
export type ImageSize = 'small' | 'medium' | 'large' | 'full'

const WikiImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'center',
        parseHTML: (el) => el.getAttribute('data-align') || 'center',
        renderHTML: (attrs) => ({ 'data-align': attrs.align })
      },
      size: {
        default: 'medium',
        parseHTML: (el) => el.getAttribute('data-size') || 'medium',
        renderHTML: (attrs) => ({ 'data-size': attrs.size })
      }
    }
  }
}).configure({ inline: false, allowBase64: false })

// ---------- editor ----------

interface Props {
  value: string
  onChange: (html: string) => void
  wikiId: string
  titles: string[]
  /** Shorter toolbar and link actions for the simple (Mac) design. */
  simple?: boolean
  /** Follow a [[link]] (⌘/Ctrl-click, or the button shown when the cursor is in a link). */
  onOpenLink?: (title: string) => void
}

const isRemote = (src: string): boolean => /^https?:\/\//i.test(src)

export default function RichEditor({ value, onChange, wikiId, titles, simple, onOpenLink }: Props): React.JSX.Element {
  const pending = useRef(new Set<string>())
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const openRef = useRef(onOpenLink)
  openRef.current = onOpenLink
  const titleKeys = useMemo(() => new Set(titles.map(titleKey)), [titles])
  const existsRef = useRef((t: string) => titleKeys.has(titleKey(t)))
  existsRef.current = (t: string) => titleKeys.has(titleKey(t))

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noreferrer', target: null } }
      }),
      WikiLink,
      WikiImage,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Callout,
      PageCards,
      HtmlBlock,
      Placeholder.configure({
        showOnlyCurrent: false,
        placeholder: ({ editor, node, pos }) => {
          if (node.type.name !== 'paragraph') return ''
          const doc = editor.state.doc
          // The paragraph before the first heading is the page's introduction.
          if (pos === 0 && doc.childCount > 1 && doc.child(1).type.name === 'heading') return 'Introduction — a short summary, shown above the contents box'
          return doc.childCount <= 1 ? 'Write something… type [[Page name]] to link a page.' : ''
        }
      }),
      MissingLinks.configure({ exists: () => existsRef.current })
    ],
    content: value,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: 'prose editor-prose', spellcheck: 'true' },
      handleClick: (view, pos, event) => {
        if (!(event.metaKey || event.ctrlKey) || !openRef.current) return false
        const mark = view.state.doc.resolve(pos).marks().find((m) => m.type.name === 'wikiLink')
        if (!mark) return false
        openRef.current(mark.attrs.page)
        return true
      },
      handlePaste: (view, event) => {
        const files = imageFiles(event.clipboardData?.files)
        if (!files.length) return false
        event.preventDefault()
        void insertImageFiles(files, wikiId, (src) => {
          view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src })))
        })
        return true
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false
        const files = imageFiles(event.dataTransfer?.files)
        if (!files.length) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? view.state.selection.from
        void insertImageFiles(files, wikiId, (src) => {
          view.dispatch(view.state.tr.insert(pos, view.state.schema.nodes.image.create({ src })))
        })
        return true
      }
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML())
      localizeRemoteImages(editor, wikiId, pending.current)
    }
  })

  // Re-color missing links when pages are created or renamed elsewhere.
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(missingKey, true))
  }, [editor, titleKeys])

  // Pick up pasted web images that were already in the content when the editor opened.
  useEffect(() => {
    if (editor) localizeRemoteImages(editor, wikiId, pending.current)
  }, [editor, wikiId])

  if (!editor) return <div className="editor-box" />
  // Older pages start straight with a heading, leaving nowhere to write an introduction.
  const startsWithHeading = editor.state.doc.firstChild?.type.name === 'heading'
  return (
    <div className="editor-box">
      <Toolbar editor={editor} wikiId={wikiId} titles={titles} simple={simple} onOpenLink={onOpenLink} exists={existsRef.current} />
      {startsWithHeading && (
        <button
          className="add-intro"
          onClick={() => editor.chain().insertContentAt(0, { type: 'paragraph' }).focus(1).run()}
          title="Wikis usually open with a short unlabelled introduction above the contents box"
        >
          + Add an introduction above the first section
        </button>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}

function imageFiles(list: FileList | undefined | null): File[] {
  return [...(list ?? [])].filter((f) => f.type.startsWith('image/'))
}

async function insertImageFiles(files: File[], wikiId: string, insert: (src: string) => void): Promise<void> {
  for (const f of files) {
    try {
      const name = await window.stash.saveImageData(wikiId, await f.arrayBuffer(), f.type)
      insert(imgUrl(name))
    } catch (e) {
      window.alert(String((e as Error).message ?? e))
    }
  }
}

/** Download images that came in with pasted web content, so the page works offline. */
function localizeRemoteImages(editor: Editor, wikiId: string, pending: Set<string>): void {
  editor.state.doc.descendants((node) => {
    const src = node.type.name === 'image' ? (node.attrs.src as string) : ''
    if (!isRemote(src) || pending.has(src)) return
    pending.add(src)
    void window.stash.fetchImage(wikiId, src).then((file) => {
      pending.delete(src)
      if (editor.isDestroyed) return
      const hits: { pos: number; size: number; attrs: Record<string, unknown> }[] = []
      editor.state.doc.descendants((n, pos) => {
        if (n.type.name === 'image' && n.attrs.src === src) hits.push({ pos, size: n.nodeSize, attrs: n.attrs })
      })
      const tr = editor.state.tr
      for (const h of hits.reverse()) {
        if (file) tr.setNodeMarkup(h.pos, undefined, { ...h.attrs, src: imgUrl(file) })
        else tr.delete(h.pos, h.pos + h.size)
      }
      if (hits.length) editor.view.dispatch(tr)
    })
  })
}

// ---------- toolbar ----------

const TEXT_COLORS = [
  '#000000', '#5f6368', '#9aa0a6', '#ffffff', '#c0392b', '#e67e22', '#f1c40f', '#27ae60',
  '#16a085', '#2980b9', '#3366cc', '#8e44ad', '#d6338a', '#795548', '#1abc9c', '#e84393'
]
const HIGHLIGHTS = ['#fff3a3', '#ffd6a5', '#ffadad', '#caffbf', '#9bf6ff', '#bdb2ff', '#ffc6ff', '#e0e0e0']

function Toolbar({
  editor,
  wikiId,
  titles,
  simple,
  onOpenLink,
  exists
}: {
  editor: Editor
  wikiId: string
  titles: string[]
  simple?: boolean
  onOpenLink?: (title: string) => void
  exists: (title: string) => boolean
}): React.JSX.Element {
  const btn = (label: React.ReactNode, title: string, action: () => void, active = false, disabled = false): React.JSX.Element => (
    <button
      type="button"
      className={'tb-btn' + (active ? ' active' : '')}
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={action}
    >
      {label}
    </button>
  )
  const chain = (): ReturnType<Editor['chain']> => editor.chain().focus()
  const blockValue = editor.isActive('heading', { level: 2 })
    ? 'h2'
    : editor.isActive('heading', { level: 3 })
      ? 'h3'
      : editor.isActive('heading', { level: 4 })
        ? 'h4'
        : 'p'

  const addImage = async (): Promise<void> => {
    const files = await window.stash.pickImages(wikiId, true)
    for (const f of files) chain().insertContent({ type: 'image', attrs: { src: imgUrl(f) } }).run()
  }

  const inTable = editor.isActive('table')
  const inCallout = editor.isActive('callout')
  const calloutKind = (editor.getAttributes('callout').kind ?? 'note') as CalloutKind
  const insertMenu = <InsertMenu editor={editor} />
  const onImage = editor.isActive('image')
  const img = editor.getAttributes('image') as { align?: ImageAlign; size?: ImageSize }
  const linkTarget = simple ? (editor.getAttributes('wikiLink').page as string | undefined) : undefined

  const styleSelect = (
    <select
      className="tb-select"
      value={blockValue}
      title="Text style"
      onChange={(e) => {
        const v = e.target.value
        if (v === 'p') chain().setParagraph().run()
        else chain().setHeading({ level: Number(v[1]) as 2 | 3 | 4 }).run()
      }}
    >
      <option value="p">Normal text</option>
      <option value="h2">Section heading</option>
      <option value="h3">Subheading</option>
      <option value="h4">Small heading</option>
    </select>
  )
  const colorMenu = (
    <Dropdown label={<span className="swatch-a" style={{ borderColor: editor.getAttributes('textStyle').color || 'currentColor' }}>A</span>} title="Text color">
      {(close) => (
        <div className="swatches">
          {TEXT_COLORS.map((c) => (
            <button key={c} style={{ background: c }} title={c} onClick={() => (chain().setColor(c).run(), close())} />
          ))}
          <label className="swatch-custom" title="Custom color">
            +
            <input type="color" onChange={(e) => chain().setColor(e.target.value).run()} />
          </label>
          <button className="swatch-reset" onClick={() => (chain().unsetColor().run(), close())}>
            Default color
          </button>
        </div>
      )}
    </Dropdown>
  )

  // The simple design keeps the everyday tools in view and tucks the rest under “More”.
  const simpleRow = (
    <div className="tb-row">
      {styleSelect}
      <span className="tb-sep" />
      {btn(<b>B</b>, `Bold (${kb('B')})`, () => chain().toggleBold().run(), editor.isActive('bold'))}
      {btn(<i>I</i>, `Italic (${kb('I')})`, () => chain().toggleItalic().run(), editor.isActive('italic'))}
      {btn(<u>U</u>, `Underline (${kb('U')})`, () => chain().toggleUnderline().run(), editor.isActive('underline'))}
      {colorMenu}
      {btn('• List', 'Bulleted list', () => chain().toggleBulletList().run(), editor.isActive('bulletList'))}
      <span className="tb-sep" />
      <PageLinkButton editor={editor} titles={titles} />
      <WebLinkButton editor={editor} />
      {btn('Picture', 'Add a picture (you can also paste or drag pictures in)', () => void addImage())}
      {insertMenu}
      <Dropdown label="More ▾" title="More formatting">
        {(close) => {
          const item = (label: string, run: () => void): React.JSX.Element => (
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => (run(), close())}>
              {label}
            </button>
          )
          return (
            <div className="menu">
              {item('Strikethrough', () => chain().toggleStrike().run())}
              {item('Highlight', () => chain().toggleHighlight({ color: HIGHLIGHTS[0] }).run())}
              {item('Numbered list', () => chain().toggleOrderedList().run())}
              {item('Quote box', () => chain().toggleBlockquote().run())}
              {item('Divider line', () => chain().setHorizontalRule().run())}
              {item('Table', () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
              {item('Align left', () => chain().setTextAlign('left').run())}
              {item('Center', () => chain().setTextAlign('center').run())}
              {item('Align right', () => chain().setTextAlign('right').run())}
              {item('Clear formatting', () => chain().unsetAllMarks().clearNodes().run())}
            </div>
          )
        }}
      </Dropdown>
      <span className="grow" />
      {btn('↶', `Undo (${kb('Z')})`, () => chain().undo().run(), false, !editor.can().undo())}
      {btn('↷', `Redo (${isMac ? '⇧⌘Z' : 'Ctrl+Y'})`, () => chain().redo().run(), false, !editor.can().redo())}
    </div>
  )

  return (
    <div className="toolbar">
      {simple ? simpleRow : (
      <div className="tb-row">
        <select
          className="tb-select"
          value={blockValue}
          title="Text style"
          onChange={(e) => {
            const v = e.target.value
            if (v === 'p') chain().setParagraph().run()
            else chain().setHeading({ level: Number(v[1]) as 2 | 3 | 4 }).run()
          }}
        >
          <option value="p">Normal text</option>
          <option value="h2">Section heading</option>
          <option value="h3">Subheading</option>
          <option value="h4">Small heading</option>
        </select>
        <span className="tb-sep" />
        {btn(<b>B</b>, `Bold (${kb('B')})`, () => chain().toggleBold().run(), editor.isActive('bold'))}
        {btn(<i>I</i>, `Italic (${kb('I')})`, () => chain().toggleItalic().run(), editor.isActive('italic'))}
        {btn(<u>U</u>, `Underline (${kb('U')})`, () => chain().toggleUnderline().run(), editor.isActive('underline'))}
        {btn(<s>S</s>, 'Strikethrough', () => chain().toggleStrike().run(), editor.isActive('strike'))}
        <Dropdown label={<span className="swatch-a" style={{ borderColor: editor.getAttributes('textStyle').color || 'currentColor' }}>A</span>} title="Text color">
          {(close) => (
            <div className="swatches">
              {TEXT_COLORS.map((c) => (
                <button key={c} style={{ background: c }} title={c} onClick={() => (chain().setColor(c).run(), close())} />
              ))}
              <label className="swatch-custom" title="Custom color">
                +
                <input type="color" onChange={(e) => chain().setColor(e.target.value).run()} />
              </label>
              <button className="swatch-reset" onClick={() => (chain().unsetColor().run(), close())}>
                Default color
              </button>
            </div>
          )}
        </Dropdown>
        <Dropdown label={<span className="swatch-hl">ab</span>} title="Highlight">
          {(close) => (
            <div className="swatches">
              {HIGHLIGHTS.map((c) => (
                <button key={c} style={{ background: c }} title={c} onClick={() => (chain().setHighlight({ color: c }).run(), close())} />
              ))}
              <button className="swatch-reset" onClick={() => (chain().unsetHighlight().run(), close())}>
                No highlight
              </button>
            </div>
          )}
        </Dropdown>
        <span className="tb-sep" />
        {btn(<AlignIcon kind="left" />, 'Align left', () => chain().setTextAlign('left').run(), editor.isActive({ textAlign: 'left' }))}
        {btn(<AlignIcon kind="center" />, 'Center', () => chain().setTextAlign('center').run(), editor.isActive({ textAlign: 'center' }))}
        {btn(<AlignIcon kind="right" />, 'Align right', () => chain().setTextAlign('right').run(), editor.isActive({ textAlign: 'right' }))}
        <span className="tb-sep" />
        {btn('• List', 'Bulleted list', () => chain().toggleBulletList().run(), editor.isActive('bulletList'))}
        {btn('1. List', 'Numbered list', () => chain().toggleOrderedList().run(), editor.isActive('orderedList'))}
        {btn('❝ Quote', 'Quote box', () => chain().toggleBlockquote().run(), editor.isActive('blockquote'))}
        {btn('―', 'Divider line', () => chain().setHorizontalRule().run())}
        <span className="tb-sep" />
        <PageLinkButton editor={editor} titles={titles} />
        <WebLinkButton editor={editor} />
        {btn('Image', 'Insert image (you can also paste or drop images)', () => void addImage())}
        {btn('Table', 'Insert table', () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), false, inTable)}
        {insertMenu}
        <span className="tb-sep" />
        {btn('↶', `Undo (${kb('Z')})`, () => chain().undo().run(), false, !editor.can().undo())}
        {btn('↷', `Redo (${isMac ? '⇧⌘Z' : 'Ctrl+Y'})`, () => chain().redo().run(), false, !editor.can().redo())}
        {btn('Clear', 'Clear formatting', () => chain().unsetAllMarks().clearNodes().run())}
      </div>
      )}
      {linkTarget !== undefined && (
        <div className="tb-row tb-context">
          <span className="tb-label">Links to “{linkTarget}”{exists(linkTarget) ? '' : ' (not written yet)'}</span>
          {onOpenLink && btn(exists(linkTarget) ? 'Open page →' : 'Create page →', `Go to the page (or ${isMac ? '⌘' : 'Ctrl+'}click the link)`, () => onOpenLink(linkTarget))}
          {btn('Remove link', 'Keep the text, remove the link', () => chain().extendMarkRange('wikiLink').unsetMark('wikiLink').run())}
        </div>
      )}
      {onImage && (
        <div className="tb-row tb-context">
          <span className="tb-label">Image:</span>
          {(['left', 'center', 'right'] as ImageAlign[]).map((a) =>
            btn(
              { left: 'Float left', center: 'Center', right: 'Float right' }[a],
              'Image position',
              () => chain().updateAttributes('image', { align: a }).run(),
              (img.align ?? 'center') === a
            )
          )}
          <span className="tb-sep" />
          {(['small', 'medium', 'large', 'full'] as ImageSize[]).map((s) =>
            btn(s[0].toUpperCase() + s.slice(1), 'Image size', () => chain().updateAttributes('image', { size: s }).run(), (img.size ?? 'medium') === s)
          )}
          <span className="tb-sep" />
          {btn('Remove image', 'Remove image', () => chain().deleteSelection().run())}
        </div>
      )}
      {inCallout && (
        <div className="tb-row tb-context">
          <span className="tb-label">Box:</span>
          {(Object.keys(CALLOUT_LABELS) as CalloutKind[]).map((k) =>
            btn(CALLOUT_LABELS[k], k === 'spoiler' ? 'Readers click to reveal it' : 'Box style', () => chain().updateAttributes('callout', { kind: k }).run(), calloutKind === k)
          )}
          <span className="tb-sep" />
          {btn('Remove box', 'Keep the writing, remove the box around it', () => chain().lift('callout').run())}
          <span className="tb-label muted">Tip: press Enter twice to leave the box.</span>
        </div>
      )}
      {inTable && (
        <div className="tb-row tb-context">
          <span className="tb-label">Table:</span>
          {btn('+ Row', 'Add row below', () => chain().addRowAfter().run())}
          {btn('+ Column', 'Add column to the right', () => chain().addColumnAfter().run())}
          {btn('− Row', 'Delete row', () => chain().deleteRow().run())}
          {btn('− Column', 'Delete column', () => chain().deleteColumn().run())}
          {btn('Header row', 'Toggle header row', () => chain().toggleHeaderRow().run())}
          {btn('Merge/split', 'Merge or split selected cells', () => chain().mergeOrSplit().run())}
          {btn('Delete table', 'Delete table', () => chain().deleteTable().run())}
        </div>
      )}
    </div>
  )
}

function AlignIcon({ kind }: { kind: 'left' | 'center' | 'right' }): React.JSX.Element {
  const rows = [
    [14, 0],
    [9, kind === 'left' ? 0 : kind === 'center' ? 2.5 : 5],
    [14, 0],
    [9, kind === 'left' ? 0 : kind === 'center' ? 2.5 : 5]
  ]
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" aria-hidden>
      {rows.map(([w, x], i) => (
        <rect key={i} x={x} y={i * 3} width={w} height="1.6" rx="0.8" fill="currentColor" />
      ))}
    </svg>
  )
}

function PageLinkButton({ editor, titles }: { editor: Editor; titles: string[] }): React.JSX.Element {
  const current = editor.getAttributes('wikiLink').page as string | undefined
  return (
    <Dropdown label="Page link" title="Link to a wiki page (or type [[Page name]])" className={'tb-btn' + (current ? ' active' : '')}>
      {(close) => (
        <PageLinkPanel
          initial={current ?? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ')}
          titles={titles}
          canRemove={!!current}
          onRemove={() => {
            editor.chain().focus().extendMarkRange('wikiLink').unsetMark('wikiLink').run()
            close()
          }}
          onPick={(title) => {
            const { empty } = editor.state.selection
            const ch = editor.chain().focus()
            if (current) ch.extendMarkRange('wikiLink').updateAttributes('wikiLink', { page: title }).run()
            else if (empty) {
              ch.insertContent({ type: 'text', text: title, marks: [{ type: 'wikiLink', attrs: { page: title } }] })
                .unsetMark('wikiLink')
                .insertContent(' ')
                .run()
            } else ch.setMark('wikiLink', { page: title }).run()
            close()
          }}
        />
      )}
    </Dropdown>
  )
}

function PageLinkPanel({
  initial,
  titles,
  canRemove,
  onPick,
  onRemove
}: {
  initial: string
  titles: string[]
  canRemove: boolean
  onPick: (t: string) => void
  onRemove: () => void
}): React.JSX.Element {
  const [q, setQ] = useState(initial)
  const [sel, setSel] = useState(0)
  const matches = useMemo(() => {
    const k = titleKey(q)
    return titles.filter((t) => titleKey(t).includes(k)).slice(0, 8)
  }, [q, titles])
  const exact = matches.some((t) => titleKey(t) === titleKey(q))
  const options = exact || !cleanTitle(q) ? matches : [...matches, cleanTitle(q)]
  return (
    <div className="link-panel">
      <input
        autoFocus
        value={q}
        placeholder="Page name"
        onChange={(e) => (setQ(e.target.value), setSel(0))}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(s + 1, options.length - 1)))
          if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)))
          if (e.key === 'Enter' && options[sel]) (e.preventDefault(), onPick(options[sel]))
        }}
      />
      <div className="link-options">
        {options.map((t, i) => (
          <button key={t} className={i === sel ? 'sel' : ''} onClick={() => onPick(t)}>
            {t}
            {!titles.includes(t) && <span className="new-tag">new page</span>}
          </button>
        ))}
      </div>
      {canRemove && (
        <button className="link-btn danger" onClick={onRemove}>
          Remove link
        </button>
      )}
    </div>
  )
}

function WebLinkButton({ editor }: { editor: Editor }): React.JSX.Element {
  const current = editor.getAttributes('link').href as string | undefined
  return (
    <Dropdown label="Web link" title="Link to a website" className={'tb-btn' + (current ? ' active' : '')}>
      {(close) => (
        <WebLinkPanel
          initial={current ?? 'https://'}
          canRemove={!!current}
          onSet={(href) => {
            const ch = editor.chain().focus().extendMarkRange('link')
            if (editor.state.selection.empty && !current) {
              ch.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()
            } else ch.setLink({ href }).run()
            close()
          }}
          onRemove={() => (editor.chain().focus().extendMarkRange('link').unsetLink().run(), close())}
        />
      )}
    </Dropdown>
  )
}

function WebLinkPanel({
  initial,
  canRemove,
  onSet,
  onRemove
}: {
  initial: string
  canRemove: boolean
  onSet: (href: string) => void
  onRemove: () => void
}): React.JSX.Element {
  const [href, setHref] = useState(initial)
  const valid = /^https?:\/\/\S+\.\S+/i.test(href) || /^mailto:\S+@\S+/i.test(href)
  return (
    <div className="link-panel">
      <input
        autoFocus
        value={href}
        onChange={(e) => setHref(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && valid && (e.preventDefault(), onSet(href.trim()))}
      />
      <div className="row gap">
        <button className="btn small" disabled={!valid} onClick={() => onSet(href.trim())}>
          Apply
        </button>
        {canRemove && (
          <button className="link-btn danger" onClick={onRemove}>
            Remove link
          </button>
        )}
      </div>
    </div>
  )
}

/** Things that can be added to a page besides plain writing. */
function InsertMenu({ editor }: { editor: Editor }): React.JSX.Element {
  // With a block (cards, fancy block…) selected, a new one goes after it instead of replacing it.
  const add = (content: Record<string, unknown>): void => {
    const sel = editor.state.selection
    if (sel instanceof NodeSelection) editor.chain().focus().insertContentAt(sel.to, content).run()
    else editor.chain().focus().insertContent(content).run()
  }
  const box = (kind: CalloutKind): void => {
    const ch = editor.chain().focus()
    if (!ch.wrapIn('callout', { kind }).run()) {
      add({ type: 'callout', attrs: { kind }, content: [{ type: 'paragraph' }] })
    }
  }
  return (
    <Dropdown label="Insert ▾" title="Add page cards, note boxes, spoilers…">
      {(close) => {
        const item = (label: string, hint: string, run: () => void): React.JSX.Element => (
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => (run(), close())}>
            <strong>{label}</strong>
            <span className="menu-hint">{hint}</span>
          </button>
        )
        return (
          <div className="menu insert-menu">
            {item('Page cards', 'Picture cards linking to pages, in groups (like “Appearances”)', () =>
              add({ type: 'pageCards', attrs: { data: JSON.stringify(emptyCards()) } })
            )}
            {item('Note box', 'A highlighted box for side information', () => box('note'))}
            {item('Tip box', 'A friendly hint or fun fact', () => box('tip'))}
            {item('Warning box', 'Content warnings or important notes', () => box('warning'))}
            {item('Spoiler box', 'Blurred until a reader clicks it', () => box('spoiler'))}
            {item('Fancy block (HTML)', 'Ready-made banners, boxes, stat bars, tabs, effects… or your own HTML', () =>
              add({ type: 'htmlBlock', attrs: { html: '' } })
            )}
          </div>
        )
      }}
    </Dropdown>
  )
}
