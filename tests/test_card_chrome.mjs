// Slice 7 (#30): card chrome — one frame per root, title once, honest header, nested ladder.
// jsdom via the shared harness (tests/helpers/render.mjs), like test_components.mjs.
import { test } from 'node:test'
import { React, act, registry, mount, assert } from './helpers/render.mjs'
import { createRoot } from 'react-dom/client'

const { CardBody } = await import('../desktop/src/card.mjs')
const { HOUSE, SURFACE } = await import('../desktop/src/components/_house.mjs')
const cardRoot = createRoot(mount)

const cardRecord = (components, meta, envelope = {}) => ({
  envelope: { card_id: 'ru-0123456789ab', policy: 'embedded', revision: 1, ...envelope },
  surface: { version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'hermes-rich-ui/1', components, dataModel: { meta }, metadata: {} } }
})
const renderCard = async record => { await act(async () => { cardRoot.render(React.createElement(CardBody, { record, registry })) }) }
const $$in = sel => [...mount.querySelectorAll(sel)]
const leafWith = t => $$in('*').find(el => el.children.length === 0 && el.textContent.trim() === t)

test('root frame: exactly ONE bordered section per card, surface + hairline + radius 6 + HOUSE padding 16 (M5/C15)', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'ACME status', children: ['m'] },
     { id: 'm', component: 'Metric', label: 'Uptime', value: 99.9 }],
    { title: 'ACME status', summary: 'How ACME is doing.', authored_at: '2026-09-29T05:20:20Z', dataset: { id: 'd', revision: 1, observed_at: null, published_at: null }, sources: [], derivations: [] }
  ))
  assert.equal($$in('[data-ru="Card"]').length, 1, 'exactly one Card frame')
  const frame = mount.querySelector('[data-ru="Card"]')
  assert.ok(frame, 'frame element present')
  const cs = getComputedStyle(frame)
  assert.equal(cs.paddingTop, SURFACE.card.padding + 'px', 'root frame padding === HOUSE card padding')
  assert.equal(cs.borderRadius, SURFACE.card.borderRadius + 'px', 'radius 6 (C15)')
  assert.equal(cs.borderTopWidth, '1px', 'hairline border')
  assert.equal(cs.borderTopStyle, 'solid')
  assert.ok(mount.querySelector('[data-ru-summary]'), 'summary renders above the body')
})

test('header shows the title ONCE at title 16/600; card body never repeats it (J4/S7)', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'ACME status', children: [] }],
    { title: 'ACME status', summary: 'How ACME is doing.', authored_at: '2026-09-29', dataset: { id: 'd', revision: 1, observed_at: null, published_at: null }, sources: [], derivations: [] }
  ))
  const titles = $$in('*').filter(el => el.children.length === 0
    && el.textContent.trim() === 'ACME status'
    && getComputedStyle(el).fontSize === '16px' && getComputedStyle(el).fontWeight === '600')
  assert.equal(titles.length, 1, 'exactly one title node at 16/600')
  assert.ok(mount.querySelector('[data-ru-header]')?.contains(titles[0]), 'it lives in the header')
})

test('honest header: no ISO/T..: on the face, no rev 1, no embedded badge; date via fmtDate (S7)', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'ACME status', children: [] }],
    { title: 'ACME status', authored_at: '2026-09-29T05:20:20Z', dataset: { id: 'd', revision: 1, observed_at: null, published_at: null }, sources: [], derivations: [] },
    { policy: 'embedded', revision: 1 }
  ))
  const header = mount.querySelector('[data-ru-header]').textContent
  assert.doesNotMatch(header, /T\d\d:|rev 1|embedded/)
  assert.ok(header.includes('Sep 29, 2026'), `authored_at renders 'Sep 29, 2026' — got: ${header}`)
})

test('honest header: rev prints ONLY when N>1; policy badge ONLY when != embedded', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'T', children: [] }],
    { title: 'T', authored_at: '2026-09-29', dataset: { id: 'd', revision: 3, observed_at: null, published_at: null }, sources: [], derivations: [] },
    { policy: 'capture', revision: 3 }
  ))
  const header = mount.querySelector('[data-ru-header]')
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
  assert.equal(cards.filter(el => getComputedStyle(el).borderTopWidth === '1px' && getComputedStyle(el).borderTopStyle === 'solid').length, 1, 'exactly one bordered section per showcase card')
  const t2 = leafWith('Middle')
  assert.ok(t2, 'depth-2 title renders')
  assert.equal(getComputedStyle(t2).fontSize, '13px', 'depth-2 title h3 13')
  assert.equal(getComputedStyle(t2).fontWeight, '600')
  assert.equal(t2.closest('[data-ru="Card"]').tagName, 'DIV', 'depth-2 Card is a flat section')
  const t3 = leafWith('Inner')
  assert.ok(t3, 'depth-3 title renders')
  assert.equal(getComputedStyle(t3).fontSize, '12px', 'depth-3 title h4 12')
  assert.equal(getComputedStyle(t3).fontWeight, '600')
  const s3 = t3.closest('[data-ru="Card"]')
  assert.equal(getComputedStyle(s3).borderTopWidth, '0px', 'depth-3: no border')
  assert.equal(getComputedStyle(s3).paddingTop, '0px', 'depth-3: no padding')
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
    const el = mount.querySelector(s)
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
  assert.equal(mount.querySelector('[data-ru-summary]'), null, 'casefold-equal summary hidden')
  assert.equal($$in('*').filter(el => el.children.length === 0 && el.textContent.trim().toLowerCase() === 'beta report').length, 1)
})

test('prose capped at HOUSE.MEASURE (S8): summary and Text faces carry the 72ch cap', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'Gamma', children: ['t'] },
     { id: 't', component: 'Text', text: 'a long line of prose that should not run past the measure' }],
    { title: 'Gamma', summary: 'a distinct summary that is clearly not the title', sources: [], derivations: [] }
  ))
  assert.equal(getComputedStyle(mount.querySelector('[data-ru-summary]')).maxWidth, HOUSE.MEASURE, 'summary capped at HOUSE.MEASURE')
  assert.equal(getComputedStyle(mount.querySelector('[data-ru="Text"]')).maxWidth, HOUSE.MEASURE, 'prose capped at HOUSE.MEASURE')
})

test('subtitle renders small text-secondary when distinct (S2)', async () => {
  await renderCard(cardRecord(
    [{ id: 'root', component: 'Card', title: 'Delta', subtitle: 'the distinct subtitle', children: [] }],
    { title: 'Delta', sources: [], derivations: [] }
  ))
  const sub = leafWith('the distinct subtitle')
  assert.ok(sub, 'subtitle renders')
  assert.equal(getComputedStyle(sub).fontSize, '12px', 'subtitle small')
})
