import { jsxs } from 'react/jsx-runtime'
import { common, text, ownSources, V, type } from './_shared.mjs'

const STEP = { 1: 'title', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'eyebrow' }

export const Heading = ({ element }) => {
  const p = element.props ?? {}
  const level = Object.hasOwn(STEP, p.level) ? p.level : 2
  return jsxs('h' + level, {
    ...common(element),
    style: { ...type(STEP[level]), margin: 0, color: V.text },
    children: [text(p.text), ownSources(p)]
  })
}
