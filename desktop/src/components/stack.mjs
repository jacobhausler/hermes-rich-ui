import { jsx } from 'react/jsx-runtime'
import { common, GAP } from './_shared.mjs'

export const Stack = ({ element, children }) => {
  const p = element.props ?? {}
  const horizontal = p.direction === 'horizontal'
  return jsx('div', {
    ...common(element, { 'data-ru-dir': horizontal ? 'horizontal' : 'vertical' }),
    style: { display: 'flex', flexDirection: horizontal ? 'row' : 'column', flexWrap: horizontal ? 'wrap' : 'nowrap', columnGap: horizontal ? Math.max(GAP[p.gap] ?? GAP.md, 20) : undefined, rowGap: GAP[p.gap] ?? GAP.md, alignItems: horizontal ? 'flex-start' : 'stretch' },
    children
  })
}
