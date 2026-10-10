import { jsx, jsxs } from 'react/jsx-runtime'
import { common, isNil, withCite, ImageTile, V, type } from './_shared.mjs'
import { HOUSE } from './_house.mjs'

// N6 (counsel 0928): an evidence strip of ≤8 tiles in ONE component (a ≥4-image strip
// today costs 3N components). Each tile reuses the shared ImageTile (E14) so the https
// posture and the dashed unavailable/blocked frame are identical to Image; per-tile
// sourceIds resolve against /meta/sources exactly like every other superscript.
// Admission never fetched or verified any src (L1) — tiles show what fails to load.
const MAX_ITEMS = 8

export const ImageGallery = ({ element }) => {
  const p = element.props ?? {}
  const items = (Array.isArray(p.items) ? p.items : []).slice(0, MAX_ITEMS)
  const columns = Math.min(4, Math.max(1, Number(p.columns ?? HOUSE.GALLERY_COLUMNS) || HOUSE.GALLERY_COLUMNS))
  // #36 (withCite): the title row is the head row — the marker joins it as the last
  // inline child; with no title it rides as a flex sibling after the tile grid.
  const head = isNil(p.title) ? null : jsx('div', { style: { ...type('h3'), color: V.text }, children: String(p.title) }, 't')
  const body = items.length === 0
    ? jsx('div', { 'data-ru-empty': 'none', style: { ...type('small'), color: V.text3, fontStyle: 'italic' }, children: 'no images' }, 'e')
    : jsx('div', { 'data-ru-columns': columns, style: { display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8 },
        children: items.map((it, i) => jsx(ImageTile, {
          src: it?.src, alt: it?.alt, caption: it?.caption,
          sourceIds: it?.sourceIds, sources: p._sources,
          extra: { 'data-ru-tile': i }
        }, i)) })
  return jsxs('div', {
    ...common(element, { 'data-ru-count': items.length }),
    style: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
    children: withCite(head, body, p.sourceIds, p._sources)
  })
}
