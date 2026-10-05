// DataTable lane tests: jsdom + act. Inferred columns (rows-only), one rung per column,
// columns that sum, collision widen, cents anywhere, nulls LAST both directions,
// sources as citeMarker ([] → "—"), grace-gated chrome (filter/counter only past one page),
// authored headers byte-identical (saved 97cb).
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
const { DataTable, sortRows, normColumns, columnFaces } = await import('../desktop/src/components/table.mjs')

const fx = JSON.parse(readFileSync(new URL('./fixtures/table-basic.json', import.meta.url), 'utf8'))
const SOURCES = [
  { id: 's1', kind: 'web', label: 'Listing page' },
  { id: 's2', kind: 'web', label: 'Market report' },
  { id: 's3', kind: 'derived', label: 'Internal model' }
]

let _n = 0
async function mount(props) {
  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => { root.render(React.createElement(DataTable, { element: { id: 't' + (++_n), type: 'DataTable', props } })) })
  return { host, root, unmount: async () => { await act(async () => { root.unmount() }); host.remove() } }
}
const click = async (el) => act(async () => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
const colText = (host, idx) => [...host.querySelectorAll('tbody tr')].map(tr => tr.children[idx].textContent)
const counter = (host) => host.querySelector('[data-richui="table-counter"]')?.textContent ?? null
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

// ---------- one rung per column (fmtColumn/fmtSet) ----------
const faces = (col, vals) => columnFaces(col, vals.map(v => ({ v })))
const numCol = { key: 'v', label: 'V', type: 'number', unit: '', precision: null }

test('columnFaces: one rung, uniform decimal places (3.50 2.00 4.25 1.00)', () => {
  assert.deepEqual(faces(numCol, [3.5, 2, 4.25, 1]), ['3.50', '2.00', '4.25', '1.00'])
})
test('columnFaces: word unit leaves the header, digits only in cells (9,120 · 412 · 88)', () => {
  const col = { key: 'v', label: 'Size', type: 'number', unit: 'GB', precision: null }
  assert.deepEqual(faces(col, [9120, 412, 88]), ['9,120', '412', '88'])
})
test('columnFaces: collision widens then flips to exact (€23,495 vs €23,450 never share a face)', () => {
  const eur = { key: 'v', label: 'V', type: 'currency', unit: 'EUR', precision: null }
  const f = faces(eur, [23495, 23450])
  assert.equal(f.length, 2)
  assert.notEqual(f[0], f[1], 'distinct values get distinct faces: ' + f.join(' · '))
})
test('columnFaces: additivity guard — the first three faces sum to the fourth face', () => {
  const f = faces(numCol, [1232000, 1233000, 1234000, 3699000])
  const val = (s) => { const t = /([\d,]+(?:\.\d+)?)(k|M|B|T)?/.exec(s); return Number(t[1].replaceAll(',', '')) * ({ k: 1e3, M: 1e6, B: 1e9, T: 1e12 }[t[2]] ?? 1) }
  assert.ok(Math.abs(val(f[0]) + val(f[1]) + val(f[2]) - val(f[3])) < 1e-6, 'faces must add: ' + f.join(' + ') + ' != ' + f[3])
})
test('columnFaces: cents anywhere puts cents on every row ($1,620.50 · $12.34)', () => {
  const usd = { key: 'v', label: 'V', type: 'currency', unit: '', precision: null }
  assert.deepEqual(faces(usd, [1620.50, 12.34]), ['$1,620.50', '$12.34'])
})
test('columnFaces: dates are always full form (D4); fraction 0.42 -> 42%', () => {
  const date = { key: 'v', label: 'V', type: 'date', unit: '', precision: null }
  assert.deepEqual(faces(date, ['2026-09-01']), ['Sep 1, 2026'])
  const frac = { key: 'v', label: 'V', type: 'fraction', unit: '', precision: null }
  assert.deepEqual(faces(frac, [0.42, 0.08]), ['42%', '8%'])
})
test('columnFaces: null cell -> null face (caller renders unavailable)', () => {
  assert.deepEqual(faces(numCol, [1, null]), ['1', null], 'no decimals anywhere -> bare faces')
})

// ---------- rows-only inference ----------
const inferred = [
  { city: 'Austin', monthlyRent: 1750, listed: '2026-09-01', available: true },
  { city: 'Denver', monthlyRent: 990, listed: '2026-08-15', available: true },
  { city: 'Boise', monthlyRent: 1500, listed: '2026-09-10', available: false },
  { city: 'Reno', monthlyRent: null, listed: '2026-07-30', available: true },
  { city: 'Tulsa', monthlyRent: 1620.5, listed: '2026-06-01', available: null }
]
test('inference: 5-row table without columns renders humanized headers, right-align, no chrome', async () => {
  const { host, unmount } = await mount({ rows: inferred })
  const btns = [...host.querySelectorAll('thead th button')].map(b => b.getAttribute('data-sort-key'))
  assert.deepEqual(btns, ['city', 'monthlyRent', 'listed', 'available'], 'one column per row key, first-seen order')
  const headTexts = [...host.querySelectorAll('thead th button')].map(b => b.textContent.replace(/ [▲▼]$/, ''))
  assert.deepEqual(headTexts, ['City', 'Monthly Rent', 'Listed', 'Available'], 'humanized labels')
  // numerics right-aligned, text left
  const rentCol = [...host.querySelectorAll('tbody tr')].map(tr => tr.children[1])
  assert.ok(rentCol.every(td => td.style.textAlign === 'right'), 'numeric cells right-aligned')
  const cityCol = [...host.querySelectorAll('tbody tr')].map(tr => tr.children[0])
  assert.ok(cityCol.every(td => td.style.textAlign === 'left'), 'text cells left-aligned')
  // header alignment = cell alignment
  const rentTh = host.querySelector('button[data-sort-key="monthlyRent"]').closest('th')
  assert.equal(rentTh.style.textAlign, 'right', 'numeric header right-aligned like its cells')
  // no chrome at all: filter box and counter only appear past one page (+50% grace)
  assert.equal(host.querySelector('input[data-richui="table-filter"]'), null, 'no filter box at 5 rows')
  assert.equal(counter(host), null, 'no counter at 5 rows')
  // inferred date renders full form
  assert.ok(host.textContent.includes('Sep 1, 2026'), 'dates always full form (D4)')
  await unmount()
})
test('inference: nulls sort last in both directions on an inferred numeric column', async () => {
  const { host, unmount } = await mount({ rows: inferred })
  await click(headerBtn(host, 'monthlyRent'))
  assert.deepEqual(colText(host, 1).at(-1), 'unavailable', 'null last asc')
  await click(headerBtn(host, 'monthlyRent'))
  assert.deepEqual(colText(host, 1).at(-1), 'unavailable', 'null last desc')
  await unmount()
})
test('defaultSort: dir optional — type-aware (numeric desc, text asc)', async () => {
  const { host, unmount } = await mount({ rows: inferred, defaultSort: { key: 'monthlyRent' } })
  assert.deepEqual(colText(host, 1).slice(0, 2), ['1750', '1621'], 'numeric defaults to desc')
  await unmount()
  const t = await mount({ rows: inferred, defaultSort: { key: 'city' } })
  assert.deepEqual(colText(t.host, 0)[0], 'Austin', 'text defaults to asc')
  await t.unmount()
})

// ---------- sources citeMarker ----------
test('sources: cells use citeMarker; [] renders — (raw ids never print)', async () => {
  const { host, unmount } = await mount({ ...fx, pageSize: 4, _sources: SOURCES })
  const rows = [...host.querySelectorAll('tbody tr')]
  const marks = (tr) => [...tr.querySelectorAll('[data-ru-citation]')].map(s => s.textContent)
  assert.ok(rows.length >= 4)
  const austin = rows.find(tr => tr.children[0].textContent === 'Austin')
  assert.deepEqual(marks(austin), ['1'], 's1 -> marker 1')
  const boise = rows.find(tr => tr.children[0].textContent === 'Boise')
  assert.equal(boise.children[5].textContent, '—', '[] -> —')
  assert.equal(host.querySelectorAll('[data-source-id]').length, 0, 'no raw-id chips')
  await unmount()
})

// ---------- authored columns ----------
test('render: title, header buttons, chrome past the grace, counter, currency formatted', async () => {
  const { host, unmount } = await mount({ ...fx, pageSize: 4, _sources: SOURCES })
  assert.ok(host.textContent.includes('Offers'))
  const btns = [...host.querySelectorAll('thead th button')]
  assert.equal(btns.length, fx.columns.length, 'every header is a <button>')
  assert.equal(host.querySelectorAll('tbody tr').length, 4, 'pageSize respected past the grace')
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
  const { host, unmount } = await mount({ ...fx, pageSize: 4, _sources: SOURCES })
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
  const { host, unmount } = await mount({ ...fx, pageSize: 4, _sources: SOURCES })
  const next = [...host.querySelectorAll('button')].find(b => b.textContent === 'Next')
  await click(next)
  assert.equal(host.querySelectorAll('tbody tr').length, 3, 'second page has the remaining 3 rows')
  assert.ok(host.querySelector('[data-richui="table-page"]').textContent.includes('page 2 of 2'))
  const prev = [...host.querySelectorAll('button')].find(b => b.textContent === 'Prev')
  await click(prev)
  assert.equal(host.querySelectorAll('tbody tr').length, 4)
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
  await e.unmount()
})

// ---------- saved 97cb authored headers, byte-identical ----------
test('saved 97cb table renders its authored headers unchanged', async () => {
  const record = JSON.parse(readFileSync(new URL('./fixtures/saved/ru-97cb020cd21b.json', import.meta.url), 'utf8'))
  const table = record.surface.createSurface.components.find(c => c.component === 'DataTable')
  const { host, unmount } = await mount({ ...table, _sources: [{ id: 'prom', kind: 'derived', label: 'Prometheus' }, { id: 'smart', kind: 'web', label: 'SMART log' }] })
  const heads = [...host.querySelectorAll('thead th button')].map(b => b.textContent.replace(/ [▲▼]$/, ''))
  assert.deepEqual(heads, ['Host', 'CPU', 'Disk free (GB)', 'Power / mo', 'Last seen', 'Evidence'],
    'authored labels byte-identical; word unit rides the header, currency never does')
  await unmount()
})
