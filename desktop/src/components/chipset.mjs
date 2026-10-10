import { jsxs } from 'react/jsx-runtime'
import { common, badge, citeMarker } from './_shared.mjs'
import { HOUSE } from './_house.mjs'

// N4 ChipSet — one component renders a flex-wrap row of N badges (the SDK Badge via
// _shared badge(); tone is Badge's existing four, mapped exactly like badge.mjs does).
// labels are data, not keys: duplicates are allowed, so keys are index-based.
// Cap mirrors admission (labels ≤24); empty labels renders nothing visible, no crash.
export const ChipSet = ({ element }) => {
  const p = element.props ?? {}
  const labels = (Array.isArray(p.labels) ? p.labels : []).slice(0, 24)
  return jsxs('div', {
    ...common(element, { 'data-ru-count': String(labels.length) }),
    style: { display: 'flex', flexWrap: (p.wrap ?? HOUSE.CHIPSET_WRAP) === false ? 'nowrap' : 'wrap', gap: 4, minWidth: 0 },
    children: [
      labels.map((l, i) => badge(String(l ?? ''), p.tone ?? HOUSE.CHIPSET_TONE, { 'data-ru-tone': p.tone ?? HOUSE.CHIPSET_TONE, 'data-ru-chip': String(i) }, i)),
      citeMarker(p.sourceIds, p._sources)
    ]
  })
}
