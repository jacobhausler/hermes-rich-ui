// Shared helpers for hermes-rich-ui components. Inline style + --ui-* vars only.
import { createContext, useState } from 'react'
import { Badge, Tip, Dialog, DialogTrigger, DialogContent, DialogTitle } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'
import { TYPE, HOUSE, S, R, B, INK } from './_house.mjs'

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

// The only component path to type: a fresh object, so callers can add layout/ink
// without mutating the frozen ramp. caps is cosmetic; eyebrow owns its tracking.
export function type(step, mods = {}) {
  if (!Object.hasOwn(TYPE, step)) throw new RangeError(`unknown type step: ${step}`)
  const { caps = false, mono = false, num = false } = mods
  return { ...TYPE[step], ...((caps || step === 'eyebrow') ? { textTransform: 'uppercase' } : {}),
    ...(mono ? { fontFamily: 'ui-monospace, monospace' } : {}),
    ...(num ? { fontVariantNumeric: 'tabular-nums lining-nums' } : {}) }
}

export const GAP = { none: 0, sm: 4, md: 8, lg: 16 }

// #28 (slice 5): the size-class table. Every catalog type has exactly one class; the
// composer, Grid tracks and the h-Stack flex CSS all read it (a new type without a row
// fails tests/test_layout_flow.mjs). tile = KPI-sized, atom = chip/rule, block = prose/list,
// wide = needs room (charts, tables, galleries).
export const SIZE_CLASS = Object.freeze({
  Metric: 'tile', Progress: 'tile', Sparkline: 'tile',
  Badge: 'atom', AsOf: 'atom', Divider: 'atom',
  Card: 'block', Stack: 'block', Accordion: 'block', Heading: 'block', Text: 'block', Callout: 'block',
  KeyValueList: 'block', Image: 'block', Timeline: 'block', SourceList: 'block', CodeBlock: 'block',
  Checklist: 'block', ChipSet: 'block', BarList: 'block',
  Grid: 'wide', Tabs: 'wide', DataTable: 'wide', Chart: 'wide', ImageGallery: 'wide', HeatMap: 'wide'
})
export const sizeClass = t => (Object.hasOwn(SIZE_CLASS, t) ? SIZE_CLASS[t] : 'block')
export const FLEX_BASIS = { tile: 140, block: 240, wide: 320 }
const FLOOR = { tile: 140, atom: 140, block: 240, wide: 280 }
const MAX_COLS = 4
const SHORT_ROWS = 8

// Provided true by the three row providers (auto-row, Grid columns ≥ 2, horizontal Stack).
export const RowContext = createContext(false)

// n children into at most `max` columns: fewest rows, then balanced (5 → 3+2, never 4+1).
export function balancedCols(n, max = MAX_COLS) {
  const m = Math.min(MAX_COLS, Math.max(1, max))
  if (!(n > 0)) return 1
  return Math.ceil(n / Math.ceil(n / m))
}

// Grid `columns` is a maximum: auto-fit tracks, floor from the widest child class.
export function gridTracks(n, cols, classes = [], gap = 16) {
  const c = balancedCols(n, cols)
  const floor = Math.max(FLOOR.tile, ...classes.map(k => FLOOR[k] ?? FLOOR.block))
  const share = c === 1 ? '100%' : `calc((100% - ${(c - 1) * gap}px) / ${c})`
  return { c, floor, template: `repeat(auto-fit, minmax(max(${floor}px, ${share}), 1fr))` }
}

// Renderer children are ElementRenderer elements carrying the raw spec element.
export const kidList = children => [children].flat(Infinity).filter(k => k && typeof k === 'object')
const typeOf = k => k?.props?.element?.type
export const classOf = k => sizeClass(typeOf(k))
const isTile = k => classOf(k) === 'tile'
const isShort = k => { const e = k?.props?.element; return e?.type === 'KeyValueList' && Array.isArray(e.props?.items) && e.props.items.length <= SHORT_ROWS }
const isBand = k => {
  const e = k?.props?.element; const els = k?.props?.spec?.elements
  if (!(e?.type === 'Grid' || (e?.type === 'Stack' && e.props?.direction === 'horizontal'))) return false
  return Array.isArray(e.children) && e.children.length > 0 && !!els && e.children.every(id => sizeClass(els[id]?.type) === 'tile')
}

// compose(): the ONE owner of sibling rhythm. Above a Heading 20, below it 6, after a KPI
// band 16, otherwise `otherwise` (Card body 12, a vertical Stack its authored gap).
// rhythm:false (gap none) zeroes the margins; auto-rows still apply.
export function compose(children, { otherwise = 12, rhythm = true } = {}) {
  const kids = kidList(children)
  const items = []
  for (let i = 0; i < kids.length;) {
    let j = i
    if (isTile(kids[i])) { while (j < kids.length && isTile(kids[j])) j++; if (j - i >= 2) { items.push({ row: 'tile', kids: kids.slice(i, j) }); i = j; continue } }
    j = i
    while (j < kids.length && isShort(kids[j])) j++
    if (j - i === 2) { items.push({ row: 'block', kids: kids.slice(i, j) }); i = j; continue }
    // a short run of 3+ never pairs: emit the whole run singly
    for (const k of kids.slice(i, Math.max(j, i + 1))) items.push({ kid: k })
    i = Math.max(j, i + 1)
  }
  const head = it => !it.row && typeOf(it.kid) === 'Heading'
  const band = it => it.row === 'tile' || (!it.row && isBand(it.kid))
  return items.map((it, n) => {
    const prev = items[n - 1]
    const marginTop = !rhythm || !prev ? 0 : head(it) ? 20 : head(prev) ? 6 : band(prev) ? 16 : otherwise
    if (!it.row) return jsx('div', { style: { display: 'flex', flexDirection: 'column', minWidth: 0, marginTop }, children: it.kid }, it.kid.key ?? n)
    const { template } = gridTracks(it.kids.length, MAX_COLS, [it.row])
    return jsx(RowContext.Provider, { value: true, children: jsx('div', {
      'data-ru-autorow': String(it.kids.length), 'data-ru-autorow-class': it.row,
      style: { display: 'grid', gridTemplateColumns: template, columnGap: 16, rowGap: 12, minWidth: 0, marginTop },
      children: it.kids
    }) }, 'row:' + (it.kids[0].key ?? n))
  })
}

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

// #33 (E-S4/E-S5): the ONE status-mark primitive — a shared SVG riding the given
// stroke color. Sparkline's trend chip (and any future trend mark) uses THIS, never a
// text glyph (▲/▼ render inconsistently across fonts/emoji fallbacks). The stroke rides
// a --ui-* token: tone error/danger ≡ var(--ui-red), success ≡ var(--ui-green), default
// follows the trend (up green / down red / flat secondary).
// #36 (slice 13, supersedes #18): the same primitive owns the status STATES — done check,
// not-done ring, unknown dashed ring carrying a `?` in text-secondary (aria-label
// `unknown`), pending hollow secondary ring. State marks are shape-distinct (greyscale
// safe); colours never discriminate.
export function StatusMark(kind, stroke, key) {
  if (Object.hasOwn(STATUS_ARROW, kind)) {
    return jsx('svg', {
      'aria-hidden': 'true', width: 10, height: 10, viewBox: '0 0 10 10',
      fill: 'none', stroke, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round',
      children: jsx('path', { d: STATUS_ARROW[kind] })
    }, key)
  }
  const mark = STATUS_MARK[kind]
  if (!mark) return null
  // Stroke geometry rides the SVG root (stroke-dasharray INHERITS into the ring), so a
  // reader (and the test) sees the dashed ring on the mark element itself.
  const kids = [jsx('circle', { cx: 6, cy: 6, r: 4.5, fill: 'none' }, 'r')]
  if (mark.path) kids.push(jsx('path', { d: mark.path, fill: 'none', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }, 'p'))
  if (mark.glyph) kids.push(jsx('text', { x: 6, y: 8.5, textAnchor: 'middle', fontSize: 7, fill: V.text2, stroke: 'none', children: '?' }, 'g'))
  return jsxs('svg', {
    'aria-label': kind, role: 'img', width: 12, height: 12, viewBox: '0 0 12 12',
    fill: 'none', stroke, strokeWidth: 1.25, ...(mark.dashed ? { strokeDasharray: '2 2' } : null),
    children: kids
  }, key)
}
const STATUS_ARROW = {
  up: 'M2 7.5 L5 2.5 L8 7.5 M3.5 5.5 L6.5 5.5',
  down: 'M2 2.5 L5 7.5 L8 2.5 M3.5 4.5 L6.5 4.5',
  flat: 'M2 5 L8 5'
}
// #36: the state vocabulary (named to pair with #57's five-state work). Each renders a
// shape-distinct SVG around the ring: done fills the ring with a check, not-done is a
// bare ring, unknown dashes the ring and prints `?` in text-secondary, pending is the
// hollow secondary ring.
const STATUS_MARK = {
  done: { path: 'M3.6 6.2 L5.3 7.9 L8.4 4.3' },
  notDone: {},
  unknown: { dashed: true, glyph: true },
  pending: { stroke2: true }
}

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
// E10 (counsel 0928): error/outline added — both values are in BADGE_VARIANTS_REAL above,
// pinned by the same idiom in tests/test_components.mjs (D6).
export const BADGE_VARIANT = { neutral: 'muted', info: 'default', success: 'success', caution: 'warn', error: 'destructive', outline: 'outline' }
export const badge = (label, tone, extra = {}, key) => jsx(Badge, { variant: BADGE_VARIANT[tone] ?? 'muted', size: 'default', ...extra, style: { ...type('caption'), ...extra.style }, children: label }, key)

// Sources are injected into props by the registry wrapper (index.mjs) as `_sources` (the /meta/sources array).
export function sourceLabels(ids, sources) {
  if (!Array.isArray(ids) || !ids.length) return []
  const byId = new Map((Array.isArray(sources) ? sources : []).filter(s => s && typeof s === 'object').map(s => [String(s.id), s]))
  return ids.map(id => { const s = byId.get(String(id)); return s ? (s.label || s.url || String(id)) : String(id) })
}

// Foundation-only primitive. No call sites move in #26; the old ⓘ sourceSup
// stays byte-for-byte until the evidence slice migrates every placement together.
// Source ids are resolved against /meta/sources, not interpreted as numbers.
export function citeMarker(ids, sources) {
  if (!Array.isArray(ids) || !Array.isArray(sources)) return null
  const index = new Map(sources.map((source, i) => [source?.id, i + 1]))
  const numbers = [...new Set(ids.filter(id => index.has(id)).map(id => index.get(id)))].sort((a, b) => a - b)
  if (!numbers.length) return null
  const tokens = []
  for (let i = 0; i < numbers.length;) {
    let end = i
    while (end + 1 < numbers.length && numbers[end + 1] === numbers[end] + 1) end++
    if (end - i + 1 >= HOUSE.CITE_RUN_MIN) tokens.push(`${numbers[i]}–${numbers[end]}`)
    else for (let j = i; j <= end; j++) tokens.push(String(numbers[j]))
    i = end + 1
  }
  const words = tokens.map(token => token.replace('–', ' to '))
  const spoken = words.length === 1 ? words[0]
    : words.length === 2 ? words.join(' and ')
      : `${words.slice(0, -1).join(', ')}, and ${words.at(-1)}`
  const face = tokens.length > HOUSE.CITE_TOKEN_LIMIT
    ? `${tokens.slice(0, HOUSE.CITE_VISIBLE).join(',')} +${tokens.length - HOUSE.CITE_VISIBLE}`
    : tokens.join(',')
  return jsx('sup', {
    'data-ru-citation': '', 'aria-label': `sources ${spoken}`,
    style: { ...type('micro'), marginLeft: S.hair, color: INK.meta, verticalAlign: 'super' },
    children: face
  })
}

// #36 (slice 13, supersedes #17): the old 'ⓘ n' sourceSup is GONE — every citation
// marker is the shared citeMarker (slice 3), never a ⓘ glyph. withCite is the ONE
// placement rule: the marker is the last inline child of the head row when a head
// exists, else a flex sibling of the body; never alone on a line. ownSources is the
// thin no-head form (flex sibling after the body) so call sites stay one line each.
export function withCite(head, body, ids, sources) {
  const mark = citeMarker(ids, sources)
  if (!mark) return [head, body].filter(Boolean)
  if (!head) return [body, mark]
  const prev = head.props.children
  const kids = prev === undefined ? [mark] : (Array.isArray(prev) ? [...prev, mark] : [prev, mark])
  return [{ ...head, props: { ...head.props, children: kids } }, body].filter(Boolean)
}

// Component-level sources (element.props.sourceIds) as the citation marker, placed as
// a flex sibling after the body (withCite covers the head-row case).
export const ownSources = (props, key = 'src') => citeMarker(props?.sourceIds, props?._sources)

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

// One media tile for Image and ImageGallery. A non-https URL never reaches the
// network; failed loads replace the media, not its caption/attribution. #37:
// absent frames name alt → caption → host, and loaded images use the SDK Dialog
// (its trigger owns keyboard activation, focus restoration, and dismissal).
export function ImageTile({ src, alt, caption, maxHeight, sourceIds, sources, aspectRatio, extra = {} }) {
  const https = typeof src === 'string' && src.startsWith('https://') ? src : null
  const maxH = Math.min(600, Math.max(64, Number(maxHeight) || HOUSE.IMAGE_MAX_H))
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen] = useState(false)
  let host = ''
  try { host = new URL(src).host } catch { /* invalid/absent URL has no host */ }
  const label = String(alt || caption || host || 'image')
  const attr = citeMarker(sourceIds, sources)
  const frame = { width: '100%', boxSizing: 'border-box', borderRadius: R.box, ...(aspectRatio ? { aspectRatio } : {}) }
  return jsxs('figure', {
    ...extra,
    style: { margin: 0, display: 'flex', flexDirection: 'column', gap: S.xs, minWidth: 0, width: '100%' },
    children: [
      https && !failed
        ? jsxs(Dialog, { open: open && loaded, onOpenChange: setOpen, children: [
            jsx(DialogTrigger, { asChild: true, children: jsx('button', {
              type: 'button', disabled: !loaded, 'aria-label': `Open image: ${label}`,
              style: { ...frame, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 0, padding: 0, border: 0, background: 'none', cursor: loaded ? 'zoom-in' : 'default' },
              children: jsx('img', { src: https, alt: String(alt ?? ''), loading: 'lazy', onLoad: () => setLoaded(true), onError: () => { setFailed(true); setOpen(false) },
                style: { display: 'block', maxHeight: maxH, maxWidth: '100%', objectFit: 'contain', borderRadius: R.box, border: B.hair, boxSizing: 'border-box', ...(aspectRatio ? { width: '100%', height: '100%' } : {}) } })
            }) }, 'trigger'),
            jsxs(DialogContent, { fitContent: true, 'aria-describedby': undefined, children: [
              jsx(DialogTitle, { style: { ...type('small'), color: V.text }, children: label }, 'title'),
              jsx('img', { src: https, alt: String(alt ?? ''), style: { maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: R.box } }, 'image')
            ] }, 'lightbox')
          ] }, 'i')
        : jsx('div', { 'data-ru-image-blocked': https ? 'unreachable' : 'scheme', style: { ...frame, ...type('small'), display: 'flex', alignItems: 'center', color: V.text3, fontStyle: 'italic', border: B.absent, padding: `${S.sm}px ${S.md}px`, overflowWrap: 'anywhere' }, children: label + (https ? ' — image unavailable' : ' — image blocked (https only)') }, 'i'),
      caption || attr
        ? jsxs('figcaption', { style: { ...type('caption'), color: V.text2 }, children: [caption ? String(caption) : null, attr] }, 'c')
        : null
    ]
  })
}
