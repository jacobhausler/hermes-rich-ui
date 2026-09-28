import { jsxs } from 'react/jsx-runtime'
import { common, text, ownSources, V } from './_shared.mjs'

const SIZE = { 1: 18, 2: 15, 3: 13, 4: 12 }

export const Heading = ({ element }) => {
  const p = element.props ?? {}
  // E7: level 4 joins at size 12 (dense sub-sections no longer fake a heading via Text caption).
  const level = [1, 2, 3, 4].includes(p.level) ? p.level : 2
  return jsxs('h' + level, {
    ...common(element),
    style: { margin: 0, fontSize: SIZE[level], fontWeight: 600, color: V.text, lineHeight: 1.3 },
    children: [text(p.text), ownSources(p)]
  })
}
