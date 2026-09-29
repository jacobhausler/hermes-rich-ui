// Chart — ONE engine: uPlot 1.6.32 (bar | line | scatter | histogram | area | waterfall | range)
// + props stack (renderer-computed cumulative baselines), stepped (uPlot.paths.stepped),
// sortDesc (label-keyed |value| desc), height (clamped 120..480, default 240).
// Contract: docs/CONTRACTS.md §2 row 16 + "Chart data shapes". Props arrive resolved on
// element.props. Self-contained: no registry/index imports. Styling = inline + --ui-* only.
//
// Verified against node_modules/uplot/dist/uPlot.esm.js (1.6.32):
//   uPlot.paths.bars(opts)   opts = {size:[gapFrac,maxPx,minPx], align, gap, disp:{x0:{unit,values}, size:{unit,values}}}
//                            disp.x0/size unit 1 = x-scale units (uniform width assumed) → used for grouped bars
//   uPlot.paths.points       default marker path; scatter uses series.paths = () => null + points.show = true
//   series.paths(u, seriesIdx, idx0, idx1) → {stroke, fill, clip, band, gaps, flags} → histogram uses a custom rect path
import { jsx, jsxs } from 'react/jsx-runtime'
import { useEffect, useMemo, useRef, useState } from 'react'
import uPlot from 'uplot'
import { formatMetric, ownSources } from './_shared.mjs'

const KINDS = ['bar', 'line', 'scatter', 'histogram', 'area', 'waterfall', 'range']
const SERIES_TOKENS = ['--ui-accent', '--ui-green', '--ui-purple', '--ui-orange']
// #15: the three waterfall fill roles — same colour-source path as SERIES_TOKENS
// (theme token at runtime, FALLBACK entry off-screen/tests; never a loose hex).
const WF_ROLE_TOKENS = { up: '--ui-green', down: '--ui-red', total: '--ui-text-secondary' }
export const WF_ROLE_LABELS = { up: 'Increase', down: 'Decrease', total: 'Total' }
const WF_ROLE_ORDER = ['up', 'down', 'total']
const FALLBACK = { '--ui-accent': '#3b82f6', '--ui-green': '#22c55e', '--ui-purple': '#a855f7', '--ui-orange': '#f97316',
  '--ui-red': '#ef4444',
  '--ui-text-secondary': '#9ca3af', '--ui-text-primary': '#e5e7eb', '--ui-stroke-tertiary': '#374151', '--ui-stroke-secondary': '#4b5563' }
const HEIGHT = 240          // default chart height (F1: `height` prop clamps 120..480)
const HEIGHT_MIN = 120
const HEIGHT_MAX = 480
const AREA_FILL_ALPHA = 0.18
// F1: height?: number → clamp 120..480, non-number/NaN → default 240.
export function clampHeight(v) {
  const n = typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? Math.min(HEIGHT_MAX, Math.max(HEIGHT_MIN, n)) : HEIGHT
}
// Area fill: same series color at AREA_FILL_ALPHA (FALLBACK colors are #rrggbb; anything else passes through).
function withAlpha(c) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(c))
  if (!m) return c
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${AREA_FILL_ALPHA})`
}
const MAX_SERIES = 4
const MAX_POINTS = 512
let unstringifiableCount = 0

// The NECESSARY subset of node_modules/uplot/dist/uPlot.min.css, colors → --ui-* tokens.
// D3 (CONTRACTS §6 revision W4): every selector is scoped under [data-richui="chart-canvas"] so the
// rules can never leak into the app document, and the <style> is rendered ONCE per document —
// React 19 hoists a <style href precedence> into <head> and dedupes it by href (no document.* here).
const UPLOT_SCOPE = '[data-richui="chart-canvas"] '
// React 19 dedupes hoisted <style> by href and never swaps the text of a mounted one: bump on EVERY css edit.
export const UPLOT_CSS_HREF = 'hermes-rich-ui/uplot-css/6'
const UPLOT_RULES = [
  '.uplot,.uplot *,.uplot *::before,.uplot *::after{box-sizing:border-box}',
  '.uplot{font-family:inherit;line-height:1.5;width:min-content;color:var(--ui-text-secondary)}',
  '.u-title{text-align:center;font-size:14px;font-weight:600;color:var(--ui-text-primary)}',
  '.u-wrap{position:relative;user-select:none}',
  '.u-over,.u-under{position:absolute}',
  '.u-under{overflow:hidden}',
  '.uplot canvas{display:block;position:relative;width:100%;height:100%}',
  '.u-axis{position:absolute}',
  '.u-legend{font-size:11px;margin:4px 0 0;text-align:left;color:var(--ui-text-secondary)}',
  '.u-inline{display:block}',
  '.u-inline *{display:inline-block}',
  '.u-inline tr{margin-right:12px}',
  '.u-legend th{font-weight:600}',
  '.u-legend th>*{vertical-align:middle;display:inline-block}',
  '.u-legend .u-marker{width:1em;height:1em;margin-right:4px;background-clip:padding-box!important}',
  '.u-inline.u-live th::after{content:":";vertical-align:middle}',
  '.u-inline:not(.u-live) .u-value{display:none}',
  '.u-series>*{padding:2px 4px 2px 0}',
  '.u-series th{cursor:pointer}',
  '.u-legend .u-off>*{opacity:0.3}',
  '.u-select{background:var(--ui-bg-tertiary);opacity:0.5;position:absolute;pointer-events:none}',
  '.u-cursor-x,.u-cursor-y{position:absolute;left:0;top:0;pointer-events:none;will-change:transform}',
  '.u-hz .u-cursor-x,.u-vt .u-cursor-y{height:100%;border-right:1px dashed var(--ui-stroke-secondary)}',
  '.u-hz .u-cursor-y,.u-vt .u-cursor-x{width:100%;border-bottom:1px dashed var(--ui-stroke-secondary)}',
  '.u-cursor-pt{position:absolute;top:0;left:0;border-radius:50%;border:0 solid;pointer-events:none;will-change:transform;background-clip:padding-box!important}',
  '.u-axis.u-off,.u-select.u-off,.u-cursor-x.u-off,.u-cursor-y.u-off,.u-cursor-pt.u-off{display:none}'
]
// Prefix EVERY comma-separated selector of every rule (selectors never contain commas in this list).
export function scopeRule(rule, scope = UPLOT_SCOPE) {
  const i = rule.indexOf('{')
  return rule.slice(0, i).split(',').map(sel => scope + sel.trim()).join(',') + rule.slice(i)
}
export const UPLOT_CSS = UPLOT_RULES.map(r => scopeRule(r)).join('')

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isNullish = (v) => v === null || v === undefined

// x for line: ISO-8601 string → epoch seconds; finite number → itself; else null (dropped).
export function parseX(x) {
  if (isNum(x)) return { v: x, time: false }
  if (typeof x === 'string') {
    const ms = Date.parse(x)
    if (Number.isFinite(ms)) return { v: ms / 1000, time: true }
  }
  return null
}

function normSeries(series) {
  if (!Array.isArray(series)) return []
  return series.slice(0, MAX_SERIES).map((s, i) => ({
    label: s && typeof s.label === 'string' && s.label ? s.label : `series ${i + 1}`,
    data: s && Array.isArray(s.data) ? s.data.slice(0, MAX_POINTS) : []
  }))
}

/**
 * Pure: turn catalog series into uPlot's `[xs, ...ys]` layout.
 * Returns { ok, reason?, data, labels, xAxisIsTime, xLabels?, highs?, binCount?, points }
 *   bar:       xs = 0..n-1 over the union of labels (first-appearance order); xLabels = labels; ys aligned by label.
 *   line:      xs = sorted distinct x (ISO → epoch seconds); nulls preserved; missing x in a series → null.
 *   scatter:   every (x, y) pair kept (duplicates too): xs sorted by x, ys[s][i] = y only at that series' rows.
 *   histogram: xs = bin lows (union, sorted); highs[s][i] = bin high; ys = counts; binCount = bins of series 0.
 *   area:      point shape == line (reuses the line layout); fill toward zero added in buildOpts.
 *   waterfall: xs = label union (first-appearance, like bar); renderer computes the RUNNING baseline —
 *              step i: base→base+value; total:true bars pin base 0→cumulative total (L6: never agent-hand-computed).
 *   range:     xs = label union (first-appearance, like bar); lows[s][i]/highs[s][i] drawn as floating rects.
 * opts: { sortDesc?: bool (bar/histogram: categories stay label-keyed, ordered by summed |value| desc),
 *         stack?: bool (bar/area only: renderer-computed cumulative baselines; vendored uPlot has NO
 *         stackGroup (RATIFY S7), so stacking is computed here and asserted via data-alt/pixels). }
 */
export function seriesToUplot(kind, series, opts = {}) {
  const ss = normSeries(series)
  const labels = ss.map(s => s.label)
  const empty = (reason) => ({ ok: false, reason, data: [[]], labels, xAxisIsTime: false, points: 0 })
  if (!KINDS.includes(kind)) return empty(`unknown chart kind "${kind}"`)
  if (ss.length === 0) return empty('no series')

  if (kind === 'bar') {
    const order = []
    const idx = new Map()
    for (const s of ss) for (const p of s.data) {
      const l = p && p.label != null ? String(p.label) : null
      if (l === null || idx.has(l)) continue
      idx.set(l, order.length); order.push(l)
    }
    if (order.length === 0) return empty('no labelled bars')
    let points = 0
    let ys = ss.map(s => {
      const col = new Array(order.length).fill(null)
      for (const p of s.data) {
        if (!p || p.label == null) continue
        const i = idx.get(String(p.label))
        if (i === undefined) continue
        col[i] = isNum(p.value) ? p.value : null
        if (col[i] !== null) points++
      }
      return col
    })
    if (points === 0) return empty('all bar values are null')
    const rawYs = ys.map(c => c.slice())   // pre-stack scores for sortDesc (E16) stay raw-magnitude based
    let stackBases
    if (opts.stack) {
      // S7: custom stacking — vendored uPlot 1.6.32 has no stackGroup. Each series paints base→cumulative top;
      // a null inside the stack is a gap for that series only (uPlot gap semantics) and contributes 0 below.
      stackBases = ys.map(c => c.map(() => null))
      for (let i = 0; i < order.length; i++) {
        let run = 0
        for (let s = 0; s < ys.length; s++) {
          const v = ys[s][i]
          if (v === null) continue
          stackBases[s][i] = run
          ys[s][i] = run = run + v
        }
      }
    }
    let orderOut = order, ysOut = ys, basesOut = stackBases
    if (opts.sortDesc && order.length > 1) {
      // E16: categories stay LABEL-KEYED; order = summed |value| desc (tie → first-appearance).
      const score = order.map((_, i) => rawYs.reduce((sum, col) => sum + Math.abs(col[i] ?? 0), 0))
      const seq = order.map((_, i) => i).sort((a, b) => score[b] - score[a] || a - b)
      orderOut = seq.map(i => order[i]); ysOut = ys.map(col => seq.map(i => col[i]))
      basesOut = stackBases ? stackBases.map(col => seq.map(i => col[i])) : undefined
    }
    const out = { ok: true, data: [orderOut.map((_, i) => i), ...ysOut], labels, xAxisIsTime: false, xLabels: orderOut, points }
    if (basesOut) out.stackBases = basesOut
    return out
  }

  if (kind === 'line' || kind === 'area') {
    const parsed = ss.map(s => s.data.map(p => (p && typeof p === 'object') ? { x: parseX(p.x), y: isNum(p.y) ? p.y : null } : null).filter(p => p && p.x))
    const allX = parsed.flat().map(p => p.x)
    if (allX.length === 0) return empty('no plottable x values')
    const xAxisIsTime = allX.every(p => p.time)
    if (!xAxisIsTime && allX.some(p => p.time)) return empty('mixed date and numeric x values')
    const xs = [...new Set(allX.map(p => p.v))].sort((a, b) => a - b)
    const pos = new Map(xs.map((x, i) => [x, i]))
    let points = 0
    const ys = parsed.map(ps => {
      const col = new Array(xs.length).fill(null)
      for (const p of ps) { col[pos.get(p.x.v)] = p.y; if (p.y !== null) points++ }
      return col
    })
    if (points === 0) return empty('all y values are null')
    const out = { ok: true, data: [xs, ...ys], labels, xAxisIsTime, points }
    if (kind === 'area' && opts.stack) {
      // Same custom stacking as bar (S7): cumulative columns; null → gap contributing 0 to series below.
      const bases = ys.map(c => c.map(() => null))
      const run = new Array(xs.length).fill(0)
      for (let s = 0; s < ys.length; s++) {
        for (let i = 0; i < xs.length; i++) {
          const v = ys[s][i]
          if (v === null) continue
          bases[s][i] = run[i]
          ys[s][i] = run[i] = run[i] + v
        }
      }
      out.stackBases = bases
    }
    return out
  }

  if (kind === 'waterfall') {
    // Label-union order reuses bar's first-appearance rule; the running baseline is COMPUTED here (L6).
    const order = []
    const idx = new Map()
    for (const s of ss) for (const p of s.data) {
      const l = p && p.label != null ? String(p.label) : null
      if (l === null || idx.has(l)) continue
      idx.set(l, order.length); order.push(l)
    }
    if (order.length === 0) return empty('no labelled steps')
    let points = 0
    const steps = [], bases = [], tops = [], totals = [], roles = []
    for (const s of ss) {
      const st = new Array(order.length).fill(null)
      const tt = new Array(order.length).fill(false)
      for (const p of s.data) {
        if (!p || p.label == null) continue
        const i = idx.get(String(p.label))
        if (i === undefined) continue
        // total:true bars render even with value omitted/null — the renderer owns the sum (L6), the
        // author never hand-computes it; a plain step without a finite value stays a gap.
        const isTotal = p.total === true
        if (!isNum(p.value) && !isTotal) continue
        st[i] = isNum(p.value) ? p.value : null
        tt[i] = isTotal
      }
      const bs = new Array(order.length).fill(null)
      const tp = new Array(order.length).fill(null)
      const rl = new Array(order.length).fill(null)
      let run = 0
      let firstIdx = -1                            // review #16 finding 4: the SERIES' own first non-gap index
      for (let i = 0; i < order.length; i++) {
        const v = st[i]
        if (v === null && !tt[i]) continue            // missing step: gap; running total unchanged
        points++
        const isFirst = firstIdx === -1
        if (isFirst) firstIdx = i
        if (tt[i]) {
          // #15 opening anchor: total:true + a numeric value as the FIRST point of THIS series
          // pins 0→value and RESETS the running total to that value (the walk starts from the
          // authored opening, the value is still never a hand-computed cumulative — L6). Later
          // totals keep pinning 0→run and ignore `value`, exactly as before (old cards unchanged).
          if (isFirst && isNum(v)) { bs[i] = 0; tp[i] = run = v }
          else { bs[i] = 0; tp[i] = run }             // total bar: pinned 0 → cumulative
          rl[i] = 'total'
        } else { bs[i] = run; tp[i] = run = run + v; rl[i] = v < 0 ? 'down' : 'up' }  // step: base → base+value (across zero fine; test pins it)
      }
      steps.push(st); totals.push(tt); bases.push(bs); tops.push(tp); roles.push(rl)
    }
    if (points === 0) return empty('all waterfall values are null')
    const out = { ok: true, data: [order.map((_, i) => i), ...tops], labels, xAxisIsTime: false, xLabels: order, points }
    out.wf = { steps, bases, tops, totals, roles }
    return out
  }

  if (kind === 'range') {
    // Categorical like bar; a rect per series spans low→high. Both endpoints required together;
    // any non-finite endpoint renders as unavailable — NEVER a midpoint (L1).
    const order = []
    const idx = new Map()
    for (const s of ss) for (const p of s.data) {
      const l = p && p.label != null ? String(p.label) : null
      if (l === null || idx.has(l)) continue
      idx.set(l, order.length); order.push(l)
    }
    if (order.length === 0) return empty('no labelled ranges')
    let points = 0
    const lows = [], highs = []
    for (const s of ss) {
      const lo = new Array(order.length).fill(null)
      const hi = new Array(order.length).fill(null)
      for (const p of s.data) {
        if (!p || p.label == null) continue
        const i = idx.get(String(p.label))
        if (i === undefined) continue
        if (isNum(p.low) && isNum(p.high)) { lo[i] = p.low; hi[i] = p.high; points++ }
        else { lo[i] = null; hi[i] = null }   // one endpoint missing → BOTH cells render unavailable, never a midpoint (L1)
      }
      lows.push(lo); highs.push(hi)
    }
    if (points === 0) return empty('all range values are null')
    const allLo = lows.flat().filter(isNum); const allHi = highs.flat().filter(isNum)
    return { ok: true, data: [order.map((_, i) => i), ...highs], labels, xAxisIsTime: false, xLabels: order, points, lows, highs, rLo: Math.min(...allLo), rHi: Math.max(...allHi) }
  }

  if (kind === 'scatter') {
    const rows = []
    ss.forEach((s, si) => { for (const p of s.data) if (p && isNum(p.x) && isNum(p.y)) rows.push({ x: p.x, y: p.y, si, label: typeof p.label === 'string' ? p.label : null }) })
    if (rows.length === 0) return empty('no numeric (x, y) pairs')
    rows.sort((a, b) => a.x - b.x)
    const xs = rows.map(r => r.x)
    const ys = ss.map((_, si) => rows.map(r => (r.si === si ? r.y : null)))
    const pointLabels = rows.map(r => r.label)
    return { ok: true, data: [xs, ...ys], labels, xAxisIsTime: false, pointLabels, points: rows.length }
  }

  // histogram
  const bins = ss.map(s => s.data.filter(b => b && isNum(b.low) && isNum(b.high) && b.high > b.low && isNum(b.count)).sort((a, b) => a.low - b.low))
  if (bins.every(b => b.length === 0)) return empty('no valid bins')
  const binBy = bins.map(bs => new Map(bs.map(b => [b.low, b])))
  const xs = [...new Set(bins.flat().map(b => b.low))].sort((a, b) => a - b)
  const pos = new Map(xs.map((x, i) => [x, i]))
  const highs = binBy.map(m => { const col = new Array(xs.length).fill(null); for (const [low, b] of m) col[pos.get(low)] = b.high; return col })
  const ys = binBy.map(m => { const col = new Array(xs.length).fill(null); for (const [low, b] of m) col[pos.get(low)] = b.count; return col })
  const xMax = Math.max(...bins.flat().map(b => b.high))
  const xMin = xs[0]
  const out = { ok: true, data: [xs, ...ys], labels, xAxisIsTime: false, highs, binCount: bins[0].length, xMax, xMin, points: bins.flat().length }
  // E16 histogram half: uPlot needs x ascending, so the plot stays bin-ordered and sortDesc reorders
  // the DataAlt rows only — categories stay label-keyed (DataAlt + axis labels follow).
  if (opts.sortDesc && xs.length > 1) {
    const score = xs.map(low => binBy.reduce((sum, m) => sum + (m.has(low) ? Math.abs(m.get(low).count) : 0), 0))
    out.altOrder = xs.map((_, i) => i).sort((a, b) => score[b] - score[a] || xs[a] - xs[b])
  }
  return out
}

// Custom series path: one rect per bin from low (xs[i]) to highs[i], baseline 0. Handles non-uniform bins.
function histogramPaths(highs) {
  return (u, sidx, i0, i1) => {
    const p = new Path2D()
    const xs = u.data[0]; const ys = u.data[sidx]
    const y0 = u.valToPos(0, 'y', true)
    for (let i = i0; i <= i1; i++) {
      if (isNullish(ys[i]) || isNullish(highs[i])) continue
      const l = u.valToPos(xs[i], 'x', true); const r = u.valToPos(highs[i], 'x', true); const t = u.valToPos(ys[i], 'y', true)
      p.rect(Math.min(l, r), Math.min(t, y0), Math.max(Math.abs(r - l), 1), Math.abs(y0 - t))
    }
    return { stroke: p, fill: p, clip: null, band: null, gaps: null, flags: 0 }
  }
}

// #15 value-label geometry pins and the ONE formatter call site for waterfall value labels
// (maintainer directive, 2026-09-28): every label text goes through the shared formatMetric —
// when the repo-wide smart-defaults formatter lands, only fmtWfValue changes. Sign prefix is
// added AROUND the formatter result (formatter stays unit/number-formatting owner).
const WF_LABEL_HALF_PER_CHAR = 2.75   // half-width estimate per char at the 11px canvas font
const WF_LABEL_HALF_PAD = 2            // half-width glyph bleed beyond the char estimate
const WF_LABEL_MIN_SLOT = 24           // bar slot narrower than this px → labels skipped entirely
const WF_LABEL_GAP = 5                 // label baseline sits this many px above the bar top
function fmtWfValue(v, unit, signed) {
  const out = formatMetric(v, { unit })
  if (out == null) return null
  return signed && v > 0 ? '+' + out : out
}

// Key banner geometry constants: the ONLY width formula for the key. keyLayout sums the
// per-item widths and drawWaterfallPlan walks the same per-item increments, so the space
// reserved for placement always equals the banner actually drawn (review #16 round 2, F1).
const KEY_SWATCH = 10, KEY_TEXT_GAP = 13, KEY_ITEM_TAIL = 12, KEY_PX_PER_CHAR = 5.5
export function keyLayout(pr, key) {
  let x = 0; const items = []
  for (const e of (key || [])) {
    items.push({ x, label: e.label, color: e.color })
    x += KEY_TEXT_GAP * pr + e.label.length * KEY_PX_PER_CHAR * pr + KEY_ITEM_TAIL * pr
  }
  // No trailing gap after the last label; an empty key (multi-series mode) reserves 0.
  return { items, width: items.length ? x - KEY_ITEM_TAIL * pr : 0 }
}

/**
 * Pure waterfall layout plan for the #15 canvas painter (testable without a canvas):
 * bar rects, top→next-base connectors, width-aware value labels, and the
 * Increase/Decrease/Total key. `u` is any uPlot-like exposing valToPos + series visibility.
 * Maintainer ruling (review #16 round 2, F3): role colouring + key are for SINGLE-SERIES
 * waterfalls only; two or more series keep main's per-series fills and the uPlot series
 * legend (this is exactly pre-#15 main behaviour for multi-series). Value labels and
 * connectors draw in BOTH modes.
 */
export function waterfallPlan(u, model, props, colors) {
  const wf = model.wf
  const n = model.data[0].length
  const seriesCount = Math.max(1, model.labels.length)
  const group = 0.8, slot = group / seriesCount
  // px-per-x-unit over the categorical range [-0.5, n-0.5] (same convention as floatingRectPaths).
  const pxPerUnit = (u.valToPos(n - 0.5, 'x', true) - u.valToPos(-0.5, 'x', true)) / Math.max(1, n)
  const unit = typeof props.unit === 'string' && props.unit ? props.unit : ''
  const wfFill = (role) => (colors.wf && colors.wf[role]) || FALLBACK[WF_ROLE_TOKENS[role]] || '#888'
  // F3 ruling: role fills + key are single-series only; multi-series keeps main's
  // per-series colour, the exact expression buildOpts uses for s.fill / legend swatches.
  const single = model.labels.length <= 1
  const seriesFill = (s) => (colors.series && colors.series[s % colors.series.length]) || FALLBACK[SERIES_TOKENS[s % SERIES_TOKENS.length]]
  const bars = [], connectors = [], labels = [], labelCandidates = []
  const shown = (s) => !u.series || !u.series[s + 1] || u.series[s + 1].show !== false
  for (let s = 0; s < model.labels.length; s++) {
    if (!shown(s)) continue
    const bases = wf.bases[s], tops = wf.tops[s], rolesCol = wf.roles[s], stepsCol = wf.steps[s], totalsCol = wf.totals[s]
    const l0 = (i) => u.valToPos(i, 'x', true) + (s * slot - group / 2) * pxPerUnit   // left edge of bar i's slot
    for (let i = 0; i < n; i++) {
      const top = tops[i], base = bases[i]
      if (isNullish(top) || isNullish(base)) continue
      const l = l0(i)
      const t = u.valToPos(top, 'y', true), b = u.valToPos(base, 'y', true)
      const role = rolesCol[i] || 'up'
      // F3 ruling (review #16 round 2): single-series → role fills; two or more series →
      // main's per-series fill (same expression as buildOpts' s.fill = color), so every
      // bar's colour equals its uPlot legend swatch.
      const fill = single ? wfFill(role) : seriesFill(s)
      bars.push({ x: l, y: Math.min(t, b), w: Math.max(slot * pxPerUnit, 1), h: Math.max(Math.abs(b - t), 1), role, fill })
    }
    // Connector: bar i's running level (its top) → the level bar i+1 rests at. A total bar's
    // walk level is its VALUE (top), not the pinned-to-zero base artifact.
    const walkLevel = (i) => (totalsCol[i] ? tops[i] : bases[i])
    for (let i = 0; i < n - 1; i++) {
      if (isNullish(tops[i]) || isNullish(bases[i]) || isNullish(tops[i + 1]) || isNullish(bases[i + 1])) continue
      const lvA = tops[i], lvB = walkLevel(i + 1)
      if (isNullish(lvA) || isNullish(lvB)) continue
      const x1 = u.valToPos(i, 'x', true) + (s * slot - group / 2 + slot) * pxPerUnit   // right edge of bar i's slot
      const x2 = u.valToPos(i + 1, 'x', true) + (s * slot - group / 2) * pxPerUnit      // left edge of bar i+1's slot
      if (!(x2 > x1)) continue
      connectors.push({ x1, x2, y1: u.valToPos(lvA, 'y', true), y2: u.valToPos(lvB, 'y', true) })
    }
    // Value labels: signed step on step bars, renderer-computed running value on total bars.
    // Skipped entirely when bars are too narrow. Review #16 finding 2: each label rides its
    // SERIES' bar-slot centre (the floatingRectPaths geometry), not the shared category
    // centre, and candidates from ALL series are gathered first so the overlap walk below
    // runs across every series together.
    if (slot * pxPerUnit >= WF_LABEL_MIN_SLOT) {
      for (let i = 0; i < n; i++) {
        if (isNullish(tops[i]) || isNullish(bases[i])) continue
        const isTotal = totalsCol[i]
        const v = isTotal ? tops[i] : stepsCol[i]
        if (!isNum(v)) continue
        const text = fmtWfValue(v, unit, !isTotal)
        if (!text) continue
        const x = l0(i) + slot * pxPerUnit / 2                       // bar-slot centre
        const half = text.length * WF_LABEL_HALF_PER_CHAR + WF_LABEL_HALF_PAD
        const topEdge = u.valToPos(Math.max(tops[i], bases[i]), 'y', true)   // visually upper edge (y grows down)
        labelCandidates.push({ x, y: topEdge - WF_LABEL_GAP, text, color: colors.text || FALLBACK['--ui-text-secondary'], half })
      }
    }
  }
  // One overlap walk across ALL series (sorted left→right): a label survives only if it
  // clears the previously kept label, whatever series it came from.
  labelCandidates.sort((a, b) => a.x - b.x)
  let lastX = -Infinity, lastHalf = 0
  for (const c of labelCandidates) {
    if (c.x - lastX < c.half + lastHalf) continue
    labels.push({ x: c.x, y: c.y, text: c.text, color: c.color })
    lastX = c.x; lastHalf = c.half
  }
  // F3 ruling: the role key belongs to the single-series mode only — with 2+ series the
  // bars carry per-series colours and the uPlot series legend is the correct key.
  const key = single ? WF_ROLE_ORDER.map((role) => ({ color: wfFill(role), label: WF_ROLE_LABELS[role] })) : []
  return { bars, connectors, labels, key }
}

// opts.hooks.draw painter for waterfall (bars get their role-coded fills here, so the
// series path paints nothing). Consumes ONLY waterfallPlan output. Coordinates are canvas
// device px (uPlot convention: valToPos(..., true) and a manual pxRatio, no ctx.setTransform).
export function drawWaterfallPlan(u, plan) {
  const ctx = u && u.ctx
  if (!ctx || !plan || !ctx.canvas) return
  const pr = (u.width && ctx.canvas.width) ? ctx.canvas.width / u.width : 1
  ctx.save && ctx.save()
  ctx.strokeStyle = plan.strokeStyle
  ctx.lineWidth = Math.max(1, pr)
  ctx.setLineDash && ctx.setLineDash([3 * pr, 3 * pr])
  ctx.beginPath && ctx.beginPath()
  for (const c of plan.connectors) { ctx.moveTo && ctx.moveTo(c.x1, c.y1); ctx.lineTo && ctx.lineTo(c.x2, c.y2) }
  ctx.stroke && ctx.stroke()
  ctx.setLineDash && ctx.setLineDash([])
  for (const b of plan.bars) { ctx.fillStyle = b.fill; ctx.fillRect && ctx.fillRect(b.x, b.y, b.w, b.h) }
  ctx.font = `${Math.round(11 * pr)}px system-ui, sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
  for (const l of plan.labels) { ctx.fillStyle = l.color; ctx.fillText && ctx.fillText(l.text, l.x, l.y) }
  // Key banner: Increase / Decrease / Total (single-series only; plan.key is empty for
  // multi-series), positioned FROM THE PLOT BOX (review #16 finding 1): canvas-absolute
  // 6*pr/12*pr put the swatches in the y-axis gutter (size ~56) and ran the banner over
  // the opening bar's value label. Simple headroom check: if the tallest bar's top label
  // area reaches into the left-aligned banner band, draw the banner at the top-RIGHT of
  // the plot box instead (still inside the box). Round 2 fix (F1): the reserved width is
  // keyLayout()'s width — the SAME per-item sum the loop below draws — so the right-edge
  // fallback can never push the last label past bbox.right the way the old KEY_W=165pr did.
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  const bbox = u.bbox
  const keyTop = (bbox ? bbox.top : 0) + 12 * pr
  const KEY_H = 14 * pr
  const layout = keyLayout(pr, plan.key)
  const KEY_W = layout.width
  const boxLeft = (bbox ? bbox.left : 0) + 6 * pr
  const boxRight = bbox ? bbox.left + bbox.width : (ctx.canvas.width / pr)
  let keyLeft = boxLeft
  if (bbox) {
    let under = false
    for (const b of plan.bars) {
      if (b.y > keyTop - 5 * pr + KEY_H) continue                    // bar top sits below the banner band (y grows down)
      if (b.x + b.w >= boxLeft && b.x <= boxLeft + KEY_W) { under = true; break }
    }
    if (under) keyLeft = Math.max(boxLeft, boxRight - 6 * pr - KEY_W)
  }
  const keyOrigin = plan.keyLeft != null ? plan.keyLeft : keyLeft
  for (const item of layout.items) {
    const kx = keyOrigin + item.x
    ctx.fillStyle = item.color
    ctx.fillRect && ctx.fillRect(kx, keyTop - 5 * pr, KEY_SWATCH * pr, KEY_SWATCH * pr)
    ctx.fillStyle = plan.keyTextColor
    ctx.fillText && ctx.fillText(item.label, kx + KEY_TEXT_GAP * pr, keyTop)
  }
  ctx.restore && ctx.restore()
}

// Shared geometry for the floating-rect kinds (waterfall, range): one rect per category from
// bases[i]→tops[i] on the y-scale, series i occupying slot i of a 0.8-wide group centred on each
// integer x (same slot math as groupedBarsPaths, drawn directly like histogramPaths).
function floatingRectPaths(seriesCount, seriesPos, basesOf) {
  const group = 0.8; const slot = group / seriesCount
  return (u, sidx, i0, i1) => {
    const p = new Path2D()
    const bases = basesOf[sidx - 1] || basesOf[0]
    const ys = u.data[sidx]   // tops (cumulative top / high endpoint) live in the uPlot data itself
    const xs = u.data[0]
    const n = Math.max(1, xs.length)
    // px-per-x-unit over the categorical range [-0.5, n-0.5] (matches buildOpts scales.x.range).
    const pxPerUnit = (u.valToPos(n - 0.5, 'x', true) - u.valToPos(-0.5, 'x', true)) / n
    for (let i = i0; i <= i1; i++) {
      const top = ys[i]
      if (isNullish(top) || isNullish(bases[i])) continue
      const centre = u.valToPos(xs[i], 'x', true)
      const l = centre + (seriesPos * slot - group / 2) * pxPerUnit
      const t = u.valToPos(top, 'y', true); const b = u.valToPos(bases[i], 'y', true)
      p.rect(l, Math.min(t, b), Math.max(slot * pxPerUnit, 1), Math.max(Math.abs(b - t), 1))
    }
    return { stroke: p, fill: p, clip: null, band: null, gaps: null, flags: 0 }
  }
}

// Grouped bars: series i occupies slot i of a 0.8-wide group centred on each integer x.
function groupedBarsPaths(seriesCount, seriesPos) {
  const group = 0.8; const slot = group / seriesCount
  return uPlot.paths.bars({
    size: [1, 100, 1],
    disp: {
      x0: { unit: 1, values: (u) => u.data[0].map(x => x - group / 2 + seriesPos * slot) },
      size: { unit: 1, values: (u) => u.data[0].map(() => slot) }
    }
  })
}

function readToken(el, name) {
  try {
    if (el && typeof getComputedStyle === 'function') {
      const v = getComputedStyle(el).getPropertyValue(name).trim()
      if (v) return v
    }
  } catch { /* jsdom / detached */ }
  return FALLBACK[name] || '#888'
}

function zeroBaseline(u, min, max) { return [Math.min(0, min), Math.max(0, max)] }

export function buildOpts(kind, model, props, width, colors) {
  const { data, labels, xAxisIsTime } = model
  const unit = typeof props.unit === 'string' && props.unit ? props.unit : ''
  const yLabel = [props.yLabel, unit ? `(${unit})` : ''].filter(Boolean).join(' ')
  const axisBase = { stroke: colors.text, grid: { stroke: colors.grid, width: 1 }, ticks: { stroke: colors.grid, width: 1 }, font: '11px system-ui, sans-serif', labelFont: '12px system-ui, sans-serif', labelSize: 20 }
  const xAxis = { ...axisBase, label: props.xLabel || undefined }
  const yAxis = { ...axisBase, label: yLabel || undefined, size: 56 }
  const scales = { x: { time: (kind === 'line' || kind === 'area') && xAxisIsTime } }
  const categorical = kind === 'bar' || kind === 'waterfall' || kind === 'range'
  if (categorical) {
    const n = data[0].length
    scales.x.range = () => [-0.5, n - 0.5]
    xAxis.splits = () => data[0].slice()
    xAxis.values = (u, splits) => splits.map(i => (Number.isInteger(i) && model.xLabels[i] != null ? model.xLabels[i] : ''))
    // Rotate category labels when the average slot is narrower than the longest label (~6.5px/char at 11px).
    const longest = model.xLabels.reduce((m, l) => Math.max(m, String(l ?? '').length), 0)
    const slot = (Math.max(160, Math.floor(width)) - 64) / Math.max(1, n)
    if (longest * 6.5 > slot) { xAxis.rotate = -35; xAxis.size = Math.min(110, 30 + longest * 4) }
    // waterfall/range float off the zero line; range pins its y domain to the endpoint envelope.
    scales.y = { range: kind === 'range' ? () => [model.rLo, model.rHi] : zeroBaseline }
  } else if (kind === 'histogram') {
    // xMin is the global min bin low regardless of sortDesc row order (uPlot re-sorts numeric x itself).
    scales.x.range = () => [model.xMin, model.xMax]
    scales.y = { range: zeroBaseline }
  } else if (kind === 'area') {
    // Fill runs toward zero — pin zero inside the y domain so mixed-sign series split at the axis (S/F risk).
    scales.y = { range: zeroBaseline }
  }
  const series = [{ label: props.xLabel || ((kind === 'line' || kind === 'area') && xAxisIsTime ? 'time' : 'x') }]
  const stacked = !!model.stackBases && (kind === 'bar' || kind === 'area')
  labels.forEach((label, i) => {
    const color = colors.series[i % colors.series.length]
    const s = { label: label + (unit ? ` (${unit})` : ''), stroke: color, width: 2, scale: 'y' }
    if (kind === 'bar') {
      // S7: stacked bars paint renderer-computed base→cumulative-top rects (single full slot, no uPlot stackGroup).
      if (stacked) { s.paths = floatingRectPaths(1, 0, model.stackBases); s.fill = color }
      else { s.paths = groupedBarsPaths(labels.length, i); s.fill = color }
      s.width = 0; s.points = { show: false }
    }
    else if (kind === 'histogram') { s.paths = histogramPaths(model.highs[i]); s.fill = color; s.width = 0; s.points = { show: false } }
    else if (kind === 'scatter') { s.paths = () => null; s.points = { show: true, size: 7, fill: color, stroke: color, width: 1 } }
    else if (kind === 'waterfall') {
      // #15 / F3 ruling: single-series bars are painted per sign-role by the draw hook
      // below (three fills + connectors + value labels + key); multi-series bars keep
      // main's per-series fill painted by the hook too (exactly pre-#15 main geometry).
      // The series path itself paints nothing, and the legend swatch is neutralised (see
      // opts.legend.markers below) only in single-series mode so no legend shows a colour
      // no bar uses.
      s.paths = () => ({ stroke: null, fill: null, clip: null, band: null, gaps: null, flags: 0 })
      s.fill = color; s.width = 0; s.points = { show: false }
    }
    else if (kind === 'range') { s.paths = floatingRectPaths(labels.length, i, model.lows); s.fill = color; s.width = 0; s.points = { show: false } }
    else if (kind === 'area') {
      // Fill toward zero: uPlot's seriesFillTo returns 0 on a linear scale; withAlpha keeps the
      // series color at AREA_FILL_ALPHA off the FALLBACK/SERIES_TOKENS palette (L7).
      s.spanGaps = false; s.points = { show: false }; s.fill = withAlpha(color)
    }
    else {
      s.spanGaps = false; s.points = { show: data[0].length <= 40, size: 5, fill: color }
      // N11/S8: value holds until the next observation (align: 1); no extension past the last point (extend: false).
      if (props.stepped === true) s.paths = uPlot.paths.stepped({ align: 1, extend: false })
    }
    series.push(s)
  })
  return {
    width: Math.max(160, Math.floor(width)),
    height: clampHeight(props.height),   // F1: props.height clamped 120..480, default 240
    scales, series,
    axes: [xAxis, yAxis],
    cursor: { show: true, x: true, y: true, drag: { x: false, y: false, setScale: false }, points: { show: true } },
    legend: { show: true, live: false,
      // F3 ruling: in single-series waterfall mode the bars carry role colours, so the
      // uPlot series swatch must not show the (unused) SERIES_TOKENS colour — width 0
      // drops the border, fill paints the neutral --ui-text-secondary the key/labels use.
      // Multi-series keeps the default markers: legendFill = s.fill = the bar fill below.
      ...(kind === 'waterfall' && labels.length === 1
        ? { markers: { width: () => 0, dash: 'solid', stroke: 'transparent', fill: () => colors.text || FALLBACK['--ui-text-secondary'] } }
        : {}) },
    // #15: waterfall paints its role-coded bars, connectors, value labels and key here —
    // after uPlot's own draw pass, from the pure waterfallPlan(u, ...) layout.
    ...(kind === 'waterfall' ? { hooks: { draw: [(u) => {
      try {
        const plan = waterfallPlan(u, model, props, colors)
        plan.strokeStyle = colors.grid || FALLBACK['--ui-stroke-tertiary']
        plan.keyTextColor = colors.text || FALLBACK['--ui-text-secondary']
        drawWaterfallPlan(u, plan)
      } catch { /* a canvas-side failure must never blank the chart */ }
    }] } } : {})
  }
}

const S = {
  box: { display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ui-text-primary)', fontSize: 13, minWidth: 0, margin: 0 },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { fontWeight: 600, color: 'var(--ui-text-primary)' },
  toggle: (on) => ({ font: 'inherit', fontSize: 11, padding: '2px 8px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--ui-stroke-secondary)', background: on ? 'var(--ui-bg-tertiary)' : 'var(--ui-bg-elevated)', color: 'var(--ui-text-secondary)' }),
  caveat: { color: 'var(--ui-text-tertiary)', fontSize: 12, whiteSpace: 'pre-wrap' },
  caption: { color: 'var(--ui-text-tertiary)', fontSize: 11 },
  nodata: { border: '1px dashed var(--ui-stroke-tertiary)', borderRadius: 8, padding: 16, color: 'var(--ui-text-tertiary)', background: 'var(--ui-bg-tertiary)', textAlign: 'center' },
  host: { width: '100%', minHeight: HEIGHT, overflow: 'hidden' },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 12 },
  th: { textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--ui-stroke-secondary)', color: 'var(--ui-text-secondary)', fontWeight: 600 },
  td: { padding: '3px 8px', borderBottom: '1px solid var(--ui-stroke-tertiary)', color: 'var(--ui-text-primary)', fontVariantNumeric: 'tabular-nums' },
  unavailable: { color: 'var(--ui-text-tertiary)', fontStyle: 'italic' }
}

function fmtX(model, x) {
  if (model.xAxisIsTime) { const d = new Date(x * 1000); return Number.isNaN(d.getTime()) ? String(x) : d.toISOString() }
  return String(x)
}

function fmtCell(v) {
  return isNullish(v) ? h('span', { style: S.unavailable }, 'unavailable') : String(v)
}

// h(type, props, children, key): jsx/jsxs take children inside props; arrays go through jsxs.
function h(type, props, children, key) {
  const p = children === undefined ? props : { ...props, children }
  return Array.isArray(children) ? jsxs(type, p, key) : jsx(type, p, key)
}

// Accessibility alternative: the same series as a plain <table>.
function DataAlt({ kind, model, props }) {
  const { data, labels } = model
  const xs = data[0]
  // E16: histogram sortDesc reorders the rows (uPlot keeps x ascending on the canvas itself).
  const rowIdx = model.altOrder ? model.altOrder : xs.map((_, i) => i)
  const header = kind === 'histogram'
    ? ['low', 'high', ...labels]
    : kind === 'range'
      ? ['label', ...labels.flatMap(l => [`${l} low`, `${l} high`])]
      : kind === 'waterfall'
        ? ['label', ...labels.flatMap(l => [`${l} value`, `${l} total`])]
        : [props.xLabel || (kind === 'bar' || kind === 'waterfall' || kind === 'range' ? 'label' : 'x'), ...labels]
  const rows = rowIdx.map(i => {
    const x = xs[i]
    if (kind === 'histogram') {
      const high = model.highs.map(hh => hh[i]).find(v => !isNullish(v))
      return [String(x), fmtCell(high), ...labels.map((_, s) => fmtCell(data[s + 1][i]))]
    }
    if (kind === 'range') {
      // BOTH endpoints are shown — never a collapsed midpoint (L1/S3).
      return [model.xLabels[i], ...labels.flatMap((_, s) => [fmtCell(model.lows[s][i]), fmtCell(model.highs[s][i])])]
    }
    if (kind === 'waterfall') {
      // value = the step the author supplied; total = the renderer-computed running position (L6).
      return [model.xLabels[i], ...labels.flatMap((_, s) => [fmtCell(model.wf.steps[s][i]), fmtCell(data[s + 1][i])])]
    }
    const xCell = kind === 'bar' ? model.xLabels[i] : fmtX(model, x)
    return [xCell, ...labels.map((_, s) => fmtCell(data[s + 1][i]))]
  })
  return h('table', { style: S.table, 'data-richui': 'chart-data' }, [
    h('thead', {}, h('tr', {}, header.map((c, i) => h('th', { scope: 'col', style: S.th }, c, `h${i}`))), 'head'),
    h('tbody', {}, rows.map((cells, r) => h('tr', {}, cells.map((c, ci) => h('td', { style: S.td }, c, `c${ci}`)), `r${r}`)), 'body')
  ])
}

function UplotHost({ kind, model, props, propsKey, height }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !model.ok) return undefined
    const colors = {
      series: SERIES_TOKENS.map(t => readToken(el, t)),
      text: readToken(el, '--ui-text-secondary'),
      grid: readToken(el, '--ui-stroke-tertiary'),
      // #15: the three waterfall fills ride the same colour-source path as SERIES_TOKENS.
      wf: Object.fromEntries(WF_ROLE_ORDER.map(r => [r, readToken(el, WF_ROLE_TOKENS[r])]))
    }
    let u = null
    const width = () => (el.clientWidth || el.getBoundingClientRect().width || 600)
    try { u = new uPlot(buildOpts(kind, model, props, width(), colors), model.data, el) }
    catch (e) { el.textContent = 'chart engine failed: ' + (e && e.message ? e.message : String(e)); return undefined }
    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { if (u) { const w = width(); if (w > 0 && w !== u.width) u.setSize({ width: Math.floor(w), height }) } })
      ro.observe(el)
    }
    return () => { if (ro) ro.disconnect(); if (u) u.destroy(); u = null }
  }, [propsKey]) // model/props derive from propsKey (JSON.stringify of element.props)
  return h('div', { ref, style: { ...S.host, minHeight: height }, 'data-richui': 'chart-canvas' })
}

export function Chart({ element }) {
  const props = (element && element.props) || {}
  // D10: unstringifiable props (unreachable from JSON) get ONE stable key per mounted instance from a
  // counter — never Math.random(), which remounted the chart on every render with a new props identity.
  const fallbackKey = useRef(null)
  const propsKey = useMemo(() => {
    try { return JSON.stringify(props) } catch {
      if (fallbackKey.current === null) fallbackKey.current = 'unstringifiable:' + (++unstringifiableCount)
      return fallbackKey.current
    }
  }, [props])
  const kind = props.kind
  const model = useMemo(() => seriesToUplot(kind, props.series, {
    stack: props.stack === true,      // N10: bar/area only (admission gates kinds — L1 manifest); ignored elsewhere
    sortDesc: props.sortDesc === true // E16 renderer half: bar/histogram categories label-keyed, |value| desc
  }), [propsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const [showData, setShowData] = useState(false)
  const title = typeof props.title === 'string' ? props.title : ''
  const caveat = typeof props.caveat === 'string' ? props.caveat : ''
  const height = clampHeight(props.height) // F1: 120..480, default 240
  // D2: lower.mjs keeps `accessibility` INSIDE props (like every other component via common()).
  const accLabel = typeof props.accessibility?.label === 'string' && props.accessibility.label ? props.accessibility.label : ''
  const caption = kind === 'histogram' && model.ok
    ? `${model.binCount} bins (bin edges supplied by the author, not computed)`
    : (model.ok ? `${model.points} points · ${model.labels.length} series` : '')

  const children = [
    h('style', { href: UPLOT_CSS_HREF, precedence: 'default', 'data-richui-uplot-css': '1' }, UPLOT_CSS, 'css'),
    h('div', { style: S.head }, [
      h('span', { style: S.title }, [title, ownSources(props)], 't'),
      model.ok ? h('button', { type: 'button', 'aria-pressed': showData, style: S.toggle(showData), onClick: () => setShowData(v => !v) }, showData ? 'Chart' : 'Data', 'toggle') : null
    ], 'head')
  ]
  if (!model.ok) {
    children.push(h('div', { style: S.nodata, role: 'status' }, `No data to chart${model.reason ? ` (${model.reason})` : ''}.`, 'nodata'))
  } else if (showData) {
    children.push(h(DataAlt, { kind, model, props }, undefined, 'alt'))
  } else {
    children.push(h(UplotHost, { kind, model, props, propsKey, height }, undefined, 'plot'))
  }
  if (caption) children.push(h('div', { style: S.caption }, caption, 'caption'))
  if (caveat) children.push(h('div', { style: S.caveat, 'data-richui': 'chart-caveat' }, caveat, 'caveat'))
  return h('figure', { style: S.box, 'data-richui': 'chart', 'data-ru': 'Chart', 'data-kind': kind, 'data-stack': props.stack === true && (kind === 'bar' || kind === 'area') ? '1' : undefined, 'data-stepped': props.stepped === true && kind === 'line' ? '1' : undefined, 'data-sort-desc': props.sortDesc === true && (kind === 'bar' || kind === 'histogram') ? '1' : undefined, 'data-height': String(height), 'aria-label': accLabel || title || `${kind} chart` }, children)
}

export default Chart