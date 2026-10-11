import { useState, Children } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, V, type } from './_shared.mjs'
import { S, B } from './_house.mjs'

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
    style: { display: 'flex', flexDirection: 'column', gap: S.sm, minWidth: 0 },
    children: [
      jsx('div', { role: 'tablist',
        style: { display: 'flex', gap: S.hair, borderBottom: B.hair, overflowX: 'auto', flexWrap: 'nowrap', minWidth: 0 },
        children: tabs.map((t, i) => jsx('button', { type: 'button', role: 'tab', 'aria-selected': i === idx, 'data-ru-tab': i,
          title: t?.title == null ? undefined : String(t.title), onClick: () => setActive(i),
          style: {
            background: 'none', border: 0, cursor: 'pointer', padding: `${S.xs}px ${S.md}px`, ...type('small'),
            whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '24ch', flexShrink: 0,
            color: i === idx ? V.text : V.text2, borderBottom: i === idx ? B.tab : '2px solid transparent'
          },
          children: text(t?.title)
        }, i))
      }, 'list'),
      jsx('div', { role: 'tabpanel', children: kids[idx] ?? null }, 'panel')
    ]
  })
}
