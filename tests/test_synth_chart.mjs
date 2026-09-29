// Lane L2 (chart-engine) synth tests — ratified pack: kinds area/waterfall/range +
// props stack/stepped/sortDesc + height clamp. Canvas is Proxy-swallowed in the harness,
// so opts are asserted via the exported buildOpts (the same object UplotHost hands to
// `new uPlot(buildOpts(...))`) and the DataAlt DOM through the real Renderer.
// uPlot.paths.stepped is spied to pin the REAL vendored API (RATIFY S8), and the whole
// captured opts tree is walked to assert NO stackGroup option anywhere (RATIFY S7: the
// vendored dist has none — stacking is renderer-computed).
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { assert as A, renderComponent, $, $$, act, registry, fixtureJson } from './helpers/render.mjs'
// repo-root reader for the catalog-doc pin below
const fsRead = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
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

// ---------- kind: waterfall readability (#15: sign-coded fills, value labels, connectors, opening anchor) ----------
// Module object (not named imports): wfmod.waterfallPlan is just undefined on main, so each
// #15 test fails on its own instead of the whole file failing to load.
const wfmod = await import('../desktop/src/components/chart.mjs')

// Fake uPlot instance: deterministic valToPos for the layout buildOpts gives waterfall
// (categorical x over [-0.5, n-0.5]; y via zeroBaseline over the data extremes).
function fakeU(model, width = 600, height = 320) {
  const n = model.data[0].length
  const all = [...model.wf.bases.flat(), ...model.wf.tops.flat()].filter(v => typeof v === 'number')
  const yMin = Math.min(0, ...all), yMax = Math.max(0, ...all)
  const padL = 64, padR = 10, padT = 10, padB = 20   // padL matches the y-axis size (buildOpts axisBase)
  const plotW = width - padL - padR, plotH = height - padT - padB
  const yPos = (v) => padT + ((yMax - v) / ((yMax - yMin) || 1)) * plotH
  return {
    width, height,
    // uPlot's plot box (CSS px), same convention as padL/padT above.
    bbox: { left: padL, top: padT, width: plotW, height: plotH },
    // uPlot's series array includes the x-series at index 0.
    series: [{}, ...model.data.slice(1).map(() => ({ show: true }))],
    valToPos: (v, scale) => (scale === 'x' ? padL + ((v + 0.5) / n) * plotW : yPos(v)),
    yPos
  }
}

test('waterfall #15: sign classification — wf.roles classifies each bar up/down/total', () => {
  const m = seriesToUplot('waterfall', [{ label: 's', data: [
    { label: 'a', value: 10 }, { label: 'b', value: -25 }, { label: 'c', value: 5 }, { label: 'T', value: null, total: true }
  ] }])
  assert.deepEqual(m.wf.roles[0], ['up', 'down', 'up', 'total'], 'the fill decision lives in the model, next to bases/tops')
})

test('waterfall #15: opening anchor — total:true + numeric value on the FIRST point pins 0→value and resets the running total', () => {
  const m = seriesToUplot('waterfall', [{ label: 'walk', data: [
    { label: 'Opening', value: 500, total: true },
    { label: 'Deposits', value: 200 },
    { label: 'Rent', value: -150 },
    { label: 'Closing', value: null, total: true }
  ] }])
  assert.equal(m.ok, true)
  assert.deepEqual(m.wf.bases[0], [0, 500, 700, 0], 'opening bar pinned to 0; the walk starts from the authored opening, not from 0')
  assert.deepEqual(m.wf.tops[0], [500, 700, 550, 550], 'running total RESETS to the opening, then stays renderer-computed (L6)')
  assert.deepEqual(m.data[1], [500, 700, 550, 550], 'tops live in the uPlot data column')
  assert.deepEqual(m.wf.roles[0], ['total', 'up', 'down', 'total'])
})

test('waterfall #15: closing total equals opening + sum of the signed steps (L6: never agent-supplied)', () => {
  const steps = [320.5, -80, 15, -200.5]
  const m = seriesToUplot('waterfall', [{ label: 's', data: [
    { label: 'Open', value: 1000, total: true },
    ...steps.map((v, i) => ({ label: 'a' + i, value: v })),
    { label: 'Close', value: null, total: true }
  ] }])
  const last = m.wf.tops[0].length - 1
  assert.equal(m.wf.bases[0][last], 0, 'closing bar pinned to zero')
  assert.equal(m.wf.tops[0][last], 1000 + steps.reduce((a, b) => a + b, 0), 'closing = opening + net movement, computed by the renderer')
})

test('waterfall #15 migration: an OLD card without an anchor keeps identical geometry; only roles is added', () => {
  const m = seriesToUplot('waterfall', fx('chart-waterfall').series)
  assert.deepEqual(m.wf.bases[0], [0, 100, 60, 0])
  assert.deepEqual(m.wf.tops[0], [100, 60, 85, 85])
  assert.deepEqual(m.wf.totals[0], [false, false, false, true])
  assert.deepEqual(m.data[1], [100, 60, 85, 85])
  assert.deepEqual(m.wf.roles[0], ['up', 'down', 'up', 'total'], 'new field only — old cards render exactly as before')
})

// Review #16 (pf-mechanic) finding 5, ruling (a): the FIRST-point total:true + numeric
// value is DELIBERATELY an opening balance (maintainer ruling: keep the new meaning —
// main drew a zero-height bar for that shape, never what an author meant). This test
// pins the new geometry ON PURPOSE on the old catalog-admissible shape.
test('waterfall #16 R10 pin: first-point total:true + numeric value is the OPENING BALANCE on purpose (finding 5)', () => {
  const m = seriesToUplot('waterfall', [{ label: 's', data: [
    { label: 'open', value: 50, total: true }, { label: 'a', value: 5 }, { label: 'end', value: null, total: true }
  ] }])
  assert.deepEqual(m.wf.bases[0], [0, 50, 0], 'opening bar pins 0→50; the walk starts FROM the authored opening')
  assert.deepEqual(m.wf.tops[0], [50, 55, 55], 'running total starts at the anchor (main drew [0,5,5] — a zero-height opening bar)')
  // (5b) the semantic change is DOCUMENTED: the admitted ChartPoint_waterfall description
  // must state the first-point anchor rule (text-only update; shape/$defs unchanged).
  const catalog = JSON.parse(fsRead('catalog/hermes-rich-ui.catalog.json'))
  const desc = catalog.$defs.ChartPoint_waterfall.description
  assert.ok(/FIRST point with total:true and a numeric value is the opening anchor/i.test(desc),
    'catalog documents the opening-anchor meaning of a first-point total:true')
})

// Review #16 (pf-mechanic) finding 4: the anchor is the SERIES' first non-gap point, not
// union index 0 — a second series whose first labelled point is a new-label
// total+value anchor must not have its value silently ignored.
test('waterfall #16 anchor binds on the SERIES first non-gap index, not union index 0 (finding 4)', () => {
  const m = seriesToUplot('waterfall', [
    { label: 'a', data: [{ label: 'shared', value: 10 }, { label: 'x', value: null, total: true }] },
    { label: 'b', data: [{ label: 'x', value: 70, total: true }] }   // first point at union index 1
  ])
  assert.deepEqual(m.wf.bases[1], [null, 0], 'series b opening bar pins to 0 at ITS first index (union index 1)')
  assert.deepEqual(m.wf.tops[1], [null, 70], 'value 70 is the opening balance, NOT silently ignored (pre-fix: tops [null,0,0]-style)')
  assert.deepEqual(m.wf.roles[1], [null, 'total'])
})

test('waterfall #15 plan: thin connector from each bar top (running level) to the next bar base', () => {
  const props = fx('chart-waterfall')
  const m = seriesToUplot('waterfall', props.series)
  const u = fakeU(m)
  const plan = wfmod.waterfallPlan(u, m, props, COLORS)
  assert.equal(plan.connectors.length, m.xLabels.length - 1, 'one connector per adjacent pair')
  // A total bar's meaningful level is its running VALUE (top), not its pinned-to-zero base artifact.
  const walkLevel = (i) => (m.wf.totals[0][i] ? m.wf.tops[0][i] : m.wf.bases[0][i])
  plan.connectors.forEach((c, k) => {
    assert.equal(c.y1, u.yPos(m.wf.tops[0][k]), `connector ${k} leaves at the running level of bar ${k}`)
    assert.equal(c.y2, u.yPos(walkLevel(k + 1)), `connector ${k} lands at the walk level of bar ${k + 1}`)
    assert.equal(c.y1, c.y2, 'contiguous walk → horizontal connector')
    assert.ok(c.x2 > c.x1, 'runs left → right between the bars')
  })
})

test('waterfall #15 plan: bars get distinct role fills from the token palette (increase/decrease/total)', () => {
  const props = fx('chart-waterfall')
  const m = seriesToUplot('waterfall', props.series)
  const plan = wfmod.waterfallPlan(fakeU(m), m, props, COLORS)
  assert.deepEqual(plan.bars.map(b => b.role), ['up', 'down', 'up', 'total'])
  assert.deepEqual(plan.bars.map(b => b.fill), ['#22c55e', '#ef4444', '#22c55e', '#9ca3af'],
    'increase=green, decrease=red, total=neutral — token-driven (FALLBACK here, theme vars at runtime)')
  assert.equal(new Set(plan.bars.map(b => b.fill)).size, 3, 'three distinct fills')
})

test('waterfall #15 plan: honour a legend-hidden series (uPlot series.show === false)', () => {
  const props = fx('chart-waterfall')
  const m = seriesToUplot('waterfall', props.series)
  const u = fakeU(m)
  u.series[1].show = false
  const plan = wfmod.waterfallPlan(u, m, props, COLORS)
  assert.deepEqual(plan.bars, [], 'hidden series paints nothing')
})

test('waterfall #15 plan: signed step labels through the shared formatter (unit honoured); total shows the running value unsigned', () => {
  const props = fx('chart-waterfall')
  const m = seriesToUplot('waterfall', props.series)
  const plan = wfmod.waterfallPlan(fakeU(m, 900, 320), m, props, COLORS)
  assert.deepEqual(plan.labels.map(l => l.text), ['+100 USD', '-40 USD', '+25 USD', '85 USD'],
    'steps signed via the ONE formatMetric call site; total bars show the renderer-computed running value')
  assert.ok(plan.labels.every(l => Number.isFinite(l.x) && Number.isFinite(l.y)), 'labels are placed over their bars')
})

test('waterfall #15 plan: labels skip when bars are too narrow — 12 categories at 320px height never overlap', () => {
  const data = []
  for (let i = 0; i < 12; i++) data.push({ label: 'cat ' + i, value: i % 2 ? -1900 : 2800 })
  data.push({ label: 'close', value: null, total: true })
  const props = { kind: 'waterfall', unit: 'USD', series: [{ label: 'walk', data }] }
  const m = seriesToUplot('waterfall', props.series)
  const narrow = wfmod.waterfallPlan(fakeU(m, 400, 320), m, props, COLORS)
  assert.deepEqual(narrow.labels.map(l => l.text), [], '400px-wide plot: bars too narrow → labels skipped, never overlapped')
  const wide = wfmod.waterfallPlan(fakeU(m, 1100, 320), m, props, COLORS)
  assert.equal(wide.labels.length, 13, 'the same 13 bars label every step once the slots fit')
  for (let i = 1; i < wide.labels.length; i++) {
    const gap = Math.abs(wide.labels[i].x - wide.labels[i - 1].x)
    const halves = (wide.labels[i].text.length + wide.labels[i - 1].text.length) * 2.75 + 4
    assert.ok(gap >= halves, `labels ${i - 1}/${i} boxes do not overlap (${gap.toFixed(1)}px ≥ ${halves.toFixed(1)}px)`)
  }
})

test('waterfall #15 key: the three meanings are labelled Increase / Decrease / Total', () => {
  assert.deepEqual(wfmod.WF_ROLE_LABELS, { up: 'Increase', down: 'Decrease', total: 'Total' },
    'the banner key labels each sign class so the fills are decodable')
  const m = seriesToUplot('waterfall', fx('chart-waterfall').series)
  const plan = wfmod.waterfallPlan(fakeU(m), m, fx('chart-waterfall'), COLORS)
  assert.deepEqual(plan.key.map(e => e.label), ['Increase', 'Decrease', 'Total'])
  assert.deepEqual(plan.key.map(e => e.color), ['#22c55e', '#ef4444', '#9ca3af'])
})

// Review #16 (pf-mechanic) finding 1: the key banner is positioned from the PLOT BOX, not
// canvas-absolute — the y-axis gutter (size ~56) would otherwise sit under the swatches.
test('waterfall #16 key banner is positioned inside u.bbox, never in the y-axis gutter (finding 1)', () => {
  const paintKey = (u, plan) => {
    const painted = []
    const ctx = {
      canvas: { width: u.width },
      beginPath() {}, moveTo(x, y) { painted.push({ op: 'moveTo', x, y }) }, lineTo() {}, stroke() {},
      fillRect(x, y, w, h) { painted.push({ op: 'fillRect', x, y, w, h }) },
      fillText(t, x, y) { painted.push({ op: 'fillText', x, y, t }) },
      save() {}, restore() {}, setLineDash() {}
    }
    wfmod.drawWaterfallPlan({ ctx, width: u.width, bbox: u.bbox }, plan)
    return painted.filter(p => p.op === 'fillRect' && p.w <= 10.5)  // swatches only (bar rects are 100px+ wide)
  }
  // (1) Normal card: every swatch sits inside the plot box — never in the y-axis gutter
  // (canvas-absolute 6*pr/12*pr put them at x=6, far left of bbox.left ≈ 64).
  const m = seriesToUplot('waterfall', fx('chart-waterfall').series)
  const u = fakeU(m)
  const plan = wfmod.waterfallPlan(u, m, fx('chart-waterfall'), COLORS)
  const swatches = paintKey(u, plan)
  assert.equal(swatches.length, plan.key.length, 'one swatch per key entry')
  for (const s of swatches) {
    assert.ok(s.x >= u.bbox.left, `key swatch x=${s.x} stays right of the plot-box left edge (${u.bbox.left}) — out of the y-axis gutter`)
    assert.ok(s.y >= u.bbox.top, `key swatch y=${s.y} stays below the plot-box top edge (${u.bbox.top})`)
    assert.ok(s.x + s.w <= u.bbox.left + u.bbox.width, 'key stays inside the plot box on the right')
  }
  // (2) Headroom check: the tallest bar's top label area reaches into the banner band →
  // the banner moves to the TOP-RIGHT of the plot box (still inside it).
  const flipped = swatches[0].x
  assert.ok(flipped > u.bbox.left + 6, 'tallest bar under the banner band → key flips top-right')
  // (3) With bars clear of the band the banner keeps the plot-box top-LEFT anchor.
  const clear = paintKey(u, { ...plan, bars: [] })
  assert.equal(clear[0].x, u.bbox.left + 6, 'no overlap → banner anchors at bbox.left + 6')
  assert.ok(flipped > clear[0].x, 'the headroom fallback sits right of the left-aligned spot')
})

// Review #16 round 2 (pf-mechanic) blocker 1 (F1): the reserved key width came from a
// hardcoded KEY_W=165*pr while the painter actually drew ≈178.5*pr, so the top-right
// fallback put the "Total" TEXT ≈13px past bbox.right (probe at bbox.right=536 reached
// x≈543.5). The width now comes from keyLayout(pr, key) — the SAME per-item sum the
// painter walks — and the assertions below test the TEXT extent, not just the swatches.
function captureKeyPaint(u, plan) {
  const painted = []
  const ctx = {
    canvas: { width: u.width },
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fillRect(x, y, w, h) { painted.push({ op: 'fillRect', x, y, w, h }) },
    fillText(t, x, y) { painted.push({ op: 'fillText', x, y, t }) },
    save() {}, restore() {}, setLineDash() {}
  }
  wfmod.drawWaterfallPlan({ ctx, width: u.width, bbox: u.bbox }, { ...plan, labels: [] })   // value labels out of scope here
  return painted
}
const keyTextEnd = (p, pr = 1) => p.x + p.t.length * 5.5 * pr   // the painter's per-char estimate

test('waterfall #16 r2 key width: top-right fallback keeps the LAST TEXT inside bbox.right; left anchor never left of bbox.left (blocker 1)', () => {
  const m = seriesToUplot('waterfall', fx('chart-waterfall').series)
  // bbox.right = 536 (the reviewer's probe): padL 64 + padR 10 → canvas width 546.
  const u = fakeU(m, 546, 320)
  assert.equal(u.bbox.left + u.bbox.width, 536, 'probe canvas: bbox.right = 536')
  const plan = wfmod.waterfallPlan(u, m, fx('chart-waterfall'), COLORS)
  // (1) Fallback path (bars under the left banner band → top-right anchor).
  const texts = captureKeyPaint(u, plan).filter(p => p.op === 'fillText')
  assert.deepEqual(texts.map(t => t.t), ['Increase', 'Decrease', 'Total'], 'three key labels painted')
  for (const p of texts) {
    assert.ok(p.x >= u.bbox.left, `fallback key text "${p.t}" starts inside the plot box (x=${p.x} ≥ ${u.bbox.left})`)
    assert.ok(keyTextEnd(p) <= u.bbox.left + u.bbox.width,
      `fallback key text "${p.t}" ends at ${keyTextEnd(p).toFixed(1)} ≤ bbox.right ${u.bbox.left + u.bbox.width} (old KEY_W=165pr put Total at ≈543.5)`)
  }
  // (2) Left-anchored path: no bar in the band → every text starts ≥ bbox.left (and ends inside).
  const left = captureKeyPaint(u, { ...plan, bars: [] }).filter(p => p.op === 'fillText')
  for (const p of left) {
    assert.ok(p.x >= u.bbox.left, `left-anchored key text "${p.t}" starts ≥ bbox.left`)
    assert.ok(keyTextEnd(p) <= u.bbox.left + u.bbox.width, `left-anchored key text "${p.t}" ends ≤ bbox.right`)
  }
  // (3) keyLayout is the single source of truth: reserved width == the actually-drawn
  // extent, measured first swatch left edge → last text end.
  const layout = wfmod.keyLayout(1, plan.key)
  const leftAll = captureKeyPaint(u, { ...plan, bars: [] })
  const firstSwatch = leftAll.find(p => p.op === 'fillRect' && p.w <= 10.5)
  const drawn = leftAll.filter(p => p.op === 'fillText').pop()
  assert.ok(Math.abs(layout.width - (keyTextEnd(drawn) - firstSwatch.x)) < 1e-9,
    'reserved KEY_W equals the actually-drawn banner extent (one shared helper)')
})

// Review #16 round 3 (pf-mechanic) blocker B1: the right-edge clamp pinned the key ORIGIN
// to bbox.left but still painted every label — probes at pr=2 ended the last text at
// device x=497 past bbox.right=460 (240px chart) and past 300 at the 160px minimum
// (buildOpts width: Math.max(160, floor(width)), chart.mjs:631). Maintainer ruling: when
// keyLayout(pr, key).width exceeds the plot box minus the 6*pr margins on both sides, SKIP
// the key entirely (value labels and bar colours still carry the meaning; no single-swatch
// variant).
test('waterfall #16 r3 narrow chart: the whole key is skipped when keyLayout width exceeds the plot box minus margins (blocker B1)', () => {
  const pr = 2
  const m = seriesToUplot('waterfall', fx('chart-waterfall').series)
  const u = fakeU(m, 160, 320)                       // supported minimum: buildOpts width = max(160, floor(width))
  const plan = wfmod.waterfallPlan(u, m, fx('chart-waterfall'), COLORS)
  // Precondition: the banner genuinely cannot fit (round-3 probe geometry, pr=2).
  assert.ok(wfmod.keyLayout(pr, plan.key).width > u.bbox.width - 12 * pr,
    'probe canvas: the key is wider than the plot box minus both 6*pr margins')
  const painted = []
  const ctx = {
    canvas: { width: u.width * pr },                 // pr = canvas.width / u.width = 2
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
    fillRect(x, y, w, h) { painted.push({ op: 'fillRect', x, y, w, h }) },
    fillText(t, x, y) { painted.push({ op: 'fillText', x, y, t }) },
    save() {}, restore() {}, setLineDash() {}
  }
  const drawn = { ...plan, labels: [] }               // value labels out of scope: any fillText left is key paint
  wfmod.drawWaterfallPlan({ ctx, width: u.width, bbox: u.bbox }, drawn)
  const keyTexts = painted.filter(p => p.op === 'fillText')
  assert.deepEqual(keyTexts.map(p => p.t), [],
    'no key item is painted (equivalently: no key text extends past bbox.right — pre-fix the last text ended at 497 vs a 300 right edge)')
  assert.equal(drawn.keySkipped, true, 'the plan reports the key as skipped')
  // Sanity: a wide box at the same pr still paints the full key (the skip is width-gated,
  // not pr-gated) and reports it as not skipped.
  const wide = fakeU(m, 900, 320)
  const widePainted = []
  const wideCtx = { ...ctx, canvas: { width: wide.width * pr },
    fillRect(x, y, w, h) { widePainted.push({ op: 'fillRect', x, y, w, h }) },
    fillText(t, x, y) { widePainted.push({ op: 'fillText', x, y, t }) } }
  const wideDrawn = { ...wfmod.waterfallPlan(wide, m, fx('chart-waterfall'), COLORS), labels: [] }
  wfmod.drawWaterfallPlan({ ctx: wideCtx, width: wide.width, bbox: wide.bbox }, wideDrawn)
  assert.deepEqual(widePainted.filter(p => p.op === 'fillText').map(p => p.t), ['Increase', 'Decrease', 'Total'],
    'the wide-box key still paints at pr=2')
  assert.equal(wideDrawn.keySkipped, false, 'wide box → key not skipped')
})

// Review #16 round 2 (pf-mechanic) blocker 2 (F3, maintainer ruling): role colouring is
// scoped to SINGLE-SERIES waterfalls. Exactly one series → role fills + the
// Increase/Decrease/Total key + a neutralised uPlot series swatch (no legend colour that
// no bar uses). This test pins the single-series half; multi-series is next.
test('waterfall #16 r2 single-series: role fills, the key draws, and the legend swatch shows no colour no bar uses (blocker 2a)', () => {
  const props = fx('chart-waterfall')
  const m = seriesToUplot('waterfall', props.series)
  const plan = wfmod.waterfallPlan(fakeU(m, 900, 320), m, props, COLORS)
  assert.deepEqual(plan.bars.map(b => b.fill), ['#22c55e', '#ef4444', '#22c55e', '#9ca3af'],
    'single series: bars carry the increase/decrease/total role fills')
  assert.deepEqual(plan.key.map(e => e.label), ['Increase', 'Decrease', 'Total'], 'the role key is drawn')
  const o = buildOpts('waterfall', m, props, 400, COLORS)
  assert.ok(o.legend.markers, 'single-series waterfall neutralises the uPlot series swatch')
  assert.equal(o.legend.markers.width(null, 1), 0, 'no marker border (stroke colour is not shown)')
  assert.notEqual(o.legend.markers.fill(null, 1), COLORS.series[0],
    'swatch fill is NOT the SERIES_TOKENS colour — the legend shows no colour no bar uses')
  assert.equal(o.legend.markers.fill(null, 1), COLORS.text, 'swatch is the neutral text colour')
})

// Blocker 2b (the F3 regression pin): with TWO series the bars must keep main's
// per-series colours (exactly the pre-PR behaviour: fill = colors.series[i % n]), no
// role key is drawn, and the legend swatch colours equal the bar fills. This test FAILS
// at 0ab0b1a (there every series painted with the shared role fills and the key showed).
test('waterfall #16 r2 multi-series: per-series bar colours match the legend, no role key (blocker 2b, fails at 0ab0b1a)', () => {
  const props = { kind: 'waterfall', unit: 'USD', series: [
    { label: '2025', data: [{ label: 'open', value: 500, total: true }, { label: 'in', value: 200 }, { label: 'out', value: -80 }] },
    { label: '2026', data: [{ label: 'open', value: 400, total: true }, { label: 'in', value: 260 }, { label: 'out', value: -30 }] }
  ] }
  const m = seriesToUplot('waterfall', props.series)
  const u = fakeU(m, 900, 320)
  const plan = wfmod.waterfallPlan(u, m, props, COLORS)
  const group = 0.8, slot = group / m.labels.length
  const n = m.data[0].length
  const pxPerUnit = (u.valToPos(n - 0.5, 'x', true) - u.valToPos(-0.5, 'x', true)) / n
  // Which series does a bar belong to? Match its left edge against the plan's own slot formula.
  const seriesOf = (b) => {
    for (let s = 0; s < m.labels.length; s++)
      for (let i = 0; i < n; i++)
        if (Math.abs(u.valToPos(i, 'x', true) + (s * slot - group / 2) * pxPerUnit - b.x) < 1e-6) return s
    return -1
  }
  assert.ok(plan.bars.length >= 6, 'both series paint their bars')
  for (const b of plan.bars) {
    const s = seriesOf(b)
    assert.ok(s === 0 || s === 1, `bar at x=${b.x.toFixed(1)} resolves to a series slot (${s})`)
    assert.equal(b.fill, COLORS.series[s % COLORS.series.length],
      `series ${s}'s bar fill equals main's per-series colour (SERIES_TOKENS[${s}]) — pre-PR behaviour`)
  }
  assert.deepEqual(plan.key, [], 'multi-series: the role key is NOT drawn (the legend is the key)')
  assert.ok(plan.labels.length > 0 && plan.connectors.length > 0, 'labels and connectors still draw in multi-series mode')
  // Legend agreement: default uPlot markers (legendFill = s.fill) and s.fill === bar fill.
  const o = buildOpts('waterfall', m, props, 400, COLORS)
  assert.equal(o.legend.markers, undefined, 'multi-series keeps uPlot default legend markers')
  for (let s = 0; s < 2; s++) {
    const bars = plan.bars.filter(b => seriesOf(b) === s)
    assert.ok(bars.length > 0)
    for (const b of bars) assert.equal(b.fill, o.series[s + 1].fill,
      `legend swatch colour for series ${s} equals its bar fill`)
  }
})

// Review #16 (pf-mechanic) finding 2: value labels ride their SERIES' bar-slot centre
// (floatingRectPaths geometry), and the overlap walk runs across ALL series together —
// two series must never print on top of each other at the category centre.
test('waterfall #16 multi-series value labels sit at each series bar-slot centre, distinct per bar (finding 2)', () => {
  const props = { kind: 'waterfall', unit: 'USD', series: [
    { label: 'a', data: [{ label: 'x', value: 10 }, { label: 'y', value: -3 }] },
    { label: 'b', data: [{ label: 'x', value: 4 }, { label: 'y', value: 8 }] }
  ] }
  const m = seriesToUplot('waterfall', props.series)
  const u = fakeU(m, 900, 320)
  const plan = wfmod.waterfallPlan(u, m, props, COLORS)
  assert.equal(plan.labels.length, 4, 'every visible bar gets a label at a wide slot')
  assert.equal(new Set(plan.labels.map(l => l.x)).size, 4, 'label x are all DISTINCT — series share only the category centre (the bug)')
  // One label per bar slot: x == l + slot*pxPerUnit/2, the floatingRectPaths geometry.
  const n = m.data[0].length
  const group = 0.8, slot = group / m.labels.length
  const pxPerUnit = (u.valToPos(n - 0.5, 'x', true) - u.valToPos(-0.5, 'x', true)) / n
  const slots = plan.bars.map(b => b.x + Math.max(slot * pxPerUnit, 1) / 2)
  for (const l of plan.labels) {
    assert.ok(slots.some(sx => Math.abs(sx - l.x) < 0.5),
      `label at x=${l.x.toFixed(1)} sits on a bar-slot centre ${slots.map(s => s.toFixed(1)).join(',')}`)
  }
})

test('waterfall #15 opts: canvas key/labels/connectors wired via opts.hooks.draw; uPlot paints no rects itself', () => {
  const props = fx('chart-waterfall')
  const m = seriesToUplot('waterfall', props.series)
  const o = buildOpts('waterfall', m, props, 400, { ...COLORS, wf: { up: '#22c55e', down: '#ef4444', total: '#9ca3af' } })
  assert.ok(Array.isArray(o.hooks.draw) && o.hooks.draw.every(f => typeof f === 'function'), 'draw hook registered (opts.hooks.draw)')
  assert.equal(typeof o.series[1].paths, 'function')
  assert.deepEqual(o.series[1].paths(fakeU(m), 1, 0, 3), { stroke: null, fill: null, clip: null, band: null, gaps: null, flags: 0 },
    'bars are painted by the draw hook per role, so the series path paints nothing')
  assert.ok(!deepKeys(o).includes('stackGroup'), 'no uPlot stacking option anywhere (S7)')
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
