// #47 blocker 2 — Chromium-computed host-border control (kills the jsdom
// false-green). jsdom's cascade is unfaithful: the jsdom test loads the host
// `.prose tr,.prose th{border-bottom:1px solid rgb(209, 213, 219)}` rule AFTER
// the hoisted PROSE_RESET_CSS (equal specificity, (0,1,1) each — the shipped
// React 19 hoist appends the reset to the END of <head>, i.e. AFTER the host
// prose stylesheets) and jsdom computes 0px/none for the tr/th regardless of
// order. Real Chromium obeys the spec: equal specificity resolves by document
// order, so ONLY the shipped hoist (reset after host) yields 0px/none — if a
// regression landed the reset BEFORE the host stylesheet, Chromium paints the
// 1px host border and jsdom still says 0px. This control closes that gap.
//
// How: mount the saved 97cb record's HeatMap under jsdom to harvest the exact
// rendered markup, rebuild it inside headless Chromium inside `.prose` + a
// `[data-ru-card]` ancestor, inject the shipped PROSE_RESET_CSS (imported from
// desktop/src/card.mjs — never a source-text snapshot, R6) and the host rule in
// BOTH orders via CDP Runtime.evaluate (scripts/screenshots/ru-cdp.mjs pattern),
// and assert REAL getComputedStyle:
//   shipped order (host then hoisted reset): every tr/th = 0px/none;
//   mis-ordered (reset then host):            the tr/th DO paint 1px solid
//       rgb(209, 213, 219) — the teeth check proving the host rule is live and
//       the shipped 0px comes from the reset winning, not from an inert rule;
//   every td heat cell in BOTH orders:        1px solid, color rgb(55, 65, 81)
//       (--ui-stroke-tertiary resolved, never a var() passthrough, never 0px).
//
// Gate (no false greens, no silent skips): see tests/helpers/chromium.mjs.
// RUI_CHROME_BIN set -> live run; no binary + RUI_SKIP_CHROMIUM=1 -> recorded
// skip + stored expected-set fallback (issue option B); no binary + no skip env
// -> hard FAIL 'CHROME MISSING — set RUI_CHROME_BIN'.
// RUI_DEFEAT_RESET=1 (dev-only, for the red-first demonstration) drops the
// reset from the shipped-order pass so its assertions go RED.
// Assertion-only: desktop/plugin.js and .sha256 must stay byte-equal.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { chromiumGate, launchChromium } from './helpers/chromium.mjs'

registerHooks({ resolve: (await import('./helpers/fixtures-sdk-resolve.mjs')).resolve })
const { PROSE_RESET_CSS } = await import('../desktop/src/card.mjs')

const HOST_RULE = '.prose tr,.prose th{border-bottom:1px solid rgb(209, 213, 219)}'
// Probe-page token map: the app theme supplies these on :root; the values are
// chart.mjs's documented FALLBACK theme tokens (--ui-stroke-tertiary #374151 ->
// rgb(55, 65, 81)), so the heat-cell border resolves to a real rgb(), exactly as
// the desktop renders it.
const TOKEN_CSS = ':root{--ui-accent:#3b82f6;--ui-green:#22c55e;--ui-purple:#a855f7;--ui-orange:#f97316;--ui-red:#ef4444;--ui-text-secondary:#9ca3af;--ui-text-primary:#e5e7eb;--ui-text-tertiary:#6b7280;--ui-stroke-tertiary:#374151;--ui-stroke-secondary:#4b5563;--ui-bg-tertiary:#1f2937;--ui-bg-elevated:#111827}'
const EXPECTED = JSON.parse(readFileSync(new URL('./fixtures/chromium-host-border-expected.json', import.meta.url), 'utf8'))
const RECORD = JSON.parse(readFileSync(new URL('./fixtures/saved/ru-97cb020cd21b.json', import.meta.url), 'utf8'))

const gate = chromiumGate()

if (!gate.run && gate.fail) {
  // Hard fail, not a silent pass: a missing binary with no explicit skip env is
  // exactly the false-green shape this control exists to kill.
  test('#47 chromium host-border control: binary gate', () => {
    assert.fail('CHROME MISSING — set RUI_CHROME_BIN (see tests/helpers/chromium.mjs; CI Chromium-less runner sets RUI_SKIP_CHROMIUM=1 for the recorded-skip fallback)')
  })
} else if (!gate.run) {
  // Issue #47 sanctioned option B: recorded skip + stored expected-set fallback.
  // It is NOT equivalent to the live run — it pins the shipped cascade outcome
  // and the shipped reset text only; the live getComputedStyle assertions below
  // need a real browser (dogfood lane).
  test('#47 chromium host-border control: recorded skip + expected-set fallback (option B)', () => {
    console.log(`SKIP: ${gate.reason}`)
    assert.equal(EXPECTED.source, 'live chrome-headless-shell getComputedStyle, dogfood lane 2026-10-04', 'expected set is live-observed provenance')
    assert.deepEqual(EXPECTED.tr_th, { borderBottomWidth: '0px', borderBottomStyle: 'none' }, 'shipped cascade: reset wins tr/th host border')
    assert.deepEqual(EXPECTED.td, { borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: 'rgb(55, 65, 81)' }, 'heat cell edge survives with resolved token color')
    assert.ok(EXPECTED.miorder_teeth.some(t => t.borderBottomWidth === '1px' && t.borderBottomStyle === 'solid' && t.borderBottomColor === 'rgb(209, 213, 219)'),
      'expected set records the mis-ordered host paint (control has teeth)')
    // The shipped reset still carries the border-zero rule for tr/th.
    assert.ok(PROSE_RESET_CSS.includes('[data-ru-card] :is(table,thead,tbody,tr,th,td){border:0}'),
      'PROSE_RESET_CSS still zeroes table borders at the card root')
  })
} else {
  // Live run needs the jsdom mount harness only to harvest the rendered markup.
  const { React, act, registry } = await import('./helpers/render.mjs')
  const { createRoot } = await import('react-dom/client')
  const { CardBody } = await import('../desktop/src/card.mjs')

  async function harvestHeatMapMarkup() {
    const shell = document.createElement('div')
    shell.className = 'prose'
    shell.style.width = '720px'
    document.body.append(shell)
    const cardRoot = createRoot(shell)
    try {
      await act(async () => { cardRoot.render(React.createElement(CardBody, { record: RECORD, registry })) })
      const heat = shell.querySelector('[data-ru="HeatMap"]')
      assert.ok(heat, 'saved 97cb HeatMap rendered under jsdom for harvesting')
      const counts = {
        tr: heat.querySelectorAll('tr').length,
        th: heat.querySelectorAll('th').length,
        td: heat.querySelectorAll('td').length
      }
      assert.ok(counts.tr >= 4 && counts.th >= 2 && counts.td > 0, `heat grid populated: ${JSON.stringify(counts)}`)
      return { heatHtml: heat.outerHTML, counts }
    } finally {
      await act(async () => { cardRoot.unmount() })
      shell.remove()
    }
  }

  // Rebuild the harvested markup in the page and return computed edge samples.
  // order='shipped' -> host stylesheet first, reset appended AFTER (the React 19
  // hoist position); order='misordered' -> reset first, host after (the
  // equal-specificity cascade then resolves in the HOST's favour).
  const buildAndMeasure = (heatHtml, order, withReset) => `(() => {
    document.head.innerHTML = '<style id="tokens">${TOKEN_CSS}</style>'
    const mk = (css, id) => { const s = document.createElement('style'); s.id = id; s.textContent = css; return s }
    const host = mk(${JSON.stringify(HOST_RULE)}, 'host')
    const reset = mk(${JSON.stringify(PROSE_RESET_CSS)}, 'reset')
    if (${JSON.stringify(order)} === 'shipped') { document.head.append(host); if (${withReset}) document.head.append(reset) }
    else { if (${withReset}) document.head.append(reset); document.head.append(host) }
    const wrap = document.createElement('div'); wrap.className = 'prose'; wrap.style.width = '720px'
    const card = document.createElement('div'); card.setAttribute('data-ru-card', ${JSON.stringify(RECORD.envelope.card_id)})
    card.innerHTML = ${JSON.stringify(heatHtml)}
    wrap.append(card); document.body.innerHTML = ''; document.body.append(wrap)
    const heat = document.querySelector('[data-ru="HeatMap"]')
    if (!heat) return { err: 'harvested markup did not mount in chromium' }
    const f = el => { const c = getComputedStyle(el); return { borderBottomWidth: c.borderBottomWidth, borderBottomStyle: c.borderBottomStyle, borderBottomColor: c.borderBottomColor } }
    const rows = [...heat.querySelectorAll('tr')].map(f)
    const headers = [...heat.querySelectorAll('th')].map(f)
    const cells = [...heat.querySelectorAll('td')].map(f)
    return { rows, headers, cells, counts: { tr: rows.length, th: headers.length, td: cells.length } }
  })()`

  const ZEROS = { borderBottomWidth: '0px', borderBottomStyle: 'none' }
  const CELL = { borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: 'rgb(55, 65, 81)' }
  const hostPaint = { borderBottomWidth: '1px', borderBottomStyle: 'solid', borderBottomColor: 'rgb(209, 213, 219)' }
  const edgeOf = s => ({ borderBottomWidth: s.borderBottomWidth, borderBottomStyle: s.borderBottomStyle, borderBottomColor: s.borderBottomColor })
  // For a cleared edge the color is meaningless (Chromium reports the initial
  // rgb(0, 0, 0)); pin width+style only — the shape that actually regressed.
  const edge2 = s => ({ borderBottomWidth: s.borderBottomWidth, borderBottomStyle: s.borderBottomStyle })

  test('#47 chromium host-border control: real getComputedStyle (live browser)', async () => {
    const { heatHtml, counts } = await harvestHeatMapMarkup()
    const { evaluate, close } = await launchChromium(gate.bin)
    try {
      // Pass A — shipped order: host rule, then the hoisted reset. This is the
      // assertion jsdom false-greens: it must be 0px/none for EVERY tr and th.
      const shipped = await evaluate(buildAndMeasure(heatHtml, 'shipped', process.env.RUI_DEFEAT_RESET !== '1'))
      assert.ok(!shipped.err, shipped.err)
      assert.deepEqual(shipped.counts, counts, 'chromium sees the same grid jsdom harvested')
      for (const [i, s] of shipped.rows.entries()) assert.deepEqual(edge2(s), ZEROS, `shipped-order tr[${i}] keeps the host row rule (reset must win)`)
      for (const [i, s] of shipped.headers.entries()) assert.deepEqual(edge2(s), ZEROS, `shipped-order th[${i}] keeps the host header rule`)
      for (const [i, s] of shipped.cells.entries()) {
        assert.deepEqual(edgeOf(s), CELL, `shipped-order td[${i}] heat edge computes 1px solid with the RESOLVED token color`)
        assert.ok(!s.borderBottomColor.includes('var('), 'no var() passthrough in computed style')
      }

      // Pass B — mis-ordered injection: equal specificity (0,1,1) resolves by
      // document order, so the tr/th DO paint the host border here. This is the
      // teeth check: it proves the host rule reaches the harvested DOM at all,
      // i.e. pass A's 0px is the reset winning, not an inert fixture.
      const mis = await evaluate(buildAndMeasure(heatHtml, 'misordered', true))
      assert.ok(!mis.err, mis.err)
      assert.deepEqual(edgeOf(mis.rows[0]), hostPaint, 'mis-ordered tr paints the host border (control is not vacuous)')
      assert.deepEqual(edgeOf(mis.headers[0]), hostPaint, 'mis-ordered th paints the host border')
      // Heat-cell inline edge survives BOTH orders — inline beats the author
      // rules regardless, with the token resolved (never 0px, never var()).
      for (const pass of [shipped, mis]) for (const [i, s] of pass.cells.entries())
        assert.deepEqual(edgeOf(s), CELL, `td[${i}] heat edge in ${pass === shipped ? 'shipped' : 'misordered'} order`)

      if (process.env.RUI_CAPTURE_EXPECTED === '1') {
        // Maintenance path (dogfood lane only): regenerate the option-B fallback
        // set FROM THE LIVE BROWSER so it can never carry invented values.
        const { writeFileSync } = await import('node:fs')
        writeFileSync(new URL('./fixtures/chromium-host-border-expected.json', import.meta.url),
          JSON.stringify({
            source: 'live chrome-headless-shell getComputedStyle, dogfood lane 2026-10-04',
            binary: 'chrome-headless-shell 154.0.8037.92 linux64 (chrome-for-testing Stable)',
            tr_th: edge2(shipped.rows[0]),
            td: edgeOf(shipped.cells[0]),
            miorder_teeth: [edgeOf(mis.rows[0]), edgeOf(mis.headers[0])]
          }, null, 2) + '\n')
      }
      // The stored fallback set must match what the live browser just said.
      assert.deepEqual([edge2(shipped.rows[0]), edgeOf(shipped.cells[0]), edgeOf(mis.rows[0])],
        [EXPECTED.tr_th, EXPECTED.td, EXPECTED.miorder_teeth[0]], 'stored expected-set agrees with the live browser')
    } finally {
      close()
    }
  })
}
