import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, isNil, sourceSup, ownSources, V, type, formatMetric } from './_shared.mjs'
import { useVintage } from './rowfmt.mjs'
import { fmt } from './fmt.mjs'

// E13 (pre-#29): per-item format?/unit?/precision? route through the shared
// formatter WHEN the resolved value is a NUMBER. Any string (even "42000") +
// format → render the raw string VERBATIM, never coerce (documented L1 ruling:
// the agent's string stays exactly what it wrote; a string is not coerced
// through Number() — that is how "0042" survives).
//
// #29 (slice 6): a bare JSON number now prints the HOUSE face (fmt.num at the
// 'kv' surface — same tables print), so {Rows: 1234567} reads 1.23M instead of
// the raw dump; the key column is fit-content(40%); an additive optional
// `title` renders as an <h3> above the list. An UNformatted string still keeps
// the pre-E13 dd style byte-for-byte (L8 additive law).
function formatItemValue(it) {
  const v = it?.value
  if (typeof v === 'number' && Number.isFinite(v)) {
    const hasFmt = !isNil(it.format) || !isNil(it.unit) || !isNil(it.precision)
    // fraction is #29-only (the legacy formatter never knew it) → house face.
    if (it.format === 'fraction') {
      const f = fmt(v, { format: 'fraction', surface: 'kv', precision: precOf(it.precision) })
      if (f !== null) return { node: f, numeric: true, authored: true }
    }
    // E13 (slice 3): an AUTHORED format/unit/precision keeps the formatMetric face
    // byte-for-byte ($42,000 never compacts to $42k; '42,000 rows' is a regular space).
    if (hasFmt) {
      const f = formatMetric(v, { format: typeof it.format === 'string' ? it.format : 'number', precision: it.precision, unit: typeof it.unit === 'string' ? it.unit : undefined })
      if (f !== null) return { node: f, numeric: true, authored: true }
    }
    // BARE number → the house face (1234567 reads 1.23M).
    const f = fmt(v, { surface: 'kv' })
    if (f !== null) return { node: f, numeric: true, authored: false }
  }
  return { node: text(v), numeric: false, authored: false }
}
const precOf = p => (Number.isInteger(p) && p >= 0 && p <= 6 ? p : undefined)

const HouseKeyValueList = ({ element }) => {
  const p = element.props ?? {}
  const items = Array.isArray(p.items) ? p.items.slice(0, 32) : []
  return jsxs('div', {
    ...common(element, typeof p.title === 'string' && p.title.trim() ? { 'data-ru-title': p.title.trim() } : undefined),
    style: { display: 'flex', flexDirection: 'column', marginBottom: 4 },
    children: [
      typeof p.title === 'string' && p.title.trim()
        ? jsx('h3', { 'data-ru-list-title': '', style: { ...type('body'), color: V.text, fontWeight: 600, margin: '0 0 6px' }, children: p.title.trim() }, 't')
        : null,
      jsx('dl', { style: { margin: 0, display: 'grid', gridTemplateColumns: 'fit-content(40%) minmax(0, 1fr)', columnGap: 12, rowGap: 4, ...type('small'), alignItems: 'baseline' },
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


// E13: per-item format?/unit?/precision? routed through formatMetric WHEN the resolved value
// is a NUMBER. Any string (even "42000") + format → render the raw string VERBATIM, never
// coerce (documented L1 ruling: the agent's string stays exactly what it wrote; a string is
// not coerced through Number() — that is how "0042" survives).
function legacyFormatItemValue(it) {
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

export const LegacyKeyValueList = ({ element }) => {
  const p = element.props ?? {}
  const items = Array.isArray(p.items) ? p.items.slice(0, 32) : []
  return jsxs('div', {
    ...common(element),
    style: { display: 'flex', flexDirection: 'column', marginBottom: 4 },
    children: [
      jsx('dl', { style: { margin: 0, display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', columnGap: 12, rowGap: 4, ...type('small'), alignItems: 'baseline' },
        children: items.flatMap((it, i) => {
          const fv = legacyFormatItemValue(it)
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

// The one exported KeyValueList: vintage switch (card.mjs vintageOf decides from the
// record stamp; everything outside a saved record defaults to 'house').
export const KeyValueList = ({ element }) =>
  jsx(useVintage() === 'legacy' ? LegacyKeyValueList : HouseKeyValueList, { element })
