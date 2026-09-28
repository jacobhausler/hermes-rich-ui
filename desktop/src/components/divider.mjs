import { jsx, jsxs } from 'react/jsx-runtime'
import { common, V } from './_shared.mjs'

const line = key => jsx('div', { style: { flex: 1, height: 1, background: V.stroke2 } }, key)

export const Divider = ({ element }) => {
  const p = element.props ?? {}
  const label = typeof p.label === 'string' && p.label ? p.label : null
  return jsxs('div', {
    ...common(element, { role: 'separator' }),
    style: { display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' },
    children: [line('a'), label ? jsx('span', { style: { fontSize: 11, color: V.text3 }, children: label }, 'l') : null, label ? line('b') : null]
  })
}
