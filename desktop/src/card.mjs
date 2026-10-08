// RichCard — the ::richui{id} directive body. Fetches the record, lowers the surface, renders it.
import { Badge, Skeleton, useQuery } from '@hermes/plugin-sdk'
import { Component, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { JSONUIProvider, Renderer } from '@json-render/react'
import { lower, unlowerable } from './lower.mjs'
import { V, type, common, ownSources } from './components/_shared.mjs'
import { INK, HOUSE, SURFACE } from './components/_house.mjs'
import { CardChrome, CardHeader } from './components/card.mjs'
import { fmtDate } from './components/fmt.mjs'
import { VintageProvider } from './components/rowfmt.mjs'

// L8 saved-card law (#24 x #29): a record STAMPED BEFORE the number-tiles slice
// (test_number_tiles, fmt.mjs) renders byte-for-byte as the day it was saved — the
// three number tiles take their pre-#29 components (formatMetric faces, old unit
// join, old delta, old KV column). Records created from the cutover take the house
// face; a record with no parseable stamp behaves as pre-cutover (saved-first).
export const NUMBER_TILES_CUTOVER = '2026-10-07T00:00:00Z'
export const vintageOf = (record) => {
  const c = record?.envelope?.created_at
  return typeof c !== 'string' || Number.isNaN(Date.parse(c)) || Date.parse(c) < Date.parse(NUMBER_TILES_CUTOVER) ? 'legacy' : 'house'
}

export const ID_RE = /^ru-[0-9a-f]{12}$/
const Q = 'hermes-rich-ui'
const HEIGHT_CAP = 480

// The card renders INSIDE the app's markdown `.prose` block, whose typography plugin puts
// margins on table/li/dl/dt/dd/p/h* and a 1.71 line-height on every descendant. Inline styles
// beat it only where we set them; these rules zero the rest at the card root (D12 — measured
// 2026-09-25: table margin 24px, li margin 6px, dt/dd margins, lh 20.57px). Scoped to
// [data-ru-card] so nothing leaks into the app; React 19 hoists <style href precedence>
// into <head> once per document.
export const PROSE_RESET_HREF = 'hermes-rich-ui/prose-reset/3' // bump on every css edit (React dedupes by href)
export const PROSE_RESET_CSS = [
  '[data-ru-card] :is(table,thead,tbody,tr,th,td,ol,ul,li,dl,dt,dd,p,figure,figcaption,h1,h2,h3,h4,h5,h6){margin:0}',
  '[data-ru-card] :is(ol,ul){padding-left:0}',
  '[data-ru-card] li::marker{content:none}',
  '[data-ru-card] :is(th,td){padding:0}',
  '[data-ru-card] :is(table,thead,tbody,tr,th,td){border:0}',
  '[data-ru-card] :is(dt,dd,th){font-weight:inherit}',
  '[data-ru-card] button{font:inherit}',
  // horizontal Stack: prose-like children (Text, Callout) share the row; chips (Badge, Metric) keep their size
  '[data-ru-card] [data-ru-dir="horizontal"]>:is([data-ru="Text"],[data-ru="Callout"]){flex:1 1 200px}'
].join('')

// ctx.rest holder — set once by register(); api() keeps the {ok:false} -> throw wrapper.
let ctxRest = async () => { throw new Error('rich-ui backend unavailable') }
export function setRest(fn) { ctxRest = fn }
export async function api(path, opts) {
  const res = await ctxRest(path, opts)
  if (res && typeof res === 'object' && (res.ok === false || res.error)) {
    throw new Error(res.error?.message || String(res.error || 'request failed'))
  }
  return res
}

const FALLBACK = 'card unavailable'

export const InlineError = ({ message }) => jsxs('div', {
  'data-ru-error': '', role: 'alert',
  style: { display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 10px', borderLeft: `3px solid ${V.red}`, background: V.bg3, borderRadius: 4, ...type('small') },
  children: [
    jsx('span', { style: { color: V.text2 }, children: FALLBACK }, 'f'),
    message ? jsx('span', { style: { color: V.text3, fontFamily: 'monospace', ...type('caption'), wordBreak: 'break-word' }, children: String(message) }, 'm') : null
  ]
})

export const UnknownType = ({ element }) => jsx('div', {
  'data-ru-unknown': element?.type ?? '', style: { ...type('caption'), color: V.text3, fontStyle: 'italic' },
  children: `unsupported component: ${element?.type ?? '?'}`
})

// A throw inside one card degrades to an inline error, never a dead message.
export class CardBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) { console.error('[hermes-rich-ui] card render failed', error) }
  render() {
    if (this.state.error) return jsx(InlineError, { message: this.state.error?.message || String(this.state.error) })
    return this.props.children
  }
}

// D6: every value is a real Badge cva variant (see _shared.mjs BADGE_VARIANTS_REAL).
export const POLICY_TONE = { embedded: 'muted', capture: 'default', manual: 'warn', poll: 'success' }

// S7 (#30): the header is honest — the title prints ONCE here at title 16/600, the date goes
// through fmtDate (no ISO/T..: on the face), 'rev N' only when N>1, the policy badge only when
// != embedded. Meta rides right as caption meta-ink.
function Header({ title, meta, envelope, sources }) {
  const authored = fmtDate(meta?.authored_at)
  const rev = meta?.dataset?.revision ?? envelope?.revision
  const policy = envelope?.policy
  const metaBits = [
    authored ? jsx('span', { children: authored }, 'a') : null,
    Number.isFinite(Number(rev)) && Number(rev) > 1 ? jsx('span', { children: `rev ${rev}` }, 'r') : null,
    policy && policy !== 'embedded' ? jsx(Badge, { variant: POLICY_TONE[policy] ?? 'muted', size: 'xs', 'data-ru-policy': policy, children: String(policy) }, 'p') : null
  ].filter(Boolean)
  return jsxs('div', {
    'data-ru-header': '',
    style: { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', ...type('caption'), color: INK.meta },
    children: [
      title || sources ? jsx('span', { style: { ...type('title'), color: V.text }, children: [title, sources] }, 't') : null,
      metaBits.length ? jsx('span', { style: { flexGrow: 1, display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'baseline', ...type('caption'), color: INK.meta }, children: metaBits }, 'm') : null
    ]
  })
}

// RFC 6901 pointer lookup (strict ~1/~0 decoding) for the header title binding.
export function getByPointer(obj, path) {
  if (typeof path !== 'string' || !path.startsWith('/')) return undefined
  let cur = obj
  for (const raw of path.slice(1).split('/')) {
    const seg = raw.replace(/~1/g, '/').replace(/~0/g, '~')
    if (cur === null || typeof cur !== 'object') return undefined
    if (Array.isArray(cur)) { cur = /^(0|[1-9][0-9]*)$/.test(seg) ? cur[Number(seg)] : undefined; continue }
    cur = Object.prototype.hasOwnProperty.call(cur, seg) ? cur[seg] : undefined
  }
  return cur
}

function bindingValue(v, dataModel) {
  return v && typeof v === 'object' && typeof v.path === 'string' && Object.keys(v).length === 1
    ? getByPointer(dataModel, v.path) : v
}

function bindingText(v, dataModel) {
  const r = bindingValue(v, dataModel)
  return typeof r === 'string' ? r : (typeof r === 'number' ? String(r) : null)
}

// S19: exact casefold duplicates among title/summary/subtitle render once.
const folded = v => String(v).trim().toLowerCase()

export function CardBody({ record, registry }) {
  const [expanded, setExpanded] = useState(false)
  const cs = record?.surface?.createSurface
  const meta = cs?.dataModel?.meta
  const root = Array.isArray(cs?.components) ? cs.components.find(c => c && c.id === 'root') : null
  const rootIsCard = root?.component === 'Card'
  const rootTitle = rootIsCard ? bindingText(root.title, cs?.dataModel) : null
  const rootSubtitle = rootIsCard ? bindingText(root.subtitle, cs?.dataModel) : null
  const title = (typeof meta?.title === 'string' && meta.title.trim()) ? meta.title : rootTitle
  const same = (a, b) => typeof a === 'string' && typeof b === 'string' && folded(a) === folded(b)
  // S19 precedence: header title, distinct root h2, summary, then subtitle.
  // Compare only chrome; authored body content is never deduplicated.
  const rootTitleShown = same(title, rootTitle)
  const showSummary = typeof meta?.summary === 'string' && meta.summary.trim()
    && !same(meta.summary, title) && !same(meta.summary, rootTitle)
  const showSubtitle = rootSubtitle !== null && !same(rootSubtitle, title) && !same(rootSubtitle, rootTitle)
    && !(showSummary && same(rootSubtitle, meta.summary))
  const rootProps = rootIsCard ? {
    title: rootTitle, subtitle: rootSubtitle, _sources: meta?.sources,
    sourceIds: bindingValue(root.sourceIds, cs?.dataModel),
    accessibility: { label: bindingText(root.accessibility?.label, cs?.dataModel) }
  } : null
  const reasons = unlowerable(cs)
  let lowered = null
  let lowerError = null
  if (!reasons.length) {
    try { lowered = lower(cs) } catch (e) { lowerError = e?.message || String(e) }
  }
  return jsx('div', {
    'data-ru-card': record?.envelope?.card_id ?? '',
    style: { margin: '6px 0', color: V.text },
    children: jsxs('section', {
      ...(rootIsCard ? common({ type: 'Card', props: rootProps }) : {}),
      style: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, ...SURFACE.card },
      children: [
      jsx('style', { href: PROSE_RESET_HREF, precedence: 'default', 'data-ru-prose-reset': '1', children: PROSE_RESET_CSS }, 'css'),
      jsx(Header, { title, meta, envelope: record?.envelope, sources: rootIsCard && (rootTitleShown || rootTitle === null) ? ownSources(rootProps) : null }, 'h'),
      rootIsCard ? jsx(CardHeader, { p: rootProps, titleShown: rootTitle !== null && !rootTitleShown, subtitleShown: showSubtitle }, 'rh') : null,
      // Plain-text summary always renders ABOVE the rich body — the accessible fallback.
      // S19: keep distinct authored root titles; S8: prose capped at HOUSE.MEASURE.
      showSummary ? jsx('p', { 'data-ru-summary': '', style: { margin: 0, maxWidth: HOUSE.MEASURE, ...type('body'), color: V.text2, whiteSpace: 'pre-wrap' }, children: String(meta.summary) }, 's') : null,
      reasons.length || lowerError
        ? jsx('ul', { 'data-ru-unlowerable': '', style: { margin: 0, paddingLeft: 18, ...type('small'), color: V.red },
          children: (lowerError ? [lowerError] : reasons).map((r, i) => jsx('li', { children: r }, i))
        }, 'u')
        : jsxs('div', { children: [
            jsx('div', { 'data-ru-body': expanded ? 'expanded' : 'capped',
              style: { maxHeight: expanded ? 'none' : HEIGHT_CAP, overflow: 'hidden', position: 'relative' },
              children: jsx(CardBoundary, {
                // The boundary owns the frame and root chrome, not the first Card ancestor.
                children: jsx(CardChrome.Provider, { value: { framed: true, rootAtBoundary: rootIsCard },
                  children: jsx(VintageProvider, {
                    value: vintageOf(record),
                  children: jsx(JSONUIProvider, {
                    registry, initialState: lowered.initialState,
                    children: jsx(Renderer, { spec: lowered.spec, registry, fallback: UnknownType })
                  })
                })
              })
            })
            }, 'body'),
            jsx('button', { type: 'button', 'data-ru-toggle': '', onClick: () => setExpanded(v => !v),
              style: { alignSelf: 'flex-start', marginTop: 4, background: 'none', border: `1px solid ${V.stroke3}`, borderRadius: 4, padding: '2px 8px', ...type('caption'), color: V.text2, cursor: 'pointer' },
              children: expanded ? 'Show less' : 'Show more'
            }, 'toggle')
          ]
        }, 'b')
      ]
    })
  })
}

export function makeRichCard(registry) {
  return function RichCard({ id }) {
    const valid = ID_RE.test(id)
    const q = useQuery({ queryKey: [Q, id], queryFn: () => api('/cards/' + id), enabled: valid })
    if (!valid) return jsx(InlineError, { message: `invalid card id: ${JSON.stringify(id)}` })
    if (q.isPending || q.isLoading) return jsx(Skeleton, { 'data-ru-loading': '', style: { height: 72, width: '100%', margin: '6px 0' } })
    if (q.isError) return jsx(InlineError, { message: q.error?.message || String(q.error) })
    const record = q.data?.card ?? q.data
    if (!record || !record.surface) return jsx(InlineError, { message: 'record has no surface' })
    return jsx(CardBoundary, { children: jsx(CardBody, { record, registry }) })
  }
}
