import { jsx } from 'react/jsx-runtime'
import { common, GAP } from './_shared.mjs'

// E2 align?: cross-axis override; ABSENT keeps the pre-E2 defaults exactly (L8).
const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end' }

export const Stack = ({ element, children }) => {
  const p = element.props ?? {}
  const horizontal = p.direction === 'horizontal'
  const align = ALIGN[p.align]
  return jsx('div', {
    ...common(element, { 'data-ru-dir': horizontal ? 'horizontal' : 'vertical', 'data-ru-align': align ? p.align : undefined }),
    style: { display: 'flex', flexDirection: horizontal ? 'row' : 'column', flexWrap: horizontal ? 'wrap' : 'nowrap', columnGap: horizontal ? Math.max(GAP[p.gap] ?? GAP.md, 20) : undefined, rowGap: GAP[p.gap] ?? GAP.md, alignItems: align ?? (horizontal ? 'flex-start' : 'stretch') },
    children
  })
}
