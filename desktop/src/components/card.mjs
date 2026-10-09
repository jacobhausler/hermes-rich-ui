import { createContext, useContext } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { common, compose, kidList, text, isNil, ownSources, V, type } from './_shared.mjs'
import { SURFACE, HOUSE } from './_house.mjs'
import { PROSE_RESET_CSS, PROSE_RESET_HREF } from '../prose-reset.mjs'

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
// #28 (M4): compose() owns the body rhythm (gap 0; no CSS heading margins); the flow
// carries the title→first-child 8, the footer 12. The prose-reset <style> is hoisted
// here too (React dedupes by href) so a spec-root Card gets the h-Stack class flex.
export const Card = ({ element, children }) => {
  const p = element.props ?? {}
  const depth = useContext(CardDepth)
  const chrome = useContext(CardChrome)
  const atBoundary = depth === 0 && chrome.rootAtBoundary
  const framed = depth === 0 && !chrome.framed
  const header = !isNil(p.title) || !isNil(p.subtitle)
  const kids = kidList(children)
  const content = [
    framed ? jsx('style', { href: PROSE_RESET_HREF, precedence: 'default', 'data-ru-prose-reset': '1', children: PROSE_RESET_CSS }, 'css') : null,
    !atBoundary ? jsx(CardHeader, { p, depth, subtitleShown: !isNil(p.subtitle) && (isNil(p.title) || folded(p.subtitle) !== folded(p.title)) }, 'h') : null,
    kids.length
      ? jsx(CardDepth.Provider, { value: depth + 1, children: jsx('div', {
          'data-ru-body-flow': '', style: { display: 'flex', flexDirection: 'column', minWidth: 0, marginTop: header || atBoundary ? 8 : 0 },
          children: compose(children, { otherwise: 12 })
        }, 'flow') }, 'c')
      : null,
    // Auto-Sources slot (census order body -> slot -> footer); filled by the evidence slice.
    jsx('div', { 'data-ru-sources-slot': '', style: { display: 'contents' } }, 'ss'),
    isNil(p.footer) ? null : jsx('div', { 'data-ru-footer': '', style: { maxWidth: HOUSE.MEASURE, ...type('caption'), color: V.text2, whiteSpace: 'pre-wrap', marginTop: 12 }, children: text(p.footer) }, 'f')
  ]
  return jsxs(framed ? 'section' : 'div', {
    ...(atBoundary ? {} : common(element)),
    'data-ru-card': framed ? '' : undefined,
    style: { display: 'flex', flexDirection: 'column', gap: 0, minWidth: 0, ...(framed ? SURFACE.card : null) },
    children: content
  })
}
