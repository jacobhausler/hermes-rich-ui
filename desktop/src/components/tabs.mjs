import { useState, Children } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, V, type } from './_shared.mjs'
import { S } from './_house.mjs'

// Local interaction only (CONTRACTS §2). Labels come from props.tabs (kept by lower()).
// #37 (slice 14): a label is the small (12) step, one line, ≤24ch with an ellipsis; the
// full title rides title=. The strip scrolls (overflow-x) instead of wrapping, and a tab
// never shrinks below its label.
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
    style: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 },
    children: [
      jsx('div', { role: 'tablist',
        style: { display: 'flex', gap: S.hair, borderBottom: `1px solid ${V.stroke3}`, overflowX: 'auto' },
        children: tabs.map((t, i) => {
          const name = text(t?.title)
          return jsx('button', { type: 'button', role: 'tab', 'aria-selected': i === idx, 'data-ru-tab': i,
            title: typeof name === 'string' ? name : undefined,
            onClick: () => setActive(i),
            style: {
              background: 'none', border: 0, cursor: 'pointer', padding: `${S.xs}px ${S.sm}px`, ...type('small'),
              color: i === idx ? V.text : V.text2, borderBottom: `2px solid ${i === idx ? V.accent : 'transparent'}`,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '24ch', flexShrink: 0
            },
            children: name
          }, i)
        })
      }, 'list'),
      jsx('div', { role: 'tabpanel', children: kids[idx] ?? null }, 'panel')
    ]
  })
}
