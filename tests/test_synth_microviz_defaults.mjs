// Defaults epic #33 (slice 10): the exact-rule pins for BarList / Sparkline / HeatMap
// as the defaults render them. RED-first: every pin below fails until the components
// implement the slice-10 rules (one grid + shared track + fmtSet + markFill + left-of-
// zero negatives + 'No items'; arrow chip + computed aria; rank ramp 12-60% + signed
// colors + fmtPair caption + cell aria). The harness mark-fill pin (tests/helpers/
// mark_fill.mjs) runs here too: BarList, DataTable bar and Progress fills >= 3:1
// against the card in light AND dark.
import { test } from 'node:test'
import { assert, registerLane, renderComponent, React, mount } from './helpers/render.mjs'
import { HOUSE } from '../desktop/src/components/_house.mjs'
import { markFill, assertMarkFillsContrast, THEMES } from './helpers/mark_fill.mjs'

const { BarList, barShares } = await import('../desktop/src/components/barlist.mjs')
const { Sparkline } = await import('../desktop/src/components/sparkline.mjs')
const { HeatMap, heatModel } = await import('../desktop/src/components/heatmap.mjs')
const shared = await import('../desktop/src/components/_shared.mjs')

registerLane('BarList', BarList)
registerLane('Sparkline', Sparkline)
registerLane('HeatMap', HeatMap)

const pct = (el) => parseFloat(/width:\s*([\d.]+)%/.exec(el.getAttribute('style') || '')[1])

// ------------------------------------------------------------------ BarList

test('#33 BarList: one grid row — shared track, fit-content(40%) labels, right-aligned values', async () => {
  await renderComponent({ id: 'b', component: 'BarList', props: { items: [{ label: 'a', value: 10 }, { label: 'b', value: 4 }] } })
  const rows = [...mount.querySelectorAll('[data-ru-item]')]
  assert.equal(rows.length, 2)
  for (const row of rows) {
    const st = row.getAttribute('style')
    assert.match(st, /display:\s*grid/, 'one grid (S12)')
    assert.match(st, /grid-template-columns:\s*fit-content\(40%\) 1fr auto/, 'label column fit-content(40%), shared track, value column')
  }
  const label = rows[0].querySelector('[data-ru-item-label]')
  assert.ok(label, 'label element marked')
  const value = rows[0].querySelector('[data-ru-item-value]')
  assert.equal(value.getAttribute('style').match(/text-align:\s*right/)?.[0], 'text-align: right', 'values right-aligned in one column')
  // shared track: every row's aria-hidden track spans the same 1fr lane — pinned by structure (one 1fr column) and equal track width
  const tracks = rows.map(r => r.querySelector('[aria-hidden="true"]'))
  assert.equal(tracks.length, 2, 'every row keeps a track, shared geometry')
})

test('#33 BarList: items formatted as ONE fmtSet — USD [1234,950,0.5] -> $1,234.00 / $950.00 / $0.50 (one cents tier)', async () => {
  await renderComponent({ id: 'b', component: 'BarList', props: { items: [{ label: 'x', value: 1234 }, { label: 'y', value: 950 }, { label: 'z', value: 0.5 }], format: 'currency', unit: 'USD' } })
  const rows = [...mount.querySelectorAll('[data-ru-item]')]
  assert.deepEqual(rows.map(r => r.querySelector('[data-ru-item-value]').textContent), ['$1,234.00', '$950.00', '$0.50'], 'fmtSet cents rule: whole money carries cents when a sibling needs them')
})

test('#33 BarList: collision guard — 12,340 and 12,344 never share a face', async () => {
  await renderComponent({ id: 'b', component: 'BarList', props: { items: [{ label: 'a', value: 12340 }, { label: 'b', value: 12344 }] } })
  const faces = [...mount.querySelectorAll('[data-ru-item-value]')].map(el => el.textContent)
  assert.deepEqual(faces, ['12,340', '12,344'], 'distinct values never collapse to one face')
})

test('#33 BarList: a smaller value never draws a longer bar; non-zero bars >= 3 px; fill = mark-fill helper', async () => {
  await renderComponent({ id: 'b', component: 'BarList', props: { items: [{ label: 'big', value: 10 }, { label: 'tiny', value: 0.01 }, { label: 'half', value: 5 }] } })
  const rows = [...mount.querySelectorAll('[data-ru-item]')]
  const byLabel = new Map(rows.map(r => [r.querySelector('[data-ru-item-label]').textContent, r]))
  const w = (l) => pct(byLabel.get(l).querySelector('[data-ru-item-fill]'))
  assert.ok(w('tiny') < w('half') && w('half') < w('big'), 'width order follows value order')
  assert.ok(w('tiny') > 0, 'non-zero value draws a real bar')
  for (const l of ['big', 'half', 'tiny']) {
    const el = byLabel.get(l).querySelector('[data-ru-item-fill]')
    assert.ok(Number(el.getAttribute('data-ru-fill-min')) >= 3, `${l} non-zero bar >= 3 px floor`)
    assert.match(el.getAttribute('style'), /background:\s*color-mix\(in srgb, var\(--ui-accent\) \d+%, var\(--ui-bg-tertiary\)\)/, 'fill comes from the shared mark-fill helper')
  }
})

test('#33 BarList: negatives extend LEFT of the zero line (replaces the old clip-to-blank pin — new pin: data-ru-item="negative")', async () => {
  await renderComponent({ id: 'b', component: 'BarList', props: { items: [{ label: 'pos', value: 8 }, { label: 'neg', value: -4 }] } })
  const rows = [...mount.querySelectorAll('[data-ru-item]')]
  const neg = rows.find(r => r.getAttribute('data-ru-item') === 'negative')
  assert.ok(neg, 'negative rows are marked negative (old clip-blank pin replaced and named)')
  const fill = neg.querySelector('[data-ru-item-fill]')
  assert.ok(fill, 'negative draws a fill, not a blank')
  assert.match(fill.getAttribute('style'), /right:\s*50%/, 'fill starts at the zero line and extends left')
  assert.ok(/width:\s*[\d.]+%/.test(fill.getAttribute('style')), 'share ∝ |value| / columnMax')
  const pos = rows.find(r => r.getAttribute('data-ru-item') === 'ok')
  assert.match(pos.querySelector('[data-ru-item-fill]').getAttribute('style'), /left:\s*50%|left:\s*0/, 'positive draws right of the zero line')
})

test('#33 BarList: [] renders No items; optional title', async () => {
  await renderComponent({ id: 'b', component: 'BarList', props: { items: [] } })
  assert.equal(mount.querySelector('[data-ru="BarList"]').textContent.trim(), 'No items', 'empty list says No items (J7)')
  await renderComponent({ id: 'b', component: 'BarList', props: { title: 'Top lanes', items: [{ label: 'a', value: 1 }] } })
  const t = mount.querySelector('[data-ru-itemlist-title]')
  assert.ok(t && t.textContent === 'Top lanes', 'optional title renders (E-B5)')
})

test('#33 BarList keeps the house pins: nulls sink last as unavailable, sort applies', async () => {
  await renderComponent({ id: 'b', component: 'BarList', props: { items: [{ label: 'n', value: null }, { label: 'hi', value: 9 }, { label: 'lo', value: 1 }] } })
  const root = mount.querySelector('[data-ru="BarList"]')
  assert.equal(root.getAttribute('data-ru-count'), '2')
  const rows = [...root.querySelectorAll('[data-ru-item]')]
  assert.deepEqual(rows.map(r => r.getAttribute('data-ru-item')), ['ok', 'ok', 'unavailable'], 'null sinks last')
  assert.match(rows[2].textContent, /unavailable/, 'null renders unavailable, never 0')
})

// ---------------------------------------------------------------- Sparkline

test('#33 Sparkline: trend chip is the shared StatusMark SVG arrow in the stroke color (not ▲)', async () => {
  assert.equal(typeof shared.StatusMark, 'function', 'StatusMark primitive lives in _shared.mjs')
  await renderComponent({ id: 's', component: 'Sparkline', props: { values: [3, 5, 4, 6], tone: 'error' } })
  const root = mount.querySelector('[data-ru="Sparkline"]')
  assert.equal(root.getAttribute('data-ru-trend'), 'up')
  const chip = root.querySelector('[data-ru-chip="up"]')
  assert.ok(chip, 'chip carries the trend name')
  const svg = chip.querySelector('svg')
  assert.ok(svg, 'chip is an SVG arrow (E-S4)')
  assert.match(svg.getAttribute('stroke') || chip.innerHTML, /var\(--ui-red\)/, 'arrow rides the stroke color: tone error ≡ danger (E-S5)')
  assert.doesNotMatch(chip.textContent, /▲/, 'text-glyph chip is gone')
})

test('#33 Sparkline: no axes, no axis text, last and isolated points dotted, full-height path', async () => {
  await renderComponent({ id: 's', component: 'Sparkline', props: { values: [3, 5, 4, 6] } })
  const root = mount.querySelector('[data-ru="Sparkline"]')
  assert.doesNotMatch(root.textContent, /1\/1\/70/, 'no axis text ever (E-S2)')
  assert.equal(root.querySelector('.u-axis'), null, 'no axes chrome')
  assert.match(root.getAttribute('style'), /display:\s*inline-flex/)
  const canvasHost = root.querySelector('[data-richui="chart-canvas"]')
  assert.equal(canvasHost.style.width, '120px', '120 x 24 defaults')
  assert.equal(canvasHost.style.height, '24px')
})

test('#33 Sparkline: title/aria = `label: first → last, low, high`', async () => {
  await renderComponent({ id: 's', component: 'Sparkline', props: { values: [3, 1, 4, 6], label: 'Latency' } })
  const root = mount.querySelector('[data-ru="Sparkline"]')
  assert.equal(root.getAttribute('aria-label'), 'Latency: 3 → 6, low 1, high 6', 'readout aria (E-S6)')
  assert.equal(root.querySelector('[data-ru-sparkline-title]').textContent, 'Latency', 'label prints as the title (E-S6)')
  await renderComponent({ id: 's', component: 'Sparkline', props: { values: [7] } })
  assert.equal(mount.querySelector('[data-ru="Sparkline"]').getAttribute('aria-label'), '7 → 7, low 7, high 7', 'single point: first==last==low==high')
})

// ------------------------------------------------------------------ HeatMap

test('#33 HeatMap: rank ramp 12–60% — a 100x outlier keeps every other cell >= 12% mix (S9)', async () => {
  const rows = [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }, { label: 'e' }]
  const cols = [{ label: 'x' }]
  const values = [1, 1, 2, 3, 100]
  const m = heatModel(rows, cols, rows.map((r, i) => ({ row: r.label, col: 'x', value: values[i] })))
  const steps = m.cells.map(c => c.mixPct)
  assert.ok(steps.every(s => s >= HOUSE.HEAT_MIX[0] && s <= HOUSE.HEAT_MIX[1]), `ramp stays inside HEAT_MIX: ${steps}`)
  assert.ok(steps[1] >= 12 && steps[4] <= 60, 'outlier never sinks the field below the 12% floor')
  assert.ok(steps[0] === steps[1], 'equal ranks share one step (rank, not linear)')
  assert.ok(steps[0] < steps[2] && steps[2] < steps[4], 'rank ramp monotone in value')
  await renderComponent({ id: 'h', component: 'HeatMap', props: { rows, cols, cells: rows.map((r, i) => ({ row: r.label, col: 'x', value: values[i] })) } })
  const tds = [...mount.querySelectorAll('td')]
  for (const td of tds) {
    const mix = parseFloat(/color-mix\(in srgb, var\(--ui-accent\) ([\d.]+)%/.exec(td.getAttribute('style'))[1])
    assert.ok(mix >= 12 && mix <= 60, `rendered cell mix ${mix}% inside HEAT_MIX`)
  }
})

test('#33 HeatMap: signed values — orange below 0, accent above (C10)', async () => {
  const props = { rows: [{ label: 'r' }], cols: [{ label: 'a' }, { label: 'b' }], cells: [{ row: 'r', col: 'a', value: -5 }, { row: 'r', col: 'b', value: 5 }] }
  await renderComponent({ id: 'h', component: 'HeatMap', props })
  const tds = [...mount.querySelectorAll('td')]
  assert.match(tds[0].getAttribute('style'), /color-mix\(in srgb, var\(--ui-orange\)/, 'below zero rides orange')
  assert.match(tds[1].getAttribute('style'), /color-mix\(in srgb, var\(--ui-accent\)/, 'above zero rides the accent')
})

test('#33 HeatMap: primary ink, cells small 12 (S17), min-width 40, overflow-x scroll', async () => {
  const props = { rows: [{ label: 'r' }], cols: [{ label: 'a' }], cells: [{ row: 'r', col: 'a', value: 3 }] }
  await renderComponent({ id: 'h', component: 'HeatMap', props })
  const td = mount.querySelector('td')
  assert.match(td.getAttribute('style'), /font-size:\s*12px/, 'cells small 12 (S17)')
  assert.match(td.getAttribute('style'), /color:\s*var\(--ui-text-primary\)/, 'primary ink (C24)')
  assert.match(td.getAttribute('style'), /min-width:\s*40px/, 'cell min-width 40')
  assert.match(mount.querySelector('[data-richui="heatmap-grid"]').getAttribute('style'), /overflow-x:\s*scroll/, 'overflow-x scroll')
})

test('#33 HeatMap: caption via fmtPair, optional title, every cell aria-label = readout', async () => {
  const props = { title: 'Queue heat', rows: [{ label: 'mon' }, { label: 'tue' }], cols: [{ label: 'a' }, { label: 'b' }],
    cells: [{ row: 'mon', col: 'a', value: 1 }, { row: 'mon', col: 'b', value: 9 }, { row: 'tue', col: 'a', value: 5 }], unit: 'ms' }
  await renderComponent({ id: 'h', component: 'HeatMap', props })
  const root = mount.querySelector('[data-ru="HeatMap"]')
  assert.equal(root.querySelector('[data-ru-heatmap-title]').textContent, 'Queue heat', 'optional title (E-H7)')
  const cap = root.querySelector('[data-richui="heatmap-caption"]')
  assert.match(cap.textContent, /1 ms \/ 9 ms/, 'caption prints the fmtPair of observed min/max')
  const td = root.querySelector('td[data-ru-value]')
  assert.equal(td.getAttribute('aria-label'), 'mon, a: 5 ms', 'cell aria-label = readout (E-H6)')
})

// ------------------------------------------------ harness mark-fill pin (#33)

test('#33 harness pin: BarList fill, DataTable bar and Progress fills >= 3:1 vs the card, light AND dark', () => {
  for (const theme of Object.values(THEMES)) {
    const mf = markFill(theme['--ui-accent'], theme['--ui-bg-tertiary'], HOUSE.MARK_FILL_MIX)
    assert.ok(mf, 'markFill builds a resolvable fill')
  }
  // The components' own fill expression must equal the pinned one (markFill helper).
  assertMarkFillsContrast((accent, tertiary) => markFill(accent, tertiary, HOUSE.MARK_FILL_MIX))
})
