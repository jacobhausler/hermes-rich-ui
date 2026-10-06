// DataTable — pure React (no deps). docs/CONTRACTS.md §2 row 15.
// Props resolved on element.props: title?, columns?[{key,label?,type?,unit?,precision?}] (optional — inferred
// from rows), rows[] (≤100), pageSize? (5..50, default 10, chrome only past pageSize×1.5 grace).
// Local sort (header <button>s), local filter (one text input, any cell, case-insensitive), pagination,
// "N of M rows" counter that reflects the filter. Nulls sort LAST in both directions and render "unavailable".
import { jsx, jsxs } from 'react/jsx-runtime'
import { useMemo, useState } from 'react'
import { ownSources, citeMarker, type } from './_shared.mjs'
import { fmtColumn, fmtDate, unitLabel } from './fmt.mjs'
import { MARK_FILL } from './_house.mjs'

// E15: column type 'bar' (width ∝ column max, computed in the RENDERER — L6). 'bar' sorts
// and formats like 'number'. defaultSort?: {key,dir?} seeds the sort (deletes agent pre-sorting);
// dir is optional and type-aware (desc for numeric/date, asc for text).
const TYPES = ['text', 'number', 'currency', 'percent', 'fraction', 'date', 'sources', 'bar']
const NUMERIC = new Set(['number', 'currency', 'percent', 'fraction', 'bar'])
const INFERABLE = new Set(['number', 'currency', 'percent', 'fraction', 'date', 'text']) // 'bar'/'sources' are never inferred
const MAX_ROWS = 100
const DEFAULT_PAGE = 10
const GRACE = 1.5 // filter/counter appear only past one page (+50%)

function h(type, props, children, key) {
  const p = children === undefined ? props : { ...props, children }
  return Array.isArray(children) ? jsxs(type, p, key) : jsx(type, p, key)
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
const isNullish = (v) => v === null || v === undefined
// Own-property read only: a column key of 'constructor' / '__proto__' on a row that does not
// own it reads as undefined (→ "unavailable"), never as an inherited Object.prototype member (D1).
const own = (row, key) => (row && typeof row === 'object' && Object.prototype.hasOwnProperty.call(row, key) ? row[key] : undefined)

// #34: a key with no authored label reads as words: camelCase/snake/dotted → "Monthly Rent".
export function humanize(key) {
  const words = String(key).replace(/[_\-.:]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim().split(/\s+/)
  return words.map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(' ')
}

// #34 rows-only: columns are optional. Inferred from the rows (first-seen key order):
// string[] → sources, all-numeric → number, all-ISO-date → date, else text. Never bar;
// never a unit (only the author names units).
const ISO_ONLY = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/
function inferColumns(rows) {
  const keys = []
  for (const row of rows) for (const k of Object.keys(row)) if (!keys.includes(k)) keys.push(k)
  return keys.slice(0, 12).map(key => {
    const vals = rows.map(r => own(r, key)).filter(v => !isNullish(v))
    let t = 'text'
    if (vals.length && vals.every(v => Array.isArray(v) && v.every(s => typeof s === 'string'))) t = 'sources'
    else if (vals.length && vals.every(isNum)) t = 'number'
    else if (vals.length && vals.every(v => typeof v === 'string' && ISO_ONLY.test(v))) t = 'date'
    return { key, label: humanize(key), type: INFERABLE.has(t) || t === 'sources' ? t : 'text', unit: '', precision: null }
  })
}

export function normColumns(columns, rows) {
  if (!Array.isArray(columns) || columns.length === 0) return inferColumns(Array.isArray(rows) ? rows.filter(r => r && typeof r === 'object').slice(0, MAX_ROWS) : [])
  return columns.filter(c => c && typeof c.key === 'string').map(c => ({
    key: c.key,
    label: typeof c.label === 'string' ? c.label : humanize(c.key),
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

// #34: each numeric column is ONE fmtSet (via fmtColumn) over ALL rows: one rung, uniform
// decimal places, shared cents, collision widen→exact, additivity guard. D4: dates always
// full form. null → null (caller renders "unavailable").
export function columnFaces(col, rows) {
  const values = rows.map(r => own(r, col.key))
  if (col.type === 'date') return values.map(v => isNullish(v) ? null : fmtDate(v))
  if (col.type === 'sources' || col.type === 'text') return values.map(v => isNullish(v) ? null : undefined)
  const format = col.type === 'bar' || col.type === 'number' ? 'number' : col.type
  const ctx = { format, unit: col.unit || undefined, precision: col.precision === null ? undefined : col.precision }
  const faces = fmtColumn(values, ctx)
  const tiered = /k|MB|T|\u00d710/.test(faces.filter(Boolean).join(' '))
  if (col.precision !== null || tiered) return faces // authored precision / tiered rung: fmtSet owns it
  let d = 0
  for (const s of faces) { const m = s && /\.(\d+)/.exec(s); if (m && m[1].length > d) d = m[1].length }
  return d === 0 ? faces : fmtColumn(values, { ...ctx, precision: d })
}

// Plain-text cell value (null → null; caller renders "unavailable"). Kept for the
// security-pinned hostile tests; renders read columnFaces.
export function formatCell(col, row) {
  const v = own(row, col.key)
  if (isNullish(v)) return null
  if (col.type === 'sources') return Array.isArray(v) ? v.join(' ') : null
  if (col.type === 'date') { const t = Date.parse(String(v)); return Number.isFinite(t) ? fmtDate(String(v)) : String(v) }
  if (NUMERIC.has(col.type)) {
    if (!isNum(v)) return String(v)
    const f = fmtColumn([v], { format: col.type === 'bar' ? 'number' : col.type, unit: col.unit || undefined, precision: col.precision === null ? undefined : col.precision })[0]
    return f ?? String(v)
  }
  return typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v))
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

function rowFace(c, row, faceOf) {
  if (c.type === 'sources') { const ids = own(row, c.key); return Array.isArray(ids) ? ids.join(' ') : '' }
  const f = faceOf.get(row)?.[c.key]
  if (f !== undefined) return f ?? String(f)
  const raw = own(row, c.key)
  return isNullish(raw) ? '' : typeof raw === 'object' ? JSON.stringify(raw) : String(raw)
}
function rowMatches(cols, row, q, faceOf) {
  if (!q) return true
  for (const c of cols) {
    if (rowFace(c, row, faceOf).toLowerCase().includes(q)) return true
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
  th: (numeric) => ({ padding: 0, borderBottom: '1px solid var(--ui-stroke-secondary)', textAlign: numeric ? 'right' : 'left' }), // header alignment = cell alignment
  thBtn: (active) => ({ font: 'inherit', ...type('h4'), width: '100%', textAlign: 'inherit', padding: '5px 8px', border: 0, background: 'transparent', cursor: 'pointer', color: active ? 'var(--ui-accent)' : 'var(--ui-text-secondary)', whiteSpace: 'nowrap' }),
  td: (numeric) => ({ padding: '4px 8px', borderBottom: '1px solid var(--ui-stroke-tertiary)', textAlign: numeric ? 'right' : 'left', fontVariantNumeric: numeric ? 'tabular-nums' : 'normal', verticalAlign: 'top' }),
  unavailable: { color: 'var(--ui-text-tertiary)', fontStyle: 'italic' },
  foot: { ...type('caption'), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: 'var(--ui-text-tertiary)' },
  pager: (disabled) => ({ font: 'inherit', ...type('caption'), padding: '2px 8px', borderRadius: 6, border: '1px solid var(--ui-stroke-secondary)', background: 'var(--ui-bg-elevated)', color: disabled ? 'var(--ui-text-tertiary)' : 'var(--ui-text-secondary)', cursor: disabled ? 'default' : 'pointer' }),
  empty: { padding: '8px 12px', textAlign: 'center', color: 'var(--ui-text-tertiary)', fontStyle: 'italic' }
}

function Cell({ col, row, face, sources }) {
  if (col.type === 'sources') {
    const ids = Array.isArray(own(row, col.key)) ? own(row, col.key).filter(s => typeof s === 'string') : []
    const mark = ids.length ? citeMarker(ids, sources) : null
    return mark ?? h('span', {}, '—')
  }
  const t = face === undefined ? (isNullish(own(row, col.key)) ? null : String(own(row, col.key))) : face
  return t === null ? h('span', { style: S.unavailable }, 'unavailable') : h('span', {}, t)
}

// E15 bar cell: width ∝ |value| / column-wide maxAbs (computed over ALL rows — L6, never
// per-cell). Zero-baseline like the chart: a center line at 50%, positive bars extend right,
// negative bars extend left. null → "unavailable" with NO bar element (never a zero-width bar).
function BarCell({ col, row, maxAbs, face }) {
  const v = own(row, col.key)
  const label = face === null || face === undefined && isNullish(v)
    ? h('span', { style: S.unavailable }, 'unavailable')
    : h('span', {}, face ?? String(v))
  if (!isNum(v) || !(maxAbs > 0)) return h('span', { 'data-ru-bar': 'absent', style: { display: 'inline-flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'flex-end' } }, label, 'lb')
  const frac = Math.abs(v) / maxAbs
  const wPct = Math.max(2, Math.round(frac * 100))
  const barStyle = { height: 6, borderRadius: 2, background: MARK_FILL(), position: 'absolute', ...(v < 0 ? { right: '50%' } : { left: '50%' }), width: `${wPct / 2}%` }
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
  const allRows = useMemo(() => (Array.isArray(props.rows) ? props.rows.filter(r => r && typeof r === 'object').slice(0, MAX_ROWS) : []), [props.rows])
  const cols = useMemo(() => normColumns(props.columns, allRows), [props.columns, allRows])
  const authored = Array.isArray(props.columns) && props.columns.length > 0
  const pageSize = Number.isInteger(props.pageSize) && props.pageSize >= 1 ? Math.min(props.pageSize, 50) : DEFAULT_PAGE
  const chromeShown = allRows.length > pageSize * GRACE
  // E15 defaultSort?: {key,dir?} — seed the sort so agents stop pre-sorting rows. An unknown
  // key falls back to the unsorted state (header clicks still work); dir is type-aware:
  // desc for numeric/date (bigger/most-recent first), asc for text.
  const seededSort = (() => {
    const d = props.defaultSort
    if (d && typeof d === 'object' && typeof d.key === 'string') {
      const col = cols.find(c => c.key === d.key)
      if (col) {
        const dir = d.dir === 'desc' || d.dir === 'asc' ? d.dir : (NUMERIC.has(col.type) || col.type === 'date' ? 'desc' : 'asc')
        return { key: d.key, dir }
      }
    }
    return { key: null, dir: 'asc' }
  })()
  const [sort, setSort] = useState(seededSort)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)

  // One fmtSet per column over ALL rows (stable faces across sort/filter/page).
  const faceOf = useMemo(() => {
    const m = new Map()
    for (const c of cols) {
      const faces = columnFaces(c, allRows)
      allRows.forEach((row, i) => {
        let per = m.get(row)
        if (!per) { per = {}; m.set(row, per) }
        per[c.key] = faces[i]
      })
    }
    return m
  }, [cols, allRows])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => allRows.filter(r => rowMatches(cols, r, q, faceOf)), [allRows, cols, q, faceOf])
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
  const sources = Array.isArray(props._sources) ? props._sources : []

  const header = h('tr', {}, cols.map(c => {
    const active = sort.key === c.key
    const arrow = active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''
    // Authored labels are byte-identical; the word unit rides the header (currency/% never do).
    const label = c.type === 'text' || c.type === 'sources' ? c.label
      : (c.unit && NUMERIC.has(c.type) && c.type !== 'currency' && c.type !== 'percent' && c.type !== 'fraction')
        ? unitLabel(c.label, { format: c.type === 'bar' ? 'number' : c.type, unit: c.unit }) : c.label
    return h('th', { scope: 'col', style: S.th(NUMERIC.has(c.type)), 'aria-sort': active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none' },
      h('button', { type: 'button', style: S.thBtn(active), onClick: () => onSort(c.key), 'data-sort-key': c.key }, label + arrow), c.key)
  }))
  const body = visible.length === 0
    ? [h('tr', {}, h('td', { colSpan: Math.max(1, cols.length), style: S.empty }, allRows.length === 0 ? 'no rows' : 'no rows match the filter'), 'empty')]
    : visible.map((row, i) => h('tr', {}, cols.map(c => {
        const face = faceOf.get(row)?.[c.key]
        if (c.type === 'bar') {
          // E15 L6: column-wide scale computed in the RENDERER over ALL rows (max |value|).
          const maxAbs = allRows.reduce((m, r) => { const v = own(r, c.key); return isNum(v) ? Math.max(m, Math.abs(v)) : m }, 0)
          return h('td', { style: S.td(true) }, h(BarCell, { col: c, row, maxAbs, face: face ?? undefined }), c.key)
        }
        return h('td', { style: S.td(NUMERIC.has(c.type)) }, h(Cell, { col: c, row, face, sources }), c.key)
      }), `r${curPage * pageSize + i}`))

  return h('div', { style: S.box, 'data-richui': 'table', 'data-ru': 'DataTable', role: 'region', 'aria-label': accLabel || title || 'data table' }, [
    h('div', { style: S.head }, [
      h('span', { style: S.title }, [title, ownSources(props)], 'title'),
      chromeShown ? h('input', { type: 'search', placeholder: 'Filter rows', 'aria-label': 'Filter rows', value: query, onChange: onFilter, style: S.input, 'data-richui': 'table-filter' }, undefined, 'filter') : null
    ], 'head'),
    h('div', { style: S.wrap }, h('table', { style: S.table }, [authored || cols.length ? h('thead', {}, header, 'thead') : null, h('tbody', {}, body, 'tbody')]), 'wrap'),
    chromeShown ? h('div', { style: S.foot }, [
      h('span', { 'data-richui': 'table-counter' }, counter, 'counter'),
      pageCount > 1 ? h('span', { style: { display: 'inline-flex', gap: 6, alignItems: 'center' } }, [
        h('button', { type: 'button', disabled: curPage === 0, style: S.pager(curPage === 0), onClick: () => setPage(p => Math.max(0, p - 1)) }, 'Prev', 'prev'),
        h('span', { 'data-richui': 'table-page' }, `page ${curPage + 1} of ${pageCount}`, 'pg'),
        h('button', { type: 'button', disabled: curPage >= pageCount - 1, style: S.pager(curPage >= pageCount - 1), onClick: () => setPage(p => Math.min(pageCount - 1, p + 1)) }, 'Next', 'next')
      ], 'pager') : null
    ], 'foot') : null
  ])
}

export default DataTable
