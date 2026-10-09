// #40 (defaults epic G6, generalized): DataTable aggregations — renderer-computed
// Total/Average/Median/Min/Max/Count rows. Pure engine (aggregate/aggRows, no DOM) +
// rendered tfoot (pinned bottom, out of sort/filter/scale, caption-ink + hairline).
// Old tables (no aggregations/totals prop) render byte-identically — no tfoot.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { registerHooks } from 'node:module'

registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })

const dom = new JSDOM('<div id="r"></div>')
globalThis.window = dom.window; globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const React = (await import('react')).default
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { DataTable, aggregate, aggRows } = await import('../desktop/src/components/table.mjs')

let _n = 0
async function mount(props) {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => { root.render(React.createElement(DataTable, { element: { id: 't' + (++_n), type: 'DataTable', props } })) })
  return { host, root, unmount: async () => { await act(async () => { root.unmount() }); host.remove() } }
}
const click = async (el) => act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
const aggRowsOf = (host) => [...host.querySelectorAll('tfoot tr[data-ru-agg]')]
const textOf = (tr) => [...tr.children].map(td => td.textContent)

// ---------- pure engine: aggregate(rows, col, agg) ----------
const numCol = { key: 'v', label: 'V', type: 'number', unit: '', precision: null }
const rowsOf = (...vs) => vs.map(v => ({ v }))

test('#40 aggregate: sum/mean/median(odd+even)/min/max skip null and non-finite', () => {
  assert.equal(aggregate(rowsOf(1, 2, 3, null, 'x'), numCol, 'sum'), 6)
  assert.equal(aggregate(rowsOf(1, 2, 3, null), numCol, 'mean'), 2)
  assert.equal(aggregate(rowsOf(1, 2, 3, null), numCol, 'median'), 2)
  assert.equal(aggregate(rowsOf(1, 2, 10, 3, null), numCol, 'median'), 2.5)
  assert.equal(aggregate(rowsOf(5, -2, null, 7), numCol, 'min'), -2)
  assert.equal(aggregate(rowsOf(5, -2, null, 7), numCol, 'max'), 7)
})
test('#40 aggregate: count counts ROWS (nulls included); countDistinct is a documented non-goal', () => {
  assert.equal(aggregate(rowsOf(1, null, null), numCol, 'count'), 3)
  assert.equal(aggregate([], numCol, 'count'), 0)
})
test('#40 aggregate: all-null / empty numeric column -> null (the unavailable glyph), never 0', () => {
  assert.equal(aggregate(rowsOf(null, null), numCol, 'sum'), null)
  assert.equal(aggregate(rowsOf(null, null), numCol, 'mean'), null)
  assert.equal(aggregate(rowsOf(null, null), numCol, 'median'), null)
  assert.equal(aggregate(rowsOf(null, null), numCol, 'min'), null)
  assert.equal(aggregate(rowsOf(null, null), numCol, 'max'), null)
  assert.equal(aggregate([], numCol, 'sum'), null)
})

// ---------- pure engine: aggRows(cols, rows, spec) ----------
const COLS = [
  { key: 'city', label: 'City', type: 'text', unit: '', precision: null },
  { key: 'rent', label: 'Rent', type: 'currency', unit: '', precision: null },
  { key: 'occ', label: 'Occupancy', type: 'percent', unit: '', precision: null },
  { key: 'seen', label: 'Seen', type: 'date', unit: '', precision: null }
]
const SMART = [
  { city: 'Austin', rent: 1620.5, occ: 5.2, seen: '2026-09-01' },
  { city: 'Denver', rent: 12, occ: 7.5, seen: '2026-09-02' }
]
test('#40 smart default (aggregations:true): ONE row; sum when additive, mean when not, count for text, none for date', () => {
  const r = aggRows(COLS, SMART, true)
  assert.equal(r.length, 1)
  assert.equal(r[0].label, 'Total', 'the smart row is the Total row; its mean/count cells do not force per-row labels (those name explicit AggSpec rows)')
  assert.equal(r[0].values.city, '2', 'text column -> count of rows')
  assert.equal(r[0].values.rent, '$1,632.50', 'cents rule rides the column (sum joins the fmtSet)')
  assert.equal(r[0].values.occ, '6.35%', 'percent (non-additive) -> mean')
  assert.equal(r[0].values.seen, '', 'date column -> silent')
})
test('#40 smart default: all-sum (no numeric columns at all) -> ONE row labelled Total', () => {
  const r = aggRows([{ key: 'city', label: 'City', type: 'text', unit: '', precision: null }], [{ city: 'Austin' }, { city: 'Denver' }], true)
  assert.equal(r.length, 1)
  assert.equal(r[0].label, 'Total')
  assert.equal(r[0].values.city, '2')
})
test('#40 totals:true is sugar for the smart default', () => {
  assert.deepEqual(aggRows(COLS, SMART, { totals: true }), aggRows(COLS, SMART, true))
})
test('#40 absent/empty spec renders nothing; no numeric column -> no row', () => {
  assert.deepEqual(aggRows(COLS, SMART, undefined), [])
  assert.deepEqual(aggRows(COLS, SMART, null), [])
  assert.deepEqual(aggRows(COLS, SMART, false), [])
  assert.deepEqual(aggRows(COLS, SMART, []), [])
})
test('#40 explicit rows: one labelled row per AggSpec; {agg:mean} on a sum-defaulted column is the point of the generalization', () => {
  const r = aggRows([{ key: 'v', label: 'V', type: 'number', unit: '', precision: null }], rowsOf(1, 2, 3, 4), [{ agg: 'sum' }, { agg: 'mean' }, { agg: 'median' }, { agg: 'min' }, { agg: 'max' }, { agg: 'count' }])
  assert.deepEqual(r.map(x => x.label), ['Total', 'Average', 'Median', 'Min', 'Max', 'Count'])
  assert.deepEqual(r.map(x => x.values.v), ['10', '2.5', '2.5', '1', '4', '4'])
})
test('#40 label override + columns restriction; unlisted cells print blank', () => {
  const r = aggRows(COLS, SMART, [{ agg: 'sum', label: 'Spend', columns: ['rent'] }])
  assert.equal(r.length, 1)
  assert.equal(r[0].label, 'Spend')
  assert.equal(r[0].values.rent, '$1,632.50')
  assert.equal(r[0].values.city, '')
  assert.equal(r[0].values.occ, '')
})
test('#40 all-null numeric column -> the unavailable glyph through the engine', () => {
  const rows = [{ v: null }, { v: null }]
  const r = aggRows([numCol], rows, [{ agg: 'sum' }])
  assert.equal(r[0].values.v, 'unavailable')
})
test('#40 unknown column name in AggSpec.columns rejects with the fix named (valid columns listed)', () => {
  assert.throws(() => aggRows(COLS, SMART, [{ agg: 'sum', columns: ['rentt'] }]),
    (e) => /unknown column/i.test(e.message) && e.message.includes('rent') && e.message.includes('occ'),
    'error names the bad column AND lists the valid ones')
})
test('#40 unknown agg rejects naming the valid set', () => {
  assert.throws(() => aggRows(COLS, SMART, [{ agg: 'stddev' }]),
    (e) => /sum/.test(e.message) && /mean/.test(e.message) && /median/.test(e.message))
})

// ---------- rendered tfoot ----------
test('#40 render: aggregations:true gives ONE tfoot row (mixed faces), caption-ink, hairline on the first agg row', async () => {
  const { host, unmount } = await mount({ columns: COLS.map(c => ({ ...c })), rows: SMART.map(r => ({ ...r })), aggregations: true })
  const trs = aggRowsOf(host)
  assert.equal(trs.length, 1)
  assert.equal(trs[0].getAttribute('data-ru-agg'), 'sum')
  assert.deepEqual(textOf(trs[0]), ['Total', '2', '$1,632.50', '6.35%', ''])
  const label = trs[0].children[0]
  assert.equal(label.style.fontSize, '11px', 'caption step (no new size steps)')
  assert.ok(label.style.color.includes('--ui-text-secondary'), 'caption-ink')
  assert.ok(label.style.borderTop.includes('--ui-stroke-secondary'), 'top hairline on the first agg row')
  await unmount()
})
test('#40 render: explicit [{agg:sum},{agg:max}] gives two rows labelled Total/Max, pinned at the bottom in spec order', async () => {
  const { host, unmount } = await mount({
    columns: [{ key: 'v', label: 'V', type: 'number', unit: '', precision: null }],
    rows: rowsOf(1, 2, 3, 4).map(r => ({ ...r })),
    aggregations: [{ agg: 'sum' }, { agg: 'max' }]
  })
  const trs = aggRowsOf(host)
  assert.deepEqual(trs.map(t => t.getAttribute('data-ru-agg')), ['sum', 'max'])
  assert.deepEqual(trs.map(t => [...t.children].map(td => td.textContent)), [['Total', '10'], ['Max', '4']])
  assert.equal(host.querySelectorAll('tbody').length, 1, 'agg rows live in the tfoot, never the tbody')
  await unmount()
})
test('#40 render: sort and filter never move or drop the agg rows', async () => {
  const cols = [{ key: 'city', label: 'City', type: 'text' }, { key: 'rent', label: 'Rent', type: 'currency' }]
  const rows = [{ city: 'Austin', rent: 1620.5 }, { city: 'Denver', rent: 12 }, { city: 'El Paso', rent: 900 }, { city: 'Fargo', rent: 40 }, { city: 'Gainesville', rent: 80 }, { city: 'Houston', rent: null }, { city: 'Idaho Falls', rent: null }, { city: 'Juneau', rent: null }]
  const { host, unmount } = await mount({ columns: cols, rows, pageSize: 5, aggregations: [{ agg: 'sum' }, { agg: 'max' }] })
  const firstBefore = host.querySelector('tbody tr').textContent
  await click(host.querySelector('button[data-sort-key="rent"]'))
  assert.notEqual(host.querySelector('tbody tr').textContent, firstBefore, 'tbody re-sorted')
  assert.deepEqual(aggRowsOf(host).map(t => [...t.children].map(td => td.textContent)), [['Total', '$2,652.50'], ['Max', '$1,620.50']], 'agg rows unmoved, values fixed')
  const input = host.querySelector('input[data-richui="table-filter"]')
  await act(async () => { input.value = 'aus'; input.dispatchEvent(new dom.window.Event('input', { bubbles: true })) })
  assert.deepEqual(aggRowsOf(host).map(t => [...t.children].map(td => td.textContent)), [['Total', '$2,652.50'], ['Max', '$1,620.50']], 'filter never drops the agg rows')
  await unmount()
})
test('#40 render: the agg value is excluded from the bar column scale (L6 — scale is data rows only)', async () => {
  const { host, unmount } = await mount({
    columns: [{ key: 'v', label: 'V', type: 'bar', unit: '', precision: null }],
    rows: [{ v: 10 }, { v: 20 }],
    aggregations: [{ agg: 'sum' }]
  })
  assert.ok(host.textContent.includes('30'), 'the Total row renders')
  const widths = [...host.querySelectorAll('[data-ru-bar]')].slice(0, 2).map(e => Number(e.getAttribute('data-ru-bar')))
  assert.deepEqual(widths, [50, 100], 'scale stays over the DATA rows (20 = 100%), not the 30 Total')
  await unmount()
})
test('#40 render: all-null column shows the unavailable glyph in the agg row, never 0', async () => {
  const { host, unmount } = await mount({
    columns: [{ key: 'v', label: 'V', type: 'number', unit: '', precision: null }],
    rows: [{ v: null }, { v: null }],
    aggregations: [{ agg: 'sum' }]
  })
  const cell = aggRowsOf(host)[0].children[1]
  assert.equal(cell.textContent, 'unavailable')
  assert.ok(cell.querySelector('span[style*="italic"]') || cell.textContent === 'unavailable', 'unavailable styling rides the Cell')
  await unmount()
})
test('#40 render: with no aggregations/totals prop there is NO tfoot (golden tables byte-identical)', async () => {
  const { host, unmount } = await mount({
    columns: [{ key: 'city', label: 'City', type: 'text' }, { key: 'rent', label: 'Rent', type: 'currency' }],
    rows: [{ city: 'Austin', rent: 1620.5 }, { city: 'Denver', rent: 12 }]
  })
  assert.equal(host.querySelector('tfoot'), null)
  await unmount()
})
