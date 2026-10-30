import { useState } from 'react'
import { useStore } from '../store'
import { CodeArea } from './CodeArea'
import LookPicker from './LookPicker'

const EXAMPLE = `/* Only on this page */
.page-title { color: #c04; letter-spacing: 2px; }`

/** Custom CSS for one page (on top of the wiki's own). */
export default function PageCssEditor({ value, onChange }: { value: string; onChange: (css: string) => void }): React.JSX.Element {
  const off = useStore((s) => !!s.meta?.customCssOff)
  // Which parts start open (then they stay as the person leaves them).
  const [start] = useState(() => ({ looks: !value.trim() || /✦ look:/.test(value), code: !!value.trim() && !/✦ look:/.test(value) }))
  return (
    <div className="page-css-editor">
      <p className="hint">
        Looks that only apply to this page, on top of the wiki’s own (Look &amp; settings → Looks &amp; custom CSS). They show while reading the
        page and in an exported website.
        {off && <strong> Custom CSS is switched off for this wiki right now.</strong>}
      </p>
      <details className="page-looks" open={start.looks}>
        <summary>Ready-made looks for this page</summary>
        <LookPicker css={value} onChange={onChange} />
      </details>
      <details className="page-css-code" open={start.code}>
        <summary>Write CSS</summary>
        <CodeArea label="This page’s CSS" value={value} onChange={onChange} placeholder={EXAMPLE} rows={8} />
      </details>
    </div>
  )
}
