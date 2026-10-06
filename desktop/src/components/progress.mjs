import { jsx, jsxs } from 'react/jsx-runtime'
import { common, isNil, unavailable, ownSources, V, type } from './_shared.mjs'
import { MARK_FILL } from './_house.mjs'

export const Progress = ({ element }) => {
  const p = element.props ?? {}
  const cur = isNil(p.current) ? null : Number(p.current)
  const tot = isNil(p.total) ? null : Number(p.total)
  const indeterminate = tot === null || !Number.isFinite(tot) || tot <= 0 || cur === null || !Number.isFinite(cur)
  const pct = indeterminate ? 0 : Math.max(0, Math.min(100, (cur / tot) * 100))
  // E12: target?: tick on the track + 'vs target' in the counter line. target > total is a
  // clamp that NAMES the relation (L4). unit? suffixes numbers. current-null NEVER prints 0 (L1).
  const unit = typeof p.unit === 'string' && p.unit ? ` ${p.unit}` : ''
  const tgt = isNil(p.target) ? null : Number(p.target)
  const tgtOk = tgt !== null && Number.isFinite(tgt)
  const tgtClamped = tgtOk && tot !== null && Number.isFinite(tot) && tot > 0 ? Math.min(tgt, tot) : tgt
  const targetExceedsTotal = tgtOk && tot !== null && Number.isFinite(tot) && tgt > tot
  const tickPct = tgtOk && !indeterminate ? Math.max(0, Math.min(100, ((tgtClamped ?? 0) / tot) * 100)) : null
  const barBase = { height: 6, borderRadius: 3, background: V.bg3, overflow: 'hidden', position: 'relative' }
  return jsxs('div', {
    ...common(element, { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': indeterminate ? undefined : tot, 'aria-valuenow': indeterminate ? undefined : cur, 'data-ru-indeterminate': indeterminate ? 'true' : 'false', 'data-ru-target': tgtOk ? String(tgt) : undefined, 'data-ru-target-error': targetExceedsTotal ? 'target_greater_than_total' : undefined }),
    style: { display: 'flex', flexDirection: 'column', gap: 4 },
    children: [
      jsxs('div', { style: { display: 'flex', justifyContent: 'space-between', ...type('caption'), color: V.text2 },
        children: [
          jsxs('span', { children: [String(p.label ?? ''), ownSources(p)] }, 'a'),
          // E12/L1: current-null NEVER prints 0; a known current with a null/absent total
          // prints 'total unavailable' while the bar stays indeterminate.
          jsxs('span', { style: { fontVariantNumeric: 'tabular-nums' },
            children: [
              cur === null ? unavailable() : (indeterminate ? `${cur}${unit}` : `${cur}${unit} / ${tot}${unit}`),
              indeterminate && cur !== null && (tot === null || !Number.isFinite(tot)) ? ' · total unavailable' : null
            ]
          }, 'b')
        ]
      }, 'l'),
      jsx('div', { style: barBase,
        children: jsx('div', {
          style: indeterminate
            ? { position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%', borderRadius: 3, background: V.stroke2, backgroundImage: `repeating-linear-gradient(45deg, ${V.stroke2} 0 6px, transparent 6px 12px)` }
            : { height: '100%', width: `${pct}%`, borderRadius: 3, background: MARK_FILL() } // #33: shared mark-fill (3:1 rule pinned by tests/helpers/mark_fill.mjs)
        })
      }, 'bar'),
      tickPct !== null ? jsx('div', { 'data-ru-target-tick': '', 'aria-hidden': 'true',
        style: { position: 'relative', height: 0 },
        children: jsx('div', { style: { position: 'absolute', left: `${tickPct}%`, top: -6, width: 2, height: 6, background: V.text3, borderRadius: 1 } })
      }, 'tick') : null,
      tgtOk ? jsx('div', { 'data-ru-vs-target': targetExceedsTotal ? 'unavailable:target_exceeds_total' : 'ok',
        style: { ...type('caption'), color: V.text3, fontVariantNumeric: 'tabular-nums' },
        children: targetExceedsTotal
          ? `vs target: unavailable — target (${tgt}) is greater than total (${tot}); relation: target must be <= total`
          : `vs target ${tgt}${unit}`
      }, 'vt') : null
    ]
  })
}
