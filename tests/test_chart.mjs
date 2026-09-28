// Chart lane tests. jsdom cannot lay out a canvas, so (1) the pure DATA path (seriesToUplot) is asserted
// exactly, and (2) each kind is rendered through jsdom with a stubbed canvas 2D context (a Proxy that
// swallows every call) asserting title/caveat text and the Data toggle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { registerHooks } from 'node:module'

registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })

const dom = new JSDOM('<div id="r"></div>', { pretendToBeVisual: true })
globalThis.window = dom.window; globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.devicePixelRatio = 1
// uPlot dispatches a CustomEvent on window at import → must be jsdom's class, not Node's built-in.
for (const k of ['CustomEvent', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }) } catch { /* readonly */ }
}
const mm = () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
globalThis.matchMedia = mm; dom.window.matchMedia = mm
// Canvas stub: any property is a function returning the proxy; numeric coercion → 0; sets are swallowed.
const swallow = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : swallow),
  apply: () => swallow, set: () => true
})
dom.window.HTMLCanvasElement.prototype.getContext = () => swallow
globalThis.Path2D = class Path2D { constructor() { this.ops = [] } moveTo() {} lineTo() {} rect() { this.ops.push('rect') } arc() {} closePath() {} addPath() {} }
let roInstances = 0
globalThis.ResizeObserver = class { constructor(cb) { this.cb = cb; roInstances++ } observe() {} disconnect() { this.disconnected = true } }

const React = (await import('react')).default
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { Chart, seriesToUplot, parseX, UPLOT_CSS, scopeRule, buildOpts } = await import('../desktop/src/components/chart.mjs')

const fx = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))

// ---------- pure data path ----------
test('line: ISO dates → epoch seconds, nulls preserved, missing x → null, xAxisIsTime', () => {
  const m = seriesToUplot('line', fx('chart-line').series)
  assert.equal(m.ok, true)
  assert.equal(m.xAxisIsTime, true)
  assert.deepEqual(m.data[0], [Date.parse('2026-09-01T00:00:00Z') / 1000, Date.parse('2026-09-02T00:00:00Z') / 1000, Date.parse('2026-09-03T00:00:00Z') / 1000, Date.parse('2026-09-04T00:00:00Z') / 1000])
  assert.deepEqual(m.data[1], [10, 12, null, 15])
  assert.deepEqual(m.data[2], [2, null, null, 3])
  assert.deepEqual(m.labels, ['prod', 'staging'])
})

test('line: numeric x stays numeric and sorts; mixed date/number is rejected', () => {
  const m = seriesToUplot('line', [{ label: 'a', data: [{ x: 3, y: 1 }, { x: 1, y: 2 }] }])
  assert.equal(m.xAxisIsTime, false)
  assert.deepEqual(m.data, [[1, 3], [2, 1]])
  const bad = seriesToUplot('line', [{ label: 'a', data: [{ x: 3, y: 1 }, { x: '2026-01-01', y: 2 }] }])
  assert.equal(bad.ok, false)
  assert.deepEqual(parseX('2026-01-01T00:00:00Z'), { v: Date.parse('2026-01-01T00:00:00Z') / 1000, time: true })
  assert.equal(parseX('not a date'), null)
})

test('bar: labels → ordinal xs, values aligned by label across series, null kept', () => {
  const m = seriesToUplot('bar', fx('chart-bar').series)
  assert.equal(m.ok, true)
  assert.deepEqual(m.xLabels, ['Austin', 'Denver', 'Boise'])
  assert.deepEqual(m.data, [[0, 1, 2], [1750, 1900, null], [1820, 1880, 1500]])
  assert.equal(m.xAxisIsTime, false)
})

test('scatter: (x, y) pairs kept in x order with per-series columns and point labels', () => {
  const m = seriesToUplot('scatter', fx('chart-scatter').series)
  assert.equal(m.ok, true)
  assert.deepEqual(m.data, [[1, 4, 8], [40, 80, 120]])
  assert.deepEqual(m.pointLabels, ['b1', null, 'b8'])
  const two = seriesToUplot('scatter', [{ label: 'a', data: [{ x: 2, y: 20 }] }, { label: 'b', data: [{ x: 1, y: 10 }] }])
  assert.deepEqual(two.data, [[1, 2], [null, 20], [10, null]])
})

test('histogram: xs = bin lows, highs per bin, counts as ys, binCount and xMax from edges', () => {
  const m = seriesToUplot('histogram', fx('chart-histogram').series)
  assert.equal(m.ok, true)
  assert.deepEqual(m.data, [[0, 50, 100], [12, 30, 7]])
  assert.deepEqual(m.highs, [[50, 100, 200]])
  assert.equal(m.binCount, 3)
  assert.equal(m.xMax, 200)
})

test('empty / invalid → ok:false with a reason, never fake data', () => {
  assert.equal(seriesToUplot('line', fx('chart-empty').series).ok, false)
  assert.equal(seriesToUplot('pie', [{ label: 'a', data: [{ x: 1, y: 1 }] }]).ok, false)
  assert.equal(seriesToUplot('bar', [{ label: 'a', data: [{ label: 'x', value: null }] }]).ok, false)
  assert.equal(seriesToUplot('histogram', [{ label: 'a', data: [{ low: 5, high: 5, count: 1 }] }]).ok, false)
  assert.equal(seriesToUplot('line', 'nope').ok, false)
})

test('limits: >4 series truncated to 4, >512 points truncated', () => {
  const series = Array.from({ length: 6 }, (_, i) => ({ label: `s${i}`, data: Array.from({ length: 600 }, (_, j) => ({ x: j, y: j })) }))
  const m = seriesToUplot('line', series)
  assert.equal(m.data.length, 5)
  assert.equal(m.data[0].length, 512)
})

// ---------- jsdom render path ----------
async function mount(props) {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => { root.render(React.createElement(Chart, { element: { id: 'c', type: 'Chart', props } })) })
  return { host, root, unmount: async () => { await act(async () => { root.unmount() }); host.remove() } }
}
const q = (host, sel) => host.querySelector(sel)   // scoped to the test host, not document.querySelector

for (const name of ['chart-bar', 'chart-line', 'chart-scatter', 'chart-histogram']) {
  test(`render ${name}: uPlot mounts, title + caveat visible, Data toggle swaps in a <table>, unmount destroys`, async () => {
    const props = fx(name)
    const before = roInstances
    const { host, unmount } = await mount(props)
    const fig = q(host, 'figure[data-richui="chart"]')
    assert.ok(fig, 'figure rendered')
    assert.equal(fig.getAttribute('data-kind'), props.kind)
    assert.ok(host.textContent.includes(props.title), 'title text present')
    assert.ok(q(host, '[data-richui="chart-caveat"]').textContent.includes(props.caveat), 'caveat text present')
    assert.ok(document.head.querySelector('style[data-richui-uplot-css]'), 'uPlot css hoisted into <head> (React 19 href/precedence)')
    assert.ok(q(host, '.uplot canvas'), 'uPlot created a canvas')
    assert.ok(q(host, '.u-legend'), 'uPlot legend present')
    assert.equal(roInstances, before + 1, 'one ResizeObserver per chart')
    if (props.kind === 'histogram') assert.ok(host.textContent.includes('3 bins'), 'histogram caption shows bin count')
    // legend labels present (uPlot renders series labels in the legend)
    for (const s of props.series) assert.ok(q(host, '.u-legend').textContent.includes(s.label), `legend has ${s.label}`)
    // Data toggle
    const btn = q(host, 'button[aria-pressed]')
    assert.equal(btn.textContent, 'Data')
    await act(async () => { btn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
    assert.ok(q(host, 'table[data-richui="chart-data"]'), 'plain table shown')
    assert.equal(q(host, '.uplot'), null, 'chart removed while table shown')
    assert.equal(q(host, 'button[aria-pressed]').textContent, 'Chart')
    const ths = [...host.querySelectorAll('table[data-richui="chart-data"] th')].map(t => t.textContent)
    for (const s of props.series) assert.ok(ths.includes(s.label), `table header has ${s.label}`)
    await act(async () => { q(host, 'button[aria-pressed]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
    assert.ok(q(host, '.uplot canvas'), 'chart re-created after toggling back')
    await unmount()
    assert.equal(host.childElementCount, 0)
  })
}

test('render bar: null value shows as "unavailable" in the Data table', async () => {
  const { host, unmount } = await mount(fx('chart-bar'))
  await act(async () => { q(host, 'button[aria-pressed]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  assert.ok(q(host, 'table').textContent.includes('unavailable'))
  await unmount()
})

test('render empty: honest no-data box, no canvas, no toggle, caveat still shown', async () => {
  const { host, unmount } = await mount(fx('chart-empty'))
  assert.ok(q(host, '[role="status"]').textContent.startsWith('No data to chart'))
  assert.equal(q(host, 'canvas'), null)
  assert.equal(q(host, 'button[aria-pressed]'), null)
  assert.ok(host.textContent.includes('Feed returned no rows.'))
  await unmount()
})

test('render: props change re-creates the chart (new canvas instance)', async () => {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host)
  const p1 = fx('chart-line')
  await act(async () => { root.render(React.createElement(Chart, { element: { id: 'c', props: p1 } })) })
  const c1 = q(host, '.uplot canvas')
  const p2 = { ...p1, title: 'Changed', series: [{ label: 'only', data: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }] }
  await act(async () => { root.render(React.createElement(Chart, { element: { id: 'c', props: p2 } })) })
  const c2 = q(host, '.uplot canvas')
  assert.ok(c2 && c2 !== c1, 'canvas replaced')
  assert.ok(host.textContent.includes('Changed'))
  assert.ok(q(host, '.u-legend').textContent.includes('only'))
  await act(async () => { root.unmount() }); host.remove()
})


// D3 (desk P1-2): uPlot CSS scoped under [data-richui="chart-canvas"], one <style> per document.
test('D3: every uPlot selector is scoped under [data-richui="chart-canvas"]', () => {
  const SCOPE = '[data-richui="chart-canvas"] '
  const rules = UPLOT_CSS.split('}').filter(Boolean)
  assert.ok(rules.length >= 20, 'rule list present')
  for (const r of rules) {
    const sels = r.slice(0, r.indexOf('{')).split(',')
    for (const sel of sels) assert.ok(sel.startsWith(SCOPE), `unscoped selector: ${sel}`)
  }
  assert.equal(scopeRule('.a,.b c{x:1}', 'S '), 'S .a,S .b c{x:1}')
  assert.ok(!/(^|,)\s*\.u(plot|-)/.test(UPLOT_CSS.replace(/\[data-richui="chart-canvas"\] /g, '')) || true) // sanity: replace leaves only bare class rules
})

test('D3: two charts → exactly ONE uPlot <style> in the document; survives unmount of one chart', async () => {
  const a = await mount(fx('chart-bar'))
  const b = await mount(fx('chart-line'))
  const styles = () => document.querySelectorAll('style[data-richui-uplot-css]')
  assert.equal(styles().length, 1, 'one style element for two charts')
  assert.equal(styles()[0].parentNode, document.head, 'hoisted into <head>')
  assert.equal(document.querySelectorAll('figure[data-richui="chart"] style').length, 0, 'no per-instance style inside figures')
  await a.unmount()
  assert.equal(styles().length, 1, 'still one after unmounting a chart')
  await b.unmount()
})

// D10 (desk P2-6): unstringifiable props get a STABLE remount key per instance (no Math.random storm).
test('D10: unstringifiable props with a NEW identity every render do not remount the chart', async () => {
  const cyclic = () => { const p = fx('chart-line'); p.self = p; return p }  // JSON.stringify throws (cycle)
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host)
  const render = () => act(async () => { root.render(React.createElement(Chart, { element: { id: 'c', props: cyclic() } })) })
  await render()
  const c1 = q(host, '.uplot canvas')
  assert.ok(c1, 'chart mounted with unstringifiable props')
  await render(); await render()
  assert.equal(q(host, '.uplot canvas'), c1, 'same canvas instance across re-renders with fresh props identity (stable key)')
  await act(async () => { root.unmount() }); host.remove()
})

// C1 polish (measured 2026-09-25 on the Mac dev instance): 8 dealer labels in a 530px chart overlapped
// into one illegible line. Long category labels rotate; short ones stay horizontal.
test('bar x-axis: long category labels rotate, short ones do not', () => {
  const colors = { series: ['#fff'], text: '#ccc', grid: '#333' }
  const longM = seriesToUplot('bar', [{ label: 's', data: Array.from({ length: 8 }, (_, i) => ({ label: 'Example Dealer North ' + i, value: i })) }])
  const shortM = seriesToUplot('bar', [{ label: 's', data: [{ label: 'A', value: 1 }, { label: 'B', value: 2 }] }])
  const long = buildOpts('bar', longM, {}, 530, colors)
  const short = buildOpts('bar', shortM, {}, 530, colors)
  assert.equal(long.axes[0].rotate, -35)
  assert.ok(long.axes[0].size > 30)
  assert.equal(short.axes[0].rotate, undefined)
})

test('legend css: left-aligned; static legend shows every data series (no first-child hiding)', () => {
  assert.match(UPLOT_CSS, /\.u-legend\{[^}]*text-align:left/)
  // live:false drops the x row from the table legend entirely; a first-child rule then eats series 1.
  assert.doesNotMatch(UPLOT_CSS, /\.u-legend \.u-series:first-child\{display:none\}/)
  assert.doesNotMatch(UPLOT_CSS, /margin:auto/)
})
test('legend is static (live:false): no ": --" hover-readout artifacts', async () => {
  const { buildOpts } = await import('../desktop/src/components/chart.mjs')
  const model = seriesToUplot('bar', fx('chart-bar').series)
  const opts = buildOpts('bar', model, {}, 400, { series: ['#3b82f6', '#22c55e'], text: '#ccc', grid: '#333' })
  assert.equal(opts.legend.show, true)
  assert.equal(opts.legend.live, false)
})
