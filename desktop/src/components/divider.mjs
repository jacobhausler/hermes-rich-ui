import { jsx, jsxs } from 'react/jsx-runtime'
import { common, V } from './_shared.mjs'

const line = key => jsx('div', { style: { flex: 1, height: 1, background: V.stroke2 } }, key)

export const Divider = ({ element }) => {
  const p = element.props ?? {}
  const label = typeof p.label === 'string' && p.label ? p.label : null
  // E4 orientation?: vertical is a 1px-wide rule that fills the row height (inside a
  // horizontal Stack it must NOT be the flex:1;height:1 horizontal stub of `line`).
  if (p.orientation === 'vertical') {
    return jsxs('div', {
      ...common(element, { role: 'separator', 'aria-orientation': 'vertical', 'data-ru-orientation': 'vertical' }),
      style: { display: 'flex', alignItems: 'stretch', alignSelf: 'stretch', margin: '0 4px' },
      children: [jsx('div', { style: { width: 1, alignSelf: 'stretch', minHeight: 16, background: V.stroke2 } }, 'v')]
    })
  }
  return jsxs('div', {
    ...common(element, { role: 'separator' }),
    style: { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' },
    children: [line('a'), label ? jsx('span', { style: { fontSize: 11, color: V.text3 }, children: label }, 'l') : null, label ? line('b') : null]
  })
}
