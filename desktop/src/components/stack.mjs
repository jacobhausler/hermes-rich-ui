import { jsx } from 'react/jsx-runtime'
import { common, compose, GAP, RowContext, kidList, classOf } from './_shared.mjs'
import { HOUSE } from './_house.mjs'

// E2 align?: cross-axis override; ABSENT keeps the pre-E2 defaults exactly (L8).
const ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end' }

// #28: a vertical Stack flows through compose() (its authored gap is the "otherwise"
// step; gap none turns the rhythm off). A horizontal Stack is a row: it provides
// RowContext(true) and marks row-fill (all tiles/atoms stay content-sized; otherwise
// the prose-reset CSS flexes each child by its size class).
export const Stack = ({ element, children }) => {
  const p = element.props ?? {}
  const horizontal = (p.direction ?? HOUSE.STACK_DIRECTION) === 'horizontal'
  const align = ALIGN[p.align]
  const gap = GAP[p.gap ?? HOUSE.STACK_GAP] ?? GAP[HOUSE.STACK_GAP]
  const fill = horizontal ? (kidList(children).every(k => ['tile', 'atom'].includes(classOf(k))) ? 'tiles' : 'mixed') : undefined
  const stack = jsx('div', {
    ...common(element, { 'data-ru-dir': horizontal ? 'horizontal' : 'vertical', 'data-ru-align': align ? p.align : undefined, 'data-ru-row-fill': fill }),
    style: { display: 'flex', flexDirection: horizontal ? 'row' : 'column', flexWrap: horizontal ? 'wrap' : 'nowrap', columnGap: horizontal ? Math.max(gap, 20) : undefined, rowGap: horizontal ? gap : 0, alignItems: align ?? (horizontal ? 'flex-start' : 'stretch') },
    children: horizontal ? children : compose(children, { otherwise: gap, rhythm: p.gap !== 'none' })
  })
  return horizontal ? jsx(RowContext.Provider, { value: true, children: stack }) : stack
}
