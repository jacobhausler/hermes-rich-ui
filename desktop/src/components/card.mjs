import { createContext, useContext } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, isNil, ownSources, V, type } from './_shared.mjs'
import { SURFACE, HOUSE } from './_house.mjs'

// Slice 7 (#30, M5/S11/C16): CardBody renders the root Card through the same registry at
// depth 0; nested Card instances count up via this context. rootTitleShown / rootSubtitleShown
// tell the root instance its header chrome already lives in the CardBody header (J4/S7/S19).
export const CardDepth = createContext(0)
export const CardChrome = createContext({ rootTitleShown: false, rootSubtitleShown: false })
const folded = v => String(v).trim().toLowerCase()

// depth 0: the ONE frame for any root (M5/S11) — SURFACE.card: card surface + hairline +
// radius 6 + padding 16 (C15; the 16 exceeds the block gap). The padding:12 frame is the
// named saved-card restyle (8px content width at the same shell, no reflow measured).
// A depth-0 title that survives chrome suppression (distinct from the header title) is h2 14/600 (C16).
// depth 1: flat — no second bordered section — with h3 13/600 title. depth >=2: bare div,
// no surface/border/padding, h4 12/600 (C16).
export const Card = ({ element, children }) => {
  const p = element.props ?? {}
  const depth = useContext(CardDepth)
  const chrome = useContext(CardChrome)
  const framed = depth === 0
  const titleShown = !(framed && chrome.rootTitleShown) && !isNil(p.title)
  const subtitleShown = !(framed && chrome.rootSubtitleShown) && !isNil(p.subtitle)
    && (isNil(p.title) || folded(p.subtitle) !== folded(p.title)) // S19: exact casefold duplicates render once
  return jsxs(framed ? 'section' : 'div', {
    ...common(element),
    style: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, ...(framed ? SURFACE.card : null) },
    children: [
      titleShown || subtitleShown ? jsxs('header', { style: { display: 'flex', flexDirection: 'column', gap: 2 },
        children: [
          titleShown ? jsxs(depth === 0 ? 'h2' : depth === 1 ? 'h3' : 'h4', { style: { margin: 0, ...type(depth === 0 ? 'h2' : depth === 1 ? 'h3' : 'h4') }, children: [text(p.title), ownSources(p)] }, 't') : null,
          subtitleShown ? jsx('div', { style: { maxWidth: HOUSE.MEASURE, ...type('small'), color: V.text2 }, children: [text(p.subtitle)] }, 's') : null
        ]
      }, 'h') : null,
      jsx(CardDepth.Provider, { value: depth + 1, children }, 'c'),
      // Auto-Sources slot (census order body -> slot -> footer); the renderer fills it at slice 13.
      jsx('div', { 'data-ru-sources-slot': '', style: { display: 'contents' } }, 'ss'),
      // E1 footer?: caption line under children (replaces the trailing Text variant=caption id ceremony).
      isNil(p.footer) ? null : jsx('div', { 'data-ru-footer': '', style: { maxWidth: HOUSE.MEASURE, ...type('caption'), color: V.text2, whiteSpace: 'pre-wrap' }, children: text(p.footer) }, 'f')
    ]
  })
}
