import { jsx, jsxs } from 'react/jsx-runtime'
import { common, text, sourceSup, ownSources, V } from './_shared.mjs'

export const KeyValueList = ({ element }) => {
  const p = element.props ?? {}
  const items = Array.isArray(p.items) ? p.items.slice(0, 32) : []
  return jsxs('div', {
    ...common(element),
    style: { display: 'flex', flexDirection: 'column', marginBottom: 4 },
    children: [
      jsx('dl', { style: { margin: 0, display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', columnGap: 12, rowGap: 4, fontSize: 12, alignItems: 'baseline' },
        children: items.flatMap((it, i) => [
          jsx('dt', { style: { color: V.text3 }, children: String(it?.label ?? '') }, 'k' + i),
          jsxs('dd', { style: { margin: 0, color: V.text, wordBreak: 'break-word' }, children: [text(it?.value), sourceSup(it?.sourceIds, p._sources, 's' + i)] }, 'v' + i)
        ])
      }, 'dl'),
      ownSources(p)
    ]
  })
}
