import { jsx, jsxs } from 'react/jsx-runtime'
import { common, isNil, ownSources, V, type } from './_shared.mjs'

// N5 (counsel 0928): the house evidence-law timestamp primitive — observed/published as a
// fixed vocabulary instead of hand-merged prose. accessedAt is TRIMMED (F8): source-scoped
// accessed_at already renders in SourceList. This renderer NEVER calls Date.now() or any
// clock — the card stays an honest static artifact (pinned by test_synth_media.mjs);
// admission validates each value with the existing parse_iso8601 (no new parser).
// A null/absent field OMITS its segment entirely (L1: nothing is invented or defaulted).
const SEGMENTS = [['observedAt', 'Observed'], ['publishedAt', 'Published']]

export const AsOf = ({ element }) => {
  const p = element.props ?? {}
  const parts = SEGMENTS
    .filter(([k]) => !isNil(p[k]) && String(p[k]) !== '')
    .map(([k, label]) => label + ' ' + String(p[k]))
  const note = !isNil(p.note) && String(p.note) !== '' ? String(p.note) : null
  const caption = parts.length || note
    ? jsxs('span', { style: { fontStyle: 'italic' }, children: [parts.join(' · '), parts.length && note ? ' · ' : '', note ?? ''] }, 'c')
    : jsxs('span', { 'data-ru-null': '', style: { fontStyle: 'italic' }, children: ['No timestamps published'] }, 'c')
  return jsxs('div', {
    ...common(element, { 'data-ru-fields': parts.length }),
    style: { display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 4, ...type('caption'), color: V.text3 },
    children: [caption, ownSources(p)]
  })
}
