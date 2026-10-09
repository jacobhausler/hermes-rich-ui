// #28 (defaults slice 5): the composer and RowContext. compose() in _shared.mjs owns
// all sibling rhythm (above a Heading 20, below 6, block→block 12, after a KPI band 16,
// title→first child 8, footer 12; no CSS heading margins). A run of ≥2 tiles auto-rows
// (≤4 per row, balanced, no orphan). Exactly 2 short blocks (≤8 rows) pair. Grid
// `columns` is a maximum with tracks minmax(max(140px, share), 1fr). A horizontal Stack
// keeps all-tile rows content-sized and flexes by class otherwise. RowContext(true) is
// provided in ONE slice by all three providers — auto-row, Grid (columns ≥ 2),
// horizontal Stack — and Metric reads it (kpi 20 in a row, title 16 alone).
// Spec: DEFAULTS-SPEC.md D8 / §0 (C1–C6, C18), AD-8b, AD-15; plan: PLAN.md slice 5;
// findings: review-M M1–M4 (e) + review-G G1–G3.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { React, act, lower, renderSpec } from './helpers/render.mjs'

const { balancedCols, gridTracks, SIZE_CLASS, sizeClass } = await import('../desktop/src/components/_shared.mjs')
const { PROSE_RESET_CSS, PROSE_RESET_HREF, CardBody } = await import('../desktop/src/card.mjs')
const { registry } = await import('../desktop/src/index.mjs')
const { KNOWN_TYPES } = await import('../desktop/src/lower.mjs')

// The Renderer reconciles positionally for a stateful root; flush an unrelated root
// between spec renders so every case mounts clean (same idiom as test_synth_layout).
const flush = () => renderSpec({ root: 'flush', elements: { flush: { type: 'Text', props: { text: '' }, children: [] } } })
const render = async components => { await flush(); const { spec, initialState } = lower({ components, dataModel: { data: {}, meta: {} } }); await renderSpec(spec, initialState) }

const $ = sel => document.getElementById('r').querySelector(sel)
const $$ = sel => [...document.getElementById('r').querySelectorAll(sel)]
const metric = (id, label) => ({ id, component: 'Metric', label, value: 42 })
const valueFontPx = m => m.querySelector('[data-ru-value]').style.fontSize

// ---- M1 / G1: auto-row of a flat tile run ----
test('M1: [Metric×3] flat under a Card → one [data-ru-autorow="3"], values 20px (RowContext kpi)', async () => {
  await render([
    { id: 'root', component: 'Card', children: ['m1', 'm2', 'm3'] },
    metric('m1', 'A'), metric('m2', 'B'), metric('m3', 'C')
  ])
  const rows = $$('[data-ru-autorow]')
  assert.equal(rows.length, 1, 'exactly one auto-row')
  assert.equal(rows[0].getAttribute('data-ru-autorow'), '3')
  assert.equal(rows[0].querySelectorAll('[data-ru="Metric"]').length, 3, 'all three Metrics inside the auto-row')
  assert.equal($$('[data-ru="Metric"]').length, 3, 'no duplicate mounts')
  for (const m of $$('[data-ru="Metric"]')) assert.equal(valueFontPx(m), '20px', 'kpi 20 in a row')
  assert.equal(rows[0].style.display, 'grid')
  assert.equal(rows[0].style.columnGap, '16px')
  assert.equal(rows[0].style.rowGap, '12px')
  // balanced c=3: the share divides by 3 with two 16px gutters, over the 140 tile floor (C3)
  assert.match(rows[0].style.gridTemplateColumns, /^repeat\(auto-fit, minmax\(max\(140px, calc\(\(100% - 32px\) \/ 3\)\), 1fr\)\)$/)
})

test('M1: a run broken by a non-tile does not auto-row; a trailing Chart is the row sibling', async () => {
  await render([
    { id: 'root', component: 'Card', children: ['m1', 't', 'm2'] },
    metric('m1', 'A'), { id: 't', component: 'Text', text: 'prose' }, metric('m2', 'B')
  ])
  assert.equal($$('[data-ru-autorow]').length, 0, 'broken run → no auto-row')
  await render([
    { id: 'root', component: 'Card', children: ['m1', 'm2', 'chart'] },
    metric('m1', 'A'), metric('m2', 'B'),
    { id: 'chart', component: 'Chart', kind: 'bar', series: [{ label: 'a', data: [{ label: 'q', value: 1 }] }] }
  ])
  const row = $('[data-ru-autorow]')
  assert.ok(row, 'the two-tile run rows')
  // compare booleans, never DOM nodes: a failing assert on jsdom nodes inspects the whole tree (OOM)
  const chart = $('[data-ru="Chart"]')
  assert.equal(row.contains(chart), false, 'Chart is not inside the auto-row')
  assert.equal(row.parentElement.contains(chart), true, 'Chart sits in the same flow as the auto-row')
})

test('C1/M9: a lone Metric under a Card reads title 16 (size comes from RowContext only)', async () => {
  await render([
    { id: 'root', component: 'Card', children: ['m1'] },
    metric('m1', 'Solo')
  ])
  assert.equal($$('[data-ru-autorow]').length, 0)
  assert.equal(valueFontPx($('[data-ru="Metric"]')), '16px', 'alone → title 16, never the 20→16→20 flip (AD-15)')
})

test('M1: [Metric×5] → one auto-row with balanced 3+2 (c=3, ≤4 per row, never an orphan)', async () => {
  await render([
    { id: 'root', component: 'Card', children: ['m1', 'm2', 'm3', 'm4', 'm5'] },
    metric('m1', 'M1'), metric('m2', 'M2'), metric('m3', 'M3'), metric('m4', 'M4'), metric('m5', 'M5')
  ])
  const rows = $$('[data-ru-autorow]')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].getAttribute('data-ru-autorow'), '5')
  assert.match(rows[0].style.gridTemplateColumns, /calc\(\(100% - 32px\) \/ 3\)/, 'c=3 → rows 3+2')
  // the balance table (M1 b): 2→2, 3→3, 4→4, 5→3+2, 6→3+3, 7→4+3, 8→4+4
  assert.deepEqual([2, 3, 4, 5, 6, 7, 8].map(n => balancedCols(n)), [2, 3, 4, 3, 3, 4, 4])
})

test('M1/AD-15: a vertical Stack of 2 Metrics → auto-row, values stay 20px', async () => {
  await render([
    { id: 'root', component: 'Stack', children: ['a', 'b'] },
    metric('a', 'L'), metric('b', 'R')
  ])
  const rows = $$('[data-ru-autorow]')
  assert.equal(rows.length, 1, 'a tile run in a vertical Stack auto-rows')
  assert.equal(rows[0].getAttribute('data-ru-autorow'), '2')
  for (const m of $$('[data-ru="Metric"]')) assert.equal(valueFontPx(m), '20px', 'was 20, stays 20')
})

// ---- C6: exactly 2 short blocks pair; 3 never do ----
const kv = (id, n) => ({ id, component: 'KeyValueList', items: Array.from({ length: n }, (_, i) => ({ label: 'k' + i, value: i })) })
test('C6: exactly 2 KV lists ≤8 rows pair into one row; 3 do not; a 9-row KV is not short', async () => {
  await render([
    { id: 'root', component: 'Card', children: ['k1', 'k2'] },
    kv('k1', 3), kv('k2', 4)
  ])
  const rows = $$('[data-ru-autorow]')
  assert.equal(rows.length, 1, 'exactly one pair row')
  assert.equal(rows[0].getAttribute('data-ru-autorow'), '2')
  assert.equal(rows[0].getAttribute('data-ru-autorow-class'), 'block')
  assert.equal(rows[0].querySelectorAll('[data-ru="KeyValueList"]').length, 2)
  assert.match(rows[0].style.gridTemplateColumns, /max\(240px,/, 'pair floor is the block floor 240')
  await render([
    { id: 'root', component: 'Card', children: ['k1', 'k2', 'k3'] },
    kv('k1', 3), kv('k2', 4), kv('k3', 2)
  ])
  assert.equal($$('[data-ru-autorow]').length, 0, 'never 3 blocks')
  await render([
    { id: 'root', component: 'Card', children: ['k1', 'k2'] },
    kv('k1', 9), kv('k2', 4)
  ])
  assert.equal($$('[data-ru-autorow]').length, 0, 'a 9-row KV is not short (≤8 rows)')
})

// ---- G3 / M2: h-Stack flexes by class unless every child is a tile ----
test('G3: h-Stack [Timeline, Stack] is class-flexed — two equal-basis columns', async () => {
  await render([
    { id: 'root', component: 'Card', children: ['top'] },
    { id: 'top', component: 'Stack', direction: 'horizontal', gap: 'lg', children: ['tl', 'r'] },
    { id: 'tl', component: 'Timeline', title: 'T', items: [{ label: 'a', date: '2026-01-01', status: 'done' }] },
    { id: 'r', component: 'Stack', children: ['h'] },
    { id: 'h', component: 'Heading', text: 'Facts' }
  ])
  const st = $('[data-ru-dir="horizontal"]')
  assert.equal(st.getAttribute('data-ru-row-fill'), 'mixed', 'a non-tile in the row flexes by class')
  const tl = st.querySelector(':scope > [data-ru="Timeline"]')
  const inner = st.querySelector(':scope > [data-ru="Stack"]')
  assert.ok(tl && inner, 'both children stay direct DOM children (no wrapper moved them)')
  for (const el of [tl, inner]) {
    const cs = window.getComputedStyle(el)
    assert.equal(cs.flexGrow, '1')
    assert.equal(cs.flexBasis, '240px', 'both are block class → equal basis (c69f 427/427 at 874 px)')
    assert.equal(cs.minWidth, '0px')
  }
})

test('C4: an all-Metric h-Stack stays content-sized (no flex grow, the 20px column gap floor intact)', async () => {
  await render([
    { id: 'root', component: 'Card', children: ['row'] },
    { id: 'row', component: 'Stack', direction: 'horizontal', children: ['a', 'b'] },
    metric('a', 'L'), metric('b', 'R')
  ])
  const st = $('[data-ru-dir="horizontal"]')
  assert.equal(st.getAttribute('data-ru-row-fill'), 'tiles', 'all-tile row keeps the today look')
  assert.equal(st.style.columnGap, '20px')
  for (const m of st.querySelectorAll(':scope > [data-ru="Metric"]')) {
    assert.equal(window.getComputedStyle(m).flexGrow, '0', 'content-sized')
    assert.equal(valueFontPx(m), '20px', 'a KPI row is a row')
  }
})

// ---- G2 / M3: Grid columns is a maximum ----
test('M3: Grid columns:4 of 5 Metrics → auto-fit tracks with the 140 floor, c=3; at 572px every track ≥140', async () => {
  await render([
    { id: 'root', component: 'Grid', columns: 4, children: ['a', 'b', 'c', 'd', 'e'] },
    metric('a', '1'), metric('b', '2'), metric('c', '3'), metric('d', '4'), metric('e', '5')
  ])
  const g = $('[data-ru="Grid"]')
  assert.equal(g.style.gridTemplateColumns,
    'repeat(auto-fit, minmax(max(140px, calc((100% - 32px) / 3)), 1fr))',
    'columns is a maximum: 5 into 4 balances to 3+2, the tile floor is 140 (C3), and an all-tile grid takes the 16px KPI gutters (M3 c)')
  // at 572 px the card content is ≈548 px: the authored share (548-32)/3 ≈ 172 ≥ 140,
  // so a 3-sig-fig face never breaks mid-glyph (M3 a / G2 a).
  assert.ok((572 - 24 - 32) / 3 >= 140)
  // the exported formula balances 4-in-3 to 2+2 (M3 e)
  assert.equal(gridTracks(4, 3, ['tile', 'tile', 'tile', 'tile']).c, 2)
  assert.equal(gridTracks(4, 4, ['tile', 'tile', 'tile', 'tile']).c, 4)
  assert.equal(gridTracks(2, 4, ['tile', 'tile']).c, 2, '2 into Grid 4 → 2 wide, never half an empty row')
  // the KPI row keeps RowContext(true) through the Grid provider
  for (const m of $$('[data-ru="Metric"]')) assert.equal(valueFontPx(m), '20px')
})

test('G2: columns:1 stays one column at the 140 floor', async () => {
  await render([
    { id: 'root', component: 'Grid', columns: 1, children: ['a'] },
    metric('a', 'x')
  ])
  assert.equal($('[data-ru="Grid"]').style.gridTemplateColumns,
    'repeat(auto-fit, minmax(max(140px, 100%), 1fr))')
  assert.equal(valueFontPx($('[data-ru="Metric"]')), '16px', 'columns:1 is a lone Metric')
})

test('M3: a Grid of blocks/wide children raises the floor (charts never crush)', async () => {
  await render([
    { id: 'root', component: 'Grid', columns: 2, children: ['a', 'b'] },
    { id: 'a', component: 'Chart', kind: 'bar', series: [{ label: 'a', data: [{ label: 'q', value: 1 }] }] },
    { id: 'b', component: 'Chart', kind: 'bar', series: [{ label: 'a', data: [{ label: 'q', value: 2 }] }] }
  ])
  assert.match($('[data-ru="Grid"]').style.gridTemplateColumns, /max\(280px,/, 'wide children raise the floor to the wide floor 280 (C3 floors are per class)')
})

// ---- M4: compose() owns the rhythm ----
test('M4: rhythm margins 0/16/20/6 — after a KPI band 16, above a Heading 20, below it 6', async () => {
  await render([
    { id: 'root', component: 'Card', children: ['grid', 'chart', 'h3', 't'] },
    { id: 'grid', component: 'Grid', columns: 3, gap: 'md', children: ['a', 'b', 'c'] },
    metric('a', '1'), metric('b', '2'), metric('c', '3'),
    { id: 'chart', component: 'Chart', kind: 'bar', series: [{ label: 'a', data: [{ label: 'q', value: 1 }] }] },
    { id: 'h3', component: 'Heading', text: 'Section', level: 3 },
    { id: 't', component: 'Text', text: 'body' }
  ])
  assert.equal($('[data-ru="Card"]').style.gap, '0px', 'compose owns the gap; no CSS heading margins (C18)')
  const flow = $('[data-ru-body-flow]')
  assert.ok(flow, 'the body flows through compose()')
  const kids = [...flow.children]
  assert.equal(kids.length, 4)
  assert.deepEqual(kids.map(k => window.getComputedStyle(k).marginTop), ['0px', '16px', '20px', '6px'],
    'first 0, after a KPI band 16, above a Heading 20, below a Heading 6')
})

test('M4: block→block 12 in a Card body; title→first child 8; footer 12', async () => {
  await render([
    { id: 'root', component: 'Card', title: 'T', footer: 'foot', children: ['a', 'b'] },
    { id: 'a', component: 'Text', text: 'one' },
    { id: 'b', component: 'Text', text: 'two' }
  ])
  const flow = $('[data-ru-body-flow]')
  assert.equal(window.getComputedStyle(flow).marginTop, '8px', 'the header binds down: title→first child 8')
  assert.deepEqual([...flow.children].map(k => window.getComputedStyle(k).marginTop), ['0px', '12px'],
    'block→block 12')
  assert.equal($('[data-ru-footer]').style.marginTop, '12px', 'footer 12')
})

test('M4: a vertical Stack keeps its authored gap as "otherwise" (md = 8) and applies the Heading rows', async () => {
  await render([
    { id: 'root', component: 'Stack', children: ['h', 't', 'u'] },
    { id: 'h', component: 'Heading', text: 'S' },
    { id: 't', component: 'Text', text: 'one' },
    { id: 'u', component: 'Text', text: 'two' }
  ])
  const st = $('[data-ru="Stack"]')
  const kids = [...st.children]
  assert.deepEqual(kids.map(k => window.getComputedStyle(k).marginTop), ['0px', '6px', '8px'],
    'below a Heading 6; otherwise the authored gap (md 8), not the Card-body 12')
})

test('M4: gap none disables the rhythm (escape hatch); auto-row still applies', async () => {
  await render([
    { id: 'root', component: 'Stack', gap: 'none', children: ['t', 'a', 'b'] },
    { id: 't', component: 'Text', text: 'one' },
    metric('a', 'A'), metric('b', 'B')
  ])
  const st = $('[data-ru="Stack"]')
  for (const k of st.children) assert.equal(window.getComputedStyle(k).marginTop, '0px', 'none = no rhythm')
  assert.equal($$('[data-ru-autorow]').length, 1, 'M1 auto-row is not a rhythm rule; it still applies')
})

// ---- the class table drives the h-Stack CSS; a new type without a class must fail here ----
test('M2 (e): PROSE_RESET_CSS carries one h-Stack flex rule per known type, basis from the class table', () => {
  const basis = { tile: '140px', block: '240px', wide: '320px' }
  for (const t of KNOWN_TYPES) {
    const cls = sizeClass(t)
    assert.ok(Object.hasOwn(SIZE_CLASS, t), `${t} is in the size-class table`)
    const want = cls === 'atom'
      ? `[data-ru-card] [data-ru-dir="horizontal"][data-ru-row-fill="mixed"]>[data-ru="${t}"]{flex:0 0 auto;min-width:0}`
      : `[data-ru-card] [data-ru-dir="horizontal"][data-ru-row-fill="mixed"]>[data-ru="${t}"]{flex:1 1 ${basis[cls]};min-width:0}`
    assert.ok(PROSE_RESET_CSS.includes(want), `missing flex rule for ${t} (${cls}); want ${want}`)
  }
  // the Divider's own 4px margin zeroes inside a composed body (M4: the rule is the separator)
  assert.match(PROSE_RESET_CSS, /\[data-ru-card\] \[data-ru-body-flow\]>div>\[data-ru="Divider"\]\{margin:0\}/)
  assert.equal(PROSE_RESET_HREF, 'hermes-rich-ui/prose-reset/4')
})

// ---- the acceptance census: saved structure is unchanged at 720 px ----
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const savedFiles = ['ru-000000000022', 'ru-97cb020cd21b', 'ru-c69fc582e9a9', 'ru-f3af0e45428d']
test('G/M census: 0/23 saved Grids and 0/26 saved cards change structure at 720px; saved Metrics keep kpi 20', async () => {
  const { createRoot } = await import('react-dom/client')
  const mountEl = document.createElement('div')
  mountEl.style.width = '720px'
  document.body.append(mountEl)
  const root = createRoot(mountEl)
  try {
    for (const name of savedFiles) {
      const record = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/saved', name + '.json'), 'utf8'))
      await act(async () => { root.render(React.createElement(CardBody, { record, registry })) })
      // no auto-row is ever inserted around a saved card's children (every saved KPI run
      // is already an explicit Grid → structure unchanged, the census of all 26 stored)
      assert.equal(mountEl.querySelectorAll('[data-ru-autorow]').length, 0, `${name}: no auto-row inserted`)
      const cs = record.surface.createSurface
      // every saved Grid divides evenly at its authored columns → same rows as today
      for (const c of cs.components.filter(x => x.component === 'Grid')) {
        const n = (c.children || []).length
        const cols = Math.min(4, Math.max(1, Number(c.columns) || 1))
        assert.equal(n % cols, 0, `${name}: saved Grid ${c.id} divides (${n} in ${cols})`)
      }
      // every saved Metric sits in a Grid (columns ≥ 2) → RowContext(true) → keeps kpi 20
      for (const m of mountEl.querySelectorAll('[data-ru="Metric"]')) assert.equal(valueFontPx(m), '20px', `${name}: saved Metric keeps kpi 20`)
      // the authored c69f two-column h-Stack row becomes class-flexed (the author's intent;
      // the 427/427 px pin at 874 px lives with the pixel harness)
      if (name === 'ru-c69fc582e9a9') {
        assert.equal(mountEl.querySelector('[data-ru-dir="horizontal"]').getAttribute('data-ru-row-fill'), 'mixed')
      }
    }
  } finally {
    await act(async () => { root.unmount() })
    mountEl.remove()
  }
})
