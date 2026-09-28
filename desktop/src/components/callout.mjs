import { jsxs } from 'react/jsx-runtime'
import { common, text, isNil, ownSources, V } from './_shared.mjs'

const TONE = { info: V.accent, caution: V.yellow, success: V.green }

export const Callout = ({ element }) => {
  const p = element.props ?? {}
  return jsxs('div', {
    ...common(element, { role: 'note', 'data-ru-tone': p.tone }),
    style: { minWidth: 0, borderLeft: `3px solid ${TONE[p.tone] ?? TONE.info}`, background: V.bg3, padding: '8px 10px', borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 2 },
    children: [
      isNil(p.title) ? null : jsxs('div', { style: { fontWeight: 600, fontSize: 12, color: V.text }, children: [text(p.title), ownSources(p)] }, 't'),
      jsxs('div', { style: { fontSize: 12, whiteSpace: 'pre-wrap', color: V.text2 }, children: [text(p.text), isNil(p.title) ? ownSources(p) : null] }, 'x')
    ]
  })
}
