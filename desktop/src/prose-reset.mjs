// The prose-reset stylesheet (#28): hoisted once per document by CardBody and by a
// framed spec-root Card (same href => React dedupes). Lives in its own module so both
// card entry points import it without a cycle; card.mjs re-exports it verbatim.
import { SIZE_CLASS, FLEX_BASIS } from './components/_shared.mjs'

export const PROSE_RESET_HREF = 'hermes-rich-ui/prose-reset/4' // bump on every css edit (React dedupes by href)
// #28 (G3/M2): a horizontal Stack flexes by size class unless every child is a tile/atom.
const HROW = '[data-ru-card] [data-ru-dir="horizontal"]'
const H_STACK_FLEX = [`${HROW}[data-ru-row-fill="tiles"]>*{flex:0 0 auto}`].concat(Object.entries(SIZE_CLASS).map(([t, c]) =>
  `${HROW}[data-ru-row-fill="mixed"]>[data-ru="${t}"]{flex:${c === 'atom' ? '0 0 auto' : `1 1 ${FLEX_BASIS[c]}px`};min-width:0}`))
export const PROSE_RESET_CSS = [
  '[data-ru-card] :is(table,thead,tbody,tr,th,td,ol,ul,li,dl,dt,dd,p,figure,figcaption,h1,h2,h3,h4,h5,h6){margin:0}',
  '[data-ru-card] :is(ol,ul){padding-left:0}',
  '[data-ru-card] li::marker{content:none}',
  '[data-ru-card] :is(th,td){padding:0}',
  '[data-ru-card] :is(table,thead,tbody,tr,th,td){border:0}',
  '[data-ru-card] :is(dt,dd,th){font-weight:inherit}',
  '[data-ru-card] button{font:inherit}',
  ...H_STACK_FLEX,
  // the Divider's own margin zeroes inside a composed body: compose() owns the rhythm
  '[data-ru-card] [data-ru-body-flow]>div>[data-ru="Divider"]{margin:0}'
].join('')
