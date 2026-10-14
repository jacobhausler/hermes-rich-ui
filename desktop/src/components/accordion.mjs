import { useState, Children } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, V, type } from './_shared.mjs'
import { S, R, B } from './_house.mjs'

// #37: an absent `open` opens the first item only; an explicit boolean always wins.
const initialOpen = items => items.map((it, i) => (typeof it?.open === 'boolean' ? it.open : i === 0))

// Inline SVG chevron: points down when open, right when closed. currentColor takes V.text3.
const Chevron = (isOpen, key) => jsx('svg', {
  viewBox: '0 0 10 10', 'aria-hidden': 'true', focusable: 'false',
  style: { flex: 'none', width: 10, height: 10, color: V.text3, transform: isOpen ? 'none' : 'rotate(-90deg)' },
  children: jsx('path', { d: 'M2 3.5 L5 6.5 L8 3.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' })
}, key)

export const Accordion = ({ element, children }) => {
  const p = element.props ?? {}
  const items = Array.isArray(p.items) ? p.items : []
  const kids = Children.toArray(children)
  const [open, setOpen] = useState(() => initialOpen(items))
  const toggle = i => setOpen(o => o.map((v, j) => (j === i ? !v : v)))
  return jsx('div', {
    ...common(element),
    style: { display: 'flex', flexDirection: 'column', border: B.hair, borderRadius: R.box },
    children: items.map((it, i) => jsxs('div', { 'data-ru-item': i,
      style: { borderTop: i ? B.hair : 0 },
      children: [
        jsxs('button', { type: 'button', 'aria-expanded': !!open[i], onClick: () => toggle(i),
          style: { width: '100%', display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 0, cursor: 'pointer', padding: `6px ${S.md}px`, ...type('small'), color: V.text, textAlign: 'left' },
          children: [Chevron(!!open[i], 'c'), text(it?.title)]
        }, 'b'),
        open[i] ? jsx('div', { style: { padding: `${S.hair}px ${S.md}px ${S.sm}px` }, children: kids[i] ?? null }, 'p') : null
      ]
    }, i))
  })
}
