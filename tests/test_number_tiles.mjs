// #29 (defaults epic slice 6): number tiles — Metric, Progress, KeyValueList all
// inherit the shared formatter (fmt.num/fmtSet/fmtPair) and the type ramp. RED-first:
// every assertion here fails against main because the three components still call the
// legacy formatMetric. No test reads source text (R6); everything is observed on the
// rendered DOM (house idiom: tests/test_tokens.mjs, tests/test_synth_fmt.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderSpec, renderComponent, $, $$ } from './helpers/render.mjs'
const NBSP = '\u00a0'

// ---- Metric: the face comes from num(); label/value/unit/delta/null per the rule ----
test('#29 Metric {value: 2.5e9} renders the house face with the exact readout in title + aria', async () => {
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'Revenue', value: 2.5e9 } })
  const v = $('[data-ru="Metric"] [data-ru-value]')
  assert.equal(v.textContent, '2.5B')
  assert.equal(v.getAttribute('data-ru-value'), '2.5B')
  assert.equal(v.getAttribute('title'), '2,500,000,000')
  assert.equal(v.getAttribute('aria-label'), '2,500,000,000')
})
test('#29 Metric Uptime 99.96 percent prints 99.96%', async () => {
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'Uptime', value: 99.96, format: 'percent' } })
  assert.equal($('[data-ru="Metric"] [data-ru-value]').textContent, '99.96%')
})
test('#29 Metric 1620.5 currency prints the identity face $1,620.50', async () => {
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'Spend', value: 1620.5, format: 'currency' } })
  assert.equal($('[data-ru="Metric"] [data-ru-value]').textContent, '$1,620.50')
})
test('#29 Metric additive fraction: {0.42, fraction} prints 42%', async () => {
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'Share', value: 0.42, format: 'fraction' } })
  assert.equal($('[data-ru="Metric"] [data-ru-value]').textContent, '42%')
})
test('#29 Metric label is caption+caps secondary on one line with ellipsis (full label in the Tip)', async () => {
  const label = 'Quarter over quarter net revenue retention rate across all cohorts'
  await renderComponent({ id: 'm', component: 'Metric', props: { label, value: 1 } })
  const m = $('[data-ru="Metric"]')
  const lab = m.querySelector('[data-ru-label]')
  assert.equal(lab.style.fontSize, '11px', 'caption step')
  assert.equal(lab.style.fontWeight, '400', 'caption weight (caps is cosmetic)')
  assert.ok(lab.style.textTransform === 'uppercase', 'caps')
  assert.ok(lab.style.color.includes('--ui-text-secondary'), 'secondary ink: ' + lab.style.color)
  assert.equal(lab.style.whiteSpace, 'nowrap')
  assert.equal(lab.style.textOverflow, 'ellipsis')
  assert.equal(lab.style.overflow, 'hidden')
  const tip = lab.querySelector('[data-slot="tip"]')
  assert.ok(tip, 'label sits in a Tip')
  assert.equal(tip.getAttribute('data-tip'), label, 'full label in the Tip')
})
test('#29 Metric unit is a sibling span in body secondary (currency carries no sibling)', async () => {
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'Latency', value: 318, unit: 'ms' } })
  const sib = $('[data-ru="Metric"] [data-ru-unit]')
  assert.ok(sib, 'unit sibling span exists')
  assert.equal(sib.tagName, 'SPAN')
  assert.equal(sib.textContent, 'ms')
  assert.equal(sib.style.fontSize, '13px', 'body step')
  assert.ok(sib.style.color.includes('--ui-text-secondary'), 'secondary ink')
  assert.equal($('[data-ru="Metric"] [data-ru-value]').textContent, '318', 'face stays bare digits')
  await renderComponent({ id: 'm2', component: 'Metric', props: { label: 'Spend', value: 42, format: 'currency' } })
  assert.equal($('[data-ru="Metric"] [data-ru-unit]'), null, 'currency prints no sibling unit')
})
test('#29 Metric delta: caption in TONE_TEXT, same face as the value, rates in pp, n× above +999%', async () => {
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'Revenue', value: 110, previous: 100 } })
  const m = $('[data-ru="Metric"]')
  const line = m.querySelector('[data-ru-delta-line]')
  assert.equal(line.style.fontSize, '11px', 'caption step')
  assert.ok(line.style.color.startsWith('color-mix(in srgb, var(--ui-green)'), 'TONE_TEXT green: ' + line.style.color)
  assert.equal(m.querySelector('[data-ru-value]').style.fontFamily, line.style.fontFamily, 'same face as the value')
  // rate metric: percentage points, never %
  await renderComponent({ id: 'r', component: 'Metric', props: { label: 'Rate', value: 12.4, previous: 12.15, format: 'percent' } })
  const rate = $('[data-ru="Metric"] [data-ru-delta-line]')
  assert.ok(rate.textContent.includes('0.25' + NBSP + 'pp'), 'rate delta in pp: ' + rate.textContent)
  // huge delta: n× face above +999% (24 vs 2 = +1100% -> 12×)
  await renderComponent({ id: 'h', component: 'Metric', props: { label: 'Signups', value: 24, previous: 2 } })
  const big = $('[data-ru="Metric"] [data-ru-delta-line]')
  assert.ok(/12×/.test(big.textContent), 'n× above +999%: ' + big.textContent)
  assert.ok(!/\+1100%/.test(big.textContent), 'never the raw +1100%')
})
test('#29 Metric equal-to-baseline delta reads a neutral 0', async () => {
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'X', value: 5, previous: 5 } })
  const line = $('[data-ru="Metric"] [data-ru-delta-line]')
  assert.ok(/(^|\s)0(\s|$)/.test(line.textContent.trim()), 'plain 0: ' + line.textContent)
  assert.ok(!line.textContent.includes('0.0'), 'no decimals on the equal case')
  assert.ok(line.style.color.includes('--ui-text-tertiary'), 'flat stays neutral')
})
test('#29 Metric null value prints `unavailable` in body 13 italic secondary', async () => {
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'Missing', value: null } })
  const v = $('[data-ru="Metric"] [data-ru-value]')
  assert.equal(v.textContent, 'unavailable')
  assert.ok(v.querySelector('[data-ru-null]'), 'null marker present')
  const sp = v.querySelector('[data-ru-null]')
  assert.equal(sp.style.fontSize, '13px', 'body step')
  assert.equal(sp.style.fontStyle, 'italic')
  assert.ok(sp.style.color.includes('--ui-text-secondary'), 'secondary ink')
})

// ---- KPI row: one fmtSet across the tiles (collision guard) ----
test('#29 KPI row: four Metrics 12340..12343 in one Grid never share one face', async () => {
  const ids = ['t1', 't2', 't3', 't4']
  const elements = { root: { type: 'Grid', props: { id: 'root', component: 'Grid', columns: 4 }, children: ids } }
  ids.forEach((id, i) => { elements[id] = { type: 'Metric', props: { id, component: 'Metric', label: 'T' + i, value: 12340 + i }, children: [] } })
  await renderSpec({ root: 'root', elements }, {})
  const faces = $$('[data-ru="Metric"] [data-ru-value]').map(el => el.getAttribute('data-ru-value'))
  assert.equal(faces.length, 4)
  assert.equal(new Set(faces).size, 4, 'one fmtSet across the row, collisions widen: ' + faces.join(' | '))
})

// ---- Progress: counter = fmtPair + ' · P%' with <1%/>99% guards ----
test('#29 Progress {7400, 10000, USD} counter prints $7.4k / $10k · 74%', async () => {
  await renderComponent({ id: 'p', component: 'Progress', props: { label: 'Emergency fund', current: 7400, total: 10000, unit: 'USD' } })
  const counter = $('[data-ru="Progress"] [data-ru-counter]')
  assert.equal(counter.textContent, `$7.4k / $10k · 74%`)
})
test('#29 Progress guards: <1% prints <1%, >99% prints >99%, exactly 0/100 print whole', async () => {
  await renderComponent({ id: 'p', component: 'Progress', props: { current: 1, total: 1000 } })
  assert.equal($('[data-ru="Progress"] [data-ru-counter]').textContent, '1 / 1,000 · <1%')
  await renderComponent({ id: 'p', component: 'Progress', props: { current: 998, total: 1000 } })
  assert.equal($('[data-ru="Progress"] [data-ru-counter]').textContent, '998 / 1,000 · >99%')
  await renderComponent({ id: 'p', component: 'Progress', props: { current: 0, total: 1000 } })
  assert.equal($('[data-ru="Progress"] [data-ru-counter]').textContent, '0 / 1,000 · 0%')
  await renderComponent({ id: 'p', component: 'Progress', props: { current: 1000, total: 1000 } })
  assert.equal($('[data-ru="Progress"] [data-ru-counter]').textContent, '1,000 / 1,000 · 100%')
})
test('#29 Progress indeterminate: full-track text-tertiary hatch + `· total unavailable`', async () => {
  await renderComponent({ id: 'p', component: 'Progress', props: { label: 'Queue', current: 7, total: null } })
  const p = $('[data-ru="Progress"]')
  assert.equal(p.getAttribute('data-ru-indeterminate'), 'true')
  assert.ok(p.textContent.includes('total unavailable'))
  const fill = p.querySelector('[data-ru-fill]')
  assert.equal(fill.style.width, '100%', 'hatch spans the FULL track')
  assert.ok(fill.style.color.includes('--ui-text-tertiary'), 'hatch ink is text-tertiary: ' + fill.style.color)
  assert.ok(/repeating-linear-gradient/.test(fill.style.backgroundImage || ''), 'hatch is drawn')
})

// ---- KeyValueList: house face for bare JSON numbers, strings verbatim, key column ----
test('#29 KV {Rows:1234567, Year:1998, Build:"0042"} renders 1.23M · 1998 · 0042', async () => {
  await renderComponent({ id: 'k', component: 'KeyValueList', props: { items: [
    { label: 'Rows', value: 1234567 },
    { label: 'Year', value: 1998 },
    { label: 'Build', value: '0042' }
  ] } })
  const dd = $$('[data-ru="KeyValueList"] dd')
  assert.deepEqual(dd.map(d => d.textContent), ['1.23M', '1998', '0042'])
})
test('#29 KV key column is fit-content(40%)', async () => {
  await renderComponent({ id: 'k', component: 'KeyValueList', props: { items: [{ label: 'A', value: 1 }] } })
  assert.ok($('[data-ru="KeyValueList"] dl').style.gridTemplateColumns.startsWith('fit-content(40%)'))
})
test('#29 KV additive optional title renders as an h3', async () => {
  await renderComponent({ id: 'k', component: 'KeyValueList', props: { title: 'Run facts', items: [{ label: 'A', value: 1 }] } })
  const h = $('[data-ru="KeyValueList"] h3')
  assert.ok(h, 'h3 rendered')
  assert.equal(h.textContent, 'Run facts')
})
test('#29 KV additive fraction: {12.4, percent} stays 12.4%, {0.42, fraction} prints 42%', async () => {
  await renderComponent({ id: 'k', component: 'KeyValueList', props: { items: [
    { label: 'Rate', value: 12.4, format: 'percent' },
    { label: 'Share', value: 0.42, format: 'fraction' }
  ] } })
  const dd = $$('[data-ru="KeyValueList"] dd')
  assert.equal(dd[0].textContent, '12.4%')
  assert.equal(dd[1].textContent, '42%')
})
