// HeatMap — rows×cols matrix as a DOM <table>-of-divs grid (N14), like Chart's DataAlt:
// ≤144 cells need no canvas and rows/labels stay crisp text at any width. No uPlot here.
// Props arrive resolved on element.props. The color ramp is COMPUTED across the OBSERVED
// min→max (L6): a theme-accent alpha ladder only (L7 — color-mix over --ui-* tokens, the
// chart.mjs FALLBACK-map idiom; no legend gradient). The caption prints the observed
// min/max incl. unit so the ladder is never unlabelled.
// null/missing cells are a hatched neutral '—' — never a guessed color (L1). All-null
// renders fully hatched, no crash, no color. A constant domain (min==max) is ONE uniform
// step, never divide-by-zero (S9).
import { jsx, jsxs } from 'react/jsx-runtime'
import { useMemo } from 'react'
import { common, formatMetric, ownSources, isNil, V, type } from './_shared.mjs'

const MAX_ROWS = 12
const MAX_COLS = 12
const MAX_CELLS = 144 // 12×12 — the single reachable cap (catalog maxItems is the enforcement)
const STEPS = 6       // quantized alpha ladder so equal values are deterministically equal
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// Pure: {rows, cols, cells} -> observed model.
//  - cells keep author order; only refs inside the row/col labels count (admission rejects
//    unknown refs; the renderer ignores them defensively rather than fabricating a lane).
//  - observed min/max are across NON-NULL cell values only (L1: nothing is invented).
//  - ramp(v) returns a quantized 0..1 alpha fraction, or null when unobservable
//    (null value, or no observed values at all). Constant domain => every step is 0.5.
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
  return { rowLabels, colLabels, grid, min, max, constant, ramp, points: seen.length }
}

function h(type, props, children, key) {
  const p = children === undefined ? props : { ...props, children }
  return Array.isArray(children) ? jsxs(type, p, key) : jsx(type, p, key)
}

// Alpha ladder on the theme accent over the tertiary background: theme-following (L7)
// and readable in BOTH themes — bg3 is dark in dark and light in light, and color-mix
// interpolates in sRGB the same way chart.mjs reads its FALLBACK tokens.
const cellBg = (t) => `color-mix(in srgb, ${V.accent} ${Math.round(t * 85)}%, ${V.bg3})`

const S = {
  box: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, color: V.text },
  table: { borderCollapse: 'collapse', width: '100%' },
  corner: { ...type('small'), padding: '3px 6px' },
  th: { ...type('h4'), padding: '3px 6px', color: V.text2, textAlign: 'left', whiteSpace: 'nowrap' },
  rowHead: { ...type('h4'), padding: '3px 6px', color: V.text2, textAlign: 'left', whiteSpace: 'nowrap' },
  cell: (t) => ({ ...type('small'), padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', minWidth: 34, background: cellBg(t), color: t >= 0.6 ? V.text : V.text2, border: '1px solid ' + V.stroke3 }),
  // L1: null/missing = hatched neutral '—', never a guessed color.
  nullCell: { ...type('small'), padding: '4px 6px', textAlign: 'center', color: V.text3, minWidth: 34, backgroundImage: `repeating-linear-gradient(45deg, ${V.stroke3} 0 4px, transparent 4px 8px)`, border: '1px solid ' + V.stroke3 },
  caption: { color: V.text3, ...type('caption') }
}

export const HeatMap = ({ element }) => {
  const p = element.props ?? {}
  const propsKey = useMemo(() => { try { return JSON.stringify(p) } catch { return 'unstringifiable:' + (element?.id ?? '') } }, [p]) // eslint-disable-line react-hooks/exhaustive-deps
  const model = useMemo(() => heatModel(p.rows, p.cols, p.cells), [propsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const showValues = p.showValues !== false
  const unit = typeof p.unit === 'string' && p.unit ? p.unit : ''

  const head = jsxs('tr', { children: [
    h('th', { scope: 'col', style: S.corner, 'aria-label': 'row labels' }, '', 'c'),
    ...model.colLabels.map((c, ci) => h('th', { scope: 'col', style: S.th }, c, 'h' + ci))
  ] }, 'head')

  const body = model.rowLabels.map((r, ri) => jsxs('tr', { children: [
    h('th', { scope: 'row', style: S.rowHead }, r, 'rh' + ri),
    ...model.colLabels.map((c, ci) => {
      const v = model.grid[ri][ci]
      const t = model.ramp(v)
      const fmt = v === null ? null : formatMetric(v, { format: 'number', precision: p.precision, unit: undefined })
      return h('td', {
        style: t === null ? S.nullCell : S.cell(t),
        'data-ru-cell': v === null ? 'unavailable' : String(t),
        'aria-label': `${r}, ${c}: ${v === null ? 'unavailable' : formatMetric(v, { format: 'number', precision: p.precision, unit: unit || undefined })}`
      }, v === null ? '—' : (showValues && fmt !== null ? fmt : ''), 'd' + ri + '-' + ci)
    })
  ] }, 'r' + ri))

  // Caption prints the OBSERVED min/max incl. unit (Q: no legend gradient).
  const caption = model.points === 0
    ? 'no values observed — all cells unavailable'
    : `observed ${formatMetric(model.min, { unit })} to ${formatMetric(model.max, { unit })} · ${model.points} values`

  return jsxs('div', {
    ...common(element, { 'data-ru-cells': String(model.points) }),
    style: S.box,
    children: [
      h('table', { style: S.table, 'data-richui': 'heatmap-grid' }, [h('thead', {}, head, 'th'), h('tbody', {}, body, 'tb')], 'tbl'),
      h('div', { style: S.caption, 'data-richui': 'heatmap-caption' }, caption, 'cap'),
      ownSources(p)
    ]
  })
}

export default HeatMap
