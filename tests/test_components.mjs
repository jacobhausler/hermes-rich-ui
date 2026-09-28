// Renders EVERY catalog type through the real json-render Renderer with a spec produced by lower()
// from tests/fixtures/surface-all-types.json. jsdom + react-dom/client + act (setup copied from
// tests/test_render_smoke.mjs). '@hermes/plugin-sdk' is mapped to tests/fixtures/sdk-stub.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'

registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })

const dom = new JSDOM('<div id="r"></div>', { pretendToBeVisual: true })
globalThis.window = dom.window; globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
// Integration: the registry now imports the real Chart (uPlot), which needs browser globals at
// import time and a canvas 2D context at mount. Same environment as tests/test_chart.mjs.
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
const { CardBody, UnknownType, InlineError, ID_RE } = await import('../desktop/src/card.mjs')
const { setOpenExternal } = await import('../desktop/src/components/sourcelist.mjs')

const fixture = JSON.parse(readFileSync(new URL('./fixtures/surface-all-types.json', import.meta.url), 'utf8'))
const TYPES = ['Card', 'Stack', 'Grid', 'Divider', 'Tabs', 'Accordion', 'Heading', 'Text', 'Callout', 'Badge', 'Metric', 'Progress', 'KeyValueList', 'Image', 'DataTable', 'Chart', 'Timeline', 'SourceList']

const mount = document.getElementById('r')
const root = createRoot(mount)
const $ = sel => mount.querySelector(sel)
const $$ = sel => [...mount.querySelectorAll(sel)]

async function renderSpec(spec, initialState) {
  await act(async () => {
    root.render(React.createElement(JSONUIProvider, { registry, initialState }, React.createElement(Renderer, { spec, registry, fallback: UnknownType })))
  })
}

test('every one of the 18 types renders its DOM marker through the real Renderer', async () => {
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  for (const t of TYPES) assert.ok($(`[data-ru="${t}"]`), `missing marker for ${t}`)
  assert.equal($$('[data-ru-unknown]').length, 0, 'no unknown types in fixture')
})

test('bindings resolve: Card title, Text body, Badge label', async () => {
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  assert.ok($('[data-ru="Card"]').textContent.includes('Fixture card'))
  assert.ok($('[data-ru="Text"]').textContent.includes('hello\nworld'))
  assert.equal($('[data-ru="Badge"] [data-slot="badge"]').textContent, 'ok')
  assert.equal($('[data-ru="Badge"] [data-slot="badge"]').getAttribute('data-variant'), 'success')
})

test('Metric: null -> "unavailable" (never 0); currency + percent formatting', async () => {
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  const metrics = $$('[data-ru="Metric"]')
  assert.equal(metrics.length, 3)
  const byLabel = Object.fromEntries(metrics.map(m => [m.textContent.startsWith('MEDIAN') || m.textContent.includes('Median') ? 'median' : m.textContent.includes('Share') ? 'share' : 'missing', m]))
  assert.equal(byLabel.median.querySelector('[data-ru-value]').getAttribute('data-ru-value'), '$1,234.50') // fixture pins precision: 2
  assert.equal(byLabel.share.querySelector('[data-ru-value]').getAttribute('data-ru-value'), '12.3%')
  assert.equal(byLabel.missing.querySelector('[data-ru-value]').getAttribute('data-ru-value'), 'unavailable')
  assert.ok(byLabel.missing.querySelector('[data-ru-null]'), 'null marker present')
  assert.ok(!byLabel.missing.textContent.includes('0'), 'no zero for null')
})

test('Progress: determinate with total, indeterminate when total null', async () => {
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  const bars = $$('[data-ru="Progress"]')
  assert.equal(bars.length, 2)
  assert.equal(bars[0].getAttribute('data-ru-indeterminate'), 'false')
  assert.equal(bars[0].getAttribute('aria-valuenow'), '3')
  assert.equal(bars[1].getAttribute('data-ru-indeterminate'), 'true')
})

test('Callout tone -> left border var; Divider label; Heading level + aria-label', async () => {
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  const co = $('[data-ru="Callout"]')
  assert.equal(co.getAttribute('data-ru-tone'), 'caution')
  assert.ok(co.style.borderLeft.includes('--ui-yellow'), co.style.borderLeft)
  assert.ok($('[data-ru="Divider"]').textContent.includes('details'))
  const h = $('[data-ru="Heading"]')
  assert.equal(h.tagName, 'H2')
  assert.equal(h.getAttribute('aria-label'), 'fixture heading')
})

test('Tabs: only active panel shown, click switches; Accordion honours open flag', async () => {
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  const tabs = $('[data-ru="Tabs"]')
  assert.equal(tabs.querySelectorAll('[role="tab"]').length, 2)
  assert.equal(tabs.querySelectorAll('[role="tab"]')[1].textContent, 'Two', 'tab title binding resolved')
  assert.ok(tabs.textContent.includes('tab one body'))
  assert.ok(!tabs.textContent.includes('tab two body'))
  await act(async () => { tabs.querySelectorAll('[role="tab"]')[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  assert.ok($('[data-ru="Tabs"]').textContent.includes('tab two body'))
  const acc = $('[data-ru="Accordion"]')
  assert.ok(acc.textContent.includes('accordion body A'))
  assert.ok(!acc.textContent.includes('accordion body B'))
  await act(async () => { acc.querySelectorAll('button')[1].dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  assert.ok($('[data-ru="Accordion"]').textContent.includes('accordion body B'))
})

test('KeyValueList: null value -> unavailable; item sourceIds superscript', async () => {
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  const kv = $('[data-ru="KeyValueList"]')
  assert.equal(kv.querySelectorAll('dt').length, 2)
  assert.ok(kv.querySelectorAll('dd')[1].querySelector('[data-ru-null]'))
  assert.equal(kv.querySelectorAll('dd')[0].querySelector('[data-ru-sources]').textContent, 'ⓘ 1')
})

test('Image: https only, alt/maxHeight/caption; non-https degrades to alt text', async () => {
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  const img = $('[data-ru="Image"] img')
  assert.equal(img.getAttribute('src'), 'https://example.com/x.png')
  assert.equal(img.getAttribute('alt'), 'example image')
  assert.equal(img.style.maxHeight, '200px')
  assert.equal($('[data-ru="Image"] figcaption').textContent, 'an example')
  const bad = lower({ components: [{ id: 'root', component: 'Image', src: 'http://example.com/x.png', alt: 'nope' }], dataModel: { data: {}, meta: {} } })
  await renderSpec(bad.spec, bad.initialState)
  assert.equal($('[data-ru="Image"] img'), null)
  assert.equal($('[data-ru-image-blocked]').getAttribute('data-ru-image-blocked'), 'scheme')
  assert.equal($('[data-ru-image-blocked]').textContent, 'nope — image blocked (https only)')
})

test('Image: a load error swaps the <img> for the alt box (no broken-image glyph)', async () => {
  const spec = lower({ components: [{ id: 'root', component: 'Image', src: 'https://example.com/404.png', alt: 'gone' }], dataModel: { data: {}, meta: {} } })
  await renderSpec(spec.spec, spec.initialState)
  const img = $('[data-ru="Image"] img')
  assert.ok(img)
  await act(async () => { img.dispatchEvent(new window.Event('error')) })
  assert.equal($('[data-ru="Image"] img'), null)
  assert.equal($('[data-ru-image-blocked]').getAttribute('data-ru-image-blocked'), 'unreachable')
  assert.equal($('[data-ru-image-blocked]').textContent, 'gone — image unavailable')
})

test('Timeline: status markers + item sources', async () => {
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  const li = $$('[data-ru="Timeline"] li')
  assert.equal(li.length, 2)
  assert.equal(li[0].getAttribute('data-ru-status'), 'done')
  assert.equal(li[0].querySelector('[data-ru-sources]').getAttribute('aria-label'), 'sources: Local computation')
  assert.equal(li[1].getAttribute('data-ru-status'), 'pending')
})

test('SourceList: reads /meta/sources via the registry wrapper; D4 link only when ctx.os.openExternal is wired', async () => {
  const { spec, initialState } = lower(fixture)
  // D4: no osOpen → NO anchor at all (Electron denies target=_blank; a dead link is worse than text).
  setOpenExternal(null)
  await renderSpec(spec, initialState)
  let sl = $('[data-ru="SourceList"]')
  assert.equal(sl.querySelectorAll('[data-ru-source]').length, 2)
  assert.equal(sl.querySelector('a'), null, 'no openExternal → no <a>')
  const span = sl.querySelector('[data-ru-source] [data-ru-url]')
  assert.equal(span.getAttribute('data-ru-url'), 'https://example.com/')
  assert.ok(span.textContent.includes('Example site') && span.textContent.includes('https://example.com/'), 'URL text shown as plain text')
  assert.equal(sl.querySelector('[data-slot="badge"]').textContent, 'web')
  // osOpen wired → anchor with href, no target=_blank, click routes through ctx.os.openExternal and is prevented.
  const opened = []
  setOpenExternal(u => { opened.push(u) })
  await act(async () => { root.render(null) })  // module-level osOpen is read at render → remount
  await renderSpec(spec, initialState)
  sl = $('[data-ru="SourceList"]')
  const a = sl.querySelector('a')
  assert.ok(a, 'openExternal wired → <a>')
  assert.equal(a.getAttribute('href'), 'https://example.com/')
  assert.equal(a.getAttribute('target'), null, 'D4: never target=_blank')
  assert.equal(a.getAttribute('rel'), 'noreferrer')
  assert.equal(a.textContent, 'Example site')
  const ev = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true })
  await act(async () => { a.dispatchEvent(ev) })
  assert.equal(ev.defaultPrevented, true, 'navigation prevented')
  assert.deepEqual(opened, ['https://example.com/'])
  assert.equal(sl.querySelectorAll('[data-ru-source]')[1].querySelector('a'), null, 'no url -> no link')
  setOpenExternal(null)
})

// D9 (sem F9 + sec P2-4): SourceList `sourceIds: []` → "No sources cited"; absent → all sources.
test('D9: SourceList sourceIds [] → "No sources cited"; absent → all; subset → subset', async () => {
  const mk = (extra) => ({ ...fixture, components: [{ id: 'root', component: 'Card', title: 'T', children: ['s'] }, { id: 's', component: 'SourceList', title: 'Sources', ...extra }] })
  let r = lower(mk({ sourceIds: [] }))
  await renderSpec(r.spec, r.initialState)
  let sl = $('[data-ru="SourceList"]')
  assert.equal(sl.querySelectorAll('[data-ru-source]').length, 0)
  assert.equal(sl.querySelector('[data-ru-empty]').textContent, 'No sources cited')
  assert.equal(sl.querySelector('[data-ru-empty]').getAttribute('data-ru-empty'), 'cited')
  r = lower(mk({}))
  await renderSpec(r.spec, r.initialState)
  sl = $('[data-ru="SourceList"]')
  assert.equal(sl.querySelectorAll('[data-ru-source]').length, 2, 'absent → all of /meta/sources')
  assert.equal(sl.querySelector('[data-ru-empty]'), null)
  r = lower(mk({ sourceIds: ['s2'] }))
  await renderSpec(r.spec, r.initialState)
  sl = $('[data-ru="SourceList"]')
  assert.equal(sl.querySelectorAll('[data-ru-source]').length, 1)
  assert.equal(sl.querySelector('[data-ru-source]').getAttribute('data-ru-source'), 's2')
  // D10: li keys are id:index — duplicate ids do not collide (no React duplicate-key warning)
  const origErr = console.error; const errs = []
  console.error = (...a) => { errs.push(a.map(String).join(' ')) }
  try {
    const dup = mk({})
    dup.dataModel = { ...fixture.dataModel, meta: { ...fixture.dataModel.meta, sources: [{ id: 'x', kind: 'web', label: 'one' }, { id: 'x', kind: 'web', label: 'two' }] } }
    r = lower(dup)
    await renderSpec(r.spec, r.initialState)
    assert.equal($('[data-ru="SourceList"]').querySelectorAll('[data-ru-source]').length, 2)
    assert.ok(!errs.some(e => /same key/i.test(e)), 'no duplicate-key warning: ' + errs.join(' | '))
  } finally { console.error = origErr }
})

test('component sourceIds -> superscript "ⓘ n" with labels tip', async () => {
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  const sup = $('[data-ru="Text"] [data-ru-sources]')
  assert.equal(sup.textContent, 'ⓘ 2')
  assert.equal(sup.getAttribute('aria-label'), 'sources: Example site, Local computation')
  assert.equal($('[data-ru="Card"] > header [data-ru-sources]').textContent, 'ⓘ 1')
})

// D2 (desk P1-1 / sem F3) + D8 (sem F6): DataTable and Chart honour the common envelope —
// accessibility.label → aria-label and component-level sourceIds → evidence superscript —
// through the real Renderer + registry (so props._sources injection is exercised).
test('D2/D8: DataTable + Chart aria-label from accessibility.label; sourceIds superscript', async () => {
  const cs = {
    ...fixture,
    components: [
      { id: 'root', component: 'Card', title: 'T', children: ['t', 'c'] },
      { id: 't', component: 'DataTable', title: 'Tbl', accessibility: { label: 'A11Y TABLE' }, sourceIds: ['s1'],
        columns: [{ key: 'src', label: 'E', type: 'sources' }, { key: 'a', label: 'A', type: 'text' }], rows: [{ a: 'x', src: ['s1'] }] },
      { id: 'c', component: 'Chart', title: 'Ch', accessibility: { label: 'A11Y CHART' }, sourceIds: ['s1', 's2'],
        kind: 'bar', series: [{ label: 'a', data: [{ label: 'q', value: 1 }] }] }
    ],
    dataModel: { data: {}, meta: { sources: [{ id: 's1', kind: 'web', label: 'Example site' }, { id: 's2', kind: 'derived', label: 'Local computation' }] } }
  }
  const { spec, initialState } = lower(cs)
  assert.equal(spec.elements.t.accessibility, undefined, 'lower() keeps accessibility INSIDE props')
  await renderSpec(spec, initialState)
  const table = $('[data-ru="DataTable"]'); const chart = $('[data-ru="Chart"]')
  assert.equal(table.getAttribute('aria-label'), 'A11Y TABLE')
  assert.equal(chart.getAttribute('aria-label'), 'A11Y CHART')
  assert.equal(table.querySelector('[data-ru-sources]').textContent, 'ⓘ 1')
  assert.equal(table.querySelector('[data-ru-sources]').getAttribute('aria-label'), 'sources: Example site')
  assert.equal(chart.querySelector('[data-ru-sources]').textContent, 'ⓘ 2')
  assert.equal(chart.querySelector('[data-ru-sources]').getAttribute('aria-label'), 'sources: Example site, Local computation')
  // row-level sources column still reads under the declared key
  assert.deepEqual([...table.querySelectorAll('[data-source-id]')].map(b => b.getAttribute('data-source-id')), ['s1'])
})

test('D2/D8: without accessibility.label, aria-label falls back to title; no sourceIds → no superscript', async () => {
  const cs = {
    ...fixture,
    components: [
      { id: 'root', component: 'Card', title: 'T', children: ['t', 'c'] },
      { id: 't', component: 'DataTable', title: 'Tbl', columns: [{ key: 'a', label: 'A', type: 'text' }], rows: [{ a: 'x' }] },
      { id: 'c', component: 'Chart', title: 'Ch', kind: 'bar', series: [{ label: 'a', data: [{ label: 'q', value: 1 }] }] }
    ]
  }
  const { spec, initialState } = lower(cs)
  await renderSpec(spec, initialState)
  assert.equal($('[data-ru="DataTable"]').getAttribute('aria-label'), 'Tbl')
  assert.equal($('[data-ru="Chart"]').getAttribute('aria-label'), 'Ch')
  assert.equal($('[data-ru="DataTable"] [data-ru-sources]'), null)
  assert.equal($('[data-ru="Chart"] [data-ru-sources]'), null)
})

// D5 (desk P2-2): register() performs NO network call — no unconditional ctx.rest('/health') probe.
test('D5: plugin register() makes zero REST calls and wires ctx.os.openExternal + the directive area', async () => {
  const plugin = (await import('../desktop/src/index.mjs')).default
  const calls = { rest: [], register: [] }
  const ctx = {
    rest: (path, opts) => { calls.rest.push(path); return Promise.resolve({}) },
    register: (r) => { calls.register.push(r) },
    os: { openExternal: (u) => { calls.open = u } }
  }
  plugin.register(ctx)
  await new Promise(r => setTimeout(r, 0))
  assert.deepEqual(calls.rest, [], 'no REST call at register time')
  assert.equal(calls.register.length, 1)
  assert.equal(calls.register[0].area, 'transcript.directives')
  assert.equal(calls.register[0].data.name, 'richui')
  const { openExternal } = await import('../desktop/src/components/sourcelist.mjs')
  assert.equal(openExternal('https://x.example/'), true)
  assert.equal(calls.open, 'https://x.example/')
  setOpenExternal(null)
})

// D6 (desk P2-3): SDK component prop contracts, verified by reading the real sources on 2026-09-25
// (paths relative to a hermes-agent checkout):
//   apps/desktop/src/components/ui/badge.tsx   (cva: variant/size lists)
//   apps/desktop/src/components/ui/tooltip.tsx (Tip { label, children })
//   apps/desktop/src/components/ui/skeleton.tsx (ComponentProps<'div'>)
//   apps/desktop/src/sdk/index.ts:1684,1749,1753 (re-exports)
// The lists below are the pinned fact; if the app changes them, this test is the place that goes red.
test('D6: every Badge variant/size we emit is in the real cva list; Tip gets label; Skeleton gets style', async () => {
  const REAL_VARIANTS = ['default', 'muted', 'success', 'warn', 'destructive', 'outline', 'solid']
  const REAL_SIZES = ['default', 'xs', 'overlay']
  const { BADGE_VARIANT, BADGE_VARIANTS_REAL, BADGE_SIZES_REAL } = await import('../desktop/src/components/_shared.mjs')
  const { POLICY_TONE } = await import('../desktop/src/card.mjs')
  assert.deepEqual(BADGE_VARIANTS_REAL, REAL_VARIANTS)
  assert.deepEqual(BADGE_SIZES_REAL, REAL_SIZES)
  for (const [tone, v] of Object.entries(BADGE_VARIANT)) assert.ok(REAL_VARIANTS.includes(v), `tone ${tone} → unknown Badge variant ${v}`)
  for (const [pol, v] of Object.entries(POLICY_TONE)) assert.ok(REAL_VARIANTS.includes(v), `policy ${pol} → unknown Badge variant ${v}`)
  // Rendered output: every Badge in the all-types fixture carries a real variant and size xs.
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  const badges = $$('[data-slot="badge"]')
  assert.ok(badges.length >= 3, 'fixture renders badges')
  for (const b of badges) {
    assert.ok(REAL_VARIANTS.includes(b.getAttribute('data-variant')), `rendered variant ${b.getAttribute('data-variant')}`)
    assert.ok(REAL_SIZES.includes(b.getAttribute('data-size')), `rendered size ${b.getAttribute('data-size')}`)
  }
  // Tip: our superscript passes `label` (a ReactNode) — the stub records it; real Tip requires exactly this prop.
  assert.ok($('[data-slot="tip"] [data-ru-sources]'), 'sourceSup wrapped in Tip with label')
  // Skeleton: card.mjs passes style + data-ru-loading, both legal on ComponentProps<'div'>.
  const { RichCard } = await import('../desktop/src/index.mjs')
  await act(async () => { root.render(React.createElement(RichCard, { id: 'ru-0123456789ab' })) })
  const sk = $('[data-slot="skeleton"]')
  assert.ok(sk, 'Skeleton rendered while pending')
  assert.equal(sk.getAttribute('data-ru-loading'), '')
  assert.equal(sk.style.height, '72px')
})

test('unknown type -> fallback "unsupported component: <type>"', async () => {
  await renderSpec({ root: 'root', elements: { root: { type: 'Button', props: {}, children: [] } } }, { data: {}, meta: {} })
  assert.equal($('[data-ru-unknown]').textContent, 'unsupported component: Button')
})

test('CardBody: summary above body, header (title/authored/rev/policy), 480px cap + Show more toggle', async () => {
  const record = { envelope: { card_id: 'ru-0123456789ab', policy: 'embedded', revision: 1 }, surface: { version: 'v1.0', createSurface: fixture } }
  await act(async () => { root.render(React.createElement(CardBody, { record, registry })) })
  const card = $('[data-ru-card]')
  assert.equal($('[data-ru-summary]').textContent, 'Plain-text summary of the fixture.')
  assert.ok(card.textContent.indexOf('Plain-text summary') < card.textContent.indexOf('Fixture heading'), 'summary precedes body')
  const header = $('[data-ru-header]')
  assert.ok(header.textContent.includes('Fixture card'))
  assert.ok(header.textContent.includes('2026-09-25T10:11:12Z'))
  assert.ok(header.textContent.includes('rev 1'))
  assert.equal(header.querySelector('[data-ru-policy]').textContent, 'embedded')
  const body = $('[data-ru-body]')
  assert.equal(body.getAttribute('data-ru-body'), 'capped')
  assert.equal(body.style.maxHeight, '480px')
  assert.equal(body.style.overflow, 'hidden')
  assert.equal($('[data-ru-toggle]').textContent, 'Show more')
  await act(async () => { $('[data-ru-toggle]').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })) })
  assert.equal($('[data-ru-body]').getAttribute('data-ru-body'), 'expanded')
  assert.equal($('[data-ru-body]').style.maxHeight, 'none')
  assert.equal($('[data-ru-toggle]').textContent, 'Show less')
})

test('CardBody: unlowerable surface shows reasons instead of a body; summary still shown', async () => {
  const cs = { ...fixture, components: fixture.components.filter(c => c.id !== 'root') }
  const record = { envelope: { card_id: 'ru-0123456789ab', policy: 'embedded' }, surface: { version: 'v1.0', createSurface: cs } }
  await act(async () => { root.render(React.createElement(CardBody, { record, registry })) })
  assert.ok($('[data-ru-unlowerable]').textContent.includes('missing root component'))
  assert.equal($('[data-ru-body]'), null)
  assert.ok($('[data-ru-summary]'))
})

test('error boundary: a throwing component degrades, never kills the card or the summary', async () => {
  const { CardBoundary } = await import('../desktop/src/card.mjs')
  const origErr = console.error; console.error = () => {}
  try {
    // 1) The Renderer's own per-element boundary swallows a throw inside one component (json-render
    //    ElementErrorBoundary renders null) — siblings and the Card shell survive.
    const boom = { ...registry, Text: () => { throw new Error('kaboom') } }
    const cs = { ...fixture, components: [{ id: 'root', component: 'Card', title: 'T', children: ['t', 'h'] }, { id: 't', component: 'Text', text: 'x' }, { id: 'h', component: 'Heading', text: 'still here' }] }
    const record = { envelope: { card_id: 'ru-0123456789ab', policy: 'embedded' }, surface: { version: 'v1.0', createSurface: cs } }
    await act(async () => { root.render(React.createElement(CardBody, { record, registry: boom })) })
    assert.ok($('[data-ru-summary]'), 'summary survives the throw')
    assert.ok($('[data-ru="Card"]'), 'card shell survives')
    assert.ok($('[data-ru="Heading"]').textContent.includes('still here'), 'sibling survives')
    assert.equal($('[data-ru="Text"]'), null, 'throwing element dropped')
    // 2) Our CardBoundary catches anything the Renderer boundary does not (e.g. a throw in the
    //    provider/Renderer itself) and shows the inline error with the fallback text.
    const Boom = () => { throw new Error('outer kaboom') }
    await act(async () => { root.render(React.createElement(CardBoundary, null, React.createElement(Boom))) })
    assert.ok($('[data-ru-error]'), 'inline error rendered')
    assert.ok($('[data-ru-error]').textContent.includes('card unavailable'))
    assert.ok($('[data-ru-error]').textContent.includes('outer kaboom'))
  } finally { console.error = origErr }
})

test('id validation regex + InlineError fallback text', async () => {
  assert.ok(ID_RE.test('ru-0123456789ab'))
  assert.ok(!ID_RE.test('ru-0123456789AB'))
  assert.ok(!ID_RE.test('ru-0123456789abc'))
  assert.ok(!ID_RE.test('../etc'))
  await act(async () => { root.render(React.createElement(InlineError, { message: 'boom' })) })
  assert.ok($('[data-ru-error]').textContent.includes('card unavailable'))
  assert.ok($('[data-ru-error]').textContent.includes('boom'))
})

// C1 polish: the card lives inside the app's `.prose` markdown block. Measured 2026-09-25: prose gave
// table margin 24px, li margin 6px + a decimal marker, dt/dd margins, line-height 20.57px. The reset
// is one hoisted <style>, every selector scoped under [data-ru-card].
test('prose reset: hoisted once, every rule scoped to [data-ru-card]', async () => {
  const { PROSE_RESET_CSS, PROSE_RESET_HREF } = await import('../desktop/src/card.mjs')
  const rules = PROSE_RESET_CSS.split('}').filter(Boolean)
  assert.ok(rules.length >= 4)
  for (const r of rules) assert.ok(r.startsWith('[data-ru-card]'), 'unscoped rule: ' + r)
  assert.match(PROSE_RESET_CSS, /table[^{]*\{margin:0/)
  assert.match(PROSE_RESET_CSS, /li::marker\{content:none\}/)
  assert.match(PROSE_RESET_HREF, /^hermes-rich-ui\/prose-reset\/\d+$/)
})

test('Stack horizontal: column gap floor 20px so uppercase Metric labels never touch', async () => {
  const s = lower({ components: [
    { id: 'root', component: 'Stack', direction: 'horizontal', gap: 'sm', children: ['a', 'b'] },
    { id: 'a', component: 'Metric', label: 'A', value: 1 }, { id: 'b', component: 'Metric', label: 'B', value: 2 }
  ], dataModel: { data: {}, meta: {} } })
  await renderSpec(s.spec, s.initialState)
  const st = $('[data-ru="Stack"]')
  assert.equal(st.style.columnGap, '20px')
  assert.equal(st.style.rowGap, '4px')
  assert.equal($('[data-ru="Metric"]').style.paddingRight, '16px')
})

test('SourceList: flush-left list, no marker indent', async () => {
  const { spec, initialState } = lower(fixture)
  await renderSpec(spec, initialState)
  const ol = $('[data-ru="SourceList"] ol')
  assert.equal(ol.style.paddingLeft, '0px')
  assert.equal(ol.style.listStyle, 'none')
})


test('formatMetric currency: whole dollars at >= 1000 without precision, cents below, precision wins', async () => {
  const { formatMetric } = await import('../desktop/src/components/_shared.mjs')
  assert.equal(formatMetric(18234500, { format: 'currency' }), '$18,234,500')
  assert.equal(formatMetric(14.7312, { format: 'currency' }), '$14.73')
  assert.equal(formatMetric(999.5, { format: 'currency' }), '$999.50')
  assert.equal(formatMetric(1234.5, { format: 'currency', precision: 2 }), '$1,234.50')
  assert.equal(formatMetric(-2500, { format: 'currency' }), '-$2,500')
})
