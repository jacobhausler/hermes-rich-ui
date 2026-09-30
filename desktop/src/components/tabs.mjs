import { useState, Children } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, V, type } from './_shared.mjs'

// Local interaction only (CONTRACTS §2). Labels come from props.tabs (kept by lower()).
export const Tabs = ({ element, children }) => {
  const p = element.props ?? {}
  const tabs = Array.isArray(p.tabs) ? p.tabs : []
  const kids = Children.toArray(children)
  // E5 defaultTab?: integer seed tab, clamped into range (negative → 0, past-end → last).
  const seeded = Number.isInteger(p.defaultTab) ? Math.max(0, Math.min(p.defaultTab, Math.max(0, kids.length - 1))) : 0
  const [active, setActive] = useState(seeded)
  const idx = Math.min(active, Math.max(0, kids.length - 1))
  return jsxs('div', {
    ...common(element, { 'data-ru-default-tab': Number.isInteger(p.defaultTab) ? seeded : undefined }),
    style: { display: 'flex', flexDirection: 'column', gap: 8 },
    children: [
      jsx('div', { role: 'tablist',
        style: { display: 'flex', gap: 2, borderBottom: `1px solid ${V.stroke3}` },
        children: tabs.map((t, i) => jsx('button', { type: 'button', role: 'tab', 'aria-selected': i === idx, 'data-ru-tab': i,
          onClick: () => setActive(i),
          style: {
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', ...type('small'),
            color: i === idx ? V.text : V.text2, borderBottom: `2px solid ${i === idx ? V.accent : 'transparent'}`, marginBottom: -1
          },
          children: text(t?.title)
        }, i))
      }, 'list'),
      jsx('div', { role: 'tabpanel', children: kids[idx] ?? null }, 'panel')
    ]
  })
}
