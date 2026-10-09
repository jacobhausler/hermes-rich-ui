import { Fragment, jsx } from 'react/jsx-runtime'
import { common, GAP, RowContext, gridTracks, kidList, classOf } from './_shared.mjs'
import { HOUSE } from './_house.mjs'
import { fmtSet } from './fmt.mjs'
import { RowFmtProvider, rowValuesFrom } from './rowfmt.mjs'

// #29 (KPI row, slice 6): when every direct child of the row is a plain number
// tile — Metric with no authored format/unit/precision and a finite value, n >= 2 —
// the row prints as ONE set: fmtSet picks a single rung from the largest value and
// every tile takes its face from that shared scale (12,340 / 12,341 / ... never
// four independent tiers). Any other row (authored formats, non-tiles, n < 2,
// nulls) provides nothing and each tile formats alone — byte-for-byte pre-#29 (L8).
// The child elements ride the React children as props.element (the Renderer's
// contract), so the census needs no Renderer change.
export const Grid = ({ element, children }) => {
  const p = element.props ?? {}
  const cols = Math.min(4, Math.max(1, Number(p.columns) || 1))
  const tiles = (Array.isArray(children) ? children : [children]).filter(c => c && c.props && c.props.element)
  const values = rowValuesFrom(tiles.map(c => c.props.element))
  const body = values ? jsx(Fragment, { children: tiles.map((c, i) => jsx(RowFmtProvider, { value: { values, faces: fmtSet(values), index: i }, children: c }, 'r' + i)) }) : children
  // #28 (M3/G2): `columns` is a MAXIMUM — balanced auto-fit tracks over the class floor;
  // an all-tile grid takes the 16px KPI gutters. columns ≥ 2 provides RowContext(true).
  const classes = kidList(children).map(classOf)
  const gap = GAP[p.gap ?? HOUSE.GRID_GAP] ?? GAP[HOUSE.GRID_GAP]
  const colGap = classes.length && classes.every(c => c === 'tile') ? 16 : gap
  const grid = jsx('div', {
    ...common(element),
    style: { display: 'grid', gridTemplateColumns: gridTracks(classes.length, cols, classes, colGap).template, columnGap: colGap, rowGap: gap },
    children: body
  })
  return cols >= 2 ? jsx(RowContext.Provider, { value: true, children: grid }) : grid
}
