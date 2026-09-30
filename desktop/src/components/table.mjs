// DataTable — pure React (no deps). docs/CONTRACTS.md §2 row 15.
// Props resolved on element.props: title?, columns[{key,label,type,unit?,precision?}], rows[] (≤100), pageSize? (5..50, default 10).
// Local sort (header <button>s), local filter (one text input, any cell, case-insensitive), pagination,
// "N of M rows" counter that reflects the filter. Nulls sort LAST in both directions and render "unavailable".
import { jsx, jsxs } from 'react/jsx-runtime'
import { useMemo, useState } from 'react'
import { ownSources, type } from './_shared.mjs'

// E15: column type 'bar' (width ∝ column max, computed in the RENDERER — L6). 'bar' sorts
// and formats like 'number'. defaultSort?: {key,dir} seeds the sort (deletes agent pre-sorting).
const TYPES = ['text', 'number', 'currency', 'percent', 'date', 'sources', 'bar']
const NUMERIC = new Set(['number', 'currency', 'percent', 'bar'])
const MAX_ROWS = 100
const DEFAULT_PAGE = 10

function h(type, props, children, key) {
  const p = children === undefined ? props : { ...props, children }
  return Array.isArray(children) ? jsxs(type, p, key) : jsx(type, p, key)
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isNullish = (v) => v === null || v === undefined
// Own-property read only: a column key of 'constructor' / '__proto__' on a row that does not
// own it reads as undefined (→ "unavailable"), never as an inherited Object.prototype member (D1).
const own = (row, key) => (row && typeof row === 'object' && Object.prototype.hasOwnProperty.call(row, key) ? row[key] : undefined)

export function normColumns(columns) {
  if (!Array.isArray(columns)) return []
  return columns.filter(c => c && typeof c.key === 'string').map(c => ({
    key: c.key,
    label: typeof c.label === 'string' ? c.label : c.key,
    type: TYPES.includes(c.type) ? c.type : 'text',
    unit: typeof c.unit === 'string' ? c.unit : '',
    precision: Number.isInteger(c.precision) && c.precision >= 0 && c.precision <= 6 ? c.precision : null
  }))
}

// Comparable sort key or null (null/unknown never sorts as 0).
export function sortKey(col, row) {
  if (col.type === 'sources') { const ids = own(row, col.key); return Array.isArray(ids) ? ids.length : null }
  const v = own(row, col.key)
  if (isNullish(v)) return null
  if (NUMERIC.has(col.type)) { if (isNum(v)) return v; const n = Number(v); return v !== '' && Number.isFinite(n) ? n : null }
  if (col.type === 'date') { const t = Date.parse(String(v)); return Number.isFinite(t) ? t : null }
  return String(v)
}

// Stable sort; nulls LAST regardless of direction.
export function sortRows(rows, col, dir) {
  if (!col) return rows.slice()
  const keyed = rows.map((row, i) => ({ row, i, k: sortKey(col, row) }))
  const numeric = NUMERIC.has(col.type) || col.type === 'date' || col.type === 'sources'
  keyed.sort((a, b) => {
    if (a.k === null && b.k === null) return a.i - b.i
    if (a.k === null) return 1
    if (b.k === null) return -1
    let c = numeric ? a.k - b.k : String(a.k).localeCompare(String(b.k), undefined, { sensitivity: 'base', numeric: true })
    if (c === 0) return a.i - b.i
    return dir === 'desc' ? -c : c
  })
  return keyed.map(k => k.row)
}

// E15/S10 pure helper for the row-level bar check the integrator merges into
// admission.py (admission.py itself is shared-seam — this helper is the tested unit).
// Rule it encodes: every NON-NULL cell read under a 'bar' column's declared key must be
// a finite number (null/undefined is legal → "unavailable"); returns offending row
// indices — empty array means the column is bar-safe. The error text must name the
// column key and the rule (L4): see MANIFEST.md for the admission.py glue.
export function barColumnViolations(rows, key) {
  if (!Array.isArray(rows)) return []
  const bad = []
  rows.forEach((row, i) => {
    const v = own(row, key)
    if (isNullish(v)) return
    if (!isNum(v)) bad.push(i)
  })
  return bad
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const usdCache = new Map()
function usdFmt(precision) {
  if (precision === null) return usd
  if (!usdCache.has(precision)) usdCache.set(precision, new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: precision, maximumFractionDigits: precision }))
  return usdCache.get(precision)
}

// Plain-text cell value (null → null; caller renders "unavailable").
export function formatCell(col, row) {
  if (col.type === 'sources') return null
  const v = own(row, col.key)
  if (isNullish(v)) return null
  if (col.type === 'currency') return isNum(v) ? usdFmt(col.precision).format(v) : String(v)
  if (col.type === 'percent') { if (!isNum(v)) return String(v); const s = col.precision === null ? String(v) : v.toFixed(col.precision); return `${s}%` }
  if (col.type === 'number' || col.type === 'bar') {
    if (!isNum(v)) return String(v)
    const s = col.precision === null ? v.toLocaleString('en-US', { maximumFractionDigits: 6 }) : v.toLocaleString('en-US', { minimumFractionDigits: col.precision, maximumFractionDigits: col.precision })
    return col.unit ? `${s} ${col.unit}` : s
  }
  if (col.type === 'date') { const t = Date.parse(String(v)); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : String(v) }
  return typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v))
}

function rowMatches(cols, row, q) {
  if (!q) return true
  for (const c of cols) {
    const t = c.type === 'sources' ? (Array.isArray(own(row, c.key)) ? own(row, c.key).join(' ') : '') : formatCell(c, row)
    if (t && t.toLowerCase().includes(q)) return true
    const raw = own(row, c.key)
    if (!isNullish(raw) && String(raw).toLowerCase().includes(q)) return true
  }
  return false
}

const S = {
  box: { display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ui-text-primary)', ...type('body'), minWidth: 0 },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  title: { ...type('h3') },
  input: { font: 'inherit', ...type('small'), padding: '3px 8px', borderRadius: 6, border: '1px solid var(--ui-stroke-secondary)', background: 'var(--ui-bg-elevated)', color: 'var(--ui-text-primary)', minWidth: 140 },
  wrap: { overflowX: 'auto' },
  table: { ...type('small'), borderCollapse: 'collapse', width: '100%' },
  th: { padding: 0, borderBottom: '1px solid var(--ui-stroke-secondary)', textAlign: 'left' },
  thBtn: (active) => ({ font: 'inherit', ...type('h4'), width: '100%', textAlign: 'inherit', padding: '5px 8px', border: 0, background: 'transparent', cursor: 'pointer', color: active ? 'var(--ui-accent)' : 'var(--ui-text-secondary)', whiteSpace: 'nowrap' }),
  td: (numeric) => ({ padding: '4px 8px', borderBottom: '1px solid var(--ui-stroke-tertiary)', textAlign: numeric ? 'right' : 'left', fontVariantNumeric: numeric ? 'tabular-nums' : 'normal', verticalAlign: 'top' }),
  unavailable: { color: 'var(--ui-text-tertiary)', fontStyle: 'italic' },
  badge: { display: 'inline-block', ...type('caption', { mono: true }), padding: '0 5px', marginRight: 3, borderRadius: 999, border: '1px solid var(--ui-stroke-secondary)', background: 'var(--ui-bg-tertiary)', color: 'var(--ui-text-secondary)' },
  foot: { ...type('caption'), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: 'var(--ui-text-tertiary)' },
  pager: (disabled) => ({ font: 'inherit', ...type('caption'), padding: '2px 8px', borderRadius: 6, border: '1px solid var(--ui-stroke-secondary)', background: 'var(--ui-bg-elevated)', color: disabled ? 'var(--ui-text-tertiary)' : 'var(--ui-text-secondary)', cursor: disabled ? 'default' : 'pointer' }),
  empty: { padding: '8px 12px', textAlign: 'center', color: 'var(--ui-text-tertiary)', fontStyle: 'italic' }
}

function Cell({ col, row }) {
  if (col.type === 'sources') {
    const raw = own(row, col.key)
    const ids = Array.isArray(raw) ? raw.filter(s => typeof s === 'string') : []
    if (ids.length === 0) return h('span', { style: S.unavailable }, 'unavailable')
    return h('span', { 'data-richui': 'sources' }, ids.map(id => h('span', { style: S.badge, 'data-source-id': id }, id, id)))
  }
  const t = formatCell(col, row)
  return t === null ? h('span', { style: S.unavailable }, 'unavailable') : h('span', {}, t)
}

// E15 bar cell: width ∝ |value| / column-wide maxAbs (computed over ALL rows — L6, never
// per-cell). Zero-baseline like the chart: a center line at 50%, positive bars extend right,
// negative bars extend left. null → "unavailable" with NO bar element (never a zero-width bar).
function BarCell({ col, row, maxAbs }) {
  const v = own(row, col.key)
  const t = formatCell(col, row)
  const label = t === null ? h('span', { style: S.unavailable }, 'unavailable') : h('span', {}, t)
  if (!isNum(v) || !(maxAbs > 0)) return h('span', { 'data-ru-bar': 'absent', style: { display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'flex-end' } }, label, 'lb')
  const frac = Math.abs(v) / maxAbs
  const wPct = Math.max(2, Math.round(frac * 100))
  const barStyle = { height: 6, borderRadius: 2, background: 'var(--ui-accent)', position: 'absolute', ...(v < 0 ? { right: '50%' } : { left: '50%' }), width: `${wPct / 2}%` }
  return h('span', { 'data-ru-bar': String(wPct), 'data-ru-bar-sign': v < 0 ? 'neg' : 'pos',
    style: { display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'flex-end' } },
    [h('span', {}, label, 'l'),
     h('span', { 'data-ru-bar-track': '', style: { position: 'relative', display: 'inline-block', width: 64, height: 6, background: 'var(--ui-bg-tertiary)', borderRadius: 2 } },
       [h('span', { 'aria-hidden': 'true', style: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--ui-stroke-secondary)' } }, undefined, 'zero'),
        h('span', { 'aria-hidden': 'true', style: barStyle }, undefined, 'b')], 'tr')]
    , 'bar')
}

export function DataTable({ element }) {
  const props = (element && element.props) || {}
  const cols = useMemo(() => normColumns(props.columns), [props.columns])
  const allRows = useMemo(() => (Array.isArray(props.rows) ? props.rows.filter(r => r && typeof r === 'object').slice(0, MAX_ROWS) : []), [props.rows])
  const pageSize = Number.isInteger(props.pageSize) && props.pageSize >= 1 ? Math.min(props.pageSize, 50) : DEFAULT_PAGE
  // E15 defaultSort?: {key,dir} — seed the sort so agents stop pre-sorting rows. An unknown
  // key falls back to the unsorted state (header clicks still work); dir defaults to 'asc'.
  const seededSort = (() => {
    const d = props.defaultSort
    if (d && typeof d === 'object' && typeof d.key === 'string' && (props.columns || []).some(c => c && c.key === d.key)) {
      return { key: d.key, dir: d.dir === 'desc' ? 'desc' : 'asc' }
    }
    return { key: null, dir: 'asc' }
  })()
  const [sort, setSort] = useState(seededSort)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => allRows.filter(r => rowMatches(cols, r, q)), [allRows, cols, q])
  const sortCol = cols.find(c => c.key === sort.key) || null
  const sorted = useMemo(() => sortRows(filtered, sortCol, sort.dir), [filtered, sortCol, sort.dir])
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const curPage = Math.min(page, pageCount - 1)
  const visible = sorted.slice(curPage * pageSize, curPage * pageSize + pageSize)

  const onSort = (key) => { setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })); setPage(0) }
  const onFilter = (e) => { setQuery(e.target.value); setPage(0) }

  const title = typeof props.title === 'string' ? props.title : ''
  const counter = q ? `${sorted.length} of ${allRows.length} rows` : `${allRows.length} rows`
  // D2: lower.mjs keeps `accessibility` INSIDE props (like every other component via common()).
  const accLabel = typeof props.accessibility?.label === 'string' && props.accessibility.label ? props.accessibility.label : ''

  const header = h('tr', {}, cols.map(c => {
    const active = sort.key === c.key
    const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''
    const label = c.unit && c.type !== 'number' && c.type !== 'bar' ? `${c.label} (${c.unit})` : c.label
    return h('th', { scope: 'col', style: S.th, 'aria-sort': active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none' },
      h('button', { type: 'button', style: S.thBtn(active), onClick: () => onSort(c.key), 'data-sort-key': c.key }, label + arrow), c.key)
  }))
  const body = visible.length === 0
    ? [h('tr', {}, h('td', { colSpan: Math.max(1, cols.length), style: S.empty }, allRows.length === 0 ? 'no rows' : 'no rows match the filter'), 'empty')]
    : visible.map((row, i) => h('tr', {}, cols.map(c => {
        if (c.type === 'bar') {
          // E15 L6: column-wide scale computed in the RENDERER over ALL rows (max |value|).
          const maxAbs = allRows.reduce((m, r) => { const v = own(r, c.key); return isNum(v) ? Math.max(m, Math.abs(v)) : m }, 0)
          return h('td', { style: S.td(true) }, h(BarCell, { col: c, row, maxAbs }), c.key)
        }
        return h('td', { style: S.td(NUMERIC.has(c.type)) }, h(Cell, { col: c, row }), c.key)
      }), `r${curPage * pageSize + i}`))

  return h('div', { style: S.box, 'data-richui': 'table', 'data-ru': 'DataTable', role: 'region', 'aria-label': accLabel || title || 'data table' }, [
    h('div', { style: S.head }, [
      h('span', { style: S.title }, [title, ownSources(props)], 'title'),
      h('input', { type: 'search', placeholder: 'Filter rows', 'aria-label': 'Filter rows', value: query, onChange: onFilter, style: S.input, 'data-richui': 'table-filter' }, undefined, 'filter')
    ], 'head'),
    h('div', { style: S.wrap }, h('table', { style: S.table }, [h('thead', {}, header, 'thead'), h('tbody', {}, body, 'tbody')]), 'wrap'),
    h('div', { style: S.foot }, [
      h('span', { 'data-richui': 'table-counter' }, counter, 'counter'),
      pageCount > 1 ? h('span', { style: { display: 'inline-flex', gap: 6, alignItems: 'center' } }, [
        h('button', { type: 'button', disabled: curPage === 0, style: S.pager(curPage === 0), onClick: () => setPage(p => Math.max(0, p - 1)) }, 'Prev', 'prev'),
        h('span', { 'data-richui': 'table-page' }, `page ${curPage + 1} of ${pageCount}`, 'pg'),
        h('button', { type: 'button', disabled: curPage >= pageCount - 1, style: S.pager(curPage >= pageCount - 1), onClick: () => setPage(p => Math.min(pageCount - 1, p + 1)) }, 'Next', 'next')
      ], 'pager') : null
    ], 'foot')
  ])
}

export default DataTable
