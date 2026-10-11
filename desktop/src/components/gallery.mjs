import { jsx, jsxs } from 'react/jsx-runtime'
import { common, isNil, withCite, ImageTile, V, type } from './_shared.mjs'
import { HOUSE, S } from './_house.mjs'

// At most eight evidence tiles; saved explicit columns survive the count default.
const MAX_ITEMS = 8

export const ImageGallery = ({ element }) => {
  const p = element.props ?? {}
  const items = (Array.isArray(p.items) ? p.items : []).slice(0, MAX_ITEMS)
  const n = items.length
  const columns = p.columns != null
    ? Math.min(4, Math.max(1, Number(p.columns) || HOUSE.GALLERY_COLUMNS))
    : Math.max(1, n <= 3 ? n : Math.min(4, Math.ceil(n / 2)))
  // The marker joins the title, or rides after the grid when there is no title.
  const head = isNil(p.title) ? null : jsx('div', { style: { ...type('h3'), color: V.text }, children: String(p.title) }, 't')
  const body = items.length === 0
    ? jsx('div', { 'data-ru-empty': 'none', style: { ...type('small'), color: V.text3, fontStyle: 'italic' }, children: 'no images' }, 'e')
    : jsx('div', { 'data-ru-columns': columns, style: { display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: S.sm },
        children: items.map((it, i) => jsx(ImageTile, {
          src: it?.src, alt: it?.alt, caption: it?.caption, aspectRatio: '3 / 2',
          sourceIds: it?.sourceIds, sources: p._sources,
          extra: { 'data-ru-tile': i }
        }, i)) }, 'grid')
  return jsxs('div', {
    ...common(element, { 'data-ru-count': items.length }),
    style: { display: 'flex', flexDirection: 'column', gap: S.sm, minWidth: 0 },
    children: withCite(head, body, p.sourceIds, p._sources)
  })
}
