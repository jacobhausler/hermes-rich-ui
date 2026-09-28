import { jsx, jsxs } from 'react/jsx-runtime'
import { common, isNil, ownSources, ImageTile, V } from './_shared.mjs'

// N6 (counsel 0928): an evidence strip of ≤8 tiles in ONE component (a ≥4-image strip
// today costs 3N components). Each tile reuses the shared ImageTile (E14) so the https
// posture and the dashed unavailable/blocked frame are identical to Image; per-tile
// sourceIds resolve against /meta/sources exactly like every other superscript.
// Admission never fetched or verified any src (L1) — tiles show what fails to load.
const MAX_ITEMS = 8

export const ImageGallery = ({ element }) => {
  const p = element.props ?? {}
  const items = (Array.isArray(p.items) ? p.items : []).slice(0, MAX_ITEMS)
  const columns = Math.min(4, Math.max(1, Number(p.columns) || 2))
  return jsxs('div', {
    ...common(element, { 'data-ru-count': items.length }),
    style: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
    children: [
      isNil(p.title) ? null : jsx('div', { style: { fontWeight: 600, fontSize: 12, color: V.text }, children: [String(p.title), ownSources(p)] }, 't'),
      items.length === 0
        ? jsx('div', { 'data-ru-empty': 'none', style: { fontSize: 12, color: V.text3, fontStyle: 'italic' }, children: 'no images' }, 'e')
        : jsx('div', { 'data-ru-columns': columns, style: { display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 8 },
            children: items.map((it, i) => jsx(ImageTile, {
              src: it?.src, alt: it?.alt, caption: it?.caption,
              sourceIds: it?.sourceIds, sources: p._sources,
              extra: { 'data-ru-tile': i }
            }, i)) })
    ]
  })
}
