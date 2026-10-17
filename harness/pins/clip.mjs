// #39 (defaults slice 16) harness pin: no text box clips at 360 and 720 CSS px.
// Pattern shared with the #47 host-border control (tests/test_host_border_chromium.mjs):
// markup is harvested from the real jsdom render, rebuilt in a real Chromium at the pin
// widths, and every text-bearing box must either fit or carry its full text in an
// attribute (title / aria-label / data-ru-exact) — an ellipsis with the full text
// available is design; a clipped box with no escape is a bug.
//
// Contract (option B, est-nm1g, identical to #47):
//   - GITHUB_ACTIONS=true or RUI_SKIP_CHROMIUM=1 or no binary  -> { skipped: reason }
//   - live lane (RUI_CHROME_BIN / harness pin)                  -> { clipped: [...] }
// Callers assert on the returned shape; the test never false-greens a live lane.
import { chromiumGate, launchChromium } from '../../tests/helpers/chromium.mjs'

export const CLIP_WIDTHS = [360, 720]

// The clip probe, evaluated inside the page. Every visible text element deeper than the
// root: overflow hidden must not swallow content; scrollWidth beyond the box is clip
// UNLESS the element (or an ancestor up to the card) exposes the same text via
// title/aria-label/data-ru-exact, or clips with ellipsis AND has that escape.
export const CLIP_PROBE = `(() => {
  const out = []
  const esc = el => el.hasAttribute('title') || el.hasAttribute('aria-label') || el.hasAttribute('data-ru-exact')
  const walk = document.createTreeWalker(document.body, 4)
  const seen = new Set()
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent.trim()) continue
    const el = n.parentElement
    if (!el || seen.has(el)) continue
    seen.add(el)
    const cs = getComputedStyle(el)
    if (cs.display === 'none' || cs.visibility === 'hidden') continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) continue
    const clips = cs.overflowX !== 'visible'
    if (!clips) continue
    if (el.scrollWidth <= Math.ceil(rect.width) + 1) continue
    const ellipsis = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none'
    const hasEscape = esc(el) || (el.parentElement && esc(el.parentElement))
    const lost = el.scrollWidth - Math.ceil(rect.width)
    if (ellipsis && hasEscape) continue
    out.push({ path: (() => { const p = []; let a = el; while (a && a !== document.body) { p.unshift(a.tagName.toLowerCase() + (a.getAttribute && a.getAttribute('data-ru') ? '[data-ru=' + a.getAttribute('data-ru') + ']' : '')); a = a.parentElement } return p.slice(-4).join('>') })(), text: (el.textContent || '').trim().slice(0, 60), lost })
  }
  return out
})()`

export async function clipCensus({ widths = CLIP_WIDTHS, harvest } = {}) {
  const gate = chromiumGate({ purpose: 'slice-16 clip pin' })
  if (!gate.ok) return { skipped: gate.reason, widths }
  if (typeof harvest !== 'function') return { skipped: 'no harvest function provided', widths }
  const launched = await launchChromium(gate.bin)
  try {
    const clipped = []
    for (const width of widths) {
      const { html, css } = await harvest(width)
      await launched.evalInPage(`document.head.innerHTML = '<style>${css.replace(/\n/g, '')}</style>'; document.body.innerHTML = ${JSON.stringify(html)}; void 0`)
      const hits = await launched.evalInPage(CLIP_PROBE)
      for (const h of hits) clipped.push({ width, ...h })
    }
    return { clipped, widths }
  } finally {
    await launched.close()
  }
}

// clipCensusSampleTypes: convenience for test_subset_gate — renders one component card per
// type through the jsdom harness, harvests the markup with the shipped token CSS inlined.
export async function harvestForClip(renderSpec, mount, types, SAMPLES, SOURCES) {
  const cards = []
  for (const type of types) {
    const props = { ...SAMPLES[type].req }
    const fix = SAMPLES[type].extras || {}
    const elements = { r: { type, props, children: props.children || props.tabs?.map(t => t.child) || [] } }
    for (const [id, [t, p]] of Object.entries(fix)) elements[id] = { type: t, props: p, children: [] }
    await renderSpec({ root: 'r', elements }, { data: {}, meta: { sources: SOURCES } })
    cards.push(mount.innerHTML)
  }
  return cards.join('\n')
}
