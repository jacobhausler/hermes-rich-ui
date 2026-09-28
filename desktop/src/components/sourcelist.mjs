import { jsx, jsxs } from 'react/jsx-runtime'
import { common, isNil, badge, V } from './_shared.mjs'

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
      isNil(p.title) ? null : jsx('div', { style: { fontWeight: 600, fontSize: 12, color: V.text }, children: String(p.title) }, 't'),
      shown.length === 0
        ? jsx('div', { 'data-ru-empty': explicitEmpty ? 'cited' : 'none', style: { fontSize: 12, color: V.text3, fontStyle: 'italic' }, children: explicitEmpty ? 'No sources cited' : 'no sources' }, 'e')
        : jsx('ol', { style: { margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 },
          children: shown.map((s, i) => {
            const url = typeof s.url === 'string' && s.url.startsWith('https://') ? s.url : null
            const label = String(s.label || s.url || s.id || '')
            return jsxs('li', { 'data-ru-source': String(s.id ?? i),
              style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', color: V.text },
              children: [
                url && osOpen
                  ? jsx('a', { href: url, rel: 'noreferrer',
                    onClick: e => { e.preventDefault(); openExternal(url) },
                    style: { color: V.accent, textDecoration: 'none', wordBreak: 'break-all' },
                    children: label
                  }, 'a')
                  : jsx('span', { 'data-ru-url': url || undefined, style: url ? { wordBreak: 'break-all' } : undefined, children: url ? `${label} — ${url}` : label }, 'a'),
                s.kind ? badge(String(s.kind), KIND_TONE[s.kind] ?? 'neutral', {}, 'k') : null,
                s.accessed_at ? jsx('span', { style: { color: V.text3, fontSize: 11 }, children: String(s.accessed_at) }, 'd') : null,
                s.note ? jsx('span', { style: { color: V.text2, fontSize: 11, flexBasis: '100%' }, children: String(s.note) }, 'n') : null
              ]
            }, String(s.id ?? '') + ':' + i)
          })
        }, 'ol')
    ]
  })
}
