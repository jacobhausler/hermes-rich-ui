import { useState, Children } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, V, type } from './_shared.mjs'

export const Accordion = ({ element, children }) => {
  const p = element.props ?? {}
  const items = Array.isArray(p.items) ? p.items : []
  const kids = Children.toArray(children)
  const [open, setOpen] = useState(() => items.map(it => !!it?.open))
  const toggle = i => setOpen(o => o.map((v, j) => (j === i ? !v : v)))
  return jsx('div', {
    ...common(element),
    style: { display: 'flex', flexDirection: 'column', border: `1px solid ${V.stroke3}`, borderRadius: 6 },
    children: items.map((it, i) => jsxs('div', { 'data-ru-item': i,
      style: { borderTop: i ? `1px solid ${V.stroke3}` : 'none' },
      children: [
        jsxs('button', { type: 'button', 'aria-expanded': !!open[i], onClick: () => toggle(i),
          style: { width: '100%', display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', ...type('small'), color: V.text, textAlign: 'left' },
          children: [jsx('span', { style: { color: V.text3, ...type('micro') }, children: open[i] ? '▾' : '▸' }, 'c'), text(it?.title)]
        }, 'b'),
        open[i] ? jsx('div', { style: { padding: '2px 10px 8px' }, children: kids[i] ?? null }, 'p') : null
      ]
    }, i))
  })
}
