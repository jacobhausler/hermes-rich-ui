// #36 (defaults epic slice 13): the evidence primitives, exactly per the issue's
// failing-first test. The c69f fixture (tests/fixtures/saved/ru-c69fc582e9a9.json,
// meta.sources = [rel, pr16]) is the repro card. Commit 1 of feat/defaults-evidence-36
// adds ONLY this file (CI RED); commit 2 implements in desktop/src/.
//
// Pins (DEFAULTS-SPEC slice 13, supersedes #17/#18):
//  - every citation marker is citeMarker placed by withCite: last inline child of the
//    head row, else a flex sibling of the body; markers `1`, `2` share the head-row line
//    box with the title for Checklist, BarList and HeatMap (the #17 repro); no ⓘ anywhere.
//  - Checklist done:null -> non-empty dashed `?` StatusMark SVG, aria-label `unknown`,
//    greyscale-distinct from done / not-done (the #18 repro).
//  - a 23:30-05:00 Timeline event reads Sep 28 for a Chicago viewer (fmtDate, viewer zone),
//    on the `12px max-content 1fr` grid whenever any date exists.
//  - SourceList rows `n · label link · host · kind · accessed <date>`, never a raw URL
//    label; `[]` -> `No sources cited`.
//  - AsOf all absent -> `No timestamps published`.
//  - sources exist and none is authored -> automatic numbered `Sources` block after the
//    body and before the footer (c69f census order: `…Tabs, Sources, footer`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { JSDOM } from 'jsdom'

registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })

const dom = new JSDOM('<div id="r"></div>', { pretendToBeVisual: true })
globalThis.window = dom.window; globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
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
const { registry } = await import('../desktop/src/index.mjs')
const { CardBody } = await import('../desktop/src/card.mjs')

const HERE = path.dirname(fileURLToPath(import.meta.url))
const loadSaved = n => JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'saved', n + '.json'), 'utf8'))
const c69f = loadSaved('ru-c69fc582e9a9')
const f97 = loadSaved('ru-97cb020cd21b')

const mount = document.createElement('div')
document.body.append(mount)
const root = createRoot(mount)
const $ = sel => mount.querySelector(sel)
const $$ = sel => [...mount.querySelectorAll(sel)]

async function renderRecord(record) {
  await act(async () => { root.render(null) })
  await act(async () => { root.render(React.createElement(CardBody, { record, registry })) })
}

// c69f repro fixture: the c69f record with the markers `1`,`2` (rel, pr16) authored on
// the Checklist, on a titled BarList and on a titled HeatMap — the #17 repro shape.
function c69fRepro() {
  const rec = structuredClone(c69f)
  const cs = rec.surface.createSurface
  for (const c of cs.components) if (c.component === 'Checklist') c.sourceIds = ['rel', 'pr16']
  cs.components.push(
    { id: 'bars', component: 'BarList', title: 'Gates by kind', sourceIds: ['rel', 'pr16'], items: [{ label: 'gates', value: 5 }] },
    { id: 'heat', component: 'HeatMap', title: 'Gates heat', sourceIds: ['rel', 'pr16'], rows: [{ label: 'a' }], cols: [{ label: 'b' }], cells: [{ row: 'a', col: 'b', value: 1 }] }
  )
  cs.components[0].children = [...cs.components[0].children, 'bars', 'heat']
  return rec
}

// ---- #17 repro: citeMarker shares the head-row line box with the title; never alone
// on a line; no ⓘ glyph anywhere.
for (const [type, title] of [['Checklist', 'v0.1.4 release gates'], ['BarList', 'Gates by kind'], ['HeatMap', 'Gates heat']]) {
  test(`c69f ${type}: markers 1,2 share the head-row line box with the title (never alone on a line)`, async () => {
    await renderRecord(c69fRepro())
    const comp = $(`[data-ru="${type}"]`)
    assert.ok(comp, `${type} renders`)
    assert.ok(!comp.textContent.includes('ⓘ'), `${type}: no ⓘ glyph (supersedes #17)`)
    const marks = [...comp.querySelectorAll('sup[data-ru-citation]')]
    assert.ok(marks.length >= 1, `${type}: citeMarker present`)
    const mark = marks[0]
    assert.equal(mark.textContent.replace(/\s+/g, ''), '1,2', `${type}: markers 1,2`)
    const row = mark.parentElement
    assert.ok(row.textContent.includes(title), `${type}: marker shares the head-row line box with the title`)
    assert.equal(row.lastElementChild, mark, `${type}: last inline child of the head row`)
  })
}
test('c69f: no ⓘ glyph anywhere in the card (supersedes #17)', async () => {
  await renderRecord(c69f)
  assert.ok(!mount.textContent.includes('ⓘ'), 'no ⓘ glyph (supersedes #17)')
})

// ---- #18 repro: done:null -> non-empty dashed `?` SVG with aria-label `unknown`,
// greyscale-distinct from done / not-done (shape, not colour, discriminates).
test('c69f Checklist done:null renders a non-empty dashed ? StatusMark with aria-label unknown', async () => {
  await renderRecord(c69f)
  const li = t => $$('[data-ru="Checklist"] li').find(x => x.getAttribute('data-ru-state') === t)
  const unknownLi = li('unknown'); const doneLi = li('done'); const openLi = li('unchecked')
  assert.ok(unknownLi && doneLi && openLi, 'all three states present on c69f')
  const svg = unknownLi.querySelector('[data-ru-marker="unknown"] svg')
  assert.ok(svg, 'unknown marker is a non-empty SVG StatusMark, not a text glyph')
  assert.equal(svg.getAttribute('aria-label'), 'unknown')
  assert.ok(svg.getAttribute('stroke-dasharray'), 'dashed ring')
  assert.ok(svg.textContent.includes('?'), 'the `?` sits in the mark')
  const sig = x => x.querySelector('[data-ru-marker] svg')?.outerHTML
  assert.ok(sig(doneLi) && sig(openLi), 'done and not-done render SVG marks too')
  assert.notEqual(sig(unknownLi), sig(doneLi), 'greyscale-distinct from done')
  assert.notEqual(sig(unknownLi), sig(openLi), 'greyscale-distinct from not-done')
  assert.notEqual(sig(doneLi), sig(openLi), 'done differs from not-done')
})

// ---- Timeline: zoned instants read in the VIEWER zone (fmtDate), on the dated grid.
test('Timeline 2026-09-28T23:30-05:00 reads Sep 28 for a Chicago viewer; dated grid 12px max-content 1fr', async () => {
  const { Timeline } = await import('../desktop/src/components/timeline.mjs')
  await act(async () => { root.render(null) })
  await act(async () => {
    root.render(React.createElement(Timeline, {
      element: { type: 'Timeline', props: { items: [{ date: '2026-09-28T23:30-05:00', label: 'late event', status: 'done' }], timeZone: 'America/Chicago' } }
    }))
  })
  const dt = $('[data-ru="Timeline"] li [data-ru-date]')
  assert.ok(dt, 'date caption renders')
  assert.match(dt.textContent, /Sep 28/, `viewer-zone caption, got ${JSON.stringify(dt.textContent)}`)
  assert.ok(!dt.textContent.includes('Sep 29'), 'the UTC day-shift face is gone')
  assert.equal($('[data-ru="Timeline"] li').style.gridTemplateColumns, '12px max-content 1fr', 'the dated grid track')
})

// ---- SourceList rows `n · label link · host · kind · accessed <date>`; never a raw URL label.
test('SourceList row reads `1 · label · host · kind · accessed <date>`, never a raw URL label', async () => {
  const { SourceList, setOpenExternal } = await import('../desktop/src/components/sourcelist.mjs')
  setOpenExternal(null)
  await act(async () => { root.render(null) })
  await act(async () => {
    root.render(React.createElement(SourceList, {
      element: { type: 'SourceList', props: { _sources: [
        { id: 's1', kind: 'web', label: 'Example site', url: 'https://example.com/report', accessed_at: '2026-09-25' },
        { id: 's2', kind: 'tool', label: 'Local computation' }
      ] } }
    }))
  })
  const rows = $$('[data-ru="SourceList"] [data-ru-source]')
  assert.equal(rows.length, 2)
  const t = rows[0].textContent.replace(/\s+/g, ' ').trim()
  assert.match(t, /^1 · Example site · example\.com · web · accessed Sep 25, 2026$/, `row census, got ${JSON.stringify(t)}`)
  assert.ok(!rows[0].textContent.includes('https://'), 'never a raw URL label')
  assert.match(rows[1].textContent.replace(/\s+/g, ' ').trim(), /^2 · Local computation · tool/, 'kind-only row without url/accessed stays in format')
})

test('SourceList [] -> No sources cited (stays pinned)', async () => {
  const { SourceList } = await import('../desktop/src/components/sourcelist.mjs')
  await act(async () => { root.render(null) })
  await act(async () => {
    root.render(React.createElement(SourceList, {
      element: { type: 'SourceList', props: { sourceIds: [], _sources: [{ id: 's1', kind: 'web', label: 'Example', url: 'https://example.com/' }] } }
    }))
  })
  assert.equal($('[data-ru="SourceList"] [data-ru-empty]').textContent, 'No sources cited')
})

// ---- AsOf all absent -> `No timestamps published` (capital N).
test('AsOf all absent -> `No timestamps published`', async () => {
  const { AsOf } = await import('../desktop/src/components/asof.mjs')
  await act(async () => { root.render(null) })
  await act(async () => { root.render(React.createElement(AsOf, { element: { type: 'AsOf', props: {} } })) })
  assert.equal($('[data-ru="AsOf"] [data-ru-null]').textContent, 'No timestamps published')
})

// ---- auto-Sources: sources exist, none authored as a SourceList -> numbered block
// after the body, before the footer (97cb is the named saved-card restyle before→after).
test('97cb (sources, no authored SourceList) gains a numbered Sources block after the body, before the footer', async () => {
  await renderRecord(f97)
  const cs = f97.surface.createSurface
  assert.ok(!cs.components.some(c => c.component === 'SourceList'), 'no authored SourceList')
  assert.ok((cs.dataModel?.meta?.sources ?? []).length === 2, 'card has sources')
  const slot = $('[data-ru-sources-slot]')
  assert.ok(slot, 'reserved slot present')
  const block = slot.querySelector('[data-ru-sources-block]')
  assert.ok(block, 'auto-Sources block renders in the reserved slot')
  assert.match(block.textContent, /Sources/, 'headed `Sources`')
  const labels = cs.dataModel.meta.sources.map(s => s.label || s.url || s.id)
  assert.ok(block.textContent.includes(labels[0]) && block.textContent.includes(labels[1]), 'both source labels appear')
  const digits = [...block.textContent.matchAll(/(\d+)\s*·/g)].map(m => m[1])
  assert.deepEqual(digits, ['1', '2'], 'rows numbered 1, 2')
  assert.ok(!block.textContent.includes('https://'), 'no raw URL label in the block')
  const flow = $('[data-ru-body]')
  const footer = $('[data-ru-footer]')
  assert.ok(flow, 'body present')
  assert.ok(flow.compareDocumentPosition(slot) & 4, 'Sources follows the body')
  if (footer) assert.ok(slot.compareDocumentPosition(footer) & 4, 'footer follows the Sources block')
})

test('c69f census order: …Tabs, Sources, footer in document order', async () => {
  await renderRecord(c69f)
  const tabs = $('[data-ru="Tabs"]')
  const srcs = $('[data-ru="SourceList"]') ?? $('[data-ru-sources-slot]')
  const footer = $('[data-ru-footer]')
  assert.ok(tabs && srcs && footer, 'tabs, sources and footer present')
  assert.ok(tabs.compareDocumentPosition(srcs) & 4, 'Sources follows Tabs')
  assert.ok(srcs.compareDocumentPosition(footer) & 4, 'footer follows Sources')
})
