import { jsxs } from 'react/jsx-runtime'
import { common, text, badge, ownSources } from './_shared.mjs'

export const Badge = ({ element }) => {
  const p = element.props ?? {}
  return jsxs('span', { ...common(element), children: [badge(text(p.label), p.tone, { 'data-ru-tone': p.tone ?? 'neutral' }), ownSources(p)] })
}
