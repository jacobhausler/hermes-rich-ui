// BarList — ranked inline-bar list (N13): 4-12 ranked rows never deserve a Chart's axes
// and legend. Rows ARE the accessibility text (table.mjs-class DOM, no canvas).
// Props arrive resolved on element.props. Widths ∝ value / columnMax are COMPUTED here
// (L6 — the agent never hand-computes shares/percentages); values render via fmtSet —
// ONE set across the column: shared tier, shared cents, collisions widened (#33).
// null sinks to the END and renders 'unavailable' with a minimum visible track — never a
// 0-width bar and never 0 as a value (L1). Negatives draw LEFT of the zero line with
// share ∝ |value| / columnMax — #33 replaces the old clip-to-blank rule (the RED pin
// test_synth_microviz_defaults names the replacement explicitly).
import { jsx, jsxs } from 'react/jsx-runtime'
import { useMemo } from 'react'
import { common, unavailable, withCite, citeMarker, isNil, V, type } from './_shared.mjs'
import { HOUSE, MARK_FILL } from './_house.mjs'
import { fmtSet } from './fmt.mjs'

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

// Pure: {shares, max, counted} — share = value / columnMax of positive values.
// Negatives (and null) get a blank (null) share here; the RENDERER draws negatives off
// this same columnMax (#33: left of zero, never clipped to blank — see BarList below).
export function barShares(items) {
  const vals = items.map(it => (isNil(it?.value) ? null : Number(it.value)))
  const positive = vals.filter(v => v !== null && v > 0)
  const max = positive.length ? Math.max(...positive) : null
  const counted = vals.filter(v => v !== null).length
  const shares = vals.map(v => {
    if (v === null || max === null) return null
    if (v <= 0) return null
    return v / max
  })
  return { shares, max, counted }
}

function h(type, props, children, key) {
  const p = children === undefined ? props : { ...props, children }
  return Array.isArray(children) ? jsxs(type, p, key) : jsx(type, p, key)
}

// #33: ONE grid row — label (fit-content(40%)), shared 1fr track lane, right-aligned
// values in one tabular column. Every row shares identical column geometry, so bars,
// labels and values line up across the list without hand-computed widths.
const S = {
  list: { display: 'flex', flexDirection: 'column', gap: 4, ...type('small'), color: V.text },
  row: { display: 'grid', gridTemplateColumns: 'fit-content(40%) 1fr auto', gap: 8, alignItems: 'center', minWidth: 0 },
  label: { color: V.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  track: { position: 'relative', height: 10, borderRadius: 3, background: V.bg3, minWidth: 24 },
  // mark fills ride the shared MARK_FILL helper — the 3:1-vs-card rule is pinned by
  // tests/helpers/mark_fill.mjs (constant moves, rule never moves).
  fill: (pct, side) => ({ position: 'absolute', top: 0, bottom: 0, ...(side === 'left' ? { right: '50%' } : { left: side === 'mid' ? '50%' : '0%' }), width: pct + '%', borderRadius: 3, background: MARK_FILL() }),
  // null row: an EMPTY hatched track (never 0-width, never a value bar) — the row says
  // 'unavailable', not '0'.
  hatch: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', borderRadius: 3, backgroundImage: `repeating-linear-gradient(45deg, ${V.stroke3} 0 4px, transparent 4px 8px)` },
  value: { fontVariantNumeric: 'tabular-nums', color: V.text, whiteSpace: 'nowrap', textAlign: 'right' }
}

export const BarList = ({ element }) => {
  const p = element.props ?? {}
  const propsKey = useMemo(() => { try { return JSON.stringify(p) } catch { return 'unstringifiable:' + (element?.id ?? '') } }, [p]) // eslint-disable-line react-hooks/exhaustive-deps
  const raw = Array.isArray(p.items) ? p.items.slice(0, MAX_ITEMS) : []
  const sort = (s => (s === 'asc' || s === 'none' ? s : 'desc'))(p.sort ?? HOUSE.BARLIST_SORT)
  const items = useMemo(() => sortItems(raw, sort), [propsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const values = useMemo(() => items.map(it => (isNil(it?.value) ? null : Number(it.value))), [items]) // eslint-disable-line react-hooks/exhaustive-deps
  const { counted } = useMemo(() => barShares(items), [items]) // eslint-disable-line react-hooks-exhaustive-deps
  const hasNeg = values.some(v => v !== null && v < 0)
  const maxAbs = values.reduce((m, v) => (v === null ? m : Math.max(m, Math.abs(v))), 0)
  // ONE fmtSet across the column: shared tier, shared cents tier (whole money carries
  // cents when a sibling needs them), collision guard widens until faces differ.
  const faces = useMemo(() => fmtSet(values, {
    format: p.format ?? HOUSE.BARLIST_FORMAT, precision: p.precision, unit: p.unit, surface: 'cell'
  }), [propsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = items.map((it, i) => {
    const value = values[i]
    const formatted = faces[i]
    const negative = value !== null && value < 0
    const width = value === null || value === 0 || maxAbs === 0 ? 0
      : Math.round(Math.abs(value) / maxAbs * (hasNeg ? 50 : 100) * 10) / 10
    return jsxs('div', {
      style: S.row,
      'data-ru-item': value === null ? 'unavailable' : negative ? 'negative' : 'ok',
      children: [
        h('span', { 'data-ru-item-label': '', style: S.label, title: String(it?.label ?? '') }, String(it?.label ?? ''), 'l' + i),
        h('div', { style: S.track, 'aria-hidden': 'true' },
          value === null ? h('div', { style: S.hatch })
            : width === 0 ? null
              : h('div', { 'data-ru-item-fill': '', 'data-ru-fill-min': String(FILL_MIN_PX), style: { ...S.fill(width, negative ? 'left' : hasNeg ? 'mid' : 'base'), minWidth: FILL_MIN_PX } }), 't' + i),
        jsxs('span', { 'data-ru-item-value': '', style: S.value, children: [
          formatted === null ? unavailable('v' + i) : formatted,
          citeMarker(it?.sourceIds, p._sources)
        ] }, 'v' + i)
      ]
    }, 'r' + i)
  })
  const head = p.title ? h('div', { 'data-ru-itemlist-title': '', style: type('h4') }, String(p.title), 'title') : null
  return jsxs('div', {
    ...common(element, { 'data-ru-count': String(counted), 'data-ru-sort': sort }),
    style: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, margin: 0 },
    role: 'list',
    children: rows.length === 0
      // J7: says No items, never a blank box (an empty list gets no head row to ride).
      ? [h('div', { 'data-ru-empty': '', style: { ...type('small'), color: V.text3, fontStyle: 'italic' } }, 'No items', 'empty')]
      // #36 (withCite): the title row is the head row — the marker joins it as the
      // last inline child; without a title it rides as a flex sibling after the body.
      : withCite(head, h('div', { style: S.list, role: 'presentation' }, rows, 'rows'), p.sourceIds, p._sources)
  })
}

// local mark-fill floor for non-zero bars (px): a visible sliver, never a hairline
const FILL_MIN_PX = 3

export default BarList
