import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, isNil, withCite, citeMarker, StatusMark, V, type } from './_shared.mjs'
import { S } from './_house.mjs'
import { fmtDate } from './fmt.mjs'

// E17: 'failed' joins with --ui-red (blockers no longer render as pending).
const DOT = { done: V.green, active: V.accent, pending: V.stroke2, failed: V.red, unclassified: V.text3 }
// #36 (slice 13): done/pending ride the shared StatusMark SVG (done check, pending
// hollow secondary ring); active/failed/unclassified keep the filled dot.
const MARKED = { done: 'done', pending: 'pending' }

// E17 date auto-format: JS mirror of admission.py parse_iso8601 (digit-leading + a real
// ISO calendar date; trailing Z normalized) + the DataTable date column's
// toISOString().slice(0,10) output. Date.parse alone is too loose ("42" parses in V8), so
// the shape must match a full YYYY-MM-DD[THH:MM[:SS[.fff]][Z|±hh:mm]] before parsing.
// Anything non-ISO ("yesterday", "42") passes through VERBATIM (pinned by test).
// #36: a ZONED instant formats through fmtDate (viewer zone, en-US caption) — the UTC
// toISOString day-shift face is gone; a 23:30-05:00 event reads Sep 28 in Chicago.
const ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/
export function formatTimelineDate(v, { timeZone } = {}) {
  const s = String(v)
  if (!ISO_RE.test(s)) return s
  const txt = s.endsWith('Z') ? s.slice(0, -1) + '+00:00' : s
  const t = Date.parse(txt)
  if (!Number.isFinite(t)) return s
  if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const face = fmtDate(txt, { timeZone })
    if (typeof face === 'string' && face !== txt) return face.split(', ').slice(0, -1).join(', ') || face
  }
  return s.slice(0, 10)
}

export const Timeline = ({ element }) => {
  const p = element.props ?? {}
  const items = Array.isArray(p.items) ? p.items.slice(0, 30) : []
  const KNOWN = ['done', 'active', 'pending', 'failed']
  const anyDate = items.some(it => !isNil(it?.date) && String(it.date) !== '')
  // #36 (withCite): the title row is the head row — the marker joins it as the last
  // inline child; with no title the marker rides as a flex sibling after the body.
  const head = isNil(p.title) ? null : jsx('div', { style: { ...type('h3'), color: V.text }, children: String(p.title) }, 't')
  const body = jsx('ol', { style: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
        children: items.map((it, i) => {
          // E17/L1: absent/unknown status renders NEUTRAL unclassified — never an invented 'pending'.
          const status = KNOWN.includes(it?.status) ? it.status : 'unclassified'
          return jsxs('li', { 'data-ru-status': status,
            // #36: a `max-content` date column joins the grid whenever any item carries a date.
            style: { display: 'grid', gridTemplateColumns: anyDate ? '12px max-content 1fr' : '12px minmax(0, 1fr)', columnGap: 8, position: 'relative', paddingBottom: i < items.length - 1 ? 8 : 0 },
            children: [
              MARKED[status]
                ? jsx('span', { style: { width: 12, marginTop: S.hair, display: 'inline-flex', flexShrink: 0 }, children: StatusMark(MARKED[status], DOT[status], 'k') }, 'd')
                : jsx('span', { style: { width: 8, height: 8, marginTop: 4, borderRadius: 4, background: DOT[status], display: 'inline-block' } }, 'd'),
              jsxs('div', { style: { display: 'flex', flexDirection: 'column', gap: 1, ...type('small') },
                children: [
                  jsxs('div', { style: { display: 'flex', gap: 8, alignItems: 'baseline', color: V.text }, children: [
                    it?.date ? jsx('span', { 'data-ru-date': String(it.date), style: { color: V.text3, ...type('caption', { num: true }) }, children: formatTimelineDate(it.date, { timeZone: p.timeZone }) }, 'dt') : null,
                    jsxs('span', { style: { ...type('small') }, children: [text(it?.label), citeMarker(it?.sourceIds, p._sources)] }, 'lb')
                  ] }, 'l'),
                  it?.text ? jsx('div', { style: { color: V.text2, whiteSpace: 'pre-wrap' }, children: String(it.text) }, 'x') : null
                ]
              }, 'b')
            ]
          }, i)
        })
      }, 'ol')
  return jsxs('div', {
    ...common(element),
    style: { display: 'flex', flexDirection: 'column', gap: 6 },
    children: withCite(head, body, p.sourceIds, p._sources)
  })
}
