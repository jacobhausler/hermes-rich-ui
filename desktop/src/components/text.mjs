import { jsxs } from 'react/jsx-runtime'
import { common, text, ownSources, V } from './_shared.mjs'

export const Text = ({ element }) => {
  const p = element.props ?? {}
  const caption = p.variant === 'caption'
  return jsxs('p', {
    ...common(element),
    style: { margin: 0, minWidth: 0, whiteSpace: 'pre-wrap', fontSize: caption ? 11 : 13, lineHeight: 1.45, color: p.tone === 'muted' || caption ? V.text2 : V.text },
    children: [text(p.text), ownSources(p)]
  })
}
