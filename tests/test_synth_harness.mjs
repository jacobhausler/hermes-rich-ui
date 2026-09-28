// Smoke test for the shared harness (tests/helpers/render.mjs) — renders two
// existing types directly, proving the lane test scaffold works before lanes
// rely on it. This file belongs to the prep commit; lanes never edit it.
import { test } from 'node:test'
import { assert, renderComponent, $ } from './helpers/render.mjs'

const mountEl = document.getElementById('r')

test('harness: Metric renders through the real registry', async () => {
  await renderComponent({ id: 'm1', component: 'Metric', props: { label: 'Latency', value: 42, unit: 'ms' } })
  assert.ok($('[data-ru="Metric"]'), 'Metric marker missing')
  assert.match(mountEl.textContent || '', /42/)
})

test('harness: Text variant caption renders', async () => {
  await renderComponent({ id: 't1', component: 'Text', props: { text: 'hello lanes', variant: 'caption' } })
  assert.ok($('[data-ru="Text"]'), 'Text marker missing')
})
