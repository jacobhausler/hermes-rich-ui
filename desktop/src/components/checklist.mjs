import { jsx, jsxs } from 'react/jsx-runtime'
import { common, isNil, text, withCite, citeMarker, StatusMark, V, type } from './_shared.mjs'
import { HOUSE } from './_house.mjs'

// N3 Checklist — undated booleans (Timeline is for dated events). Read-only card:
// the tri-state marker is native status text, NEVER an interactive checkbox (S ruling).
// done === true -> checked; done === false -> unchecked; null/absent -> UNKNOWN open
// circle, never guessed into unchecked (L1). The tally "3/7" is COMPUTED here (L6):
// the agent never hand-counts. Cap mirrors admission (items ≤32).
// #36 (supersedes #18): the three marks are StatusMark SVGs (check / ring / dashed `?`),
// never text glyphs (✓ ○ ◌ render inconsistently across fonts/emoji fallbacks).
const STATE = {
  done: { mark: 'done', color: V.green, aria: 'done' },
  unchecked: { mark: 'notDone', color: V.text2, aria: 'not done' },
  unknown: { mark: 'unknown', color: V.text3, aria: 'unknown' }
}
const stateOf = (done) => (done === true ? 'done' : done === false ? 'unchecked' : 'unknown')

export const Checklist = ({ element }) => {
  const p = element.props ?? {}
  const items = Array.isArray(p.items) ? p.items.slice(0, 32) : []
  const doneCount = items.filter((it) => it && it.done === true).length
  const tally = doneCount + '/' + items.length
  const showTally = (p.showTally ?? HOUSE.CHECKLIST_SHOW_TALLY) !== false
  const head = (isNil(p.title) && !showTally) ? null : jsxs('div', { style: { display: 'flex', gap: 8, alignItems: 'baseline' }, children: [
    isNil(p.title) ? null : jsx('span', { style: { ...type('h3'), color: V.text }, children: String(p.title) }, 't'),
    showTally ? jsx('span', { 'data-ru-tally-text': tally, role: 'status', style: { ...type('caption'), color: V.text3, fontVariantNumeric: 'tabular-nums' }, children: tally }, 'c') : null
  ] }, 'h')
  const list = jsx('ul', { style: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 },
    children: items.map((it, i) => {
      const st = stateOf(it?.done)
      const conf = STATE[st]
      return jsxs('li', { 'data-ru-state': st, style: { display: 'flex', alignItems: 'baseline', gap: 8, ...type('small'), color: V.text }, children: [
        jsx('span', { 'data-ru-marker': st, 'aria-label': conf.aria, style: { display: 'inline-flex', width: 12, flexShrink: 0 }, children: StatusMark(conf.mark, conf.color, 'mk') }, 'm'),
        jsxs('span', { style: { display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }, children: [text(it?.label), citeMarker(it?.sourceIds, p._sources)] }, 'l')
      ] }, i)
    })
  }, 'ul')
  return jsxs('div', {
    ...common(element, { 'data-ru-tally': tally }),
    style: { display: 'flex', flexDirection: 'column', gap: 6 },
    // #36 (withCite): the marker rides the head row (last inline child beside
    // title+tally); with no head row it becomes a flex sibling of the body.
    children: withCite(head, list, p.sourceIds, p._sources)
  })
}
