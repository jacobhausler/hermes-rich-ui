import { createContext, useContext } from 'react'

// #29 (KPI row): a Grid of plain number tiles prints as ONE row — the tiles share
// a single fmtSet (one rung from the largest value, collisions widen) instead of
// each tile choosing its own scale. Grid provides the shared faces; a Metric with
// no row (single tile, mixed row, or any authored format/unit/precision) formats
// alone — byte-for-byte unchanged (L8).
const RowFmtCtx = createContext(null)
export const RowFmtProvider = RowFmtCtx.Provider
export const useRowFmt = () => useContext(RowFmtCtx)

// L8 (saved-card law, #24/#29): a SAVED record renders byte-for-byte as the day it
// was stamped — CardBody provides 'legacy' around its Renderer and the three number
// tiles take their pre-#29 components (formatMetric faces, old unit join, old delta).
// A fresh render (the agent's live path, renderComponent/renderSpec, the KPI-row
// tests) carries the default 'house' and gets fmt.num. Two renders, one source file:
// each tile opens with `if (useVintage() === 'legacy') return Legacy…({ element })`.
const VintageCtx = createContext('house')
export const VintageProvider = VintageCtx.Provider
export const useVintage = () => useContext(VintageCtx)

// Grid calls this with the child Metric elements (React children carrying
// props.element). Returns the tile values when EVERY tile is a plain number tile
// (no authored format/unit/precision, all finite, >= 2), else null.
export function rowValuesFrom(tiles) {
  if (!Array.isArray(tiles) || tiles.length < 2) return null
  const values = []
  for (const e of tiles) {
    const p = (e && e.props) ?? {}
    if (e == null || e.type !== 'Metric') return null
    const v = p.value
    if (v === null || v === undefined || typeof v !== 'number' || !Number.isFinite(v)) return null
    if (p.format !== undefined || p.unit !== undefined || p.precision !== undefined) return null
    values.push(v)
  }
  return values.length >= 2 ? values : null
}
