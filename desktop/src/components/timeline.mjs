import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, isNil, sourceSup, ownSources, V } from './_shared.mjs'

const DOT = { done: V.green, active: V.accent, pending: V.stroke2 }

export const Timeline = ({ element }) => {
  const p = element.props ?? {}
  const items = Array.isArray(p.items) ? p.items.slice(0, 30) : []
  return jsxs('div', {
    ...common(element),
    style: { display: 'flex', flexDirection: 'column', gap: 6 },
    children: [
      isNil(p.title) ? null : jsxs('div', { style: { fontWeight: 600, fontSize: 12, color: V.text }, children: [String(p.title), ownSources(p)] }, 't'),
      jsx('ol', { style: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
        children: items.map((it, i) => jsxs('li', { 'data-ru-status': it?.status ?? 'pending',
          style: { display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr)', columnGap: 8, position: 'relative', paddingBottom: i < items.length - 1 ? 8 : 0 },
          children: [
            jsx('span', { style: { width: 8, height: 8, marginTop: 4, borderRadius: 4, background: DOT[it?.status] ?? DOT.pending, display: 'inline-block' } }, 'd'),
            jsxs('div', { style: { display: 'flex', flexDirection: 'column', gap: 1, fontSize: 12 },
              children: [
                jsxs('div', { style: { display: 'flex', gap: 8, alignItems: 'baseline', color: V.text }, children: [
                  it?.date ? jsx('span', { style: { color: V.text3, fontVariantNumeric: 'tabular-nums', fontSize: 11 }, children: String(it.date) }, 'dt') : null,
                  jsxs('span', { style: { fontWeight: 500 }, children: [text(it?.label), sourceSup(it?.sourceIds, p._sources, 's' + i)] }, 'lb')
                ] }, 'l'),
                it?.text ? jsx('div', { style: { color: V.text2, whiteSpace: 'pre-wrap' }, children: String(it.text) }, 'x') : null
              ]
            }, 'b')
          ]
        }, i))
      }, 'ol')
    ]
  })
}
