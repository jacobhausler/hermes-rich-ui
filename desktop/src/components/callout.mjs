import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, isNil, withCite, V, type } from './_shared.mjs'
import { HOUSE } from './_house.mjs'

// E9: tone 'error' → --ui-red (V.red already in the theme; tone stays REQUIRED at 0.1.1, S-E9).
const TONE = { info: V.accent, caution: V.yellow, success: V.green, error: V.red }

export const Callout = ({ element }) => {
  const p = element.props ?? {}
  const tone = p.tone ?? HOUSE.CALLOUT.tone
  // #36 (withCite): the title is the head row — the marker joins it as the last inline
  // child; with no title it rides as a flex sibling after the text body.
  const head = isNil(p.title) ? null : jsx('div', { style: { ...type('h3'), color: V.text }, children: text(p.title) }, 't')
  const body = jsx('div', { style: { ...type('body'), whiteSpace: 'pre-wrap', color: V.text2 }, children: text(p.text) }, 'x')
  return jsxs('div', {
    ...common(element, { role: 'note', 'data-ru-tone': tone }),
    style: { minWidth: 0, borderLeft: `${HOUSE.CALLOUT.railW}px solid ${TONE[tone]}`, background: V.bg3, padding: HOUSE.CALLOUT.padding, borderRadius: HOUSE.CALLOUT.radius, display: 'flex', flexDirection: 'column', gap: HOUSE.CALLOUT.gap },
    children: withCite(head, body, p.sourceIds, p._sources)
  })
}
