import { jsx, jsxs } from 'react/jsx-runtime'
import { common, isNil, badge, V, type } from './_shared.mjs'

// External link path (grepped apps/desktop/src/sdk/index.ts + contrib/plugin.ts on 2026-09-25):
// the SDK `host` object has NO openExternal; the curated door is `ctx.os.openExternal(url)`
// (PluginOs on the register() context). index.mjs stashes it here at register().
// D4: when ctx.os is absent there is NO working link path — Electron's setWindowOpenHandler
// (window-open-policy.ts) denies every window.open/target=_blank, and will-navigate does not fire
// for _blank — so the fallback is a plain non-link <span> showing the URL text, never a dead anchor.
let osOpen = null
export function setOpenExternal(fn) { osOpen = typeof fn === 'function' ? fn : null }
export function openExternal(url) {
  if (!osOpen || typeof url !== 'string' || !url.startsWith('https://')) return false
  try { const r = osOpen(url); if (r && typeof r.catch === 'function') r.catch(() => {}) } catch { return false }
  return true
}

const KIND_TONE = { web: 'info', file: 'neutral', tool: 'success', derived: 'caution' }

// #36 (slice 13): the row census is `n · label link · host · kind · accessed <date>` —
// the label NEVER falls back to the raw URL (a URL-shaped label prints its host), and
// accessed_at prints through fmtDate behind the word `accessed`, never raw ISO.
import { fmtDate } from './fmt.mjs'
const hostOf = url => { try { return new URL(url).host } catch { return null } }
export function sourceRow(s, n) {
  const url = typeof s.url === 'string' && s.url.startsWith('https://') ? s.url : null
  const raw = String(s.label || s.url || s.id || '')
  const label = raw === s.url ? (hostOf(raw) || raw) : raw
  const host = url ? hostOf(url) : null
  const accessed = !isNil(s.accessed_at) && String(s.accessed_at) !== '' ? fmtDate(s.accessed_at) : null
  return jsxs('li', { 'data-ru-source': String(s.id ?? n - 1),
    style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', color: V.text },
    children: [
      jsx('span', { 'data-ru-source-n': String(n), style: { ...type('caption', { num: true }), color: V.text3 }, children: String(n) }, 'n'),
      jsx('span', { 'aria-hidden': 'true', style: { color: V.text3 }, children: ' · ' }, 's1'),
      url && osOpen
        ? jsx('a', { href: url, rel: 'noreferrer',
          onClick: e => { e.preventDefault(); openExternal(url) },
          style: { color: V.accent, textDecoration: 'none', wordBreak: 'break-all' },
          children: label
        }, 'a')
        : jsx('span', { 'data-ru-url': url || undefined, style: url ? { wordBreak: 'break-all' } : undefined, children: label }, 'a'),
      host ? jsxs('span', { style: { color: V.text3 }, children: [' · ', host] }, 'h') : null,
      s.kind ? jsxs('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6 }, children: [jsx('span', { 'aria-hidden': 'true', style: { color: V.text3 }, children: ' · ' }, 's3'), badge(String(s.kind), KIND_TONE[s.kind] ?? 'neutral', {}, 'k'), jsx('span', { 'aria-hidden': 'true', style: { color: V.text3 }, children: ' · ' }, 's4')] }, 'k') : null,
      accessed ? jsxs('span', { style: { ...type('caption'), color: V.text3 }, children: ['accessed ', accessed] }, 'd') : null,
      s.note ? jsx('span', { style: { color: V.text2, ...type('caption'), flexBasis: '100%' }, children: String(s.note) }, 'n2') : null
    ].filter(Boolean)
  }, String(s.id ?? '') + ':' + (n - 1))
}

export const SourceList = ({ element }) => {
  const p = element.props ?? {}
  const sources = Array.isArray(p.sources) ? p.sources : (Array.isArray(p._sources) ? p._sources : [])
  // D9 (CONTRACTS §2 row 18): sourceIds ABSENT → all of /meta/sources; explicit [] → empty state.
  const wanted = Array.isArray(p.sourceIds) ? new Set(p.sourceIds.map(String)) : null
  const explicitEmpty = wanted !== null && wanted.size === 0
  const shown = sources.filter(s => s && typeof s === 'object' && (!wanted || wanted.has(String(s.id))))
  return jsxs('div', {
    ...common(element),
    style: { display: 'flex', flexDirection: 'column', gap: 4 },
    children: [
      isNil(p.title) ? null : jsx('div', { style: { ...type('h3'), color: V.text }, children: String(p.title) }, 't'),
      shown.length === 0
        ? jsx('div', { 'data-ru-empty': explicitEmpty ? 'cited' : 'none', style: { ...type('small'), color: V.text3, fontStyle: 'italic' }, children: explicitEmpty ? 'No sources cited' : 'no sources' }, 'e')
        : jsx('ol', { style: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3, ...type('small') },
          children: shown.map((s, i) => sourceRow(s, i + 1))
        }, 'ol')
    ]
  })
}
