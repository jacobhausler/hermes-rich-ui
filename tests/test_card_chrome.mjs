// Slice 7 (#30): card chrome — one frame per root, title once, honest header, nested ladder.
// jsdom via the shared harness (tests/helpers/render.mjs), like test_components.mjs.
import { test } from 'node:test'
import { React, act, registry, assert } from './helpers/render.mjs'
import { createRoot } from 'react-dom/client'

const { CardBody } = await import('../desktop/src/card.mjs')
const { HOUSE, SURFACE } = await import('../desktop/src/components/_house.mjs')
// Own mount + root (like test_type_ladder.mjs) so we never fight the harness root for #r.
const cardMount = document.createElement('div')
document.body.append(cardMount)
const cardRoot = createRoot(cardMount)

const cardRecord = (components, meta, envelope = {}) => ({
  envelope: { card_id: 'ru-0123456789ab', policy: 'embedded', revision: 1, ...envelope },
  surface: { version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'hermes-rich-ui/1', components, dataModel: { meta }, metadata: {} } }
})
const renderCard = async record => { await act(async () => { cardRoot.render(React.createElement(CardBody, { record, registry })) }) }
const $$in = sel => [...cardMount.querySelectorAll(sel)]
const leafWith = t => $$in('*').find(el => el.children.length === 0 && el.textContent.trim() === t)

test('root frame: exactly ONE bordered section per card, surface + hairline + radius 6 + HOUSE padding 16 (M5/C15)', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'ACME status', children: ['m'] },
     { id: 'm', component: 'Metric', label: 'Uptime', value: 99.9 }],
    { title: 'ACME status', summary: 'How ACME is doing.', authored_at: '2026-09-29T05:20:20Z', dataset: { id: 'd', revision: 1, observed_at: null, published_at: null }, sources: [], derivations: [] }
  ))
  assert.equal($$in('[data-ru="Card"]').length, 1, 'exactly one Card frame')
  const frame = cardMount.querySelector('[data-ru="Card"]')
  assert.ok(frame, 'frame element present')
  assert.equal(frame.tagName, 'SECTION', 'the one frame is a bordered section')
  assert.equal(frame.style.paddingTop, SURFACE.card.padding + 'px', 'root frame padding === HOUSE card padding')
  assert.equal(frame.style.borderRadius, SURFACE.card.borderRadius + 'px', 'radius 6 (C15)')
  assert.match(frame.style.border, /^1px solid/, 'hairline border')
  assert.ok(cardMount.querySelector('[data-ru-summary]'), 'summary renders above the body')
})

test('header shows the title ONCE at title 16/600; card body never repeats it (J4/S7)', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'ACME status', children: [] }],
    { title: 'ACME status', summary: 'How ACME is doing.', authored_at: '2026-09-29', dataset: { id: 'd', revision: 1, observed_at: null, published_at: null }, sources: [], derivations: [] }
  ))
  const titles = $$in('*').filter(el => el.children.length === 0
    && el.textContent.trim() === 'ACME status'
    && el.style.fontSize === '16px' && el.style.fontWeight === '600')
  assert.equal(titles.length, 1, 'exactly one title node at 16/600')
  assert.ok(cardMount.querySelector('[data-ru-header]')?.contains(titles[0]), 'it lives in the header')
})

test('honest header: no ISO/T..: on the face, no rev 1, no embedded badge; date via fmtDate (S7)', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'ACME status', children: [] }],
    { title: 'ACME status', authored_at: '2026-09-29T05:20:20Z', dataset: { id: 'd', revision: 1, observed_at: null, published_at: null }, sources: [], derivations: [] },
    { policy: 'embedded', revision: 1 }
  ))
  const header = cardMount.querySelector('[data-ru-header]').textContent
  assert.doesNotMatch(header, /T\d\d:|rev 1|embedded/)
  assert.ok(header.includes('Sep 29, 2026'), `authored_at renders 'Sep 29, 2026' — got: ${header}`)
})

test('honest header: rev prints ONLY when N>1; policy badge ONLY when != embedded', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'T', children: [] }],
    { title: 'T', authored_at: '2026-09-29', dataset: { id: 'd', revision: 3, observed_at: null, published_at: null }, sources: [], derivations: [] },
    { policy: 'capture', revision: 3 }
  ))
  const header = cardMount.querySelector('[data-ru-header]')
  assert.ok(header.textContent.includes('rev 3'), 'rev 3 shows')
  assert.equal(header.querySelector('[data-ru-policy]').textContent, 'capture', 'non-embedded policy shows')
})

test('nested ladder: depth-2 Card is flat with h3 13/600 title; depth-3 has no surface/border/padding and h4 12/600 (C16)', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'Outer', children: ['c2'] },
     { id: 'c2', component: 'Card', title: 'Middle', children: ['c3'] },
     { id: 'c3', component: 'Card', title: 'Inner', children: [] }],
    { title: 'Outer', sources: [], derivations: [] }
  ))
  const cards = $$in('[data-ru="Card"]')
  assert.equal(cards.length, 3, 'three Card instances')
  assert.equal(cards.filter(el => /^1px solid/.test(el.style.border || '')).length, 1, 'exactly one bordered section per showcase card')
  const t2 = leafWith('Middle')
  assert.ok(t2, 'depth-2 title renders')
  assert.equal(t2.style.fontSize, '13px', 'depth-2 title h3 13')
  assert.equal(t2.style.fontWeight, '600')
  assert.equal(t2.tagName, 'H3', 'depth-2 title is an h3')
  assert.equal(t2.closest('[data-ru="Card"]').tagName, 'DIV', 'depth-2 Card is a flat section')
  const t3 = leafWith('Inner')
  assert.ok(t3, 'depth-3 title renders')
  assert.equal(t3.style.fontSize, '12px', 'depth-3 title h4 12')
  assert.equal(t3.style.fontWeight, '600')
  assert.equal(t3.tagName, 'H4', 'depth-3 title is an h4')
  const s3 = t3.closest('[data-ru="Card"]')
  assert.equal(s3.style.border, '', 'depth-3: no border')
  assert.equal(s3.style.padding, '', 'depth-3: no padding')
  assert.equal(s3.style.background, '', 'depth-3: no surface')
})

test('casefold-equal title/summary/subtitle render ONCE (S19/S2)', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'Alpha Report', subtitle: 'alpha report', children: [] }],
    { title: 'ALPHA REPORT', summary: 'alpha report', sources: [], derivations: [] }
  ))
  const hits = $$in('*').filter(el => el.children.length === 0 && el.textContent.trim().toLowerCase() === 'alpha report')
  assert.equal(hits.length, 1, `exact casefold duplicates render once — got ${hits.length}`)
})

test('census order: header -> body -> [data-ru-sources-slot] -> footer in document order', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'T', footer: 'Authored footer.', children: ['t'] },
     { id: 't', component: 'Text', text: 'body line' }],
    { title: 'T', sources: [{ id: 's1', kind: 'web', label: 'Example', url: 'https://example.com/' }], derivations: [] }
  ))
  const names = ['header', 'body', 'sources-slot', 'footer']
  const els = ['[data-ru-header]', '[data-ru-body]', '[data-ru-sources-slot]', '[data-ru-footer]'].map(s => {
    const el = cardMount.querySelector(s)
    assert.ok(el, `${s} present`)
    return el
  })
  for (let i = 1; i < els.length; i++) {
    assert.ok(els[i - 1].compareDocumentPosition(els[i]) & 4, `${names[i]} follows ${names[i - 1]}`)
  }
})

test('summary: hidden when casefold-equal to the title (S19)', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'Beta report', children: [] }],
    { title: 'Beta report', summary: 'beta REPORT', sources: [], derivations: [] }
  ))
  assert.equal(cardMount.querySelector('[data-ru-summary]'), null, 'casefold-equal summary hidden')
  assert.equal($$in('*').filter(el => el.children.length === 0 && el.textContent.trim().toLowerCase() === 'beta report').length, 1)
})

test('prose capped at HOUSE.MEASURE (S8): summary and Text faces carry the 72ch cap', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'Gamma', children: ['t'] },
     { id: 't', component: 'Text', text: 'a long line of prose that should not run past the measure' }],
    { title: 'Gamma', summary: 'a distinct summary that is clearly not the title', sources: [], derivations: [] }
  ))
  assert.equal(cardMount.querySelector('[data-ru-summary]').style.maxWidth, HOUSE.MEASURE, 'summary capped at HOUSE.MEASURE')
  assert.equal(cardMount.querySelector('[data-ru="Text"]').style.maxWidth, HOUSE.MEASURE, 'prose capped at HOUSE.MEASURE')
})

test('subtitle renders small text-secondary when distinct (S2)', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'Delta', subtitle: 'the distinct subtitle', children: [] }],
    { title: 'Delta', sources: [], derivations: [] }
  ))
  const sub = leafWith('the distinct subtitle')
  assert.ok(sub, 'subtitle renders')
  assert.equal(sub.style.fontSize, '12px', 'subtitle small')
})

// Review fix (#64 changes verdict, C16): suppression is gated on casefold-EQUALITY with the
// header title; a DISTINCT root Card title renders exactly once, inside the frame, as h2 14/600.
const META = { summary: 'x', authored_at: '2026-09-29', dataset: { id: 'd', revision: 1, observed_at: null, published_at: null }, sources: [], derivations: [] }
const frameTitle = t => [...cardMount.querySelectorAll('[data-ru="Card"] > header *')].filter(el => el.children.length === 0 && el.textContent.trim() === t)

test('distinct literal root Card title renders ONCE in the frame as h2 14/600 (C16)', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'Quarterly detail', children: [] }],
    { ...META, title: 'ACME status' }
  ))
  const hits = frameTitle('Quarterly detail')
  assert.equal(hits.length, 1, 'distinct root title rendered exactly once in the frame')
  assert.equal(hits[0].tagName, 'H2', 'distinct root title is an h2')
  assert.equal(hits[0].style.fontSize, '14px')
  assert.equal(hits[0].style.fontWeight, '600')
  assert.ok(cardMount.querySelector('[data-ru-header]').textContent.includes('ACME status'), 'header keeps meta.title')
})

test('distinct BOUND root Card title renders once; casefold-equal bound title stays suppressed (C16/S19)', async () => {
  const comps = [{ id: 'root', component: 'Card', title: { path: '/t' }, children: [] }]
  const rec = (t) => { const r = cardRecord(comps, { ...META, title: 'ACME status' }); r.surface.createSurface.dataModel.t = t; return r }
  await renderCard(rec('Bound detail'))
  assert.equal(frameTitle('Bound detail').length, 1, 'distinct bound title rendered once')
  await renderCard(rec('acme STATUS'))
  assert.equal(frameTitle('acme STATUS').length, 0, 'casefold-equal bound title is suppressed (header owns it)')
})

test('casefold-equal literal root title is suppressed — the header carries it once (J4/S7)', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'acme STATUS', children: [] }],
    { ...META, title: 'ACME status' }
  ))
  assert.equal(frameTitle('acme STATUS').length, 0)
})

test('S8: Card subtitle and footer carry the HOUSE.MEASURE cap', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'ACME status', subtitle: 'A distinct subtitle', footer: 'A footer line', children: [] }],
    { ...META, title: 'ACME status' }
  ))
  const sub = leafWith('A distinct subtitle')
  const foot = cardMount.querySelector('[data-ru-footer]')
  assert.ok(sub && foot, 'subtitle + footer render')
  assert.equal(sub.style.maxWidth, HOUSE.MEASURE, 'subtitle capped')
  assert.equal(foot.style.maxWidth, HOUSE.MEASURE, 'footer capped')
})

// ---- #31 (slice 8, G4/C17, M-G4; AD-16): the card cap ----
// Rule: scrollHeight <= CAP_WHOLE shows whole (no toggle, no fade, no cap). Overflow cuts at the
// LARGEST top-level child offsetTop inside [CUT_MIN=360, CUT_MAX=576], else CUT_MAX; a 32px fade
// sits at the cut; the toggle reads `Show all · N more` (N = children clipped by the cut) and
// exists ONLY when overflowing; the footer renders OUTSIDE the capped region.
// jsdom has no layout: scrollHeight/offsetTop/offsetHeight are stubbed off data-ru-* dataset
// keys, so the card must be rendered once, instrumented, then re-rendered to re-measure.
const protoStub = (proto, prop, read) => Object.defineProperty(proto, prop, { configurable: true, get() { return read(this) } })
protoStub(Element.prototype, 'scrollHeight', el => Number(el?.dataset?.ruScrollHeight ?? 0))
protoStub(HTMLElement.prototype, 'offsetTop', el => Number(el?.dataset?.ruOffsetTop ?? 0))
protoStub(HTMLElement.prototype, 'offsetHeight', el => Number(el?.dataset?.ruOffsetHeight ?? 0))

// one render + dataset instrumentation + re-render (fresh record identity forces re-measure)
const renderCapped = async (components, meta, geom) => {
  await renderCard(cardRecord(components, meta))
  const body = cardMount.querySelector('[data-ru-body]')
  const flow = body.querySelector('[data-ru-body-flow]')
  body.dataset.ruScrollHeight = String(geom.scrollHeight)
  const kids = [...(flow ? flow.children : body.children)]
  assert.equal(kids.length, geom.children.length, `instrumented ${kids.length} children, spec had ${geom.children.length}`)
  kids.forEach((k, i) => { k.dataset.ruOffsetTop = String(geom.children[i][0]); k.dataset.ruOffsetHeight = String(geom.children[i][1]) })
  await renderCard(cardRecord(components, meta))
  return cardMount.querySelector('[data-ru-body]')
}
const BLOCKS = (n) => Array.from({ length: n }, (_, i) => ({ id: 't' + i, component: 'Text', text: 'line ' + i }))
const BLOCK_IDS = (n) => Array.from({ length: n }, (_, i) => 't' + i)
const GEOM_META = { ...META, title: 'T' }

test('#31 short body (scrollHeight 400): whole — no toggle, no fade, no cap', async () => {
  const comps = [{ id: 'root', component: 'Card', title: 'T', children: BLOCK_IDS(3) }, ...BLOCKS(3)]
  const body = await renderCapped(comps, GEOM_META, { scrollHeight: 400, children: [[0, 130], [130, 130], [260, 130]] })
  assert.equal(body.getAttribute('data-ru-body'), 'whole')
  assert.equal(body.style.maxHeight, '', 'no max-height on a whole body')
  assert.equal(cardMount.querySelector('[data-ru-toggle]'), null, 'NO toggle when the body does not overflow')
  assert.equal(cardMount.querySelector('[data-ru-fade]'), null, 'no fade when whole')
})

test('#31 scrollHeight exactly CAP_WHOLE (600) is still whole', async () => {
  const comps = [{ id: 'root', component: 'Card', title: 'T', children: BLOCK_IDS(2) }, ...BLOCKS(2)]
  const body = await renderCapped(comps, GEOM_META, { scrollHeight: 600, children: [[0, 300], [300, 300]] })
  assert.equal(body.getAttribute('data-ru-body'), 'whole')
  assert.equal(cardMount.querySelector('[data-ru-toggle]'), null)
})

test('#31 overflow cuts at a child boundary in [360,576], fades, and toggles `Show all · N more`', async () => {
  const comps = [{ id: 'root', component: 'Card', title: 'T', children: BLOCK_IDS(5) }, ...BLOCKS(5)]
  const body = await renderCapped(comps, GEOM_META, { scrollHeight: 1400, children: [[0, 200], [200, 220], [420, 280], [700, 300], [1000, 400]] })
  assert.equal(body.getAttribute('data-ru-body'), 'capped')
  assert.equal(body.style.maxHeight, '420px', 'cut = largest child offsetTop inside [360, 576]')
  assert.equal(body.style.overflow, 'hidden')
  const fade = cardMount.querySelector('[data-ru-fade]')
  assert.ok(fade, 'fade renders at the cut')
  assert.equal(fade.style.height, '32px', 'fade height HOUSE.FADE = 32')
  const toggle = cardMount.querySelector('[data-ru-toggle]')
  assert.ok(toggle, 'toggle exists when overflowing')
  assert.equal(toggle.textContent, 'Show all · 3 more', 'N = top-level children clipped by the cut (420, 700, 1000)')
  await act(async () => { toggle.click() })
  const open = cardMount.querySelector('[data-ru-body]')
  assert.equal(open.getAttribute('data-ru-body'), 'expanded')
  assert.equal(open.style.maxHeight, 'none', 'expanded shows whole')
  assert.equal(cardMount.querySelector('[data-ru-fade]'), null, 'fade gone when expanded')
  assert.equal(cardMount.querySelector('[data-ru-toggle]').textContent, 'Show less')
})

test('#31 no child boundary inside [360,576]: the cut falls back to CUT_MAX (576)', async () => {
  const comps = [{ id: 'root', component: 'Card', title: 'T', children: ['t0'] }, { id: 't0', component: 'Text', text: 'one tall block' }]
  const body = await renderCapped(comps, GEOM_META, { scrollHeight: 1400, children: [[0, 1400]] })
  assert.equal(body.style.maxHeight, '576px', 'fallback cut = CUT_MAX')
})

test('#31 overflowing root Card: the footer renders OUTSIDE the capped body, after it', async () => {
  const comps = [{ id: 'root', component: 'Card', title: 'T', footer: 'Authored footer.', children: BLOCK_IDS(5) }, ...BLOCKS(5)]
  const body = await renderCapped(comps, GEOM_META, { scrollHeight: 1400, children: [[0, 200], [200, 220], [420, 280], [700, 300], [1000, 400]] })
  const foot = cardMount.querySelector('[data-ru-footer]')
  assert.ok(foot, 'footer renders')
  assert.equal(foot.textContent, 'Authored footer.')
  assert.ok(!body.contains(foot), 'footer is NOT inside the capped body node')
  assert.ok(body.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING, 'footer follows the body in document order')
  assert.equal(foot.style.maxWidth, HOUSE.MEASURE, 'hoisted footer keeps the HOUSE.MEASURE cap')
})

test('#31 nested Card keeps its own footer inside its own block (hoist is root-only)', async () => {
  const comps = [
    { id: 'root', component: 'Card', title: 'T', children: ['c2'] },
    { id: 'c2', component: 'Card', title: 'Inner', footer: 'nested footer', children: [] }
  ]
  await renderCard(cardRecord(comps, GEOM_META))
  const inner = [...cardMount.querySelectorAll('[data-ru="Card"]')].at(-1)
  const foot = inner.querySelector('[data-ru-footer]')
  assert.ok(foot, 'nested footer still renders in its own card')
  assert.equal(foot.textContent, 'nested footer')
})
