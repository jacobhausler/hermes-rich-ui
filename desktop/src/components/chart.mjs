// Chart — ONE engine: uPlot 1.6.32 (bar | line | scatter | histogram).
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
import { ownSources } from './_shared.mjs'

const KINDS = ['bar', 'line', 'scatter', 'histogram']
const SERIES_TOKENS = ['--ui-accent', '--ui-green', '--ui-purple', '--ui-orange']
const FALLBACK = { '--ui-accent': '#3b82f6', '--ui-green': '#22c55e', '--ui-purple': '#a855f7', '--ui-orange': '#f97316',
  '--ui-text-secondary': '#9ca3af', '--ui-text-primary': '#e5e7eb', '--ui-stroke-tertiary': '#374151', '--ui-stroke-secondary': '#4b5563' }
const HEIGHT = 240
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
 */
export function seriesToUplot(kind, series) {
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
    const xs = order.map((_, i) => i)
    let points = 0
    const ys = ss.map(s => {
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
    return { ok: true, data: [xs, ...ys], labels, xAxisIsTime: false, xLabels: order, points }
  }

  if (kind === 'line') {
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
    return { ok: true, data: [xs, ...ys], labels, xAxisIsTime, points }
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
  const xs = [...new Set(bins.flat().map(b => b.low))].sort((a, b) => a - b)
  const pos = new Map(xs.map((x, i) => [x, i]))
  const highs = bins.map(bs => { const col = new Array(xs.length).fill(null); for (const b of bs) col[pos.get(b.low)] = b.high; return col })
  const ys = bins.map(bs => { const col = new Array(xs.length).fill(null); for (const b of bs) col[pos.get(b.low)] = b.count; return col })
  const xMax = Math.max(...bins.flat().map(b => b.high))
  return { ok: true, data: [xs, ...ys], labels, xAxisIsTime: false, highs, binCount: bins[0].length, xMax, points: bins.flat().length }
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
  const scales = { x: { time: kind === 'line' && xAxisIsTime } }
  if (kind === 'bar') {
    const n = data[0].length
    scales.x.range = () => [-0.5, n - 0.5]
    xAxis.splits = () => data[0].slice()
    xAxis.values = (u, splits) => splits.map(i => (Number.isInteger(i) && model.xLabels[i] != null ? model.xLabels[i] : ''))
    // Rotate category labels when the average slot is narrower than the longest label (~6.5px/char at 11px).
    const longest = model.xLabels.reduce((m, l) => Math.max(m, String(l ?? '').length), 0)
    const slot = (Math.max(160, Math.floor(width)) - 64) / Math.max(1, n)
    if (longest * 6.5 > slot) { xAxis.rotate = -35; xAxis.size = Math.min(110, 30 + longest * 4) }
    scales.y = { range: zeroBaseline }
  } else if (kind === 'histogram') {
    scales.x.range = () => [data[0][0], model.xMax]
    scales.y = { range: zeroBaseline }
  }
  const series = [{ label: props.xLabel || (xAxisIsTime ? 'time' : 'x') }]
  labels.forEach((label, i) => {
    const color = colors.series[i % colors.series.length]
    const s = { label: label + (unit ? ` (${unit})` : ''), stroke: color, width: 2, scale: 'y' }
    if (kind === 'bar') { s.paths = groupedBarsPaths(labels.length, i); s.fill = color; s.width = 0; s.points = { show: false } }
    else if (kind === 'histogram') { s.paths = histogramPaths(model.highs[i]); s.fill = color; s.width = 0; s.points = { show: false } }
    else if (kind === 'scatter') { s.paths = () => null; s.points = { show: true, size: 7, fill: color, stroke: color, width: 1 } }
    else { s.spanGaps = false; s.points = { show: data[0].length <= 40, size: 5, fill: color } }
    series.push(s)
  })
  return {
    width: Math.max(160, Math.floor(width)),
    height: HEIGHT,
    scales, series,
    axes: [xAxis, yAxis],
    cursor: { show: true, x: true, y: true, drag: { x: false, y: false, setScale: false }, points: { show: true } },
    legend: { show: true, live: false }
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
  const header = kind === 'histogram'
    ? ['low', 'high', ...labels]
    : [props.xLabel || (kind === 'bar' ? 'label' : 'x'), ...labels]
  const rows = xs.map((x, i) => {
    if (kind === 'histogram') {
      const high = model.highs.map(hh => hh[i]).find(v => !isNullish(v))
      return [String(x), fmtCell(high), ...labels.map((_, s) => fmtCell(data[s + 1][i]))]
    }
    const xCell = kind === 'bar' ? model.xLabels[i] : fmtX(model, x)
    return [xCell, ...labels.map((_, s) => fmtCell(data[s + 1][i]))]
  })
  return h('table', { style: S.table, 'data-richui': 'chart-data' }, [
    h('thead', {}, h('tr', {}, header.map((c, i) => h('th', { scope: 'col', style: S.th }, c, `h${i}`))), 'head'),
    h('tbody', {}, rows.map((cells, r) => h('tr', {}, cells.map((c, ci) => h('td', { style: S.td }, c, `c${ci}`)), `r${r}`)), 'body')
  ])
}

function UplotHost({ kind, model, props, propsKey }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !model.ok) return undefined
    const colors = {
      series: SERIES_TOKENS.map(t => readToken(el, t)),
      text: readToken(el, '--ui-text-secondary'),
      grid: readToken(el, '--ui-stroke-tertiary')
    }
    let u = null
    const width = () => (el.clientWidth || el.getBoundingClientRect().width || 600)
    try { u = new uPlot(buildOpts(kind, model, props, width(), colors), model.data, el) }
    catch (e) { el.textContent = 'chart engine failed: ' + (e && e.message ? e.message : String(e)); return undefined }
    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { if (u) { const w = width(); if (w > 0 && w !== u.width) u.setSize({ width: Math.floor(w), height: HEIGHT }) } })
      ro.observe(el)
    }
    return () => { if (ro) ro.disconnect(); if (u) u.destroy(); u = null }
  }, [propsKey]) // model/props derive from propsKey (JSON.stringify of element.props)
  return h('div', { ref, style: S.host, 'data-richui': 'chart-canvas' })
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
  const model = useMemo(() => seriesToUplot(kind, props.series), [propsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const [showData, setShowData] = useState(false)
  const title = typeof props.title === 'string' ? props.title : ''
  const caveat = typeof props.caveat === 'string' ? props.caveat : ''
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
    children.push(h(UplotHost, { kind, model, props, propsKey }, undefined, 'plot'))
  }
  if (caption) children.push(h('div', { style: S.caption }, caption, 'caption'))
  if (caveat) children.push(h('div', { style: S.caveat, 'data-richui': 'chart-caveat' }, caveat, 'caveat'))
  return h('figure', { style: S.box, 'data-richui': 'chart', 'data-ru': 'Chart', 'data-kind': kind, 'aria-label': accLabel || title || `${kind} chart` }, children)
}

export default Chart