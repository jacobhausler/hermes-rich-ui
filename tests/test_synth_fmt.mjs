// L7 E-pack item 2 (format/data sugar): E11 Metric delta (with the RATIFY S9
// truth-table pins), E12 Progress target/unit/honest-total, E13 KeyValueList
// per-item format sugar (raw-verbatim pin).
import { test } from 'node:test'
import { assert, renderComponent, $, $$ } from './helpers/render.mjs'
// dynamic: the sdk stub loader is registered by helpers/render.mjs's evaluation,
// which runs after static imports link. Import components only after that.
const { computeDelta } = await import('../desktop/src/components/metric.mjs')

// ---- E11 Metric delta ----
test('E11 renderer computes delta + percent with arrow and tone (agent never pre-computes, L6)', async () => {
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'Revenue', value: 110, previous: 100, unit: 'k' } })
  const m = $('[data-ru="Metric"]')
  assert.equal(m.getAttribute('data-ru-delta'), 'up')
  const line = m.querySelector('[data-ru-delta-line]')
  assert.ok(line, 'delta row present')
  assert.equal(line.getAttribute('data-ru-delta-line'), 'up')
  assert.equal(line.getAttribute('data-ru-delta-percent'), '10')
  assert.ok(line.textContent.includes('▲'))
  assert.ok(line.textContent.includes('10'))
  assert.ok(line.style.color.includes('--ui-green'), 'up is green by default: ' + line.style.color)
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'X', value: 90, previous: 100 } })
  const down = $('[data-ru="Metric"] [data-ru-delta-line]')
  assert.equal(down.getAttribute('data-ru-delta-line'), 'down')
  assert.equal(down.getAttribute('data-ru-delta-percent'), '-10')
  assert.ok(down.textContent.includes('▼'))
  assert.ok(down.style.color.includes('--ui-red'))
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'X', value: 100, previous: 100 } })
  const flat = $('[data-ru="Metric"] [data-ru-delta-line]')
  assert.equal(flat.getAttribute('data-ru-delta-line'), 'flat')
  assert.ok(flat.style.color.includes('--ui-text-tertiary'), 'flat is muted')
})
test('E11 invertTone flips tones for lower-is-better metrics', async () => {
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'Cost', value: 110, previous: 100, invertTone: true } })
  const line = $('[data-ru="Metric"] [data-ru-delta-line]')
  assert.ok(line.style.color.includes('--ui-red'), 'up is RED when inverted: ' + line.style.color)
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'Cost', value: 90, previous: 100, invertTone: true } })
  assert.ok($('[data-ru="Metric"] [data-ru-delta-line]').style.color.includes('--ui-green'))
})
// RATIFY S9 truth-table pins (pure function — deterministic across engines):
test('E11/S9 PIN previous===0 -> percent unavailable, never inf or 100%', () => {
  const d = computeDelta(5, 0, false)
  assert.ok(d, 'delta row exists')
  assert.equal(d.percent, null, 'percent is unavailable, not Infinity')
  assert.equal(d.dir, 'up')
  assert.equal(d.delta, 5)
})
test('E11/S9 PIN value null or previous null/absent -> no delta row at all (L1)', () => {
  assert.equal(computeDelta(null, 100, false), null)
  assert.equal(computeDelta(undefined, 100, false), null)
  assert.equal(computeDelta(100, null, false), null)
  assert.equal(computeDelta(100, undefined, false), null, 'absent previous = no row')
  assert.equal(computeDelta(100, 'abc', false), null, 'non-numeric previous = no row')
})
test('E11 Metric without previous renders exactly as before (L8)', async () => {
  await renderComponent({ id: 'm', component: 'Metric', props: { label: 'A', value: 42 } })
  const m = $('[data-ru="Metric"]')
  assert.equal(m.querySelector('[data-ru-delta-line]'), null)
  assert.equal(m.getAttribute('data-ru-delta'), null)
  assert.equal(m.querySelector('[data-ru-value]').getAttribute('data-ru-value'), '42')
})
test('E11 negative previous: percent uses |previous| baseline', () => {
  const d = computeDelta(-50, -100, false)
  assert.equal(d.percent, 50, '(-50 - -100)/100 = +50%')
  assert.equal(d.dir, 'up')
})

// ---- E12 Progress target + unit + honest total ----
test('E12 target tick + vs-target line; unit suffix on the counter', async () => {
  await renderComponent({ id: 'p', component: 'Progress', props: { label: 'Builds', current: 3, total: 10, target: 8, unit: 'ci' } })
  const p = $('[data-ru="Progress"]')
  assert.equal(p.getAttribute('data-ru-target'), '8')
  assert.ok(p.querySelector('[data-ru-target-tick]'), 'tick element present')
  const vt = p.querySelector('[data-ru-vs-target]')
  assert.equal(vt.getAttribute('data-ru-vs-target'), 'ok')
  assert.ok(vt.textContent.includes('vs target 8 ci'), vt.textContent)
  assert.ok(p.textContent.includes('3 ci / 10 ci'), 'unit suffix ends the unitless 3 / 10 mystery')
})
test('E12 target > total: clamp names the relation (L4), tick clamped', async () => {
  await renderComponent({ id: 'p', component: 'Progress', props: { current: 3, total: 10, target: 12 } })
  const p = $('[data-ru="Progress"]')
  assert.equal(p.getAttribute('data-ru-target-error'), 'target_greater_than_total')
  const vt = p.querySelector('[data-ru-vs-target]')
  assert.ok(vt.getAttribute('data-ru-vs-target').includes('target_exceeds_total'))
  assert.ok(/target must be <= total/.test(vt.textContent), 'error names the relation: ' + vt.textContent)
})
test('E12 current-known total-null prints total unavailable, bar stays indeterminate', async () => {
  await renderComponent({ id: 'p', component: 'Progress', props: { label: 'Queue', current: 7, total: null } })
  const p = $('[data-ru="Progress"]')
  assert.equal(p.getAttribute('data-ru-indeterminate'), 'true')
  assert.ok(p.textContent.includes('7'), 'current still printed')
  assert.ok(p.textContent.includes('total unavailable'), p.textContent)
})
test('E12 current-null NEVER prints 0 (L1); no target -> no tick/vs-target (L8)', async () => {
  await renderComponent({ id: 'p', component: 'Progress', props: { current: null, total: 10 } })
  const p = $('[data-ru="Progress"]')
  assert.ok(p.querySelector('[data-ru-null]'), 'unavailable marker')
  assert.ok(!/\b0\b/.test(p.textContent), 'no zero anywhere: ' + p.textContent)
  assert.equal(p.querySelector('[data-ru-target-tick]'), null)
  assert.equal(p.querySelector('[data-ru-vs-target]'), null)
  assert.equal(p.getAttribute('data-ru-target'), null)
})
test('E12 determinate render unchanged without new props (L8)', async () => {
  await renderComponent({ id: 'p', component: 'Progress', props: { current: 3, total: 10 } })
  const p = $('[data-ru="Progress"]')
  assert.equal(p.getAttribute('data-ru-indeterminate'), 'false')
  assert.equal(p.getAttribute('aria-valuenow'), '3')
  assert.ok(p.textContent.includes('3 / 10'), 'old counter format kept: ' + p.textContent)
})

// ---- E13 KeyValueList per-item format sugar ----
test('E13 numeric value + format routes through formatMetric', async () => {
  await renderComponent({ id: 'k', component: 'KeyValueList', props: { items: [
    { label: 'Spend', value: 42000, format: 'currency' },
    { label: 'Rate', value: 12.345, format: 'percent', precision: 1 },
    { label: 'Count', value: 42000, unit: 'rows' }
  ] } })
  const dd = $$('[data-ru="KeyValueList"] dd')
  assert.equal(dd[0].textContent, '$42,000', '42000 no longer prints raw (the #1 L6 violation)')
  assert.equal(dd[1].textContent, '12.3%')
  assert.equal(dd[2].textContent, '42,000 rows')
})
test('E13 PIN non-numeric value + format -> raw string VERBATIM, never coerced', async () => {
  await renderComponent({ id: 'k', component: 'KeyValueList', props: { items: [
    { label: 'Build', value: '0042', format: 'number', precision: 2 },
    { label: 'Tag', value: 'N/A', format: 'currency' }
  ] } })
  const dd = $$('[data-ru="KeyValueList"] dd')
  assert.equal(dd[0].textContent, '0042', 'string stays byte-exact: no Number() coercion, no padding')
  assert.equal(dd[1].textContent, 'N/A', 'non-numeric + currency -> verbatim, never $N/A')
})
test('E13 null value still renders unavailable (L1)', async () => {
  await renderComponent({ id: 'k', component: 'KeyValueList', props: { items: [{ label: 'A', value: null, format: 'currency' }] } })
  const dd = $('[data-ru="KeyValueList"] dd')
  assert.ok(dd.querySelector('[data-ru-null]'))
  assert.ok(!dd.textContent.includes('$'))
})
test('E13 unformatted items render exactly as before (L8)', async () => {
  await renderComponent({ id: 'k', component: 'KeyValueList', props: { items: [{ label: 'A', value: 'plain' }] } })
  const dd = $('[data-ru="KeyValueList"] dd')
  assert.equal(dd.textContent, 'plain')
  assert.equal(dd.style.fontVariantNumeric, '', 'no tabular-nums when unformatted')
})
