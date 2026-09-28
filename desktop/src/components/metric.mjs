import { jsxs } from 'react/jsx-runtime'
import { common, formatMetric, unavailable, ownSources, V } from './_shared.mjs'

export const Metric = ({ element }) => {
  const p = element.props ?? {}
  const formatted = formatMetric(p.value, p)
  return jsxs('div', {
    ...common(element, { 'data-ru-format': p.format ?? 'number' }),
    style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, paddingRight: 16 },
    children: [
      jsxs('div', { style: { fontSize: 11, color: V.text3, textTransform: 'uppercase', letterSpacing: 0.4 }, children: [String(p.label ?? ''), ownSources(p)] }, 'l'),
      jsxs('div', { 'data-ru-value': formatted ?? 'unavailable', style: { fontSize: 20, fontWeight: 600, color: V.text, fontVariantNumeric: 'tabular-nums' }, children: [formatted === null ? unavailable() : formatted] }, 'v')
    ]
  })
}
