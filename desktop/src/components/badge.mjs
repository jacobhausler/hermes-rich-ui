import { jsxs } from 'react/jsx-runtime'
import { common, text, badge, ownSources } from './_shared.mjs'
import { HOUSE } from './_house.mjs'

export const Badge = ({ element }) => {
  const p = element.props ?? {}
  return jsxs('span', { ...common(element), children: [badge(text(p.label), p.tone ?? HOUSE.BADGE_TONE, { 'data-ru-tone': p.tone ?? HOUSE.BADGE_TONE }), ownSources(p)] })
}
