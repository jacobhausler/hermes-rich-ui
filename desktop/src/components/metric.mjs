import { jsxs } from 'react/jsx-runtime'
import { common, formatMetric, isNil, unavailable, ownSources, V } from './_shared.mjs'

// E11 delta: previous?: NullableDynamicNumber → the RENDERER computes Δ and %Δ (L6 —
// the agent never hand-computes deltas). Truth-table pins (RATIFY S9):
//   previous === 0        → percent 'unavailable' (never inf / 100%)
//   value null            → no delta row at all (L1)
//   previous null/absent  → no delta row (L1)
export function computeDelta(value, previous, invertTone) {
  const n = isNil(value) ? null : Number(value)
  if (n === null || !Number.isFinite(n)) return null
  if (isNil(previous)) return null
  const pv = Number(previous)
  if (!Number.isFinite(pv)) return null
  const dir = n > pv ? 'up' : n < pv ? 'down' : 'flat'
  const percent = pv === 0 ? null : ((n - pv) / Math.abs(pv)) * 100
  const color = dir === 'flat' ? V.text3
    : invertTone ? (dir === 'up' ? V.red : V.green)
    : (dir === 'up' ? V.green : V.red)
  return { dir, delta: n - pv, percent, color }
}

const fmtNum = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

export const Metric = ({ element }) => {
  const p = element.props ?? {}
  const formatted = formatMetric(p.value, p)
  const delta = computeDelta(p.value, p.previous, p.invertTone === true)
  const unitSuffix = p.unit && p.format !== 'currency' && p.format !== 'percent' ? ` ${p.unit}` : ''
  return jsxs('div', {
    ...common(element, { 'data-ru-format': p.format ?? 'number', 'data-ru-delta': delta ? delta.dir : undefined }),
    style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, paddingRight: 16 },
    children: [
      jsxs('div', { style: { fontSize: 11, color: V.text3, textTransform: 'uppercase', letterSpacing: 0.4 }, children: [String(p.label ?? ''), ownSources(p)] }, 'l'),
      jsxs('div', { 'data-ru-value': formatted ?? 'unavailable', style: { fontSize: 20, fontWeight: 600, color: V.text, fontVariantNumeric: 'tabular-nums' }, children: [formatted === null ? unavailable() : formatted] }, 'v'),
      delta ? jsxs('div', { 'data-ru-delta-line': delta.dir,
        'data-ru-delta-percent': delta.percent === null ? 'unavailable' : String(Math.round(delta.percent * 10) / 10),
        style: { fontSize: 11, color: delta.color, fontVariantNumeric: 'tabular-nums' },
        children: [`${delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '—'} ${fmtNum(Math.abs(delta.delta))}${unitSuffix}`,
          delta.percent === null ? ' · percent unavailable'
            : ` · ${delta.percent < 0 ? '-' : '+'}${Math.round(Math.abs(delta.percent) * 10) / 10}%`]
      }, 'd') : null
    ]
  })
}
