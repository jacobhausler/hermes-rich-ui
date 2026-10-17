import { jsx, jsxs } from 'react/jsx-runtime'
import { common, isNil, text, citeMarker, StatusMark, stageMark, V, type } from './_shared.mjs'

// #57 S3: PhaseTracker — an ordered stage pipeline over the five-token stage
// vocabulary (S1: the _shared.mjs StatusMark table is the single state+color source).
// density compact = segment bar, expanded = rows. The `current` pointer is COMPUTED
// (first active; otherwise none) — L6 precedent: the agent never hand-points.
// Colours ride --ui-* custom properties only (#15). blocked surfaces note/owner;
// blocked != skipped (S1 law). A legacy/unknown stored state falls back to the
// neutral unknown ring — never a coercion (admission rejects at author time, #38).

const markOf = (st) => {
  const state = st && typeof st.state === 'string' ? st.state : null
  const m = state ? stageMark(state, 'sg') : null
  return { state: m ? state : 'unknown', color: m ? 'var(' + m.stroke + ')' : V.text3 }
}
const str = (v) => (typeof v === 'string' && v !== '' ? String(v) : null)

function stageNode(st, i, isCur, density, sources) {
  const mk = markOf(st)
  const detail = density === 'expanded' || mk.state === 'blocked'
  const note = detail && str(st?.note) ? jsx('span', { 'data-ru-note': '1', style: { ...type('caption'), color: V.text3 }, children: str(st.note) }, 'n') : null
  const owner = detail && str(st?.owner) ? jsx('span', { 'data-ru-owner': '1', style: { ...type('caption'), color: V.text3 }, children: '@' + str(st.owner) }, 'o') : null
  const props = {
    'data-ru-stage': String(i), 'data-ru-state': mk.state,
    'data-ru-current': isCur ? 'true' : 'false',
    ...(isCur ? { 'aria-current': 'step' } : null),
    style: { display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0, ...type('small'), color: V.text },
    children: jsxs('span', { style: { display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }, children: [
      jsx('span', { 'data-ru-marker': mk.state, 'aria-label': mk.state, style: { display: 'inline-flex', width: 12, flexShrink: 0 }, children: StatusMark(mk.state, mk.color, 'mk') }, 'm'),
      jsxs('span', { style: { display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }, children: [text(st?.label), note, owner, citeMarker(st?.sourceIds, sources)] }, 'l')
    ] })
  }
  return jsx(density === 'compact' ? 'div' : 'li', props, 's' + i)
}

export const PhaseTracker = ({ element }) => {
  const p = element.props ?? {}
  const stages = (Array.isArray(p.stages) ? p.stages : []).slice(0, 12)
  const density = p.density === 'expanded' ? 'expanded' : 'compact'
  const cur = stages.findIndex((s) => s && s.state === 'active')
  const kids = stages.map((st, i) => stageNode(st, i, i === cur, density, p._sources))
  const body = density === 'compact'
    ? jsx('div', { 'data-ru-pt': 'compact', role: 'list', style: { display: 'flex', gap: 8, flexWrap: 'wrap' }, children: kids }, 'b')
    : jsx('ol', { 'data-ru-pt': 'expanded', style: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }, children: kids }, 'b')
  const head = isNil(p.title) ? null : jsx('div', { 'data-ru-head': '', style: { ...type('h3'), color: V.text }, children: String(p.title) }, 't')
  return jsxs('section', { ...common(element), 'aria-label': String(p.title ?? 'PhaseTracker'), style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [head, body] }, 'pt')
}
