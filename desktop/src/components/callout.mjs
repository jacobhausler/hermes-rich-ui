import { jsxs } from 'react/jsx-runtime'
import { common, text, isNil, ownSources, V, type } from './_shared.mjs'
import { HOUSE } from './_house.mjs'

// E9: tone 'error' → --ui-red (V.red already in the theme; tone stays REQUIRED at 0.1.1, S-E9).
const TONE = { info: V.accent, caution: V.yellow, success: V.green, error: V.red }

export const Callout = ({ element }) => {
  const p = element.props ?? {}
  const tone = p.tone ?? HOUSE.CALLOUT.tone
  return jsxs('div', {
    ...common(element, { role: 'note', 'data-ru-tone': tone }),
    style: { minWidth: 0, borderLeft: `${HOUSE.CALLOUT.railW}px solid ${TONE[tone]}`, background: V.bg3, padding: HOUSE.CALLOUT.padding, borderRadius: HOUSE.CALLOUT.radius, display: 'flex', flexDirection: 'column', gap: HOUSE.CALLOUT.gap },
    children: [
      isNil(p.title) ? null : jsxs('div', { style: { ...type('h3'), color: V.text }, children: [text(p.title), ownSources(p)] }, 't'),
      jsxs('div', { style: { ...type('body'), whiteSpace: 'pre-wrap', color: V.text2 }, children: [text(p.text), isNil(p.title) ? ownSources(p) : null] }, 'x')
    ]
  })
}
