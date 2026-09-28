import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, isNil, ownSources, V } from './_shared.mjs'

export const Card = ({ element, children }) => {
  const p = element.props ?? {}
  return jsxs('section', {
    ...common(element),
    style: { display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: `1px solid ${V.stroke3}`, borderRadius: 6, background: V.bgEl, color: V.text },
    children: [
      isNil(p.title) && isNil(p.subtitle) ? null : jsxs('header', { style: { display: 'flex', flexDirection: 'column', gap: 2 },
        children: [
          isNil(p.title) ? null : jsxs('div', { style: { fontWeight: 600, fontSize: 14 }, children: [text(p.title), ownSources(p)] }, 't'),
          isNil(p.subtitle) ? null : jsxs('div', { style: { fontSize: 12, color: V.text2 }, children: [text(p.subtitle)] }, 's')
        ]
      }, 'h'),
      children,
      // E1 footer?: caption line under children (replaces the trailing Text variant=caption id ceremony).
      isNil(p.footer) ? null : jsx('div', { 'data-ru-footer': '', style: { fontSize: 11, color: V.text2, whiteSpace: 'pre-wrap' }, children: text(p.footer) }, 'f')
    ]
  })
}
