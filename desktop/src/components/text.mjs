import { jsxs } from 'react/jsx-runtime'
import { common, text, citeMarker, V, type } from './_shared.mjs'
import { HOUSE } from './_house.mjs'

export const Text = ({ element }) => {
  const p = element.props ?? {}
  const variant = p.variant ?? HOUSE.TEXT_VARIANT
  const caption = variant === 'caption'
  // E8 variant 'mono': ui-monospace + tabular-nums for ids/hashes (never markdown — jsx escapes).
  const mono = variant === 'mono'
  return jsxs('p', {
    ...common(element, { 'data-ru-variant': mono ? 'mono' : undefined }),
    // S8 (#30): prose capped at HOUSE.MEASURE (72ch).
    style: { margin: 0, minWidth: 0, maxWidth: HOUSE.MEASURE, whiteSpace: 'pre-wrap', ...type(mono ? 'small' : caption ? 'caption' : 'body', { mono, num: mono }), color: (p.tone ?? HOUSE.TEXT_TONE) === 'muted' || caption ? V.text2 : V.text },
    children: [text(p.text), citeMarker(p.sourceIds, p._sources)]
  })
}
