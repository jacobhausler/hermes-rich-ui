import { useState, Children } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, V, type } from './_shared.mjs'
import { S, R, B } from './_house.mjs'

export const Accordion = ({ element, children }) => {
  const p = element.props ?? {}
  const items = Array.isArray(p.items) ? p.items : []
  const kids = Children.toArray(children)
  const [open, setOpen] = useState(() => items.map((it, i) => typeof it?.open === 'boolean' ? it.open : i === 0))
  const toggle = i => setOpen(o => o.map((v, j) => (j === i ? !v : v)))
  return jsx('div', {
    ...common(element),
    style: { display: 'flex', flexDirection: 'column', border: B.hair, borderRadius: R.box },
    children: items.map((it, i) => jsxs('div', { 'data-ru-item': i,
      style: { borderTop: i ? B.hair : 0 },
      children: [
        jsxs('button', { type: 'button', 'aria-expanded': !!open[i], onClick: () => toggle(i),
          style: { width: '100%', display: 'flex', alignItems: 'center', gap: S.sm, background: 'none', border: 0, cursor: 'pointer', padding: `${S.sm}px ${S.md}px`, ...type('small'), color: V.text, textAlign: 'left' },
          children: [jsx('svg', { 'aria-hidden': 'true', width: 10, height: 10, viewBox: '0 0 10 10', fill: 'none', stroke: V.text3, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
            style: { flexShrink: 0, transform: open[i] ? 'rotate(90deg)' : 'rotate(0deg)' }, children: jsx('path', { d: 'M3 2 L6 5 L3 8' }) }, 'c'), text(it?.title)]
        }, 'b'),
        open[i] ? jsx('div', { style: { padding: `${S.hair}px ${S.md}px ${S.sm}px` }, children: kids[i] ?? null }, 'p') : null
      ]
    }, i))
  })
}
