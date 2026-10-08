import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { Tip } from '@hermes/plugin-sdk'
import { common, isNil, unavailable, ownSources, V, type, formatMetric } from './_shared.mjs'
import { HOUSE, TONE_TEXT, INK } from './_house.mjs'
import { num } from './fmt.mjs'
import { useRowFmt, useVintage } from './rowfmt.mjs'
const NBSP = '\u00a0'

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

const clean = (n) => Number(n.toPrecision(15))

// L8 saved-card vintage (rowfmt.mjs useVintage): the pre-#29 Metric, byte-for-byte the
// component the four saved showcase cards were stamped against (formatMetric faces,
// regular-space unit join, delta row in delta.color). Rendered ONLY when CardBody
// provides the 'legacy' vintage; the fresh/agent path below takes fmt.num (L6).
export const LegacyMetric = ({ element }) => {
  const p = element.props ?? {}
  const format = p.format ?? HOUSE.METRIC_FORMAT
  const formatted = formatMetric(p.value, { ...p, format })
  const delta = computeDelta(p.value, p.previous, (p.invertTone ?? HOUSE.METRIC_INVERT_TONE) === true)
  const unitSuffix = p.unit && format !== 'currency' && format !== 'percent' ? ` ${p.unit}` : ''
  return jsxs('div', {
    ...common(element, { 'data-ru-format': format, 'data-ru-delta': delta ? delta.dir : undefined }),
    style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, paddingRight: 16 },
    children: [
      jsxs('div', { style: { ...type('caption', { caps: true }), color: V.text3 }, children: [String(p.label ?? ''), ownSources(p)] }, 'l'),
      jsxs('div', { 'data-ru-value': formatted ?? 'unavailable', style: { ...type('kpi', { num: true }), color: V.text }, children: [formatted === null ? unavailable() : formatted] }, 'v'),
      delta ? jsxs('div', { 'data-ru-delta-line': delta.dir,
        'data-ru-delta-percent': delta.percent === null ? 'unavailable' : String(Math.round(delta.percent * 10) / 10),
        style: { ...type('caption', { num: true }), color: delta.color },
        children: [`${delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '—'} ${fmtNumLegacy(Math.abs(delta.delta))}${unitSuffix}`,
          delta.percent === null ? ' · percent unavailable'
            : ` · ${delta.percent < 0 ? '-' : '+'}${Math.round(Math.abs(delta.percent) * 10) / 10}%`]
      }, 'd') : null
    ]
  })
}
const fmtNumLegacy = (n) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

// #29 (slice 3+6): the value→text path is fmt.num — the same face tables and
// bar-lists print (no more legacy formatMetric tiers). The label is ONE line with
// a mid-word ellipsis inside a Tip (NUMBER_TILES.LABEL_ELLIPSIS_PX is the only
// line-breaking rule); the unit rides the value's face as a sibling span in body
// secondary (never glued to the face); the delta row is caption in TONE_TEXT,
// rate deltas print in pp, and |%Δ| beyond DELTA_MULT_FROM folds into an n× face.
// A KPI row inside a Grid shares one scale via RowFmt (fmtSet from fmt.mjs).
const HouseMetric = ({ element }) => {
  const p = element.props ?? {}
  const format = p.format ?? HOUSE.METRIC_FORMAT
  const isRate = format === 'percent' || format === 'fraction'
  const row = useRowFmt()
  const n = num(p.value, { format, precision: p.precision })
  // The KPI row (grid.mjs) prints the whole row with one fmtSet; a tile outside a
  // row — or any authored format/unit/precision — formats alone (L8: unchanged).
  const ri = row && n.face !== null ? row.values.indexOf(Number(p.value)) : -1
  const face = ri >= 0 ? row.faces[ri] : n.face
  const hasUnit = typeof p.unit === 'string' && p.unit.trim() && !isRate
  const delta = computeDelta(p.value, p.previous, (p.invertTone ?? HOUSE.METRIC_INVERT_TONE) === true)
  const tn = HOUSE.NUMBER_TILES
  let deltaNode = null
  if (delta) {
    const tone = delta.dir === 'flat' ? INK.meta
      : delta.dir === 'up' ? (p.invertTone ? TONE_TEXT.error : TONE_TEXT.success)
      : (p.invertTone ? TONE_TEXT.success : TONE_TEXT.error)
    const arrow = delta.dir === 'up' ? '▲' : delta.dir === 'down' ? '▼' : '—'
    const abs = clean(Math.abs(delta.delta))
    const dface = delta.dir === 'flat' ? '0'
      : num(abs, { format: isRate ? 'number' : format, precision: p.precision }).face
    const suffix = isRate ? NBSP + 'pp' : hasUnit ? ' ' + p.unit.trim() : ''
    const mult = delta.percent !== null && Math.abs(delta.percent) > tn.DELTA_MULT_FROM && !isNil(p.previous) && Number(p.previous) !== 0
      ? num(clean(p.value / p.previous)).face + '\u00d7'
      : null
    const pct = delta.percent === null ? ' \u00b7 percent unavailable'
      : delta.dir === 'flat' || mult !== null ? ''
      : ` \u00b7 ${delta.percent < 0 ? '-' : '+'}${Math.round(Math.abs(delta.percent) * 10) / 10}%`
    deltaNode = jsxs('div', {
      'data-ru-delta-line': delta.dir,
      'data-ru-delta-percent': delta.percent === null ? 'unavailable' : String(Math.round(delta.percent * 10) / 10),
      style: { ...type('caption', { num: true }), color: tone },
      children: [`${arrow} ${mult ?? dface}${suffix}${pct}`]
    }, 'd')
  }
  const label = String(p.label ?? '')
  return jsxs('div', {
    ...common(element, { 'data-ru-format': format, 'data-ru-delta': delta ? delta.dir : undefined }),
    style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, paddingRight: 16 },
    children: [
      jsxs('div', {
        'data-ru-label': '',
        style: { ...type('caption', { caps: true }), color: V.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: tn.LABEL_ELLIPSIS_PX },
        children: [jsx(Tip, { label, children: [label, ownSources(p)] }, 't')]
      }, 'l'),
      jsxs('div', {
        'data-ru-value': face ?? 'unavailable',
        title: n.exact ?? undefined, 'aria-label': n.aria ?? undefined,
        style: { ...type('kpi', { num: true }), color: V.text },
        children: [face === null
          ? jsx('span', { 'data-ru-null': '', style: { ...type('body'), fontStyle: 'italic', color: V.text2 }, children: 'unavailable' }, 'n')
          : face]
      }, 'v'),
      hasUnit && face !== null ? jsx('span', {
        'data-ru-unit': '', style: { ...type('body'), color: V.text2, marginLeft: 4 },
        children: [p.unit.trim()]
      }, 'u') : null,
      deltaNode
    ]
  })
}

// The one exported Metric: vintage switch (card.mjs vintageOf decides from the
// record stamp; everything outside a saved record defaults to 'house').
export const Metric = ({ element }) =>
  jsx(useVintage() === 'legacy' ? LegacyMetric : HouseMetric, { element })
