// Sparkline — tiny inline trend strip next to a Metric (N12). One uPlot canvas, no legend,
// no axes, no chrome: the Chart engine's 240px figure is the wrong tool at 24px.
// Props arrive resolved on element.props. All scales/trend are COMPUTED here (L6) — the
// agent never pre-normalizes values or hand-picks trend arrows. null is a gap (same
// semantics as Chart line: spanGaps=false), never 0 (L1).
// Styling = inline + --ui-* only (L7); the uPlot CSS is the SAME hoisted scoped style the
// Chart ships (chart.mjs UPLOT_CSS/UPLOT_CSS_HREF), so no new <style> and no leak: every
// rule stays scoped under [data-richui="chart-canvas"], which this host also carries.
import { jsx, jsxs } from 'react/jsx-runtime'
import { useEffect, useMemo, useRef } from 'react'
import uPlot from 'uplot'
import { ownSources, type } from './_shared.mjs'
import { UPLOT_CSS, UPLOT_CSS_HREF } from './chart.mjs'

const MAX_POINTS = 512
const FALLBACK = { '--ui-accent': '#3b82f6', '--ui-green': '#22c55e', '--ui-red': '#ef4444' }
const TONE_TOKEN = { default: '--ui-accent', success: '--ui-green', danger: '--ui-red' }
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

// Pure: {values|series: (number|null)[]} -> the computed model the renderer draws.
// min/max are observed (never guessed); normalization norm(v) = (v-min)/(max-max-safe);
// a constant domain normalizes to a single 0.5 step (never divide-by-zero).
// trend: first non-null vs last non-null across the AVAILABLE pair; fewer than two
// non-null points (or all-null) => 'unavailable', never guessed (S9).
export function sparkModel(raw) {
  const values = (Array.isArray(raw) ? raw.slice(0, MAX_POINTS) : []).map(v => (isNum(v) ? v : null))
  const seen = values.filter(v => v !== null)
  const n = seen.length
  const min = n ? Math.min(...seen) : null
  const max = n ? Math.max(...seen) : null
  const constant = n > 0 && min === max
  const norm = values.map(v => (v === null ? null : constant ? 0.5 : (v - min) / (max - min)))
  const trend = n < 2 ? 'unavailable' : seen[0] === seen[n - 1] ? 'flat' : seen[0] < seen[n - 1] ? 'up' : 'down'
  return { values, min, max, constant, norm, trend, points: n }
}

const clamp = (v, lo, hi, dflt) => (isNum(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt)

// Pure: uPlot options for the tiny inline mode — single canvas, NO legend, NO axes, no cursor.
export function buildSparkOpts(model, opts) {
  const width = clamp(opts.width, 60, 400, 120)
  const height = clamp(opts.height, 14, 48, 24)
  const color = opts.color || FALLBACK['--ui-accent']
  const bar = opts.direction === 'bar'
  const xs = model.values.map((_, i) => i)
  const s = { stroke: color, fill: color, width: bar ? 0 : 2, scale: 'y', points: { show: false } }
  if (bar) s.paths = uPlot.paths.bars({ size: [0.2, 100, 1] })
  else s.spanGaps = false // null => gap, exactly like Chart line (L1/F: same semantics)
  const scales = { x: {}, y: {} }
  if (bar) {
    scales.x.range = () => [-0.5, model.values.length - 0.5]
    scales.y.range = (u, min, max) => [Math.min(0, min), Math.max(0, max)]
  } else if (model.min !== null) {
    // min→max normalization computed here; constant domain gets a 1-step band so uPlot never divides by 0
    scales.y.range = () => (model.constant ? [model.min - 0.5, model.max + 0.5] : [model.min, model.max])
  }
  return {
    width, height, scales,
    series: [{}, { ...s }],
    axes: [],
    cursor: { show: false },
    legend: { show: false },
    select: { show: false }
  }
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

// h(type, props, children, key): same local idiom as chart.mjs (never import from chart's internals beyond CSS consts).
function h(type, props, children, key) {
  const p = children === undefined ? props : { ...props, children }
  return Array.isArray(children) ? jsxs(type, p, key) : jsx(type, p, key)
}

function Host({ model, opts, propsKey }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || model.points === 0) return undefined
    const color = readToken(el, TONE_TOKEN[opts.tone] || TONE_TOKEN.default)
    let u = null
    try { u = new uPlot(buildSparkOpts(model, { ...opts, color }), [model.values.map((_, i) => i), model.values], el) }
    catch (e) { el.textContent = 'sparkline engine failed: ' + (e && e.message ? e.message : String(e)); return undefined }
    return () => { if (u) u.destroy(); u = null }
  }, [propsKey]) // model/opts derive from propsKey (JSON.stringify of element.props)
  return h('div', { ref, 'data-richui': 'chart-canvas', 'data-ru-sparkline': '1',
    style: { width: clamp(opts.width, 60, 400, 120) + 'px', height: clamp(opts.height, 14, 48, 24) + 'px', position: 'relative', flex: '0 0 auto', overflow: 'hidden' } })
}

const CHIP = { up: '▲', down: '▼', flat: '–', unavailable: '' }
const CHIP_COLOR = { up: 'var(--ui-green)', down: 'var(--ui-red)', flat: 'var(--ui-text-secondary)', unavailable: 'var(--ui-text-tertiary)' }

export function Sparkline({ element }) {
  const props = (element && element.props) || {}
  const propsKey = useMemo(() => { try { return JSON.stringify(props) } catch { return 'unstringifiable:' + (element?.id ?? '') } }, [props])
  const raw = Array.isArray(props.values) ? props.values : Array.isArray(props.series) ? props.series : []
  const model = useMemo(() => sparkModel(raw), [propsKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const opts = {
    direction: props.direction === 'bar' ? 'bar' : 'line',
    width: props.width, height: props.height,
    tone: TONE_TOKEN[props.tone] ? props.tone : 'default'
  }
  const accLabel = typeof props.accessibility?.label === 'string' && props.accessibility.label ? props.accessibility.label : 'sparkline'

  const body = model.points === 0
    ? h('span', { 'data-ru-null': '', role: 'status', style: { color: 'var(--ui-text-tertiary)', fontStyle: 'italic', ...type('caption'), alignSelf: 'center' } }, 'unavailable')
    : h(Host, { model, opts: { ...opts, color: undefined }, propsKey }, undefined, 'host')

  const children = [
    h('style', { href: UPLOT_CSS_HREF, precedence: 'default', 'data-richui-uplot-css': '1' }, UPLOT_CSS, 'css'),
    body,
    model.points === 0
      ? null
      : h('span', { 'data-ru-chip': model.trend, style: { marginLeft: 4, ...type('micro'), color: CHIP_COLOR[model.trend] }, 'aria-hidden': 'true' }, CHIP[model.trend] || 'unavailable', 'chip')
  ]
  return jsx('span', {
    style: { display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, verticalAlign: 'middle' },
    'data-ru': 'Sparkline',
    'data-ru-trend': model.trend,
    'data-ru-points': String(model.points),
    'data-ru-direction': opts.direction,
    'data-ru-min': model.min === null ? 'unavailable' : String(model.min),
    'data-ru-max': model.max === null ? 'unavailable' : String(model.max),
    role: 'img',
    'aria-label': accLabel + ': ' + model.points + ' points, trend ' + model.trend,
    children
  })
}

export default Sparkline
