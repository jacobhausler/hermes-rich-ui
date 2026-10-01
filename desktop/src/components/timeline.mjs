import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, isNil, sourceSup, ownSources, V, type } from './_shared.mjs'

// E17: 'failed' joins with --ui-red (blockers no longer render as pending).
const DOT = { done: V.green, active: V.accent, pending: V.stroke2, failed: V.red, unclassified: V.text3 }

// E17 date auto-format: JS mirror of admission.py parse_iso8601 (digit-leading + a real
// ISO calendar date; trailing Z normalized) + the DataTable date column's
// toISOString().slice(0,10) output. Date.parse alone is too loose ("42" parses in V8), so
// the shape must match a full YYYY-MM-DD[THH:MM[:SS[.fff]][Z|±hh:mm]] before parsing.
// Anything non-ISO ("yesterday", "42") passes through VERBATIM (pinned by test).
const ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/
export function formatTimelineDate(v) {
  const s = String(v)
  if (!ISO_RE.test(s)) return s
  const txt = s.endsWith('Z') ? s.slice(0, -1) + '+00:00' : s
  const t = Date.parse(txt)
  if (!Number.isFinite(t)) return s
  return new Date(t).toISOString().slice(0, 10)
}

export const Timeline = ({ element }) => {
  const p = element.props ?? {}
  const items = Array.isArray(p.items) ? p.items.slice(0, 30) : []
  const KNOWN = ['done', 'active', 'pending', 'failed']
  return jsxs('div', {
    ...common(element),
    style: { display: 'flex', flexDirection: 'column', gap: 6 },
    children: [
      isNil(p.title) ? null : jsxs('div', { style: { ...type('h3'), color: V.text }, children: [String(p.title), ownSources(p)] }, 't'),
      jsx('ol', { style: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
        children: items.map((it, i) => {
          // E17/L1: absent/unknown status renders NEUTRAL unclassified — never an invented 'pending'.
          const status = KNOWN.includes(it?.status) ? it.status : 'unclassified'
          return jsxs('li', { 'data-ru-status': status,
            style: { display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr)', columnGap: 8, position: 'relative', paddingBottom: i < items.length - 1 ? 8 : 0 },
            children: [
              jsx('span', { style: { width: 8, height: 8, marginTop: 4, borderRadius: 4, background: DOT[status], display: 'inline-block' } }, 'd'),
              jsxs('div', { style: { display: 'flex', flexDirection: 'column', gap: 1, ...type('small') },
                children: [
                  jsxs('div', { style: { display: 'flex', gap: 8, alignItems: 'baseline', color: V.text }, children: [
                    it?.date ? jsx('span', { style: { color: V.text3, ...type('caption', { num: true }) }, children: formatTimelineDate(it.date) }, 'dt') : null,
                    jsxs('span', { style: { ...type('small') }, children: [text(it?.label), sourceSup(it?.sourceIds, p._sources, 's' + i)] }, 'lb')
                  ] }, 'l'),
                  it?.text ? jsx('div', { style: { color: V.text2, whiteSpace: 'pre-wrap' }, children: String(it.text) }, 'x') : null
                ]
              }, 'b')
            ]
          }, i)
        })
      }, 'ol')
    ]
  })
}
