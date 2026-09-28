import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, isNil, formatMetric, sourceSup, ownSources, V } from './_shared.mjs'

// E13: per-item format?/unit?/precision? routed through formatMetric WHEN the resolved value
// is a NUMBER. Any string (even "42000") + format → render the raw string VERBATIM, never
// coerce (documented L1 ruling: the agent's string stays exactly what it wrote; a string is
// not coerced through Number() — that is how "0042" survives).
function formatItemValue(it) {
  const v = it?.value
  if (typeof v === 'number' && Number.isFinite(v)) {
    const hasFmt = !isNil(it.format) || !isNil(it.unit) || !isNil(it.precision)
    if (hasFmt) {
      const f = formatMetric(v, { format: typeof it.format === 'string' ? it.format : 'number', precision: it.precision, unit: typeof it.unit === 'string' ? it.unit : undefined })
      if (f !== null) return { node: f, numeric: true }
    }
  }
  return { node: text(v), numeric: false }
}

export const KeyValueList = ({ element }) => {
  const p = element.props ?? {}
  const items = Array.isArray(p.items) ? p.items.slice(0, 32) : []
  return jsxs('div', {
    ...common(element),
    style: { display: 'flex', flexDirection: 'column', marginBottom: 4 },
    children: [
      jsx('dl', { style: { margin: 0, display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', columnGap: 12, rowGap: 4, fontSize: 12, alignItems: 'baseline' },
        children: items.flatMap((it, i) => {
          const fv = formatItemValue(it)
          return [
            jsx('dt', { style: { color: V.text3 }, children: String(it?.label ?? '') }, 'k' + i),
            // Unformatted items keep the pre-E13 dd style exactly (L8 additive law).
            jsxs('dd', { style: { margin: 0, color: V.text, wordBreak: 'break-word', ...(fv.numeric ? { fontVariantNumeric: 'tabular-nums' } : null) }, children: [fv.node, sourceSup(it?.sourceIds, p._sources, 's' + i)] }, 'v' + i)
          ]
        })
      }, 'dl'),
      ownSources(p)
    ]
  })
}
