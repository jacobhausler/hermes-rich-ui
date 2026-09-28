// L8 wave B1 (MANIFEST-L3 §5): the deferred-to-L8 asserts — full registry (26 types
// from desktop/src/components/index.mjs) + the real Renderer render the extended
// tests/fixtures/surface-all-types.json end-to-end; every type's DOM marker present;
// deterministic double-render (byte-identical innerHTML); admission round-trip: the
// extended fixture AND every tests/fixtures/expansion-*.json pass engine admission
// (engine/admission.admit via python3), and the NORMALIZED components re-admit cleanly.
// Environment setup mirrors tests/test_components.mjs (uPlot canvas stubs for Sparkline).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { JSDOM } from 'jsdom'

registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })

const here = path.dirname(fileURLToPath(import.meta.url))

const dom = new JSDOM('<div id="r"></div>', { pretendToBeVisual: true })
globalThis.window = dom.window; globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
// Sparkline (like Chart) drives uPlot: browser globals at import time + a canvas 2D
// context at mount. Same swallow-stub environment as tests/test_components.mjs.
globalThis.devicePixelRatio = 1
for (const k of ['CustomEvent', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }) } catch { /* readonly */ }
}
const mm = () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
globalThis.matchMedia = mm; dom.window.matchMedia = mm
const swallow = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : swallow),
  apply: () => swallow, set: () => true
})
dom.window.HTMLCanvasElement.prototype.getContext = () => swallow
globalThis.Path2D = class Path2D { moveTo() {} lineTo() {} rect() {} arc() {} closePath() {} addPath() {} }
globalThis.ResizeObserver = class { observe() {} disconnect() {} }

const React = (await import('react')).default
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { JSONUIProvider, Renderer } = await import('@json-render/react')
const { lower } = await import('../desktop/src/lower.mjs')
const { registry } = await import('../desktop/src/index.mjs')
const { components } = await import('../desktop/src/components/index.mjs')
const { UnknownType } = await import('../desktop/src/card.mjs')
const { setOpenExternal } = await import('../desktop/src/components/sourcelist.mjs')

const ALL_26 = ['Card', 'Stack', 'Grid', 'Divider', 'Tabs', 'Accordion', 'Heading', 'Text', 'Callout', 'Badge', 'Metric', 'Progress', 'KeyValueList', 'Image', 'DataTable', 'Chart', 'Timeline', 'SourceList', 'CodeBlock', 'Checklist', 'ChipSet', 'AsOf', 'ImageGallery', 'Sparkline', 'BarList', 'HeatMap']

const fixture = JSON.parse(readFileSync(path.join(here, 'fixtures', 'surface-all-types.json'), 'utf8'))
const expansionFixtures = readdirSync(path.join(here, 'fixtures'))
  .filter(f => f.startsWith('expansion-') && f.endsWith('.json'))
  .sort()
  .map(f => [f, JSON.parse(readFileSync(path.join(here, 'fixtures', f), 'utf8'))])

const mount = document.getElementById('r')
const $ = sel => mount.querySelector(sel)
const $$ = sel => [...mount.querySelectorAll(sel)]

async function renderSpec(spec, initialState) {
  // Unmount first: React reconciles the same JSONUIProvider/Renderer tree across
  // calls and would carry local state (e.g. Tabs useState) from the previous spec.
  await act(async () => { root.render(null) })
  await act(async () => {
    root.render(React.createElement(JSONUIProvider, { registry, initialState }, React.createElement(Renderer, { spec, registry, fallback: UnknownType })))
  })
}
const root = createRoot(mount)

// 1. Full registry: all 26 component implementations registered; every fixture
//    element type resolves in the registry the real Renderer consumes.
test('registry: all 26 components registered, real Renderer consumes them', async () => {
  assert.deepEqual(Object.keys(components).sort(), [...ALL_26].sort())
  assert.deepEqual(Object.keys(registry).sort(), [...ALL_26].sort())
  const { spec } = lower(fixture)
  for (const [id, el] of Object.entries(spec.elements)) {
    assert.ok(registry[el.type], `${id}: element type ${el.type} missing from the registry`)
  }
})

// 2. End-to-end render of the extended fixture: marker for every one of the 26 types.
test('extended surface-all-types renders the marker for all 26 types', async () => {
  setOpenExternal(null)
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  for (const t of ALL_26) assert.ok($(`[data-ru="${t}"]`), `missing marker for ${t}`)
  assert.equal($$('[data-ru-unknown]').length, 0, 'no unknown types in fixture')
})

// 3. Per-type DOM markers for the 8 new components (markers read from
//    desktop/src/components/{codeblock,checklist,chipset,asof,gallery,sparkline,barlist,heatmap}.mjs).
test('new-type markers: CodeBlock, Checklist, ChipSet, AsOf, ImageGallery, Sparkline, BarList, HeatMap', async () => {
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)

  const cb = $('[data-ru="CodeBlock"]')
  assert.equal(cb.querySelector('[data-ru-caption]').textContent, 'verbatim stdout')
  assert.equal(cb.querySelector('[data-ru-lang]').textContent, 'python')
  assert.equal(cb.querySelector('[data-ru-lines]').getAttribute('data-ru-lines'), '3')
  assert.equal(cb.querySelectorAll('[data-ru-line]').length, 3)

  const ck = $('[data-ru="Checklist"]')
  assert.equal(ck.getAttribute('data-ru-tally'), '1/3')
  assert.deepEqual([...ck.querySelectorAll('li')].map(li => li.getAttribute('data-ru-state')), ['done', 'unchecked', 'unknown'])

  const cs = $('[data-ru="ChipSet"]')
  assert.equal(cs.getAttribute('data-ru-count'), '3')
  assert.equal(cs.querySelectorAll('[data-slot="badge"]').length, 3)
  assert.equal(cs.querySelectorAll('[data-ru-chip]').length, 3)

  const asof = $('[data-ru="AsOf"]')
  assert.equal(asof.getAttribute('data-ru-fields'), '2')
  assert.ok(asof.textContent.includes('Observed 2026-09-26T10:00:00Z · Published 2026-09-01'), asof.textContent)

  const gal = $('[data-ru="ImageGallery"]')
  assert.equal(gal.getAttribute('data-ru-count'), '2')
  assert.equal(gal.querySelectorAll('[data-ru-tile]').length, 2)

  const sp = $('[data-ru="Sparkline"]')
  assert.equal(sp.getAttribute('data-ru-points'), '5')
  assert.equal(sp.getAttribute('data-ru-trend'), 'up')
  assert.equal(sp.getAttribute('data-ru-direction'), 'bar')

  const bl = $('[data-ru="BarList"]')
  assert.equal(bl.getAttribute('data-ru-count'), '2')
  assert.equal(bl.getAttribute('data-ru-sort'), 'desc')
  const items = bl.querySelectorAll('[data-ru-item]')
  assert.equal(items.length, 3)
  assert.deepEqual([...items].map(i => i.getAttribute('data-ru-item')), ['ok', 'ok', 'unavailable'], 'null sinks last, never 0')

  const hm = $('[data-ru="HeatMap"]')
  assert.equal(hm.getAttribute('data-ru-cells'), '5')
  // 3x3 grid: 6 declared cells (1 null) + 3 missing pairs -> 4 hatched unavailable, never a guessed color.
  assert.equal(hm.querySelectorAll('[data-ru-cell="unavailable"]').length, 4)
  assert.ok(hm.textContent.includes('observed'), 'caption prints observed min/max')

  // E-pack enums carried by the fixture: Badge tone=error -> destructive variant,
  // Card footer, Divider vertical orientation.
  assert.ok($('[data-ru="Badge"] [data-variant="destructive"]'), 'error-tone Badge renders destructive')
  assert.ok($('[data-ru="Card"] [data-ru-footer]'), 'Card footer renders')
  assert.equal($('[data-ru="Divider"][data-ru-orientation="vertical"]') !== null, true, 'vertical Divider renders')
})

// 4. Deterministic double-render: rendering the same surface twice yields byte-identical DOM.
test('deterministic double-render of the extended fixture', async () => {
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  const a = mount.innerHTML
  await act(async () => { root.render(null) })
  await renderSpec(spec, initialState)
  assert.equal(mount.innerHTML, a, 're-render is byte-identical')
})

// 5. Admission round-trip: the extended surface-all-types fixture AND every
//    expansion-*.json pass engine admission, and the normalized components (defaults
//    applied) re-admit cleanly. tests/test_fixtures_admit.py discovers the same files.
test('engine admission accepts the extended fixture and normalized output re-admits', () => {
  const py = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(here, '..'))})
from engine.admission import admit
out = {}
for rel in json.loads(sys.argv[1]):
    obj = json.load(open(rel, encoding='utf-8'))
    cs = obj.get('createSurface', obj)
    errors, normalized = admit(cs['components'], cs['dataModel'])
    rt_errors, _ = admit(normalized, cs['dataModel'])
    out[rel] = {'errors': errors, 'roundTripErrors': rt_errors}
print(json.dumps(out))
`
  const files = [
    path.join(here, 'fixtures', 'surface-all-types.json'),
    ...expansionFixtures.map(([f]) => path.join(here, 'fixtures', f))
  ]
  const run = spawnSync('python3', ['-c', py, JSON.stringify(files)], { encoding: 'utf8' })
  assert.equal(run.status, 0, 'python3 admission probe failed: ' + run.stderr)
  const results = JSON.parse(run.stdout)
  for (const [rel, { errors, roundTripErrors }] of Object.entries(results)) {
    assert.deepEqual(errors, [], `${path.basename(rel)} must admit: ${JSON.stringify(errors.slice(0, 5))}`)
    assert.deepEqual(roundTripErrors, [], `${path.basename(rel)} normalized re-admission must be clean: ${JSON.stringify(roundTripErrors.slice(0, 5))}`)
  }
})

// 6. E-pack props render through the real Renderer (expansion-epack.json): failed
//    Timeline status, renderer-computed Metric delta, Tabs defaultTab seed, Card
//    footer binding, DataTable bar column + mono Text variant.
test('e-pack props render: failed status, delta, defaultTab, footer, bar column', async () => {
  setOpenExternal(null)
  const ep = expansionFixtures.find(([f]) => f === 'expansion-epack.json')
  assert.ok(ep, 'expansion-epack.json present')
  const { spec, initialState } = lower(ep[1])
  await renderSpec(spec, initialState)
  const tl = $('[data-ru="Timeline"]')
  assert.equal(tl.querySelector('li').getAttribute('data-ru-status'), 'failed', 'failed status renders')
  assert.equal(tl.querySelectorAll('li')[1].getAttribute('data-ru-status'), 'unclassified', 'absent status renders neutral unclassified, never an invented pending')
  const m = $('[data-ru="Metric"]')
  assert.equal(m.getAttribute('data-ru-delta'), 'up')
  // invertTone: costs up is red (lower-is-better).
  assert.ok(m.querySelector('[data-ru-delta-line="up"]').style.color.includes('red'), m.querySelector('[data-ru-delta-line="up"]').style.color)
  assert.equal($('[data-ru="Tabs"]').getAttribute('data-ru-default-tab'), '1')
  assert.ok($('[data-ru="Tabs"]').textContent.includes('panel B'), 'defaultTab 1 shows the second panel')
  assert.ok(!$('[data-ru="Tabs"]').textContent.includes('panel A'))
  assert.ok($('[data-ru="Card"] [data-ru-footer]').textContent.includes('E-pack footer binding.'), 'footer binding resolves')
  const tb = $('[data-ru="DataTable"]')
  assert.ok(tb, 'bar-column table renders')
  assert.ok(tb.querySelectorAll('th').length >= 2, 'bar + text headers render')
  const mono = $('[data-ru="Text"][data-ru-variant="mono"]')
  assert.ok(mono && mono.textContent.includes('panel B'), 'Text variant=mono marker renders')
})
