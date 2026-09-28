import { jsxs } from 'react/jsx-runtime'
import { common, text, ownSources, V } from './_shared.mjs'

export const Text = ({ element }) => {
  const p = element.props ?? {}
  const caption = p.variant === 'caption'
  // E8 variant 'mono': ui-monospace + tabular-nums for ids/hashes (never markdown — jsx escapes).
  const mono = p.variant === 'mono'
  return jsxs('p', {
    ...common(element, { 'data-ru-variant': mono ? 'mono' : undefined }),
    style: { margin: 0, minWidth: 0, whiteSpace: 'pre-wrap', fontSize: caption ? 11 : 13, lineHeight: 1.45, color: p.tone === 'muted' || caption ? V.text2 : V.text, ...(mono ? { fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' } : null) },
    children: [text(p.text), ownSources(p)]
  })
}
