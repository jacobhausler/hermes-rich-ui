import { jsx, jsxs } from 'react/jsx-runtime'
import { common, isNil, unavailable, citeMarker, V, type, formatMetric } from './_shared.mjs'
import { MARK_FILL } from './_house.mjs'
import { num, fmtPair, fmtSet, unitSpec } from './fmt.mjs'
import { useVintage } from './rowfmt.mjs'
const NBSP = '\u00a0'

// #29 (slice 4+6): the counter line is the pair face — ONE tier for current and
// total chosen from the larger value, the percent in parentheses at 0 decimals
// ('38 %', thin space before %), with <1 % / >99 % guards so a sliver never reads
// as a hard 0 and a near-complete bar never fakes done. Indeterminate keeps the
// hatched bar and PRINTS '· total unavailable' (L1: never a fake 0). unit rides
// both sides. Legacy raw digits without a unit keep their grouping (4,411).
const HATCH = `repeating-linear-gradient(45deg, ${V.text3} 0 6px, transparent 6px 12px)`

const HouseProgress = ({ element }) => {
  const p = element.props ?? {}
  const cur = isNil(p.current) ? null : Number(p.current)
  const tot = isNil(p.total) ? null : Number(p.total)
  const indeterminate = tot === null || !Number.isFinite(tot) || tot <= 0 || cur === null || !Number.isFinite(cur)
  const pct = indeterminate ? 0 : Math.max(0, Math.min(100, (cur / tot) * 100))
  const unit = typeof p.unit === 'string' && p.unit ? p.unit.trim() : ''
  const hasCur = cur !== null && Number.isFinite(cur)
  const tgt = isNil(p.target) ? null : Number(p.target)
  const tgtOk = tgt !== null && Number.isFinite(tgt)
  const tgtClamped = tgtOk && tot !== null && Number.isFinite(tot) && tot > 0 ? Math.min(tgt, tot) : tgt
  const targetExceedsTotal = tgtOk && tot !== null && Number.isFinite(tot) && tgt > tot
  const tickPct = tgtOk && !indeterminate ? Math.max(0, Math.min(100, ((tgtClamped ?? 0) / tot) * 100)) : null
  // pair face + the ' · P%' tail, guard-widened: a sliver never reads 0%, a
  // near-complete bar never fakes 100% (#29 pinned faces). A WORD unit (E12) rides both
  // sides on an ASCII space — '3 ci / 10 ci', never the NBSP glue fmt.mjs uses for a
  // face suffix; currency/percent ride through the 'kv' surface (fmtPair).
  const wu = unitSpec(undefined, unit)
  const pair = hasCur && tot !== null && Number.isFinite(tot) && tot > 0
    ? (wu.cls === 'word'
        ? fmtSet([cur, tot], { group: true }).map(s => `${s} ${wu.suffix}`).join(' / ')
        : fmtPair(cur, tot, { ...(unit ? { unit } : {}), sep: ' / ', surface: 'kv' }))
    : null
  const share = hasCur ? (cur / (tot && Number.isFinite(tot) && tot > 0 ? tot : 1)) * 100 : 0
  const shareFace = hasCur && tot !== null && Number.isFinite(tot) && tot > 0
    ? (share < 1 && cur > 0 ? '<1' : share > 99 && cur < tot ? '>99' : String(Math.floor(share)))
    : null
  const counter = hasCur
    ? (pair ? `${pair} \u00b7 ${shareFace}%` : `${num(cur).face}${unit ? NBSP + unit : ''}`)
    : null
  const barBase = { height: 6, borderRadius: 3, background: V.bg3, overflow: 'hidden', position: 'relative' }
  return jsxs('div', {
    ...common(element, { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': indeterminate ? undefined : tot, 'aria-valuenow': indeterminate ? undefined : cur, 'data-ru-indeterminate': indeterminate ? 'true' : 'false', 'data-ru-target': tgtOk ? String(tgt) : undefined, 'data-ru-target-error': targetExceedsTotal ? 'target_greater_than_total' : undefined }),
    style: { display: 'flex', flexDirection: 'column', gap: 4 },
    children: [
      jsxs('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
        children: [
          jsx('div', { 'data-ru-label': '',
            style: { ...type('caption', { caps: true }), color: V.text2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 },
            children: [String(p.label ?? ''), citeMarker(p.sourceIds, p._sources)] }, 'a'),
          jsx('div', { 'data-ru-counter': counter ?? 'unavailable',
            style: { ...type('body', { num: true }), color: V.text, whiteSpace: 'nowrap' },
            children: hasCur ? [counter, indeterminate && tot === null ? ' \u00b7 total unavailable' : null] : unavailable()
          }, 'b')
        ]
      }, 'l'),
      jsx('div', { style: barBase,
        children: jsx('div', {
          'data-ru-fill': '',
          style: indeterminate
            ? { position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', borderRadius: 3, color: V.text3, backgroundImage: HATCH }
            : { height: '100%', width: `${pct}%`, borderRadius: 3, background: MARK_FILL() } // #33: shared mark-fill (3:1 rule pinned by tests/helpers/mark_fill.mjs)
        })
      }, 'bar'),
      tickPct !== null ? jsx('div', { 'data-ru-target-tick': '', 'aria-hidden': 'true',
        style: { position: 'relative', height: 0 },
        children: jsx('div', { style: { position: 'absolute', left: `${tickPct}%`, top: -6, width: 2, height: 6, background: V.text3 } })
      }, 'tick') : null,
      tgtOk ? jsx('div', { 'data-ru-vs-target': targetExceedsTotal ? 'unavailable:target_exceeds_total' : 'ok',
        style: { ...type('caption'), color: V.text3, fontVariantNumeric: 'tabular-nums' },
        children: targetExceedsTotal
          ? `vs target: unavailable — target (${tgt}) is greater than total (${tot}); relation: target must be <= total`
          : `vs target ${formatMetric(tgt, { format: 'number', unit: unit || undefined })}`
      }, 'vt') : null
    ]
  })
}


export const LegacyProgress = ({ element }) => {
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
          jsxs('span', { children: [String(p.label ?? ''), citeMarker(p.sourceIds, p._sources)] }, 'a'),
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
            : { height: '100%', width: `${pct}%`, borderRadius: 3, background: V.accent }
        })
      }, 'bar'),
      tickPct !== null ? jsx('div', { 'data-ru-target-tick': '', 'aria-hidden': 'true',
        style: { position: 'relative', height: 0 },
        children: jsx('div', { style: { position: 'absolute', left: `${tickPct}%`, top: -6, width: 2, height: 6, background: V.text3 } })
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

// The one exported Progress: vintage switch (card.mjs vintageOf decides from the
// record stamp; everything outside a saved record defaults to 'house').
export const Progress = ({ element }) =>
  jsx(useVintage() === 'legacy' ? LegacyProgress : HouseProgress, { element })
