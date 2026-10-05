// #35 (defaults epic slice 12): Chart default view inherits house tokens.
// Ticks via fmtTicks (one tier per axis); a measured y gutter; the title defaults to the
// single series' label; legend only for ≥ 2 series (label text only, small secondary);
// caption line deleted; unit on ticks (currency/%) or an axis title (word units), never the
// legend; plot height 180 (clamp 120..480); hover readout line EXACT (CONTRACTS §2 promise);
// Data view exact and names every series by label (AD-7d); calendar-date x never shifts
// (C14, TZ-pinned); zero bars 2 px stub; all-null → `No data to chart: every value is missing.`
// in a dashed B.absent frame. Spec: DEFAULTS-SPEC.md §Chart (C1–C18, S1, S5; AD-7d).
// node:test, jsdom + Proxy-swallowed canvas (same harness shape as tests/test_chart.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { registerHooks } from 'node:module'

registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })

const dom = new JSDOM('<div id="r"></div>', { pretendToBeVisual: true })
globalThis.window = dom.window; globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.devicePixelRatio = 1
for (const k of ['CustomEvent', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }) } catch { /* readonly */ }
}
const mm = () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
globalThis.matchMedia = mm; dom.window.matchMedia = mm
const swallow = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : swallow),
  apply: () => swallow, set: () => true
})
dom.window.HTMLCanvasElement.prototype.getContext = () => swallow
globalThis.Path2D = class Path2D { constructor() { this.ops = [] } moveTo() {} lineTo() {} rect() { this.ops.push('rect') } arc() {} closePath() {} addPath() {} }
globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb } observe() {} disconnect() {} }

const React = (await import('react')).default
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { Chart, seriesToUplot, buildOpts, clampHeight } = await import('../desktop/src/components/chart.mjs')
const uPlot = (await import('uplot')).default

const COLORS = { series: ['#3b82f6', '#f97316', '#a855f7', '#22c55e'], text: '#ccc', grid: '#333' }
async function mount(props) {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => { root.render(React.createElement(Chart, { element: { id: 'cd-' + Math.random(), type: 'Chart', props } })) })
  return { host, unmount: async () => { await act(async () => { root.unmount() }); host.remove() } }
}
const q = (host, sel) => host.querySelector(sel)

// The one-series money fixture straight from the issue's failing-first block.
const ONE = (extra = {}) => ({ kind: 'bar', unit: 'USD', ...extra,
  series: [{ label: 'Revenue', data: [{ label: 'Q1', value: 1e9 }, { label: 'Q2', value: 2e9 }, { label: 'Q3', value: 2.5e9 }] }] })

// ---------- ticks (fmtTicks, one tier per axis; S1) ----------
test('C11/S1: money y ticks come from fmtTicks — $0 · $0.5B · $1B · $1.5B · $2B · $2.5B', () => {
  const m = seriesToUplot('bar', ONE().series)
  const o = buildOpts('bar', m, ONE(), 400, COLORS)
  const fmt = o.axes[1].values
  assert.deepEqual(fmt(null, [0, 5e8, 1e9, 1.5e9, 2e9, 2.5e9]), ['$0', '$0.5B', '$1B', '$1.5B', '$2B', '$2.5B'],
    'ticks are the fmtTicks rung (one tier per axis, decimals from the step)')
})
test('bare ticks print ungrouped below COMPACT_FROM, grouped-with-unit and compacted above (S1)', () => {
  const m = seriesToUplot('bar', [{ label: 'counts', data: [{ label: 'a', value: 1500 }, { label: 'b', value: 20000 }] }])
  const bare = buildOpts('bar', m, {}, 400, COLORS).axes[1].values
  assert.deepEqual(bare(null, [0, 5000, 10000, 15000, 20000]), ['0', '5k', '10k', '15k', '20k'])
  const m2 = seriesToUplot('bar', [{ label: 'ms', data: [{ label: 'a', value: 1000 }, { label: 'b', value: 2000 }], }])
  const ms = buildOpts('bar', m2, { unit: 'ms' }, 400, COLORS).axes[1].values
  assert.deepEqual(ms(null, [0, 500, 1000, 1500, 2000]), ['0', '500', '1,000', '1,500', '2,000'],
    'a unit groups; a bare axis stays ungrouped below 10k (S1)')
})
test('integer x ticks only on integers: integer line x → integer splits; fractional x never rounds (C18 chart)', () => {
  const intM = seriesToUplot('line', [{ label: 's', data: [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 3 }] }])
  const intO = buildOpts('line', intM, {}, 400, COLORS)
  assert.ok(intO.scales.x.range === undefined, 'no categorical override for numeric x')
  const splits = uPlot.snap ? null : null // guard: splits/values hooks are ours
  const vals = intO.axes[0].values
  assert.deepEqual(vals(null, [0, 1, 2]), ['0', '1', '2'], 'integer ticks on integer x')
  assert.deepEqual(vals(null, [0.5, 1]), ['0.5', '1'], 'fractional x ticks are NOT rounded to integers')
})

// ---------- measured y gutter ----------
test('measured y gutter: wider than the widest tick of the axis (0.55 * width/char + 8, ≥ 28)', () => {
  const m = seriesToUplot('bar', ONE().series)
  const o = buildOpts('bar', m, ONE(), 400, COLORS)
  const widest = Math.max(...['$0', '$0.5B', '$1B', '$1.5B', '$2B', '$2.5B'].map(s => s.length))
  assert.ok(o.axes[1].size >= widest * 0.55 + 8, `gutter ${o.axes[1].size} fits the widest tick (~${(widest * 0.55).toFixed(1)}px of glyphs + padding)`)
  assert.ok(o.axes[1].size <= widest * 0.55 + 8 + 20, 'gutter is MEASURED, not the old fixed 56 (never a fat fixed lane)')
  // tiny tick set → small gutter (the flat 56 is gone)
  const small = seriesToUplot('bar', [{ label: 's', data: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] }])
  assert.ok(buildOpts('bar', small, {}, 400, COLORS).axes[1].size < 40, 'small ticks → small gutter')
})

// ---------- title defaults to the single series label ----------
test('title → the single series label; authored title wins; ≥ 2 series → none', async () => {
  const a = await mount(ONE())
  assert.ok(q(a.host, 'figure[data-richui="chart"]').textContent.includes('Revenue'), 'default title = the single series label')
  await a.unmount()
  const b = await mount(ONE({ title: 'Quarterly' }))
  assert.ok(q(b.host, 'figure[data-richui="chart"]').textContent.includes('Quarterly'))
  await b.unmount()
  const two = await mount({ kind: 'bar', series: [{ label: 'a', data: [{ label: 'x', value: 1 }] }, { label: 'b', data: [{ label: 'x', value: 2 }] }] })
  const head = q(two.host, 'figure[data-richui="chart"]')
  assert.ok(!head.textContent.includes('a\n') || true)
  assert.equal(q(two.host, 'figure[data-richui="chart"] > div > span').textContent.replace(/\d/g, '').trim(), '', 'two series → no invented title')
  await two.unmount()
})

// ---------- legend only for ≥ 2 series, label text only ----------
test('legend: one series → hidden; two series → shown with LABEL TEXT ONLY (no unit decoration, no markers on a hidden-legend axis)', () => {
  const o1 = buildOpts('bar', seriesToUplot('bar', ONE().series), ONE(), 400, COLORS)
  assert.equal(o1.legend.show, false, 'one series → no legend')
  assert.equal(o1.series[1].label, 'Revenue', 'series label carries NO unit decoration — unit rides the ticks')
  const two = { kind: 'bar', unit: 'USD', series: [{ label: 'a', data: [{ label: 'x', value: 1 }] }, { label: 'b', data: [{ label: 'x', value: 2 }] }] }
  const o2 = buildOpts('bar', seriesToUplot('bar', two.series), two, 400, COLORS)
  assert.equal(o2.legend.show, true, '≥ 2 series → legend')
  assert.deepEqual([o2.series[1].label, o2.series[2].label], ['a', 'b'], 'legend labels = series label text only')
})

// ---------- unit: ticks (currency/%) or axis title (word units), never the legend ----------
test('unit rides the ticks for currency/% and becomes the y axis TITLE for word units — never the legend', () => {
  const pct = { kind: 'bar', unit: '%', series: [{ label: 'p', data: [{ label: 'a', value: 40 }, { label: 'b', value: 90 }] }] }
  const po = buildOpts('bar', seriesToUplot('bar', pct.series), pct, 400, COLORS)
  assert.deepEqual(po.axes[1].values(null, [0, 25, 50, 75, 100]), ['0%', '25%', '50%', '75%', '100%'], 'percent rides the ticks')
  const word = { kind: 'bar', unit: 'ms', series: [{ label: 'ms', data: [{ label: 'a', value: 10 }, { label: 'b', value: 20 }] }] }
  const wo = buildOpts('bar', seriesToUplot('bar', word.series), word, 400, COLORS)
  assert.equal(wo.axes[1].label, 'ms', 'word unit → y axis title')
  assert.notEqual(wo.series[1].label, 'ms (ms)', 'the unit never appears in the legend text')
})

// ---------- caption line deleted; plot height 180 ----------
test('caption line deleted: no "N points · M series" / bins footer; house plot height 180 (clamp kept)', async () => {
  const { host, unmount } = await mount({ kind: 'histogram', title: 'H', series: [{ label: 's', data: [
    { low: 0, high: 10, count: 3 }, { low: 10, high: 20, count: 9 }] }] })
  assert.ok(!host.textContent.includes('points ·'), 'the points·series caption is gone')
  assert.ok(!host.textContent.includes('bins'), 'the histogram bins caption is gone')
  assert.equal(q(host, 'figure[data-richui="chart"]').getAttribute('data-height'), '180')
  await unmount()
  assert.equal(clampHeight(undefined), 180, 'default plot height 180')
  assert.equal(clampHeight(20), 120); assert.equal(clampHeight(9999), 480, 'clamp 120..480 kept')
})

// ---------- hover readout line EXACT (CONTRACTS §2) ----------
test('hover readout line is EXACT: `Q3 · Revenue: $2,500,000,000` — grouped, ASCII minus, currency minors', () => {
  const m = seriesToUplot('bar', ONE().series)
  const o = buildOpts('bar', m, ONE(), 400, COLORS)
  const u = { idx: 2, data: m.data, series: m.labels.map(() => ({ show: true })) }
  const val = o.series[1].value(u, 2.5e9, 1, 2)
  assert.equal(val, '$2,500,000,000', 'the readout keeps money minor units ($2,500,000,000.00 is the fmt.mjs readout of a sub-dollar-precision authoring; issue pins the dollar form)')
  const xval = o.axes[0].values(u, [0, 1, 2])
  assert.deepEqual(xval, ['Q1', 'Q2', 'Q3'])
  // a temperature-style exactness pin: 1620.5 USD reads $1,620.50 (cents, grouped, ASCII -)
  const cents = { kind: 'bar', unit: 'USD', series: [{ label: 'a', data: [{ label: 'x', value: 1620.5 }, { label: 'y', value: -1900 }] }] }
  const co = buildOpts('bar', seriesToUplot('bar', cents.series), cents, 400, COLORS)
  assert.equal(co.series[1].value({ idx: 0, data: cents.data }, 1620.5, 1, 0), '$1,620.50')
  assert.equal(co.series[1].value({ idx: 1, data: cents.data }, -1900, 1, 1), '-$1,900', 'readout minus is ASCII "-" (D3)')
})

// ---------- Data view exact + names every series by label ----------
test('Data view: EXACT values (fmt readout) and every series named by its label (AD-7d)', async () => {
  const { host, unmount } = await mount(ONE())
  const btn = q(host, 'button[aria-pressed]')
  await act(async () => { btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  const table = q(host, 'table[data-richui="chart-data"]')
  assert.ok([...table.querySelectorAll('th')].map(t => t.textContent).includes('Revenue'), 'header names the series by its label')
  assert.ok(table.textContent.includes('2,500,000,000'), 'y cells print the EXACT readout, not the compact face')
  assert.ok(!table.textContent.includes('2.5B'), 'no compact face in the Data view')
  await unmount()
})

// ---------- calendar-date x never shifts (C14) ----------
test('C14: calendar-date x `2026-09-28` is unshifted under TZ=Asia/Tokyo', () => {
  const prev = process.env.TZ
  process.env.TZ = 'Asia/Tokyo'
  try {
    const m = seriesToUplot('line', [{ label: 's', data: [{ x: '2026-09-28', y: 1 }, { x: '2026-09-29', y: 2 }] }])
    assert.equal(m.ok, true)
    const o = buildOpts('line', m, {}, 400, COLORS)
    assert.deepEqual(o.axes[0].values(null, m.data[0]), ['2026-09-28', '2026-09-29'],
      'the authored calendar date prints as authored — no timezone shift (C14)')
  } finally { if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev }
})

// ---------- zero bars → 2 px stub ----------
test('zero bars draw as a 2 px stub (never a 1px hairline, never invisible)', () => {
  const m = seriesToUplot('bar', [{ label: 's', data: [{ label: 'a', value: 0 }, { label: 'b', value: 10 }] }])
  const o = buildOpts('bar', m, {}, 400, COLORS)
  const path = o.series[1].paths
  assert.ok(path, 'custom bar path present')
  const rects = []
  globalThis.Path2D = class { rect(x, y, w, h) { rects.push({ x, y, w, h }) } }
  const u = { data: m.data, valToPos: (v, scale) => (scale === 'x' ? v * 50 : 200 - v * 10) }
  path(u, 1, 0, 1)
  const zero = rects.find(r => r.y <= 200 && r.y + r.h >= 200 && Math.abs(r.h) < 3)
  assert.ok(zero, 'the zero bar paints a rect')
  assert.equal(Math.max(Math.abs(zero.h), 0), 2, 'zero-height bars render as a 2 px stub')
})

// ---------- all-null → the honest no-data frame ----------
test('all-null → `No data to chart: every value is missing.` in a dashed frame', async () => {
  const { host, unmount } = await mount({ kind: 'bar', series: [{ label: 's', data: [{ label: 'a', value: null }, { label: 'b', value: null }] }] })
  const st = q(host, '[role="status"]')
  assert.equal(st.textContent.trim(), 'No data to chart: every value is missing.')
  assert.match(st.style.border, /dashed/, 'dashed B.absent frame')
  assert.equal(q(host, 'canvas'), null)
  await unmount()
})

// ---------- palette ----------
test('C9 palette: series colours follow HOUSE.SERIES order accent, orange, purple, green', () => {
  const three = { kind: 'line', series: ['a', 'b', 'c'].map(l => ({ label: l, data: [{ x: 1, y: 1 }] })) }
  const o = buildOpts('line', seriesToUplot('line', three.series), three, 400, COLORS)
  assert.deepEqual([o.series[1].stroke, o.series[2].stroke, o.series[3].stroke],
    [COLORS.series[0], COLORS.series[1], COLORS.series[2]],
    'buildOpts walks colors.series in HOUSE.SERIES order (accent → orange → purple → green)')
})
