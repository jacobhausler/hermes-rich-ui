// L7 E-pack item 2: E15 DataTable bar columns + defaultSort (with the RATIFY S10
// row-level numeric checks) and E17 Timeline failed/ISO-auto-format/absent-status.
import { test } from 'node:test'
import { assert, renderComponent, $, $$ } from './helpers/render.mjs'
// dynamic: the sdk stub loader is registered by helpers/render.mjs's evaluation,
// which runs after static imports link. Import components only after that.
const { barColumnViolations, sortRows, normColumns } = await import('../desktop/src/components/table.mjs')
const { formatTimelineDate } = await import('../desktop/src/components/timeline.mjs')

// DataTable is stateful (sort/query/page): re-rendering the SAME element id reuses the
// React fiber and its state. Every mount below gets a unique id via mountTable().
let _tn = 0
const mountTable = async (props) => {
  // Flush a throwaway root first: the Renderer reconciles positionally and would
  // otherwise hand the previous DataTable's sort/query fiber to this mount.
  await renderComponent({ id: 'flush' + _tn, component: 'Text', props: { text: '' } })
  return renderComponent({ id: 'tbl' + (++_tn), component: 'DataTable', props })
}

const tableProps = (over = {}) => ({ title: 'T', columns: [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'v', label: 'V', type: 'bar' }
], rows: [
  { name: 'aa', v: 10 }, { name: 'bb', v: 40 }, { name: 'cc', v: null }, { name: 'dd', v: -20 }
], ...over })

// ---- E15 bar columns ----
test('E15 bar width is proportional to the COLUMN max computed by the renderer (L6)', async () => {
  await mountTable(tableProps())
  const bars = $$('[data-ru="DataTable"] [data-ru-bar]')
  const withBar = bars.filter(b => b.getAttribute('data-ru-bar') !== 'absent')
  assert.equal(withBar.length, 3, 'numeric cells have bars')
  const widths = withBar.map(b => Number(b.getAttribute('data-ru-bar')))
  // row max |40| => 100, 10 => 25, -20 => 50 (∝ |value|/column max, not per-cell).
  assert.ok(Math.max(...widths) === 100, 'column-max cell is full width: ' + widths)
  assert.ok(widths.includes(25) && widths.includes(50), 'widths ∝ column max: ' + widths)
  // bars live on a track with a zero baseline (negatives share the chart story).
  const neg = withBar.find(b => b.getAttribute('data-ru-bar-sign') === 'neg')
  assert.ok(neg.querySelector('[data-ru-bar-track]'), 'neg bar has a track')
})
test('E15 null cell -> unavailable + NO bar element (never zero-width)', async () => {
  await mountTable(tableProps())
  const absent = $$('[data-ru="DataTable"] [data-ru-bar="absent"]')
  assert.equal(absent.length, 1)
  assert.ok(absent[0].textContent.includes('unavailable'))
  assert.equal(absent[0].querySelector('[data-ru-bar-track]'), null, 'null never renders even a zero-width bar')
})
test('E15 all-null bar column: maxAbs 0 -> no bars at all, no divide-by-zero', async () => {
  await mountTable({ title: 'T',
    columns: [{ key: 'v', label: 'V', type: 'bar' }], rows: [{ v: null }, { v: null }] })
  assert.equal($$('[data-ru="DataTable"] [data-ru-bar-track]').length, 0)
})
test('E15 defaultSort seeds the order (deletes agent pre-sorting)', async () => {
  // Rows deliberately unsorted by v; defaultSort desc must show 40 first.
  await mountTable(tableProps({ defaultSort: { key: 'v', dir: 'desc' } }))
  const firstBody = $('[data-ru="DataTable"] tbody tr')
  assert.ok(firstBody.textContent.includes('bb'), 'largest first: ' + firstBody.textContent)
  assert.equal($('[data-ru="DataTable"] th[aria-sort="descending"] [data-sort-key="v"]')?.textContent, 'V ▼', 'sorted header marked')
})
test('E15 defaultSort with an unknown key falls back to unsorted (no crash)', async () => {
  await mountTable(tableProps({ defaultSort: { key: 'nope', dir: 'desc' } }))
  assert.ok($('[data-ru="DataTable"] tbody tr').textContent.includes('aa'), 'original order kept')
})
// table.mjs:36-59 behavior pin: nulls LAST both directions; nonnumeric never Number()-coerced.
test('E15 nonnumeric values sort unknown-LAST, never Number() coerced to 0', () => {
  const cols = normColumns([{ key: 'v', label: 'V', type: 'bar' }])
  const rows = [{ v: 'alpha' }, { v: 5 }, { v: null }, { v: 1 }]
  const asc = sortRows(rows, cols[0], 'asc').map(r => r.v)
  assert.deepEqual(asc, [1, 5, 'alpha', null], 'string sinks after numbers, null last; not coerced to 0')
  const desc = sortRows(rows, cols[0], 'desc').map(r => r.v)
  assert.deepEqual(desc, [5, 1, 'alpha', null], 'null stays LAST in both directions')
})
// RATIFY S10: the bar check is ROW-LEVEL numeric-or-null, not a self-referential type==bar.
test('E15/S10 barColumnViolations checks ROW VALUES (numeric-or-null)', () => {
  const rows = [{ v: 1 }, { v: null }, { v: 2.5 }, { v: 'x' }, { v: NaN }, {}, { v: true }]
  assert.deepEqual(barColumnViolations(rows, 'v'), [3, 4, 6], 'strings/NaN/booleans offend; numbers and null pass')
  assert.deepEqual(barColumnViolations([{ v: 1 }, { v: null }], 'v'), [], 'numeric-or-null column passes')
  assert.deepEqual(barColumnViolations([], 'v'), [])
})

// ---- E17 Timeline ----
const tlProps = (items) => ({ title: 'Log', items })
test('E17 status=failed renders the --ui-red dot', async () => {
  await renderComponent({ id: 'tl', component: 'Timeline', props: tlProps([{ label: 'deploy', status: 'failed' }]) })
  const li = $('[data-ru="Timeline"] li')
  assert.equal(li.getAttribute('data-ru-status'), 'failed')
  assert.ok(li.querySelector('span').style.background.includes('--ui-red'), li.querySelector('span').style.background)
})
test('E17 ISO dates auto-format; non-ISO passes through VERBATIM (pin)', async () => {
  await renderComponent({ id: 'tl', component: 'Timeline', props: tlProps([
    { label: 'a', date: '2026-09-25T10:00:00Z' },
    { label: 'b', date: 'yesterday' },
    { label: 'c', date: '42' }
  ]) })
  const dts = $$('[data-ru="Timeline"] li > div > div:first-child > span:first-child')
  assert.equal(dts[0].textContent, '2026-09-25', 'ISO timestamp normalises to the date')
  assert.equal(dts[1].textContent, 'yesterday', 'non-ISO survives byte-exact (Chart rejects it; Timeline shows it)')
  assert.equal(dts[2].textContent, '42', 'bare number is not a calendar date -> verbatim')
  assert.equal(formatTimelineDate('2026-09-25'), '2026-09-25')
  assert.equal(formatTimelineDate('not a date'), 'not a date')
})
// L1 pin: an absent status is NEUTRAL unclassified — never an invented 'pending'.
test('E17 PIN absent status -> unclassified neutral dot, never invented pending', async () => {
  await renderComponent({ id: 'tl', component: 'Timeline', props: tlProps([{ label: 'unknown step' }, { label: 'weird', status: 'bogus' }]) })
  const lis = $$('[data-ru="Timeline"] li')
  assert.equal(lis[0].getAttribute('data-ru-status'), 'unclassified', 'no fabricated pending')
  assert.equal(lis[1].getAttribute('data-ru-status'), 'unclassified', 'unknown status string also unclassified')
  const dotColor = lis[0].querySelector('span').style.background
  assert.ok(dotColor.includes('--ui-text-tertiary'), 'neutral dot: ' + dotColor)
  assert.ok(!dotColor.includes('--ui-stroke-secondary'), 'must NOT reuse the pending dot color')
})
test('E17 known statuses unchanged (done/active/pending keep their dots, L8)', async () => {
  await renderComponent({ id: 'tl', component: 'Timeline', props: tlProps([
    { label: 'd', status: 'done' }, { label: 'a', status: 'active' }, { label: 'p', status: 'pending' }
  ]) })
  const lis = $$('[data-ru="Timeline"] li')
  assert.deepEqual(lis.map(l => l.getAttribute('data-ru-status')), ['done', 'active', 'pending'])
  assert.ok(lis[0].querySelector('span').style.background.includes('--ui-green'))
  assert.ok(lis[2].querySelector('span').style.background.includes('--ui-stroke-secondary'))
})
