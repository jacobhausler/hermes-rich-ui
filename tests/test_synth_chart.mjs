// Lane L2 (chart-engine) synth tests — ratified pack: kinds area/waterfall/range +
// props stack/stepped/sortDesc + height clamp. Canvas is Proxy-swallowed in the harness,
// so opts are asserted via the exported buildOpts (the same object UplotHost hands to
// `new uPlot(buildOpts(...))`) and the DataAlt DOM through the real Renderer.
// uPlot.paths.stepped is spied to pin the REAL vendored API (RATIFY S8), and the whole
// captured opts tree is walked to assert NO stackGroup option anywhere (RATIFY S7: the
// vendored dist has none — stacking is renderer-computed).
import { test } from 'node:test'
import { assert as A, renderComponent, $, $$, act, registry, fixtureJson } from './helpers/render.mjs'
// Dynamic imports: registerHooks (in helpers/render.mjs) must run BEFORE chart.mjs resolves
// its @hermes/plugin-sdk import — same pattern as tests/test_chart.mjs.
const uPlot = (await import('uplot')).default
const { Chart, seriesToUplot, buildOpts, clampHeight } = await import('../desktop/src/components/chart.mjs')

A.equal(typeof registry.Chart, 'function', 'Chart already registered (shared seam untouched)')
const assert = A

const COLORS = { series: ['#3b82f6', '#22c55e', '#a855f7', '#f97316'], text: '#ccc', grid: '#333' }
const fx = (n) => fixtureJson(`${n}.json`)
const opts = (kind, props, o) => buildOpts(kind, seriesToUplot(kind, props.series, o || {}), props, 400, COLORS)

// deep walk: no uPlot stacking option anywhere in the captured opts (S7)
function deepKeys(v, out = []) {
  if (v && typeof v === 'object') { for (const k of Object.keys(v)) { out.push(k); deepKeys(v[k], out) } }
  return out
}

// ---------- kind: area (N7) ----------
test('area: point shape == line (reuses line layout wholesale)', () => {
  const m = seriesToUplot('area', fx('chart-area').series)
  const line = seriesToUplot('line', fx('chart-area').series)
  assert.equal(m.ok, true)
  assert.equal(m.xAxisIsTime, true)
  assert.deepEqual(m.data, line.data)
  assert.deepEqual(m.data[1], [10, 12, null, 15])
  assert.deepEqual(m.data[2], [2, null, null, 3])
})

test('area: fill truthy on every series, fill toward zero via zeroBaseline y-range', () => {
  const props = fx('chart-area')
  const o = opts('area', props)
  for (let i = 1; i < o.series.length; i++) {
    assert.ok(o.series[i].fill, `series ${i} has a fill`)
    assert.match(o.series[i].fill, /^rgba\(/, 'fill is the series color at AREA_FILL_ALPHA (L7 palette)')
  }
  // fill toward zero: y-range fn pins zero inside the domain — mixed-sign data splits at zero.
  const range = o.scales.y.range
  assert.deepEqual(range(null, -5, 10), [-5, 10])
  assert.deepEqual(range(null, 1, 10), [0, 10])
  assert.deepEqual(range(null, -10, -1), [-10, 0])
})

test('area: all-null y → ok:false (L1, never a zero line)', () => {
  assert.equal(seriesToUplot('area', [{ label: 'a', data: [{ x: 1, y: null }] }]).ok, false)
})

// ---------- kind: waterfall (N8) ----------
test('waterfall: +100/−40/+25/total → floating rects 0→100, 100→60, 60→85, 0→85 (exact pins)', () => {
  const m = seriesToUplot('waterfall', fx('chart-waterfall').series)
  assert.equal(m.ok, true)
  assert.deepEqual(m.xLabels, ['Revenue', 'Costs', 'Refunds', 'Net'])
  assert.deepEqual(m.wf.bases[0], [0, 100, 60, 0])
  assert.deepEqual(m.wf.tops[0], [100, 60, 85, 85])
  assert.deepEqual(m.data[1], [100, 60, 85, 85])   // tops live in the uPlot data column
  assert.deepEqual(m.wf.totals[0], [false, false, false, true])
})

test('waterfall: running baseline crosses zero without clamping (Q risk pin)', () => {
  const m = seriesToUplot('waterfall', [{ label: 's', data: [
    { label: 'a', value: 10 }, { label: 'b', value: -25 }, { label: 'c', value: 5 }, { label: 'T', total: true }
  ] }])
  assert.deepEqual(m.wf.bases[0], [0, 10, -15, 0])
  assert.deepEqual(m.wf.tops[0], [10, -15, -10, -10])
})

test('waterfall: label-union first-appearance order (reuses bar rule, F)', () => {
  const m = seriesToUplot('waterfall', [
    { label: 's1', data: [{ label: 'z', value: 1 }] },
    { label: 's2', data: [{ label: 'a', value: 2 }, { label: 'z', value: 3 }] }
  ])
  assert.deepEqual(m.xLabels, ['z', 'a'])
})

test('waterfall: all values null → ok:false (L1)', () => {
  assert.equal(seriesToUplot('waterfall', [{ label: 's', data: [{ label: 'x', value: null }] }]).ok, false)
})

test('waterfall: custom floating-rect path, no bars() path, no stackGroup option', () => {
  const o = opts('waterfall', fx('chart-waterfall'))
  assert.equal(typeof o.series[1].paths, 'function')
  assert.ok(!deepKeys(o).includes('stackGroup'), 'no uPlot stacking option anywhere (S7)')
  assert.ok(Array.isArray(o.scales.x.range()), 'categorical x range present')
})

// ---------- kind: range (N9) ----------
test('range: rect low→high, endpoints kept as supplied, ≤4 series/≤512 pts enforced by normSeries', () => {
  const m = seriesToUplot('range', fx('chart-range').series)
  assert.equal(m.ok, true)
  assert.deepEqual(m.xLabels, ['Austin', 'Denver', 'Boise'])
  assert.deepEqual(m.lows[0], [350000, 410000, null])
  assert.deepEqual(m.highs[0], [520000, 480000, null])
  assert.deepEqual(m.lows[1], [280000, null, 220000])
  assert.equal(m.rLo, 220000); assert.equal(m.rHi, 520000)
  const wide = seriesToUplot('range', Array.from({ length: 6 }, (_, i) =>
    ({ label: `s${i}`, data: Array.from({ length: 600 }, (_, j) => ({ label: 'c' + (j % 3), low: j, high: j + 1 })) })))
  assert.equal(wide.data.length, 5, '>4 series truncated to 4')
  assert.equal(wide.lows[0].length, 3, 'label union capped via 512-point truncation')
})

test('range: one endpoint null → BOTH cells unavailable, never a midpoint (L1/S3)', () => {
  const m = seriesToUplot('range', [{ label: 's', data: [{ label: 'a', low: null, high: 9 }, { label: 'b', low: 2, high: 6 }] }])
  assert.deepEqual(m.lows[0], [null, 2])
  assert.deepEqual(m.highs[0], [null, 6])
  assert.equal(m.points, 1, 'the half-known row contributes no plottable point')
})

test('range: both-null rows only → ok:false (L1)', () => {
  assert.equal(seriesToUplot('range', [{ label: 's', data: [{ label: 'a', low: null, high: null }] }]).ok, false)
})

// ---------- prop: stack (N10, S7 custom path) ----------
test('stack bar: renderer-computed cumulative baselines; totals == per-x sum; NO stackGroup option', () => {
  const series = [
    { label: 'a', data: [{ label: 'x', value: 10 }, { label: 'y', value: null }] },
    { label: 'b', data: [{ label: 'x', value: 20 }, { label: 'y', value: 30 }] }
  ]
  const m = seriesToUplot('bar', series, { stack: true })
  assert.deepEqual(m.stackBases[0], [0, null], 'null value → base null: that series draws a gap there')
  assert.deepEqual(m.stackBases[1], [10, 0], 'null contributes 0 below; series b stacks from 0 under the gap')
  assert.deepEqual(m.data[1], [10, null])
  assert.deepEqual(m.data[2], [30, 30], 'stacked column top equals the per-x sum')
  const o = buildOpts('bar', m, { stack: true }, 400, COLORS)
  assert.ok(!deepKeys(o).includes('stackGroup'), 'vendored uPlot has no stackGroup — stack is custom (S7)')
  for (let i = 1; i < o.series.length; i++) {
    assert.equal(typeof o.series[i].paths, 'function', 'stacked bars paint base→top rects')
  }
})

test('stack area: cumulative columns through the line layout, gap on null', () => {
  const m = seriesToUplot('area', [
    { label: 'a', data: [{ x: 1, y: 1 }, { x: 2, y: null }] },
    { label: 'b', data: [{ x: 1, y: 2 }, { x: 2, y: 4 }] }
  ], { stack: true })
  assert.deepEqual(m.stackBases[1], [1, 0])
  assert.deepEqual(m.data[2], [3, 4], 'series b paints base→(base+b) with base 0 under the gap')
})

// ---------- prop: stepped (N11, S8 real vendored API) ----------
test('stepped: uses the vendored uPlot.paths.stepped({align:1, extend:false}) — no extrapolation after last point', () => {
  assert.equal(typeof uPlot.paths.stepped, 'function', 'gate: vendored dist exposes paths.stepped')
  const spyCalls = []
  const real = uPlot.paths.stepped
  uPlot.paths.stepped = (o) => { spyCalls.push(o); return real(o) }
  try {
    const m = seriesToUplot('line', [{ label: 's', data: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }])
    const o = buildOpts('line', m, { stepped: true }, 400, COLORS)
    assert.deepEqual(spyCalls, [{ align: 1, extend: false }], 'called once with the ratified pins (S8)')
    assert.equal(typeof o.series[1].paths, 'function')
    const plain = buildOpts('line', m, {}, 400, COLORS)
    assert.equal(plain.series[1].paths, undefined, 'non-stepped line keeps the default linear path')
  } finally { uPlot.paths.stepped = real }
})

// ---------- prop: sortDesc (E16 renderer half) ----------
test('sortDesc bar: categories stay label-keyed, ordered by summed |value| desc; DataAlt follows', () => {
  const series = [
    { label: 'q1', data: [{ label: 'a', value: 5 }, { label: 'b', value: -9 }, { label: 'c', value: 2 }] },
    { label: 'q2', data: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }, { label: 'c', value: 10 }] }
  ]
  const m = seriesToUplot('bar', series, { sortDesc: true })
  // |a|=6, |b|=11, |c|=12 → c, b, a
  assert.deepEqual(m.xLabels, ['c', 'b', 'a'])
  assert.deepEqual(m.data[0], [0, 1, 2])
  assert.deepEqual(m.data[1], [2, -9, 5])
  assert.deepEqual(m.data[2], [10, 2, 1])
})

test('sortDesc bar: ties keep first-appearance order', () => {
  const m = seriesToUplot('bar', [{ label: 's', data: [{ label: 'x', value: 5 }, { label: 'y', value: 5 }] }], { sortDesc: true })
  assert.deepEqual(m.xLabels, ['x', 'y'])
})

test('sortDesc histogram: uPlot keeps x ascending; DataAlt rows reorder by |count| desc', () => {
  const m = seriesToUplot('histogram', [{ label: 's', data: [
    { low: 0, high: 10, count: 3 }, { low: 10, high: 20, count: 9 }, { low: 20, high: 30, count: 5 }
  ] }], { sortDesc: true })
  assert.deepEqual(m.data[0], [0, 10, 20], 'canvas x stays ascending (uPlot requires it)')
  assert.deepEqual(m.altOrder, [1, 2, 0], 'rows: count 9, 5, 3')
  assert.equal(m.xMin, 0)
})

// ---------- prop: height clamp (F1) ----------
test('height clamp 120..480, default 240 (F1)', () => {
  assert.equal(clampHeight(undefined), 240)
  assert.equal(clampHeight(240), 240)
  assert.equal(clampHeight(50), 120)
  assert.equal(clampHeight(119), 120)
  assert.equal(clampHeight(480), 480)
  assert.equal(clampHeight(9999), 480)
  assert.equal(clampHeight(NaN), 240)
  assert.equal(clampHeight('200'), 240)
  assert.equal(clampHeight(Infinity), 240)
  const m = seriesToUplot('bar', [{ label: 's', data: [{ label: 'x', value: 1 }] }])
  assert.equal(buildOpts('bar', m, { height: 600 }, 400, COLORS).height, 480)
  assert.equal(buildOpts('bar', m, {}, 400, COLORS).height, 240)
})

// ---------- jsdom render: fixtures through the real Renderer ----------
async function mountProps(kind, fixtureName, extraProps) {
  // Unique element id per mount: the shared root reconciles same-id/same-type elements,
  // which would carry the previous test's showData toggle state over.
  mountProps.n = (mountProps.n || 0) + 1
  const props = { ...fx(fixtureName), ...(extraProps || {}) }
  await renderComponent({ id: 'c' + mountProps.n, component: 'Chart', props })
  return props
}
async function toggleToTable() {
  const btn = $('button[aria-pressed]')
  if (btn.textContent === 'Data') await act(async () => { btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
  assert.ok($('table[data-richui="chart-data"]'), 'table visible')
}

test('render area: figure mounts, DataAlt carries line rows with unavailable cells', async () => {
  await mountProps('area', 'chart-area')
  const fig = $('figure[data-ru="Chart"]')
  assert.equal(fig.getAttribute('data-kind'), 'area')
  assert.ok(fig.textContent.includes('Requests over time'))
  await toggleToTable()
  const table = $('table[data-richui="chart-data"]')
  assert.ok(table.textContent.includes('unavailable'), 'null y renders unavailable (L1)')
  assert.ok(!table.textContent.includes('NaN'))
})

test('render waterfall: DataAlt shows authored value + renderer-computed running position (L6)', async () => {
  await mountProps('waterfall', 'chart-waterfall')
  assert.equal($('figure[data-ru="Chart"]').getAttribute('data-kind'), 'waterfall')
  await toggleToTable()
  const ths = $$('table[data-richui="chart-data"] th').map(t => t.textContent)
  assert.deepEqual(ths, ['label', 'walk value', 'walk total'])
  const rows = $$('table[data-richui="chart-data"] tbody tr').map(tr => [...tr.children].map(td => td.textContent))
  assert.deepEqual(rows, [
    ['Revenue', '100', '100'],
    ['Costs', '-40', '60'],
    ['Refunds', '25', '85'],
    ['Net', 'unavailable', '85']
  ])
})

test('render range: DataAlt shows BOTH endpoints per series, both-null row is unavailable — never a midpoint', async () => {
  await mountProps('range', 'chart-range')
  await toggleToTable()
  const ths = $$('table[data-richui="chart-data"] th').map(t => t.textContent)
  assert.deepEqual(ths, ['label', 'houses low', 'houses high', 'condos low', 'condos high'])
  const table = $('table[data-richui="chart-data"]')
  const rows = $$('table[data-richui="chart-data"] tbody tr').map(tr => [...tr.children].map(td => td.textContent))
  assert.deepEqual(rows[0], ['Austin', '350000', '520000', '280000', '390000'])
  assert.deepEqual(rows[2], ['Boise', 'unavailable', 'unavailable', '220000', '310000'])
  // the midpoint lie is impossible: (350000+520000)/2 and every other midpoint never appears
  assert.ok(!table.textContent.includes('435000'))
  assert.ok(table.textContent.includes('unavailable'))
})

test('render bar stack: data-stack marker + DataAlt column tops equal per-x sums', async () => {
  await renderComponent({ id: 'cstack', component: 'Chart', props: {
    kind: 'bar', title: 'Stacked', stack: true,
    series: [
      { label: 'web', data: [{ label: 'jan', value: 10 }, { label: 'feb', value: null }] },
      { label: 'api', data: [{ label: 'jan', value: 20 }, { label: 'feb', value: 30 }] }
    ]
  } })
  const fig = $('figure[data-ru="Chart"]')
  assert.equal(fig.getAttribute('data-stack'), '1')
  await toggleToTable()
  const rows = $$('table[data-richui="chart-data"] tbody tr').map(tr => [...tr.children].map(td => td.textContent))
  assert.deepEqual(rows, [['jan', '10', '30'], ['feb', 'unavailable', '30']])
})

test('render line stepped + sortDesc bar + height markers', async () => {
  await renderComponent({ id: 'c1', component: 'Chart', props: {
    kind: 'line', title: 'Stepped', stepped: true, series: [{ label: 's', data: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }]
  } })
  assert.equal($('figure[data-ru="Chart"]').getAttribute('data-stepped'), '1')
  assert.equal($('figure[data-ru="Chart"]').getAttribute('data-height'), '240')
  await renderComponent({ id: 'c2', component: 'Chart', props: {
    kind: 'bar', title: 'Sorted', sortDesc: true, height: 600,
    series: [{ label: 's', data: [{ label: 'a', value: 5 }, { label: 'b', value: 9 }] }]
  } })
  const fig = $('figure[data-ru="Chart"]')
  assert.equal(fig.getAttribute('data-sort-desc'), '1')
  assert.equal(fig.getAttribute('data-height'), '480', 'height clamped to 480 and surfaced')
})
