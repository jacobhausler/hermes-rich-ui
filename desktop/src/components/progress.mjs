import { jsx, jsxs } from 'react/jsx-runtime'
import { common, isNil, unavailable, ownSources, V } from './_shared.mjs'

export const Progress = ({ element }) => {
  const p = element.props ?? {}
  const cur = isNil(p.current) ? null : Number(p.current)
  const tot = isNil(p.total) ? null : Number(p.total)
  const indeterminate = tot === null || !Number.isFinite(tot) || tot <= 0 || cur === null || !Number.isFinite(cur)
  const pct = indeterminate ? 0 : Math.max(0, Math.min(100, (cur / tot) * 100))
  const barBase = { height: 6, borderRadius: 3, background: V.bg3, overflow: 'hidden', position: 'relative' }
  return jsxs('div', {
    ...common(element, { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': indeterminate ? undefined : tot, 'aria-valuenow': indeterminate ? undefined : cur, 'data-ru-indeterminate': indeterminate ? 'true' : 'false' }),
    style: { display: 'flex', flexDirection: 'column', gap: 4 },
    children: [
      jsxs('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: V.text2 },
        children: [
          jsxs('span', { children: [String(p.label ?? ''), ownSources(p)] }, 'a'),
          jsx('span', { style: { fontVariantNumeric: 'tabular-nums' }, children: cur === null ? unavailable() : (indeterminate ? String(cur) : `${cur} / ${tot}`) }, 'b')
        ]
      }, 'l'),
      jsx('div', { style: barBase,
        children: jsx('div', {
          style: indeterminate
            ? { position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%', borderRadius: 3, background: V.stroke2, backgroundImage: `repeating-linear-gradient(45deg, ${V.stroke2} 0 6px, transparent 6px 12px)` }
            : { height: '100%', width: `${pct}%`, borderRadius: 3, background: V.accent }
        })
      }, 'bar')
    ]
  })
}
