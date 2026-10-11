import { jsx } from 'react/jsx-runtime'
import { common, ImageTile } from './_shared.mjs'

// Renders only https:// sources; anything else degrades to the absent frame.
// ImageTile owns the loaded-image SDK lightbox and keeps caption/attribution
// outside the media/blocked swap, shared with ImageGallery.
export const Image = ({ element }) => {
  const p = element.props ?? {}
  return jsx(ImageTile, {
    src: p.src, alt: p.alt, caption: p.caption, maxHeight: p.maxHeight,
    sourceIds: p.sourceIds, sources: p._sources, extra: common(element)
  })
}
