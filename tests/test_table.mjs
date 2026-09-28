// DataTable lane tests: jsdom + act. Sort (null LAST both directions), filter → "N of M rows",
// page size respected, currency/percent/date formatting, sources badges, header <button>s.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { registerHooks } from 'node:module'

registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })

const dom = new JSDOM('<div id="r"></div>')
globalThis.window = dom.window; globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const React = (await import('react')).default
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { DataTable, sortRows, normColumns, formatCell } = await import('../desktop/src/components/table.mjs')

const fx = JSON.parse(readFileSync(new URL('./fixtures/table-basic.json', import.meta.url), 'utf8'))

async function mount(props) {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => { root.render(React.createElement(DataTable, { element: { id: 't', type: 'DataTable', props } })) })
  return { host, root, unmount: async () => { await act(async () => { root.unmount() }); host.remove() } }
}
const click = async (el) => act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
const colText = (host, idx) => [...host.querySelectorAll('tbody tr')].map(tr => tr.children[idx].textContent)
const counter = (host) => host.querySelector('[data-richui="table-counter"]').textContent
const headerBtn = (host, key) => host.querySelector(`button[data-sort-key="${key}"]`)

// ---------- pure helpers ----------
test('sortRows: numeric null LAST in both directions; date by Date.parse; text localeCompare', () => {
  const cols = normColumns(fx.columns)
  const rent = cols.find(c => c.key === 'rent')
  const asc = sortRows(fx.rows, rent, 'asc').map(r => r.rent)
  assert.deepEqual(asc, [950, 990, 1100, 1500, 1620.5, 1750, null])
  const desc = sortRows(fx.rows, rent, 'desc').map(r => r.rent)
  assert.deepEqual(desc, [1750, 1620.5, 1500, 1100, 990, 950, null])
  const seen = cols.find(c => c.key === 'seen')
  assert.deepEqual(sortRows(fx.rows, seen, 'desc').map(r => r.seen), ['2026-09-20', '2026-09-10', '2026-09-01', '2026-08-15', '2026-07-30', '2026-06-01', null])
  const city = cols.find(c => c.key === 'city')
  assert.deepEqual(sortRows(fx.rows, city, 'asc').map(r => r.city), ['Austin', 'Boise', 'Denver', 'Fargo', 'Omaha', 'Reno', 'Tulsa'])
})

test('formatCell: currency Intl USD, percent precision, number unit, date, null → null', () => {
  const cols = normColumns(fx.columns)
  const by = Object.fromEntries(cols.map(c => [c.key, c]))
  assert.equal(formatCell(by.rent, { rent: 1620.5 }), '$1,620.50')
  assert.equal(formatCell(by.rent, { rent: 1750 }), '$1,750.00')
  assert.equal(formatCell(by.vacancy, { vacancy: 6.25 }), '6.3%')
  assert.equal(formatCell(by.score, { score: 3.5 }), '3.50 pts')
  assert.equal(formatCell(by.seen, { seen: '2026-09-01' }), '2026-09-01')
  assert.equal(formatCell(by.rent, { rent: null }), null)
  assert.equal(formatCell(by.rent, {}), null)
})

// ---------- rendered behaviour ----------
test('render: title, header buttons, pageSize respected, counter shows total, currency formatted', async () => {
  const { host, unmount } = await mount(fx)
  assert.ok(host.textContent.includes('Offers'))
  const btns = [...host.querySelectorAll('thead th button')]
  assert.equal(btns.length, fx.columns.length, 'every header is a <button>')
  assert.equal(host.querySelectorAll('tbody tr').length, 5, 'pageSize 5 respected')
  assert.equal(counter(host), '7 rows')
  assert.ok(host.querySelector('[data-richui="table-page"]').textContent.includes('page 1 of 2'))
  assert.deepEqual(colText(host, 1).slice(0, 2), ['$1,750.00', 'unavailable'])
  await unmount()
})

test('render: sort by number puts null last (asc and desc), aria-sort set', async () => {
  const { host, unmount } = await mount({ ...fx, pageSize: 50 })
  await click(headerBtn(host, 'rent'))
  assert.deepEqual(colText(host, 1), ['$950.00', '$990.00', '$1,100.00', '$1,500.00', '$1,620.50', '$1,750.00', 'unavailable'])
  assert.equal(headerBtn(host, 'rent').closest('th').getAttribute('aria-sort'), 'ascending')
  await click(headerBtn(host, 'rent'))
  assert.deepEqual(colText(host, 1), ['$1,750.00', '$1,620.50', '$1,500.00', '$1,100.00', '$990.00', '$950.00', 'unavailable'])
  assert.equal(headerBtn(host, 'rent').closest('th').getAttribute('aria-sort'), 'descending')
  // percent column (has a null) – same rule
  await click(headerBtn(host, 'vacancy')); await click(headerBtn(host, 'vacancy'))
  assert.equal(colText(host, 2).at(-1), 'unavailable')
  await unmount()
})

test('render: filter updates "N of M rows", is case-insensitive, matches formatted cells, resets page', async () => {
  const { host, unmount } = await mount(fx)
  const input = host.querySelector('input[data-richui="table-filter"]')
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set
  const type = async (v) => act(async () => { setter.call(input, v); input.dispatchEvent(new dom.window.Event('input', { bubbles: true })) })
  await type('AUSTIN')
  assert.equal(counter(host), '1 of 7 rows')
  assert.deepEqual(colText(host, 0), ['Austin'])
  await type('$1,')   // matches formatted currency cells 1,750 / 1,500 / 1,620.50 / 1,100
  assert.equal(counter(host), '4 of 7 rows')
  await type('zzz')
  assert.equal(counter(host), '0 of 7 rows')
  assert.ok(host.textContent.includes('no rows match the filter'))
  await type('')
  assert.equal(counter(host), '7 rows')
  await unmount()
})

test('render: pagination Next/Prev walks pages', async () => {
  const { host, unmount } = await mount(fx)
  const next = [...host.querySelectorAll('button')].find(b => b.textContent === 'Next')
  await click(next)
  assert.equal(host.querySelectorAll('tbody tr').length, 2, 'second page has the remaining 2 rows')
  assert.ok(host.querySelector('[data-richui="table-page"]').textContent.includes('page 2 of 2'))
  const prev = [...host.querySelectorAll('button')].find(b => b.textContent === 'Prev')
  await click(prev)
  assert.equal(host.querySelectorAll('tbody tr').length, 5)
  await unmount()
})

test('render: sources column reads the row value under the declared column key (E11); empty → unavailable', async () => {
  const { host, unmount } = await mount({ ...fx, pageSize: 50 })
  const rows = [...host.querySelectorAll('tbody tr')]
  const badges = (tr) => [...tr.querySelectorAll('[data-source-id]')].map(b => b.getAttribute('data-source-id'))
  assert.deepEqual(badges(rows[0]), ['s1'])
  assert.deepEqual(badges(rows[1]), ['s1', 's2'])
  assert.equal(badges(rows[2]).length, 0)
  assert.ok(rows[2].children[5].textContent.includes('unavailable'))
  await unmount()
})

test('render: rows capped at 100, default pageSize 10, no rows → honest empty', async () => {
  const rows = Array.from({ length: 150 }, (_, i) => ({ n: i }))
  const { host, unmount } = await mount({ columns: [{ key: 'n', label: 'N', type: 'number' }], rows })
  assert.equal(counter(host), '100 rows')
  assert.equal(host.querySelectorAll('tbody tr').length, 10)
  await unmount()
  const e = await mount({ columns: [{ key: 'n', label: 'N', type: 'number' }], rows: [] })
  assert.ok(e.host.textContent.includes('no rows'))
  assert.equal(counter(e.host), '0 rows')
  await e.unmount()
})
