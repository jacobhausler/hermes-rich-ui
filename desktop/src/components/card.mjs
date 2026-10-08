import { createContext, useContext } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, isNil, ownSources, V, type } from './_shared.mjs'
import { SURFACE, HOUSE } from './_house.mjs'

// CardBody owns the whole-card frame. Count Card ancestry independently so
// non-Card roots do not shift or suppress their descendants' title ladder.
export const CardDepth = createContext(0)
export const CardChrome = createContext({ framed: false, rootAtBoundary: false })
const folded = v => String(v).trim().toLowerCase()

export function CardHeader({ p, depth = 0, titleShown = !isNil(p.title), subtitleShown = !isNil(p.subtitle) }) {
  return titleShown || subtitleShown ? jsxs('header', { style: { display: 'flex', flexDirection: 'column', gap: 2 },
    children: [
      titleShown ? jsxs(depth === 0 ? 'h2' : depth === 1 ? 'h3' : 'h4', { style: { margin: 0, ...type(depth === 0 ? 'h2' : depth === 1 ? 'h3' : 'h4') }, children: [text(p.title), ownSources(p)] }, 't') : null,
      subtitleShown ? jsx('div', { style: { maxWidth: HOUSE.MEASURE, ...type('small'), color: V.text2 }, children: [text(p.subtitle)] }, 's') : null
    ]
  }) : null
}

// Standalone Cards keep their frame; CardBody renders its root header at the
// boundary and all nested Cards flat. Titles remain h2 / h3 / h4 by ancestry.
export const Card = ({ element, children }) => {
  const p = element.props ?? {}
  const depth = useContext(CardDepth)
  const chrome = useContext(CardChrome)
  const atBoundary = depth === 0 && chrome.rootAtBoundary
  const framed = depth === 0 && !chrome.framed
  const content = [
    !atBoundary ? jsx(CardHeader, { p, depth, subtitleShown: !isNil(p.subtitle) && (isNil(p.title) || folded(p.subtitle) !== folded(p.title)) }, 'h') : null,
    jsx(CardDepth.Provider, { value: depth + 1, children }, 'c'),
    // Auto-Sources slot (census order body -> slot -> footer); filled by the evidence slice.
    jsx('div', { 'data-ru-sources-slot': '', style: { display: 'contents' } }, 'ss'),
    isNil(p.footer) ? null : jsx('div', { 'data-ru-footer': '', style: { maxWidth: HOUSE.MEASURE, ...type('caption'), color: V.text2, whiteSpace: 'pre-wrap' }, children: text(p.footer) }, 'f')
  ]
  return jsxs(framed ? 'section' : 'div', {
    ...(atBoundary ? {} : common(element)),
    style: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, ...(framed ? SURFACE.card : null) },
    children: content
  })
}
