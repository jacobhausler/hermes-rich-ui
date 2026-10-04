// Chromium-computed host-border control for the saved 97cb HeatMap (issue #47, blocker 2).
//
// The jsdom host fixture in tests/test_components.mjs is false-green: jsdom reports
// borderBottomWidth '0px' on tr/th where real Chromium computes the `.prose` host 1px edge
// unless the shipped [data-ru-card] prose reset genuinely wins the cascade. This control
// runs the SAME markup (reconstructed from tests/fixtures/saved/ru-97cb020cd21b.json),
// the SAME host rule (tests/test_components.mjs:78) and the REAL shipped reset text
// (PROSE_RESET_CSS imported from desktop/src/card.mjs) inside headless Chromium and
// asserts getComputedStyle results there — no jsdom in the loop.
//
// When no Chromium/Chrome binary is reachable the test records a skip; the helper carries
// the stored Chromium-computed expected set (issue #47's sanctioned fallback) which is
// exactly what the live probes below assert against.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { findChromium, withBrowser, EXPECTED } from './helpers/chromium.mjs'

// '@hermes/plugin-sdk' is mapped to tests/fixtures/sdk-stub.mjs (same pattern as
// tests/test_components.mjs) so the real shipped card module imports cleanly.
registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })
const { PROSE_RESET_CSS } = await import('../desktop/src/card.mjs')

const CHROMIUM = findChromium()

// Host rule exactly as the jsdom control loads it (tests/test_components.mjs:78), loaded
// AFTER the reset so cascade order mirrors the app (host prose block wraps the card).
const HOST_RULE = '.prose tr,.prose th{border-bottom:1px solid rgb(209, 213, 219)}'

// Read --ui-* fallback tokens straight from chart.mjs's FALLBACK map (single source;
// --ui-stroke-tertiary #374151 -> rgb(55, 65, 81) is asserted against it, never a copy).
const chartSrc = readFileSync(new URL('../desktop/src/components/chart.mjs', import.meta.url), 'utf8')
const fallbackBlock = chartSrc.match(/const FALLBACK = \{([\s\S]*?)\}/)
assert.ok(fallbackBlock, 'chart.mjs FALLBACK token map found')
const TOKENS = {}
for (const [, name, hex] of fallbackBlock[1].matchAll(/'(--ui-[\w-]+)':\s*'(#[0-9a-fA-F]{6})'/g)) {
  TOKENS[name] = hex
}
const strokeToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}
const STROKE_RGB = strokeToRgb(TOKENS['--ui-stroke-tertiary'])

// Rebuild the saved 97cb HeatMap table markup — mirrors desktop/src/components/heatmap.mjs
// (corner/th/rowHead paddings, the heat-cell `border:1px solid var(--ui-stroke-tertiary)`
// declaration, the hatched null cell, the ramp caption) from the SAVED fixture's own props.
function heatTableMarkup() {
  const record = JSON.parse(readFileSync(new URL('./fixtures/saved/ru-97cb020cd21b.json', import.meta.url), 'utf8'))
  const p = record.surface.createSurface.components.find(c => c.component === 'HeatMap')
  const rows = (p.rows ?? []).map(r => String(r?.label ?? ''))
  const cols = (p.cols ?? []).map(c => String(c?.label ?? ''))
  const isNum = v => typeof v === 'number' && Number.isFinite(v)
  const grid = rows.map(() => cols.map(() => null))
  for (const c of p.cells ?? []) {
    const ri = rows.indexOf(String(c?.row ?? '')); const ci = cols.indexOf(String(c?.col ?? ''))
    if (ri < 0 || ci < 0) continue
    grid[ri][ci] = c?.value === null || c?.value === undefined ? null : (isNum(Number(c.value)) ? Number(c.value) : null)
  }
  const seen = grid.flat().filter(v => v !== null)
  const min = seen.length ? Math.min(...seen) : null
  const max = seen.length ? Math.max(...seen) : null
  const ramp = v => {
    if (v === null || min === null) return null
    if (min === max) return 0.5
    return Math.round(((v - min) / (max - min)) * 5) / 5
  }
  const cellBg = t => `color-mix(in srgb, ${TOKENS['--ui-accent'] ?? '#3b82f6'} ${Math.round(t * 85)}%, ${TOKENS['--ui-bg-tertiary'] ?? '#27272a'})`
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const head = '<tr><th scope="col" style="padding:3px 6px" aria-label="row labels"></th>' +
    cols.map(c => `<th scope="col" style="padding:3px 6px;text-align:left;white-space:nowrap">${esc(c)}</th>`).join('') + '</tr>'
  const body = rows.map((r, ri) => '<tr>' +
    `<th scope="row" style="padding:3px 6px;text-align:left;white-space:nowrap">${esc(r)}</th>` +
    cols.map((c, ci) => {
      const v = grid[ri][ci]; const t = ramp(v)
      const style = t === null
        ? 'padding:4px 6px;text-align:center;min-width:34px;background-image:repeating-linear-gradient(45deg, var(--ui-stroke-tertiary) 0 4px, transparent 4px 8px);border:1px solid var(--ui-stroke-tertiary)'
        : `padding:4px 6px;text-align:right;min-width:34px;background:${cellBg(t)};border:1px solid var(--ui-stroke-tertiary)`
      const label = v === null ? '—' : String(v)
      return `<td style="${style}" data-ru-cell="${v === null ? 'unavailable' : String(t)}" aria-label="${esc(`${r}, ${c}: ${v === null ? 'unavailable' : v + (p.unit ?? '')}`)}">${label}</td>`
    }).join('') + '</tr>').join('')
  const caption = seen.length === 0
    ? 'no values observed — all cells unavailable'
    : `observed ${min}${p.unit ?? ''} to ${max}${p.unit ?? ''} · ${seen.length} values`
  return [
    `<div data-ru="HeatMap" data-ru-cells="${seen.length}">`,
    `<table style="border-collapse:collapse;width:100%" data-richui="heatmap-grid"><thead>${head}</thead><tbody>${body}</tbody></table>`,
    `<div data-richui="heatmap-caption">${esc(caption)}</div>`,
    '</div>'
  ].join('')
}

// Build the probe page. `omitReset: true` drops the shipped reset (mutant proof (b)).
function probePage({ omitReset = false } = {}) {
  const vars = Object.entries(TOKENS).map(([k, v]) => `${k}:${v}`).join(';')
  return `<!doctype html><html><head><meta charset="utf-8">` +
    `<style id="ui-vars">:root{${vars}}</style>` +
    `<style id="host">${HOST_RULE}</style>` +
    (omitReset ? '' : `<style id="prose-reset">${PROSE_RESET_CSS}</style>`) +
    `</head><body><div class="prose" style="width:720px"><div data-ru-card="ru-97cb020cd21b">${heatTableMarkup()}</div></div></body></html>`
}

const PROBE_EXPR = `(() => {
  const heat = document.querySelector('[data-ru="HeatMap"]')
  const edges = sel => [...heat.querySelectorAll(sel)].map(el => {
    const cs = getComputedStyle(el)
    return { tag: el.tagName, text: (el.textContent || '').trim().slice(0, 20),
      bottomWidth: cs.borderBottomWidth, bottomStyle: cs.borderBottomStyle,
      topWidth: cs.borderTopWidth, topStyle: cs.borderTopStyle, topColor: cs.borderTopColor }
  })
  return { tr: edges('tr'), th: edges('th'), td: edges('td') }
})()`

const chromiumSkip = CHROMIUM ? false : 'no Chromium/Chrome binary found (CHROME_BIN unset, none on PATH) — control skipped; helper carries the stored Chromium-computed expected set'

async function probeInto(pageHtml) {
  const dir = await mkdtemp(join(tmpdir(), 'ru-host-border-probe-'))
  try {
    const file = `${dir}/probe.html`
    await writeFile(file, pageHtml)
    return await withBrowser(CHROMIUM, async session => {
      await session.navigate(`file://${file}`)
      return session.evaluate(PROBE_EXPR)
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('Chromium: saved 97cb HeatMap rows/headers lose the host border only because the shipped reset wins the cascade', { skip: chromiumSkip }, async () => {
  const res = await probeInto(probePage())
  assert.ok(res.tr.length >= 5, 'header row + 4 body rows probed')
  assert.ok(res.th.length >= 6, 'corner + header + row-header cells probed')
  assert.ok(res.td.length >= 20, 'heat cells probed')
  // The false-green fix: in real Chromium the host 1px edge is GONE only because the
  // shipped reset wins — jsdom reports 0px unconditionally, Chromium must confirm it.
  for (const el of [...res.tr, ...res.th]) {
    assert.equal(el.bottomWidth, EXPECTED.hostEdge.width, `${el.tag} "${el.text}": host border-bottom width`)
    assert.equal(el.bottomStyle, EXPECTED.hostEdge.style, `${el.tag} "${el.text}": host border-bottom style`)
  }
  // Every declared heat-cell edge survives: 1px solid rgb(55, 65, 81) — never a
  // var() passthrough, never 0px.
  for (const el of res.td) {
    assert.equal(el.topWidth, EXPECTED.cellEdge.width, `td "${el.text}": cell edge width`)
    assert.equal(el.topStyle, EXPECTED.cellEdge.style, `td "${el.text}": cell edge style`)
    assert.equal(el.topColor, STROKE_RGB, `td "${el.text}": cell edge resolves the stroke token`)
  }
})

test('Chromium mutant proof: with the shipped reset removed from the page the host tr/th edges go 1px solid (control is live)', { skip: chromiumSkip }, async () => {
  const res = await probeInto(probePage({ omitReset: true }))
  // Without the reset the .prose host rule computes on EVERY tr/th — the mutant-proven
  // guarantee that the assertions in the green control can actually fail.
  for (const el of [...res.tr, ...res.th]) {
    assert.equal(el.bottomWidth, EXPECTED.hostEdgeMutant.width, `${el.tag} "${el.text}": mutant shows host 1px edge`)
    assert.equal(el.bottomStyle, EXPECTED.hostEdgeMutant.style, `${el.tag} "${el.text}": mutant shows solid edge`)
  }
})
