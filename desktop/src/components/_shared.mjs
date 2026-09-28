// Shared helpers for hermes-rich-ui components. Inline style + --ui-* vars only.
import { Badge, Tip } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'

export const V = {
  text: 'var(--ui-text-primary)',
  text2: 'var(--ui-text-secondary)',
  text3: 'var(--ui-text-tertiary)',
  stroke2: 'var(--ui-stroke-secondary)',
  stroke3: 'var(--ui-stroke-tertiary)',
  bgEl: 'var(--ui-bg-elevated)',
  bg3: 'var(--ui-bg-tertiary)',
  accent: 'var(--ui-accent)',
  green: 'var(--ui-green)',
  red: 'var(--ui-red)',
  yellow: 'var(--ui-yellow)',
  purple: 'var(--ui-purple)',
  orange: 'var(--ui-orange)'
}

export const GAP = { none: 0, sm: 4, md: 8, lg: 16 }

// Attributes common to every component root: aria-label from accessibility.label + a DOM marker.
export function common(element, extra = {}) {
  const props = element?.props ?? {}
  const out = { 'data-ru': element?.type, ...extra }
  const label = props.accessibility?.label
  if (typeof label === 'string' && label) out['aria-label'] = label
  return out
}

export const isNil = v => v === null || v === undefined

export const unavailable = (key) => jsx('span', { 'data-ru-null': '', style: { color: V.text3, fontStyle: 'italic' }, children: 'unavailable' }, key)

// Plain-text render of any resolved scalar; null/undefined -> 'unavailable', never 0.
export function text(v) {
  if (isNil(v)) return unavailable()
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// D6 — verified 2026-09-25 against apps/desktop/src/components/ui/badge.tsx (cva variant list) and the
// SDK re-export `export { Badge } from '@/components/ui/badge'` (sdk/index.ts:1684):
//   Badge variants: default | muted | success | warn | destructive | outline | solid   (default: 'default')
//   Badge sizes:    default | xs | overlay                                               (default: 'default')
//   Badge props:    React.ComponentProps<'span'> + asChild  → data-* attrs pass through to the <span>.
//   Tip (tooltip.tsx, sdk/index.ts:1753): { label: ReactNode, children, delayDuration?, ...TooltipContentProps };
//     falsy label renders children untouched; no provider needed (falls back to a local TooltipProvider).
//   Skeleton (skeleton.tsx, sdk/index.ts:1749): React.ComponentProps<'div'> → style + data-* pass through.
// Every value below is in the real list; tests/test_components.mjs pins it.
export const BADGE_VARIANTS_REAL = ['default', 'muted', 'success', 'warn', 'destructive', 'outline', 'solid']
export const BADGE_SIZES_REAL = ['default', 'xs', 'overlay']
export const BADGE_VARIANT = { neutral: 'muted', info: 'default', success: 'success', caution: 'warn' }
export const badge = (label, tone, extra = {}, key) => jsx(Badge, { variant: BADGE_VARIANT[tone] ?? 'muted', size: 'xs', ...extra, children: label }, key)

// Sources are injected into props by the registry wrapper (index.mjs) as `_sources` (the /meta/sources array).
export function sourceLabels(ids, sources) {
  if (!Array.isArray(ids) || !ids.length) return []
  const byId = new Map((Array.isArray(sources) ? sources : []).filter(s => s && typeof s === 'object').map(s => [String(s.id), s]))
  return ids.map(id => { const s = byId.get(String(id)); return s ? (s.label || s.url || String(id)) : String(id) })
}

// Superscript 'ⓘ n' badge with a Tip listing the resolved source labels.
export function sourceSup(ids, sources, key) {
  if (!Array.isArray(ids) || !ids.length) return null
  const labels = sourceLabels(ids, sources)
  const tip = jsx('div', { style: { whiteSpace: 'pre-line' }, children: labels.map((l, i) => `${i + 1}. ${l}`).join('\n') })
  return jsx(Tip, {
    label: tip,
    children: jsx('sup', {
      'data-ru-sources': ids.length,
      'aria-label': 'sources: ' + labels.join(', '),
      style: { marginLeft: 3, fontSize: '0.65em', color: V.text3, cursor: 'help', verticalAlign: 'super', lineHeight: 1 },
      children: `ⓘ ${ids.length}`
    })
  }, key)
}

// Component-level sources (element.props.sourceIds) rendered after the body.
export const ownSources = (props, key = 'src') => sourceSup(props?.sourceIds, props?._sources, key)

export function formatMetric(value, { format = 'number', precision, unit } = {}) {
  if (isNil(value)) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  const p = Number.isInteger(precision) && precision >= 0 && precision <= 6 ? precision : undefined
  const digits = p === undefined ? {} : { minimumFractionDigits: p, maximumFractionDigits: p }
  let out
  if (format === 'currency') {
    // no explicit precision: whole-dollar for |n| >= 1000 ($18,234,500), cents below ($14.73) — C1 polish, measured on the metric gallery card
    const auto = p === undefined ? (Math.abs(n) >= 1000 ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}) : {}
    out = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', ...auto, ...digits }).format(n)
  } else if (format === 'percent') {
    out = new Intl.NumberFormat('en-US', { ...(p === undefined ? { maximumFractionDigits: 2 } : digits) }).format(n) + '%'
  } else {
    out = new Intl.NumberFormat('en-US', { ...(p === undefined ? { maximumFractionDigits: 6 } : digits) }).format(n)
  }
  if (unit && format !== 'currency' && format !== 'percent') out += ' ' + unit
  return out
}

export const row = (style, ...kids) => jsxs('div', { style: { display: 'flex', alignItems: 'center', gap: 6, ...style }, children: kids })
