import { useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { common, V } from './_shared.mjs'

// Renders only https:// sources; anything else degrades to the alt text.
export const Image = ({ element }) => {
  const p = element.props ?? {}
  const src = typeof p.src === 'string' && p.src.startsWith('https://') ? p.src : null
  const alt = String(p.alt ?? '')
  const maxHeight = Math.min(600, Math.max(64, Number(p.maxHeight) || 320))
  const [failed, setFailed] = useState(false)
  return jsxs('figure', {
    ...common(element),
    style: { margin: 0, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' },
    children: [
      src && !failed
        ? jsx('img', { src, alt, loading: 'lazy', onError: () => setFailed(true), style: { maxHeight, maxWidth: '100%', objectFit: 'contain', borderRadius: 4, border: `1px solid ${V.stroke3}` } }, 'i')
        : jsx('div', { 'data-ru-image-blocked': src ? 'unreachable' : 'scheme', style: { fontSize: 12, color: V.text3, fontStyle: 'italic', border: `1px dashed ${V.stroke3}`, borderRadius: 4, padding: '8px 10px' }, children: (alt || 'image') + (src ? ' — image unavailable' : ' — image blocked (https only)') }, 'i'),
      p.caption ? jsx('figcaption', { style: { fontSize: 11, color: V.text2 }, children: String(p.caption) }, 'c') : null
    ]
  })
}
