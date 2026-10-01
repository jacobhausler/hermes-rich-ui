import { jsx } from 'react/jsx-runtime'
import { common, GAP } from './_shared.mjs'
import { HOUSE } from './_house.mjs'

export const Grid = ({ element, children }) => {
  const p = element.props ?? {}
  const cols = Math.min(4, Math.max(1, Number(p.columns) || 1))
  return jsx('div', {
    ...common(element),
    style: { display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP[p.gap ?? HOUSE.GRID_GAP] ?? GAP[HOUSE.GRID_GAP] },
    children
  })
}
