// HeatMap — rows×cols matrix as a DOM <table>-of-divs grid (N14), like Chart's DataAlt:
// ≤144 cells need no canvas and rows/labels stay crisp text at any width. No uPlot here.
// Props arrive resolved on element.props. The color ramp is COMPUTED across the OBSERVED
// values as a RANK ladder (#33/S9): quantizing by linear min→max lets one 100× outlier
// sink every other cell under the 12% floor, so equal ranks share one step and the ladder
// stays inside HOUSE.HEAT_MIX (12–60%) whatever the outlier spread. Signed values split
// the hue (C10): below zero rides orange, at/above zero the accent. The caption prints
// the observed min/max via fmtPair so the ladder is never unlabelled (E-H7).
// null/missing cells are a hatched neutral '—' — never a guessed color (L1). All-null
// renders fully hatched, no crash, no color. A constant domain (min==max) is ONE uniform
// step, never divide-by-zero (S9).
import { jsx, jsxs } from 'react/jsx-runtime'
import { useMemo } from 'react'
import { common, formatMetric, withCite, isNil, V, type } from './_shared.mjs'
import { HOUSE } from './_house.mjs'
import { fmtSet, fmtPair } from './fmt.mjs'

const MAX_ROWS = 12
const MAX_COLS = 12
const MAX_CELLS = 144 // 12×12 — the single reachable cap (catalog maxItems is the enforcement)
const STEPS = 6       // quantized 0..1 ladder so equal values are deterministically equal
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// Pure: {rows, cols, cells} -> observed model.
//  - cells keep author order; only refs inside the row/col labels count (admission rejects
//    unknown refs; the renderer ignores them defensively rather than fabricating a lane).
//  - observed min/max are across NON-NULL cell values only (L1: nothing is invented).
//  - ramp(v) returns a quantized 0..1 step fraction, or null when unobservable
//    (null value, or no observed values at all). Constant domain => every step is 0.5.
//  - #33: per-cell {mixPct} — the RANK ramp (equal ranks one step, HEAT_MIX-bounded).
export function heatModel(rows, cols, cells) {
  const rowLabels = (Array.isArray(rows) ? rows.slice(0, MAX_ROWS) : []).map(r => String(r?.label ?? ''))
  const colLabels = (Array.isArray(cols) ? cols.slice(0, MAX_COLS) : []).map(c => String(c?.label ?? ''))
  const rowIdx = new Map(rowLabels.map((l, i) => [l, i]))
  const colIdx = new Map(colLabels.map((l, i) => [l, i]))
  const grid = rowLabels.map(() => new Array(colLabels.length).fill(null))
  const seen = []
  for (const c of (Array.isArray(cells) ? cells.slice(0, MAX_CELLS) : [])) {
    if (!c) continue
    const ri = rowIdx.get(String(c.row ?? ''))
    const ci = colIdx.get(String(c.col ?? ''))
    if (ri === undefined || ci === undefined) continue
    const v = isNil(c.value) ? null : (isNum(Number(c.value)) ? Number(c.value) : null)
    grid[ri][ci] = v
  }
  for (const row of grid) for (const v of row) if (v !== null) seen.push(v)
  const min = seen.length ? Math.min(...seen) : null
  const max = seen.length ? Math.max(...seen) : null
  const constant = seen.length > 0 && min === max
  const ramp = (v) => {
    if (v === null || min === null) return null
    if (constant) return 0.5 // uniform single step — never (v-min)/(max-min) = 0/0
    return Math.round(((v - min) / (max - min)) * (STEPS - 1)) / (STEPS - 1)
  }
  // #33 (S9): rank ramp across DISTINCT observed values — a 100× outlier shifts one cell's
  // rank, never the whole field's brightness. HEAT_MIX bounds every step.
  const distinct = [...new Set(seen)].sort((a, b) => a - b)
  const rankOf = new Map(distinct.map((v, i) => [v, i]))
  const [lo, hi] = HOUSE.HEAT_MIX
  const mixPct = (v) => (v === null || distinct.length === 0) ? null
    : distinct.length === 1 ? (lo + hi) / 2 // constant domain: ONE uniform step
    : lo + (rankOf.get(v) / (distinct.length - 1)) * (hi - lo)
  const cellList = []
  grid.forEach((row, ri) => row.forEach((v, ci) => cellList.push({ row: rowLabels[ri], col: colLabels[ci], value: v, mixPct: mixPct(v) })))
  return { rowLabels, colLabels, grid, cells: cellList, min, max, constant, ramp, mixPct, points: seen.length }
}

function h(type, props, children, key) {
  const p = children === undefined ? props : { ...props, children }
  return Array.isArray(children) ? jsxs(type, p, key) : jsx(type, p, key)
}

// Rank step over the theme accent (orange below zero — C10) on the tertiary background:
// theme-following (L7) and readable in BOTH themes — bg3 is dark in dark and light in
// light, and color-mix interpolates in sRGB the same way chart.mjs reads its FALLBACK
// tokens. mixPct is already bounded by HOUSE.HEAT_MIX (#33).
const cellBg = (mix, signed) => `color-mix(in srgb, ${signed < 0 ? V.orange : V.accent} ${Math.round(mix)}%, ${V.bg3})`

const S = {
  box: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, color: V.text },
  // #33: overflow-x scroll on the grid host so wide matrices never squeeze cells below
  // their 40px floor (display:block makes the overflow box actually scroll).
  table: { borderCollapse: 'collapse', width: '100%', display: 'block', overflowX: 'scroll' },
  corner: { ...type('small'), padding: '3px 6px' },
  th: { ...type('h4'), padding: '3px 6px', color: V.text2, textAlign: 'left', whiteSpace: 'nowrap' },
  rowHead: { ...type('h4'), padding: '3px 6px', color: V.text2, textAlign: 'left', whiteSpace: 'nowrap' },
  // #33 (S17/C24): cells at the small-12 step, primary ink at every rank, min-width 40.
  cell: (t, signed) => ({ ...type('small'), padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', minWidth: 40, background: cellBg(t, signed), color: V.text, border: '1px solid ' + V.stroke3 }),
  // L1: null/missing = hatched neutral '—', never a guessed color.
  nullCell: { ...type('small'), padding: '4px 6px', textAlign: 'center', color: V.text3, minWidth: 40, backgroundImage: `repeating-linear-gradient(45deg, ${V.stroke3} 0 4px, transparent 4px 8px)`, border: '1px solid ' + V.stroke3 },
  caption: { color: V.text3, ...type('caption') }
}

export const HeatMap = ({ element }) => {
  const p = element.props ?? {}
  const propsKey = useMemo(() => { try { return JSON.stringify(p) } catch { return 'unstringifiable:' + (element?.id ?? '') } }, [p]) // eslint-disable-line react-hooks/exhaustive-deps
  const model = useMemo(() => heatModel(p.rows, p.cols, p.cells), [propsKey]) // eslint-disable-line react-hooks-exhaustive-deps
  const showValues = (p.showValues ?? HOUSE.HEATMAP_SHOW_VALUES) !== false
  const unit = typeof p.unit === 'string' && p.unit ? p.unit : ''
  const fmtCtx = { format: p.format ?? 'number', unit: unit || undefined, precision: p.precision }
  // ONE fmtSet across every observed cell face (shared tier + cents; unit prints once
  // in the caption, not per cell — D2.1 heatCell row of the unit table).
  const observed = model.cells.map(c => c.value).filter(v => v !== null)
  const faceByIdx = useMemo(() => fmtSet(observed, { ...fmtCtx, surface: 'heatCell' }), [propsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const faces = (() => { let k = 0; return model.grid.map(row => row.map(v => (v === null ? null : faceByIdx[k++]))) })()

  const head = jsxs('tr', { children: [
    h('th', { scope: 'col', style: S.corner, 'aria-label': 'row labels' }, '', 'c'),
    ...model.colLabels.map((c, ci) => h('th', { scope: 'col', style: S.th }, c, 'h' + ci))
  ] }, 'head')

  const body = model.rowLabels.map((r, ri) => jsxs('tr', { children: [
    h('th', { scope: 'row', style: S.rowHead }, r, 'rh' + ri),
    ...model.colLabels.map((c, ci) => {
      const v = model.grid[ri][ci]
      const t = model.mixPct(v)
      // E-H6: every cell's aria-label IS the readout — `row, col: value unit`.
      const readout = v === null ? 'unavailable' : formatMetric(v, { format: fmtCtx.format, precision: fmtCtx.precision, unit: fmtCtx.unit })
      return h('td', {
        style: t === null ? S.nullCell : S.cell(t, v),
        'data-ru-cell': v === null ? 'unavailable' : String(model.ramp(v)),
        'data-ru-value': v === null ? undefined : String(v),
        'aria-label': `${r}, ${c}: ${readout}`
      }, v === null ? '—' : (showValues && faces[ri][ci] !== null ? faces[ri][ci] : ''), 'd' + ri + '-' + ci)
    })
  ] }, 'r' + ri))

  // Caption prints the OBSERVED min/max via fmtPair incl. unit (E-H7: no legend gradient).
  // NBSP→space keeps the house caption plain ASCII (spec golden face).
  const caption = model.points === 0
    ? 'no values observed — all cells unavailable'
    : `observed ${fmtPair(model.min, model.max, { ...fmtCtx, surface: 'readout' }).replace(/\u00a0/g, ' ')} · ${model.points} values`

  const titleRow = p.title ? h('div', { 'data-ru-heatmap-title': '', style: type('h4') }, String(p.title), 'title') : null
  return jsxs('div', {
    ...common(element, { 'data-ru-cells': String(model.points) }),
    style: S.box,
    // #36 (withCite): the title row is the head row — the marker joins it as the
    // last inline child; without a title it rides as a flex sibling after the body.
    children: withCite(titleRow, [
      h('table', { style: S.table, 'data-richui': 'heatmap-grid' }, [h('thead', {}, head, 'th'), h('tbody', {}, body, 'tb')], 'tbl'),
      h('div', { style: S.caption, 'data-richui': 'heatmap-caption' }, caption, 'cap')
    ], p.sourceIds, p._sources)
  })
}

export default HeatMap
