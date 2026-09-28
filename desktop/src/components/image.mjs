import { jsx } from 'react/jsx-runtime'
import { common, ImageTile } from './_shared.mjs'

// Renders only https:// sources; anything else degrades to the alt text.
// E14 (counsel 0928): tile implementation lives in _shared.mjs (ImageTile, shared with
// ImageGallery); the schema-legal sourceIds prop is now DISPLAYED as attribution in the
// figcaption (it was a dead prop — image.mjs never rendered it). Default render of an
// Image without sourceIds is byte-identical to the previous implementation.
export const Image = ({ element }) => {
  const p = element.props ?? {}
  return jsx(ImageTile, {
    src: p.src, alt: p.alt, caption: p.caption, maxHeight: p.maxHeight,
    sourceIds: p.sourceIds, sources: p._sources, extra: common(element)
  })
}
