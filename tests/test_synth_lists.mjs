// Lane L4 (lists) render ACCEPT — Checklist (N3) + ChipSet (N4).
// Run: node --test tests/test_synth_lists.mjs   (exit 0 = green)
import { test } from 'node:test'
import { assert, renderComponent, registerLane, $, $$, mount } from './helpers/render.mjs'
// Dynamic imports: the harness registers the '@hermes/plugin-sdk' resolve hook
// at runtime, so component modules (which import _shared.mjs -> the SDK) must
// be imported AFTER the helper finishes setup — same pattern the harness itself uses.
const { Checklist } = await import('../desktop/src/components/checklist.mjs')
const { ChipSet } = await import('../desktop/src/components/chipset.mjs')

const items7 = [
  { label: 'Collect samples', done: true },
  { label: 'Normalize units', done: true },
  { label: 'Cross-check totals', done: true },
  { label: 'Review outliers', done: false },
  { label: 'Draft summary', done: false },
  { label: 'Verify citations', done: null },
  { label: 'Publish card' }
]

test('unknown type renders the fallback (proves the asserts below bind)', async () => {
  // v0.1.1: Checklist is registered in the real registry (index.mjs), so the
  // original pre-register guard is obsolete; an impossible type keeps this
  // control honest — the marker asserts below could only fail open.
  await renderComponent({ id: 'pre', component: 'ChecklistNotAComponent', props: { items: items7 } })
  assert.ok(!$('[data-ru="Checklist"]'), 'fallback control must not render a Checklist')
  assert.ok($('[data-ru-unknown]'), 'fallback should have rendered')
})

test('Checklist: renders marker, items, and renderer-computed tally 3/7', async () => {
  registerLane('Checklist', Checklist)
  await renderComponent({ id: 'ck', component: 'Checklist', props: { title: 'Launch readiness', items: items7 } })
  assert.ok($('[data-ru="Checklist"]'), 'Checklist marker missing')
  assert.equal($('[data-ru="Checklist"]').getAttribute('data-ru-tally'), '3/7', 'data-ru-tally must be renderer-computed 3/7 (L6)')
  assert.equal($('[data-ru-tally-text]').getAttribute('data-ru-tally-text'), '3/7', 'visible tally text must match')
  assert.equal($('[data-ru-tally-text]').getAttribute('role'), 'status', 'tally must be native read-only status text')
  assert.ok(mount.textContent.includes('3/7'), 'tally text content')
  assert.ok(mount.textContent.includes('Launch readiness'), 'title renders')
  assert.equal($$('li').length, 7, 'seven items')
  assert.equal($$('[data-ru-state="done"]').length, 3)
  assert.equal($$('[data-ru-state="unchecked"]').length, 2)
  assert.equal($$('[data-ru-state="unknown"]').length, 2, 'null AND absent done are both UNKNOWN')
})

test('Checklist: null ≠ false — UNKNOWN is styled distinctly from UNCHECKED (L1)', async () => {
  await renderComponent({ id: 'ck2', component: 'Checklist', props: { items: [{ label: 'is-false', done: false }, { label: 'is-null', done: null }] } })
  const falseMk = $$('[data-ru-state]')[0].querySelector('[data-ru-marker]')
  const nullMk = $$('[data-ru-state]')[1].querySelector('[data-ru-marker]')
  assert.equal(falseMk.getAttribute('data-ru-marker'), 'unchecked')
  assert.equal(nullMk.getAttribute('data-ru-marker'), 'unknown', 'a null must never become unchecked')
  assert.notEqual(nullMk.getAttribute('style'), falseMk.getAttribute('style'), 'UNKNOWN and UNCHECKED styling must differ')
  assert.equal(falseMk.getAttribute('aria-label'), 'not done')
  assert.equal(nullMk.getAttribute('aria-label'), 'unknown')
})

test('Checklist: read-only — no checkbox/input elements ever', async () => {
  assert.equal($('input'), null, 'native read-only status text, never an interactive checkbox')
  assert.equal($$('button').length, 0)
})

test('Checklist: showTally false hides the tally; empty items tally is 0/0', async () => {
  await renderComponent({ id: 'ck3', component: 'Checklist', props: { title: 'Quiet', items: items7, showTally: false } })
  assert.equal($('[data-ru-tally-text]'), null, 'showTally:false hides the tally text')
  assert.equal($('[data-ru="Checklist"]').getAttribute('data-ru-tally'), '3/7', 'the data attr stays for tooling')
  await renderComponent({ id: 'ck4', component: 'Checklist', props: { items: [] } })
  assert.equal($('[data-ru="Checklist"]').getAttribute('data-ru-tally'), '0/0')
  assert.equal($$('li').length, 0, 'empty items renders no rows without crash')
})

test('Checklist: per-item sourceIds render the superscript', async () => {
  const state = { meta: { sources: [{ id: 's1', kind: 'web', label: 'Example source', url: 'https://example.org/x' }] } }
  await renderComponent({ id: 'ck5', component: 'Checklist', props: { items: [{ label: 'Cited step', done: true, sourceIds: ['s1'] }] } }, state)
  const sup = $('[data-ru-sources]')
  assert.ok(sup, 'per-item sourceIds superscript missing')
  assert.equal(sup.getAttribute('data-ru-sources'), '1')
})

test('ChipSet: renders N SDK badges from 1 component with data-ru-count', async () => {
  registerLane('ChipSet', ChipSet)
  const labels = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta']
  await renderComponent({ id: 'cs', component: 'ChipSet', props: { labels, tone: 'success' } })
  assert.ok($('[data-ru="ChipSet"]'), 'ChipSet marker missing')
  assert.equal($('[data-ru="ChipSet"]').getAttribute('data-ru-count'), String(labels.length), 'data-ru-count = labels.length')
  assert.equal($$('[data-slot="badge"]').length, labels.length, 'N badges from 1 component')
  assert.ok($('[data-slot="badge"]')?.getAttribute('data-variant') === 'success', 'tone maps through Badge variant')
  assert.ok($('[data-slot="badge"]')?.getAttribute('data-size') === 'xs', 'xs size like Badge')
  assert.ok(mount.textContent.includes('alpha') && mount.textContent.includes('theta'))
})

test('ChipSet: duplicate labels are data, not keys — all render', async () => {
  await renderComponent({ id: 'cs2', component: 'ChipSet', props: { labels: ['dupe', 'dupe', 'single'] } })
  assert.equal($$('[data-ru-chip]').length, 3, 'duplicates allowed')
  assert.equal($('[data-ru="ChipSet"]').getAttribute('data-ru-count'), '3')
  assert.equal($$('[data-ru-chip]').map(n => n.textContent).join(','), 'dupe,dupe,single')
})

test('ChipSet: empty labels renders nothing visible without crash', async () => {
  await renderComponent({ id: 'cs3', component: 'ChipSet', props: { labels: [] } })
  assert.ok($('[data-ru="ChipSet"]'), 'root still marks the component')
  assert.equal($('[data-ru="ChipSet"]').getAttribute('data-ru-count'), '0')
  assert.equal($$('[data-slot="badge"]').length, 0)
  assert.equal($('[data-ru="ChipSet"]').textContent, '')
})

test('ChipSet: absent labels is treated as empty', async () => {
  await renderComponent({ id: 'cs4', component: 'ChipSet', props: {} })
  assert.equal($('[data-ru="ChipSet"]').getAttribute('data-ru-count'), '0')
})

test('Caps: renderer clamps to the admitted caps (defense in depth, admission is the gate)', async () => {
  await renderComponent({ id: 'ckc', component: 'Checklist', props: { items: Array.from({ length: 40 }, (_, i) => ({ label: 'step ' + i, done: i < 5 })) } })
  assert.equal($$('li').length, 32, 'items clamped to ≤32')
  assert.equal($('[data-ru="Checklist"]').getAttribute('data-ru-tally'), '5/32')
  await renderComponent({ id: 'csc', component: 'ChipSet', props: { labels: Array.from({ length: 30 }, (_, i) => 'chip-' + i) } })
  assert.equal($$('[data-ru-chip]').length, 24, 'labels clamped to ≤24')
  assert.equal($('[data-ru="ChipSet"]').getAttribute('data-ru-count'), '24')
})
