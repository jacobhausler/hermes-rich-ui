// BarList — ranked inline-bar list (N13): 4-12 ranked rows never deserve a Chart's axes
// and legend. Rows ARE the accessibility text (table.mjs-class DOM, no canvas).
// Props arrive resolved on element.props. Widths ∝ value / columnMax are COMPUTED here
// (L6 — the agent never hand-computes shares/percentages); values render via formatMetric.
// null sinks to the END and renders 'unavailable' with a minimum visible track — never a
// 0-width bar and never 0 as a value (L1). Negatives clip at 0 with a blank share (pinned).
import { jsx, jsxs } from 'react/jsx-runtime'
import { useMemo } from 'react'
import { common, formatMetric, unavailable, ownSources, sourceSup, isNil, V } from './_shared.mjs'

const MAX_ITEMS = 30
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// Pure: apply the sort (desc|asc|none, dflt desc). null values ALWAYS sink last no matter
// the direction (L1: an unknown is not the smallest number). 'none' keeps author order,
// nulls still sink last. Stable on equal values.
export function sortItems(items, sort = 'desc') {
  const idx = items.map((it, i) => ({ it, i }))
  const nullsLast = (a, b) => {
    const an = isNum(a.it?.value), bn = isNum(b.it?.value)
    if (an !== bn) return an ? -1 : 1
    if (!an && !bn) return a.i - b.i
    return 0
  }
  const byValue = (a, b, dir) => (dir === 'asc' ? a.it.value - b.it.value : b.it.value - a.it.value)
  if (sort === 'asc' || sort === 'desc') {
    return idx.sort((a, b) => {
      const nl = nullsLast(a, b)
      if (nl) return nl
      const d = byValue(a, b, sort)
      return d !== 0 ? d : a.i - b.i
    }).map(x => x.it)
  }
  return idx.sort((a, b) => { const nl = nullsLast(a, b); return nl !== 0 ? nl : a.i - b.i }).map(x => x.it)
}

// Pure: {shares, max, counted} — share = clipped value / columnMax of positive values.
// Negatives (and null) get a blank (null) share; the denominator is the max POSITIVE
// value, so one outlier never squashes the field and negatives never widen it.
export function barShares(items) {
  const vals = items.map(it => (isNil(it?.value) ? null : Number(it.value)))
  const positive = vals.filter(v => v !== null && v > 0)
  const max = positive.length ? Math.max(...positive) : null
  const counted = vals.filter(v => v !== null).length
  const shares = vals.map(v => {
    if (v === null || max === null) return null
    if (v <= 0) return null // negatives clip at 0 -> blank share (honest, pinned)
    return v / max
  })
  return { shares, max, counted }
}

function h(type, props, children, key) {
  const p = children === undefined ? props : { ...props, children }
  return Array.isArray(children) ? jsxs(type, p, key) : jsx(type, p, key)
}

const S = {
  list: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: V.text },
  row: { display: 'grid', gridTemplateColumns: 'minmax(0, 8em) minmax(0, 1fr) auto', gap: 8, alignItems: 'center', minWidth: 0 },
  label: { color: V.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  track: { position: 'relative', height: 10, borderRadius: 3, background: V.bg3, overflow: 'hidden', minWidth: 24 },
  fill: (pct) => ({ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', borderRadius: 3, background: V.accent }),
  // null row: an EMPTY hatched track (never 0-width, never a value bar) — the row says
  // 'unavailable', not '0'.
  hatch: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', borderRadius: 3, backgroundImage: `repeating-linear-gradient(45deg, ${V.stroke3} 0 4px, transparent 4px 8px)` },
  value: { fontVariantNumeric: 'tabular-nums', color: V.text, whiteSpace: 'nowrap' }
}

export const BarList = ({ element }) => {
  const p = element.props ?? {}
  const propsKey = useMemo(() => { try { return JSON.stringify(p) } catch { return 'unstringifiable:' + (element?.id ?? '') } }, [p]) // eslint-disable-line react-hooks/exhaustive-deps
  const raw = Array.isArray(p.items) ? p.items.slice(0, MAX_ITEMS) : []
  const sort = p.sort === 'asc' ? 'asc' : p.sort === 'none' ? 'none' : 'desc'
  const items = useMemo(() => sortItems(raw, sort), [propsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const { shares, counted } = useMemo(() => barShares(items), [items]) // eslint-disable-line react-hooks/exhaustive-deps
  const fmt = { format: p.format ?? 'number', precision: p.precision, unit: p.unit }
  const rows = items.map((it, i) => {
    const value = isNil(it?.value) ? null : Number(it.value)
    const formatted = value === null ? null : formatMetric(value, fmt)
    const share = shares[i]
    const negative = value !== null && value <= 0
    return jsxs('div', {
      style: S.row,
      'data-ru-item': value === null ? 'unavailable' : negative ? 'clipped' : 'ok',
      children: [
        h('span', { style: S.label, title: String(it?.label ?? '') }, String(it?.label ?? ''), 'l' + i),
        h('div', { style: S.track, 'aria-hidden': 'true' },
          value === null ? h('div', { style: S.hatch }) : (share === null ? null : h('div', { style: S.fill(Math.round(share * 1000) / 10) })), 't' + i),
        jsxs('span', { style: S.value, children: [
          formatted === null ? unavailable('v' + i) : formatted,
          sourceSup(it?.sourceIds, p._sources, 's' + i)
        ] }, 'v' + i)
      ]
    }, 'r' + i)
  })
  return jsxs('div', {
    ...common(element, { 'data-ru-count': String(counted), 'data-ru-sort': sort }),
    style: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, margin: 0 },
    role: 'list',
    children: [
      h('div', { style: S.list, role: 'presentation' }, rows, 'rows'),
      ownSources(p)
    ]
  })
}

export default BarList
