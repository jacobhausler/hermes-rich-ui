import { useState, Children } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, V } from './_shared.mjs'

// Local interaction only (CONTRACTS §2). Labels come from props.tabs (kept by lower()).
export const Tabs = ({ element, children }) => {
  const p = element.props ?? {}
  const tabs = Array.isArray(p.tabs) ? p.tabs : []
  const [active, setActive] = useState(0)
  const kids = Children.toArray(children)
  const idx = Math.min(active, Math.max(0, kids.length - 1))
  return jsxs('div', {
    ...common(element),
    style: { display: 'flex', flexDirection: 'column', gap: 8 },
    children: [
      jsx('div', { role: 'tablist',
        style: { display: 'flex', gap: 2, borderBottom: `1px solid ${V.stroke3}` },
        children: tabs.map((t, i) => jsx('button', { type: 'button', role: 'tab', 'aria-selected': i === idx, 'data-ru-tab': i,
          onClick: () => setActive(i),
          style: {
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', fontSize: 12,
            color: i === idx ? V.text : V.text2, borderBottom: `2px solid ${i === idx ? V.accent : 'transparent'}`, marginBottom: -1
          },
          children: text(t?.title)
        }, i))
      }, 'list'),
      jsx('div', { role: 'tabpanel', children: kids[idx] ?? null }, 'panel')
    ]
  })
}
