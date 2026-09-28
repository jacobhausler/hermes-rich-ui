import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, ownSources, row, V } from './_shared.mjs'

// CodeBlock (expansion N1, 2026-09-28): monospace literal code/config/shell output.
// `language` is a LABEL ONLY — never parsed, never selects a highlighter. No syntax
// highlighting, no HTML (jsx escapes every string; never dangerouslySetInnerHTML).
// The 4 KiB cap on `code` is an ADMISSION rule (see MANIFEST: check_code_cap in
// engine/admission.py); the renderer never truncates (L1/L4).
const MONO = 'ui-monospace, monospace' // same idiom as table.mjs badge fontFamily

const headerRow = { flexWrap: 'wrap' }
const captionStyle = { fontSize: 11, color: V.text3 }
// Same pill idiom as table.mjs:108 (badge style), ui-monospace carried through.
const langStyle = {
  display: 'inline-block', fontSize: 10, lineHeight: '14px', padding: '0 5px',
  borderRadius: 999, border: '1px solid ' + V.stroke3, background: V.bg3,
  color: V.text2, fontFamily: MONO
}
const preStyle = {
  margin: 0, padding: '8px 10px', fontSize: 12, lineHeight: 1.5, color: V.text,
  background: V.bg3, border: '1px solid ' + V.stroke3, borderRadius: 6,
  whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflow: 'auto',
  minWidth: 0, fontFamily: MONO
}
const lineStyle = { display: 'block', position: 'relative', paddingLeft: 34 }
const gutterStyle = {
  position: 'absolute', left: 0, width: 26, paddingRight: 8, textAlign: 'right',
  color: V.text3, fontStyle: 'normal', fontVariantNumeric: 'tabular-nums', userSelect: 'none'
}

export const CodeBlock = ({ element }) => {
  const p = element.props ?? {}
  // `code` arrives already resolved by the renderer ({ path } bindings lower to
  // $state; admission guarantees a string before this point — L3, never trust payload).
  const code = typeof p.code === 'string' ? p.code : null
  const header = (typeof p.caption === 'string' && p.caption) || (typeof p.language === 'string' && p.language)
    ? row(headerRow,
        typeof p.caption === 'string' && p.caption
          ? jsx('span', { 'data-ru-caption': '', style: captionStyle, children: p.caption }, 'c')
          : null,
        typeof p.language === 'string' && p.language
          ? jsx('span', { 'data-ru-lang': p.language, style: langStyle, children: p.language }, 'l')
          : null
      )
    : null
  const body = code === null
    ? jsx('div', { style: { ...preStyle, background: 'transparent', border: 'none', padding: 0 }, children: text(p.code) }, 'n')
    : p.showLines === true
      ? jsx('pre', { 'data-ru-lines': String(code.split('\n').length), style: preStyle, children:
          code.split('\n').map((ln, i, all) => jsxs('span', { 'data-ru-line': String(i + 1), style: lineStyle, children: [
            jsx('span', { 'data-ru-line-no': String(i + 1), 'aria-hidden': 'true', style: gutterStyle, children: String(i + 1) }, 'g'),
            i === all.length - 1 ? ln : ln + '\n'
          ] }, i))
        }, 'l')
      : jsx('pre', { style: preStyle, children: code }, 'p')
  return jsxs('div', { ...common(element), style: { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }, children: [header, body, ownSources(p)] })
}
