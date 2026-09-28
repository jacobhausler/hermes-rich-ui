// L3 microviz lane tests (expansion cycle 2026-09-28): N12 Sparkline, N13 BarList,
// N14 HeatMap. Canvas is Proxy-swallowed in jsdom, so the uPlot path is pinned on the
// CAPTURED opts (buildSparkOpts) exactly like test_chart.mjs pins buildOpts; the
// computed-DOM paths (BarList widths/shares, HeatMap ramp) are asserted on real DOM.
// Components are registered lane-locally via registerLane (never components/index.mjs).
import { test } from 'node:test'
import { assert, registerLane, renderComponent, renderSpec, React, $, $$, mount } from './helpers/render.mjs'

const { Sparkline, sparkModel, buildSparkOpts } = await import('../desktop/src/components/sparkline.mjs')
const { BarList, sortItems, barShares } = await import('../desktop/src/components/barlist.mjs')
const { HeatMap, heatModel } = await import('../desktop/src/components/heatmap.mjs')
const { UPLOT_CSS_HREF } = await import('../desktop/src/components/chart.mjs')

registerLane('Sparkline', Sparkline)
registerLane('BarList', BarList)
registerLane('HeatMap', HeatMap)

const pct = (el) => parseFloat(/width:\s*([\d.]+)%/.exec(el.getAttribute('style') || '')[1])
const mix = (td) => parseFloat(/color-mix\(in srgb, var\(--ui-accent\) ([\d.]+)%/.exec(td.getAttribute('style') || '')[1])

// ------------------------------------------------------------- N12 Sparkline

test('sparkline sparkModel: trend truth table (first vs last NON-NULL; S9 pins)', () => {
  assert.equal(sparkModel([1, 2, 3]).trend, 'up')
  assert.equal(sparkModel([3, 2, 1]).trend, 'down')
  assert.equal(sparkModel([2, 2, 2]).trend, 'flat')
  // first/last entries null: trend computed across the AVAILABLE pair, explicit (S9)
  assert.equal(sparkModel([null, 1, 5, 2, null]).trend, 'up')
  assert.equal(sparkModel([5, null, null, 2]).trend, 'down')
  assert.equal(sparkModel([4, null, 4]).trend, 'flat')
  // fewer than two non-null => 'unavailable', never guessed (S9)
  assert.equal(sparkModel([7, null]).trend, 'unavailable')
  assert.equal(sparkModel([null, null]).trend, 'unavailable')
  assert.equal(sparkModel([]).trend, 'unavailable')
  // null gaps: points counts non-null only; nulls stay null, never 0 (L1)
  const m = sparkModel([1, null, 3])
  assert.equal(m.points, 2)
  assert.deepEqual(m.values, [1, null, 3])
  assert.equal(m.min, 1); assert.equal(m.max, 3)
  assert.deepEqual(m.norm, [0, null, 1])
  // constant domain: uniform 0.5 step, never divide-by-zero
  const c = sparkModel([5, 5])
  assert.ok(c.constant); assert.deepEqual(c.norm, [0.5, 0.5])
  // ≤512 cap applied defensively in the renderer too
  assert.equal(sparkModel(Array.from({ length: 600 }, (_, i) => i)).points, 512)
})

test('sparkline buildSparkOpts: single canvas, NO legend/axes/cursor, clamps, spanGaps gap', () => {
  const m = sparkModel([1, 2, 3])
  const o = buildSparkOpts(m, {})
  assert.equal(o.legend.show, false, 'legend off')
  assert.deepEqual(o.axes, [], 'no axes')
  assert.equal(o.cursor.show, false, 'cursor off')
  assert.equal(o.select.show, false, 'select off')
  assert.equal(o.series.length, 2, 'one data series + the x placeholder: single canvas')
  assert.equal(o.series[1].spanGaps, false, 'null => gap, Chart line semantics (L1)')
  assert.equal(o.width, 120); assert.equal(o.height, 24, 'defaults')
  const clamped = buildSparkOpts(m, { width: 10, height: 1 })
  assert.equal(clamped.width, 60); assert.equal(clamped.height, 14, 'clamped to 60..400 / 14..48')
  const hi = buildSparkOpts(m, { width: 9999, height: 999 })
  assert.equal(hi.width, 400); assert.equal(hi.height, 48)
  const bar = buildSparkOpts(m, { direction: 'bar' })
  assert.equal(bar.series[1].width, 0, 'bar mode: strokes off, fills via paths.bars')
  assert.equal(typeof bar.series[1].paths, 'function', 'uPlot paths.bars callable (vendored 1.6.32)')
  assert.equal(typeof bar.scales.x.range, 'function', 'bar mode owns its category range')
})

test('sparkline render: inline-flex, single canvas, no legend, data-ru-trend, hoisted scoped CSS', async () => {
  await renderComponent({ id: 's1', component: 'Sparkline', props: { values: [1, 2, 3] } })
  const root = mount.querySelector('[data-ru="Sparkline"]')
  assert.ok(root, 'data-ru marker')
  assert.match(root.getAttribute('style'), /display:\s*inline-flex/, 'inline-flex beside a Metric')
  assert.equal(root.getAttribute('data-ru-trend'), 'up')
  assert.equal(root.getAttribute('data-ru-points'), '3')
  assert.equal(root.getAttribute('role'), 'img')
  assert.equal(root.querySelectorAll('canvas').length, 1, 'single canvas')
  assert.equal(root.querySelector('.u-legend'), null, 'no legend chrome')
  const st = document.head.querySelector('style[data-richui-uplot-css]')
  assert.ok(st && (st.getAttribute('href') || st.getAttribute('data-href')) === UPLOT_CSS_HREF, 'same scoped uPlot style href as Chart, no leak')
  assert.equal(root.querySelector('[data-ru-chip="up"]').textContent, '▲')
})

test('sparkline beside a Metric renders as a KPI row (ACCEPT: inline-flex beside a Metric)', async () => {
  await renderSpec({
    root: 'row',
    elements: {
      row: { type: 'Stack', props: {}, children: ['m', 's'] },
      m: { type: 'Metric', props: { label: 'Requests', value: 1234, unit: 'rps' }, children: [] },
      s: { type: 'Sparkline', props: { values: [10, 12, 11, 15], height: 16 }, children: [] }
    }
  })
  assert.ok(mount.querySelector('[data-ru="Metric"]'), 'Metric present')
  const s = mount.querySelector('[data-ru="Sparkline"]')
  assert.ok(s, 'Sparkline present')
  assert.match(s.getAttribute('style'), /display:\s*inline-flex/)
  assert.equal(s.getAttribute('data-ru-trend'), 'up')
})

test('sparkline all-null / empty: trend unavailable, never guessed (S9), no canvas', async () => {
  await renderComponent({ id: 's2', component: 'Sparkline', props: { values: [null, null, null] } })
  const root = mount.querySelector('[data-ru="Sparkline"]')
  assert.equal(root.getAttribute('data-ru-trend'), 'unavailable')
  assert.equal(root.getAttribute('data-ru-points'), '0')
  assert.equal(root.querySelectorAll('canvas').length, 0, 'no engine for an empty strip')
  assert.match(root.textContent, /unavailable/, 'L1: says unavailable, never 0')
  await renderComponent({ id: 's3', component: 'Sparkline', props: { values: [7, null] } })
  const one = mount.querySelector('[data-ru="Sparkline"]')
  assert.equal(one.getAttribute('data-ru-trend'), 'unavailable', 'single non-null point cannot show a trend')
})

// --------------------------------------------------------------- N13 BarList

test('barlist sortItems: desc/asc/none, nulls ALWAYS sink last, stable on ties', () => {
  const items = [{ label: 'a', value: 3 }, { label: 'b', value: null }, { label: 'c', value: 10 }, { label: 'd', value: 3 }, { label: 'e', value: null }]
  assert.deepEqual(sortItems(items, 'desc').map(i => i.label), ['c', 'a', 'd', 'b', 'e'])
  assert.deepEqual(sortItems(items, 'asc').map(i => i.label), ['a', 'd', 'c', 'b', 'e'])
  assert.deepEqual(sortItems(items, 'none').map(i => i.label), ['a', 'c', 'd', 'b', 'e'], 'none keeps author order, nulls sink last')
})

test('barlist barShares: width ∝ value/columnMax, negatives clipped blank, all-null honest', () => {
  const { shares, max, counted } = barShares([{ value: 10 }, { value: 5 }, { value: null }, { value: -4 }])
  assert.equal(max, 10)
  assert.deepEqual(shares, [1, 0.5, null, null], 'null and negative share blank; negatives clip at 0 (pinned)')
  assert.equal(counted, 3, 'nulls are not counted')
  const z = barShares([{ value: null }, { value: null }])
  assert.equal(z.max, null); assert.deepEqual(z.shares, [null, null])
})

test('barlist render: widths ∝ value/max, sort applied, null row unavailable + hatched track, data-ru-count', async () => {
  await renderComponent({
    id: 'b1', component: 'BarList',
    props: { items: [{ label: 'alpha', value: 5 }, { label: 'missing', value: null }, { label: 'beta', value: 10 }, { label: 'down', value: -3 }], sort: 'desc' }
  })
  const root = mount.querySelector('[data-ru="BarList"]')
  assert.equal(root.getAttribute('data-ru-count'), '3', 'non-null counted')
  assert.equal(root.getAttribute('data-ru-sort'), 'desc')
  const rows = [...root.querySelectorAll('[data-ru-item]')]
  assert.deepEqual(rows.map(r => r.querySelector('[title]').textContent), ['beta', 'alpha', 'down', 'missing'], 'desc applied, null sinks last')
  assert.equal(pct(rows[0].querySelector('[aria-hidden] > div')), 100, 'width ∝ 10/10')
  assert.equal(pct(rows[1].querySelector('[aria-hidden] > div')), 50, 'width ∝ 5/10')
  assert.equal(rows[2].getAttribute('data-ru-item'), 'clipped', 'negative clipped at 0')
  assert.equal(rows[2].querySelector('[aria-hidden]').children.length, 0, 'blank share for negatives')
  const nullRow = rows[3]
  assert.equal(nullRow.getAttribute('data-ru-item'), 'unavailable')
  assert.match(nullRow.textContent, /unavailable/, 'L1: null renders unavailable')
  assert.doesNotMatch(nullRow.textContent, /\b0\b/, 'null never renders as 0')
  const track = nullRow.querySelector('[aria-hidden] > div')
  assert.ok(track, 'null row keeps a visible (hatched) track — never 0-width')
  assert.match(track.getAttribute('style'), /repeating-linear-gradient/)
})

test('barlist sort=none keeps author order; values render via formatMetric (unit/precision/format)', async () => {
  await renderComponent({
    id: 'b2', component: 'BarList',
    props: { items: [{ label: 'x', value: 1200 }, { label: 'y', value: 0.452 }], sort: 'none' }
  })
  let rows = [...mount.querySelectorAll('[data-ru-item]')]
  assert.deepEqual(rows.map(r => r.querySelector('[title]').textContent), ['x', 'y'], 'sort=none preserves order')

  await renderComponent({
    id: 'b3', component: 'BarList',
    props: { items: [{ label: 'rev', value: 1200 }, { label: 'hit', value: 45 }], format: 'currency', unit: 'ignored-in-currency' }
  })
  rows = [...mount.querySelectorAll('[data-ru-item]')]
  assert.match(rows[0].textContent, /\$1,200/, 'formatMetric currency (imported from _shared, unmodified)')

  await renderComponent({
    id: 'b4', component: 'BarList',
    props: { items: [{ label: 'up', value: 99.5 }], format: 'percent', precision: 1 }
  })
  assert.match(mount.textContent, /99\.5%/, 'formatMetric percent + precision')
})

// --------------------------------------------------------------- N14 HeatMap

test('heatmap heatModel: observed min→max ramp (monotone, quantized), S9 constant + all-null pins', () => {
  const rows = [{ label: 'r1' }, { label: 'r2' }], cols = [{ label: 'c1' }, { label: 'c2' }]
  const m = heatModel(rows, cols, [
    { row: 'r1', col: 'c1', value: 1 }, { row: 'r1', col: 'c2', value: 9 }, { row: 'r2', col: 'c1', value: 5 }
  ])
  assert.equal(m.min, 1); assert.equal(m.max, 9); assert.equal(m.points, 3)
  assert.equal(m.ramp(1), 0); assert.equal(m.ramp(9), 1)
  const mid = m.ramp(5)
  assert.ok(mid > 0 && mid < 1, 'intensity strictly between')
  assert.ok(m.ramp(2) <= m.ramp(5) && m.ramp(5) <= m.ramp(9), 'monotone in value')
  assert.equal(m.ramp(null), null, 'null is unobservable, never a guessed color (L1)')
  // S9: constant domain -> ONE uniform step, never 0/0
  const c = heatModel(rows, cols, [{ row: 'r1', col: 'c1', value: 7 }, { row: 'r2', col: 'c2', value: 7 }])
  assert.ok(c.constant)
  assert.equal(c.ramp(7), 0.5)
  // S9: all-null -> fully hatched model, no crash
  const n = heatModel(rows, cols, [{ row: 'r1', col: 'c1', value: null }, { row: 'r2', col: 'c2', value: null }])
  assert.equal(n.min, null); assert.equal(n.max, null); assert.equal(n.points, 0)
  assert.equal(n.ramp(3), null)
})

test('heatmap render: cell count, intensity monotone in value, caption min/max+unit, null hatch (L1)', async () => {
  await renderComponent({
    id: 'h1', component: 'HeatMap',
    props: {
      rows: [{ label: 'mon' }, { label: 'tue' }], cols: [{ label: 'a' }, { label: 'b' }],
      cells: [
        { row: 'mon', col: 'a', value: 1 }, { row: 'mon', col: 'b', value: 9 },
        { row: 'tue', col: 'a', value: 5 }
        // (tue,b) missing => null hatch
      ],
      unit: 'ms'
    }
  })
  const root = mount.querySelector('[data-ru="HeatMap"]')
  assert.equal(root.getAttribute('data-ru-cells'), '3')
  const tds = [...root.querySelectorAll('td')]
  assert.equal(tds.length, 4, 'rows × cols DOM grid (144 cells need no canvas)')
  assert.ok(root.querySelector('table[data-richui="heatmap-grid"]'), 'table-of-divs DataAlt idiom')
  assert.ok(root.querySelector('th[scope="col"]') && root.querySelector('th[scope="row"]'), 'row/col headers are the a11y text')
  const tLow = parseFloat(tds[0].getAttribute('data-ru-cell'))
  const tHigh = parseFloat(tds[1].getAttribute('data-ru-cell'))
  assert.ok(tLow < tHigh, 'background intensity monotone in value')
  assert.ok(mix(tds[0]) < mix(tds[1]), 'alpha ladder rises with the ramp step')
  const nullTd = tds[3]
  assert.equal(nullTd.getAttribute('data-ru-cell'), 'unavailable')
  assert.equal(nullTd.textContent, '—', 'null/missing renders —')
  assert.match(nullTd.getAttribute('style'), /repeating-linear-gradient/, 'hatched neutral, never a guessed color (L1)')
  const cap = root.querySelector('[data-richui="heatmap-caption"]')
  assert.match(cap.textContent, /1 ms/, 'caption prints observed min + unit')
  assert.match(cap.textContent, /9 ms/, 'caption prints observed max + unit')
  assert.match(tds[0].getAttribute('style'), /color-mix\(in srgb, var\(--ui-accent\)/, 'theme accent only (L7)')
})

test('heatmap all-null renders fully hatched with an honest caption (S9); constant domain uniform step', async () => {
  await renderComponent({
    id: 'h2', component: 'HeatMap',
    props: { rows: [{ label: 'r1' }], cols: [{ label: 'c1' }, { label: 'c2' }], cells: [{ row: 'r1', col: 'c1', value: null }] }
  })
  let root = mount.querySelector('[data-ru="HeatMap"]')
  assert.equal(root.getAttribute('data-ru-cells'), '0')
  assert.ok([...root.querySelectorAll('td')].every(td => td.getAttribute('data-ru-cell') === 'unavailable'), 'all-null all-hatched')
  assert.match(root.querySelector('[data-richui="heatmap-caption"]').textContent, /no values observed/, 'honest caption, no fabricated bounds')
  assert.ok(!/color-mix/.test([...root.querySelectorAll('td')].map(td => td.getAttribute('style')).join('')), 'no color at all when nothing was observed')

  await renderComponent({
    id: 'h3', component: 'HeatMap',
    props: { rows: [{ label: 'r1' }, { label: 'r2' }], cols: [{ label: 'c1' }], cells: [{ row: 'r1', col: 'c1', value: 4 }, { row: 'r2', col: 'c1', value: 4 }] }
  })
  root = mount.querySelector('[data-ru="HeatMap"]')
  const steps = [...root.querySelectorAll('td')].map(td => td.getAttribute('data-ru-cell'))
  assert.deepEqual(steps, ['0.5', '0.5'], 'constant domain -> uniform step (S9), no divide-by-zero')
})

test('heatmap rows/cols caps applied defensively (≤12, cells ≤144)', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ label: 'r' + i }))
  const cols = Array.from({ length: 20 }, (_, i) => ({ label: 'c' + i }))
  const m = heatModel(rows, cols, Array.from({ length: 300 }, (_, i) => ({ row: 'r' + (i % 20), col: 'c' + (i % 20), value: i })))
  assert.equal(m.rowLabels.length, 12); assert.equal(m.colLabels.length, 12)
  assert.ok(m.points <= 144, 'renderer never draws more than the single reachable cap')
})
