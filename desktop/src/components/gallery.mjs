import { jsx, jsxs } from 'react/jsx-runtime'
import { useState } from 'react'
import { common, isNil, withCite, citeMarker, V, type } from './_shared.mjs'
import { S, R, B } from './_house.mjs'

// N6 (counsel 0928): an evidence strip of ≤8 tiles in ONE component. Every src is https-only
// (L3): a non-https src never reaches the network, and a failed https load swaps to the dashed
// frame (Q-E13). Per-tile sourceIds resolve against /meta/sources like every other superscript.
// Admission never fetched or verified any src (L1) — tiles show what fails to load.
// #37 (slice 14): every tile is one uniform 3:2 frame (object-fit contain, loaded or dashed), so a
// row never mixes heights, and the caption sits directly under its frame. The tile is local to this
// file: #37 keeps its change out of the shared ImageTile, which the Image slice owns.
const MAX_ITEMS = 8

// #37: absent columns take the post-J9 count rule; an explicit columns (a saved `columns:2`) is
// honoured and clamped 1..4. Renderer-only: no record is rewritten and the catalog carries no default.
export function galleryColumns(n, explicit) {
  if (!isNil(explicit)) {
    const c = Number(explicit)
    if (c) return Math.min(4, Math.max(1, Math.round(c)))
  }
  return n <= 3 ? Math.max(1, n) : Math.min(4, Math.ceil(n / 2))
}

const FRAME = Object.freeze({ position: 'relative', width: '100%', aspectRatio: '3 / 2', minWidth: 0 })
const IMG = Object.freeze({
  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', boxSizing: 'border-box',
  objectFit: 'contain', display: 'block', borderRadius: R.control, border: B.hair
})

// One tile. The https posture and the failed-load swap live here; attribution stays in the
// figcaption outside the frame, so it survives a blocked or unreachable image.
function GalleryTile({ src, alt, caption, sourceIds, sources, extra }) {
  const https = typeof src === 'string' && src.startsWith('https://') ? src : null
  const [failed, setFailed] = useState(false)
  const label = String(alt ?? '')
  const attr = citeMarker(sourceIds, sources)
  const blocked = jsx('div', {
    'data-ru-image-blocked': https ? 'unreachable' : 'scheme',
    style: {
      ...type('small'), position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', overflow: 'hidden',
      padding: S.sm, borderRadius: R.control, border: B.absent, color: V.text3, fontStyle: 'italic'
    },
    children: (label || 'image') + (https ? ' — image unavailable' : ' — image blocked (https only)')
  })
  return jsxs('figure', {
    ...extra,
    style: { margin: 0, display: 'flex', flexDirection: 'column', gap: S.xs, minWidth: 0 },
    children: [
      jsx('div', {
        style: FRAME,
        children: https && !failed
          ? jsx('img', { src: https, alt: label, loading: 'lazy', onError: () => setFailed(true), style: IMG })
          : blocked
      }),
      caption || attr
        ? jsxs('figcaption', { style: { ...type('caption'), color: V.text2 }, children: [caption ? String(caption) : null, attr] })
        : null
    ]
  })
}

export const ImageGallery = ({ element }) => {
  const p = element.props ?? {}
  const items = (Array.isArray(p.items) ? p.items : []).slice(0, MAX_ITEMS)
  const columns = galleryColumns(items.length, p.columns)
  // #36 (withCite): the title row is the head row — the marker joins it as the last
  // inline child; with no title it rides as a flex sibling after the tile grid.
  const head = typeof p.title !== 'string' || !p.title.trim() ? null : jsx('div', { 'data-ru-head': '', style: { ...type('h3'), color: V.text }, children: String(p.title) }, 't')
  const body = items.length === 0
    ? jsx('div', { 'data-ru-empty': 'none', style: { ...type('small'), color: V.text3, fontStyle: 'italic' }, children: 'no images' }, 'e')
    : jsx('div', {
      'data-ru-columns': columns,
      style: { display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: S.sm, minWidth: 0 },
      children: items.map((it, i) => jsx(GalleryTile, {
        src: it?.src, alt: it?.alt, caption: it?.caption,
        sourceIds: it?.sourceIds, sources: p._sources,
        extra: { 'data-ru-tile': i }
      }, i))
    }, 'b')
  return jsxs('div', {
    ...common(element, { 'data-ru-count': items.length }),
    style: { display: 'flex', flexDirection: 'column', gap: S.sm, minWidth: 0 },
    children: withCite(head, body, p.sourceIds, p._sources)
  })
}
