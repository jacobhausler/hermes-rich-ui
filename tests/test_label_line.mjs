// #39 (defaults slice 16): one label line per mixed row; one foot grammar per band.
// A mixed row (tiles + a titled block in one row — auto-row, Grid, or horizontal Stack)
// shows ONE label line: the block's title takes the tiles' label face (caption + caps),
// so the row reads as a single labelled band. The failing-first pin from the issue:
// fixture [Metric, Metric, BarList{title}] → all three labels on one line box at 11 px caps.
//
// Foot grammar: inside a tile (Metric/Progress/Sparkline) the SECOND line — delta line,
// percent foot, trend chip — is always the caption step. One grammar per band, everywhere.
//
// EXEMPT = [] is asserted by construction: the lists below start empty and any future
// restyle must ADD a named before→after pair (separately reviewed), which this file
// refuses until the census is green.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { React, act, registry, lower, renderSpec, mount } from './helpers/render.mjs'

const { TYPE } = await import('../desktop/src/components/_house.mjs')

// Shrinking-list idiom: nothing is exempt today; a future exception needs a named pair.
const EXEMPT = new Map()
assert.deepEqual([...EXEMPT], [], 'EXEMPT = [] asserted')

const quad = el => [el.style.fontSize, el.style.fontWeight, el.style.lineHeight, el.style.letterSpacing]
// Rendered-quad form of the caption step (TYPE stores unitless numbers; style strings carry them).
const CAPTION_CAPS = [`${TYPE.caption.fontSize}px`, String(TYPE.caption.fontWeight), String(TYPE.caption.lineHeight), TYPE.caption.letterSpacing]
assert.deepEqual(CAPTION_CAPS, ['11px', '400', '16px', '0em'], 'the label line is the caption step')
const isCaps = el => el.style.textTransform === 'uppercase'

// lower() eats the createSurface shape: props sit FLAT on the component descriptor.
async function render(components) {
  const flat = components.map(c => ({ id: c.id, component: c.component, ...(c.props || {}), ...(c.children ? { children: c.children } : {}) }))
  const { spec, initialState } = lower({ components: flat, dataModel: { data: {}, meta: { sources: [] } } })
  await act(async () => { renderSpec(spec, initialState) })
  return mount
}
const tile = (id, label, value) => ({ id, component: 'Metric', props: { label, value } })
const barlistTitle = { id: 'bl', component: 'BarList', props: { title: 'Traffic', items: [{ label: 'auth', value: 512 }, { label: 'search', value: 9200 }] } }

test('mixed auto-row [Metric, Metric, BarList{title}]: one label line, caption+caps', async () => {
  const el = await render([
    { id: 'root', component: 'Card', props: { children: ['m1', 'm2', 'bl'] }, children: ['m1', 'm2', 'bl'] },
    tile('m1', 'Requests', 12345), tile('m2', 'Errors', 3), barlistTitle
  ])
  const row = el.querySelector('[data-ru-autorow="3"]')
  assert.ok(row, 'the mixed run forms ONE auto-row (data-ru-autorow="3")')
  assert.equal(row.getAttribute('data-ru-autorow-class'), 'mixed', 'the run is a mixed row')
  const labels = [...row.querySelectorAll('[data-ru-label]')]
  assert.equal(labels.length, 3, 'all three labels ride the row label line (two tiles + the block title)')
  for (const l of labels) {
    assert.deepEqual(quad(l), CAPTION_CAPS, `label "${(l.textContent || '').slice(0, 24)}" on the caption quad`)
    assert.ok(isCaps(l), `label "${(l.textContent || '').slice(0, 24)}" takes caps`)
  }
  // The block's title is the third label — not a second head line inside the block.
  const bl = row.querySelector('[data-ru="BarList"]')
  assert.ok(!bl.querySelector('[data-ru-itemlist-title]'), 'no separate head line inside the block')
})

test('mixed Grid row demotes the block title to the label line', async () => {
  const el = await render([
    { id: 'root', component: 'Card', props: { children: ['g'] }, children: ['g'] },
    { id: 'g', component: 'Grid', props: { columns: 3, children: ['m1', 'm2', 'bl'] }, children: ['m1', 'm2', 'bl'] },
    tile('m1', 'A', 1), tile('m2', 'B', 2), barlistTitle
  ])
  const bl = el.querySelector('[data-ru="BarList"]')
  const title = bl.querySelector('[data-ru-head]')
  assert.ok(title, 'the block exposes its title as [data-ru-head]')
  assert.deepEqual(quad(title), CAPTION_CAPS, 'Grid-mixed block title takes the caption quad')
  assert.ok(isCaps(title), 'Grid-mixed block title takes caps')
})

test('untitled block next to tiles keeps the auto-row rule (M1 pin preserved)', async () => {
  const el = await render([
    { id: 'root', component: 'Card', props: { children: ['m1', 't', 'm2'] }, children: ['m1', 't', 'm2'] },
    tile('m1', 'A', 1), { id: 't', component: 'Text', props: { text: 'prose' } }, tile('m2', 'B', 2)
  ])
  assert.equal(el.querySelectorAll('[data-ru-autorow]').length, 0, 'a broken tile run still does not auto-row')
})

test('foot grammar: every tile second line is the caption step', async () => {
  const el = await render([
    { id: 'root', component: 'Card', props: { children: ['m1', 'm2', 'pg'] }, children: ['m1', 'm2', 'pg'] },
    { id: 'm1', component: 'Metric', props: { label: 'A', value: 9876543, previous: 12 } },
    { id: 'm2', component: 'Metric', props: { label: 'B', value: null } },
    { id: 'pg', component: 'Progress', props: { current: 12345, total: 98765, label: 'rows migrated' } }
  ])
  const feet = [...el.querySelectorAll('[data-ru-delta-line], [data-ru-foot]')]
  assert.ok(feet.length >= 1, 'delta/foot lines exist to inspect')
  for (const f of feet) assert.deepEqual(quad(f), CAPTION_CAPS, `foot "${(f.textContent || '').slice(0, 30)}" is caption`)
  // The auto-row labels for the tile band are caption+caps too (same line-box rule).
  for (const l of el.querySelectorAll('[data-ru-label]')) {
    assert.deepEqual(quad(l), CAPTION_CAPS, 'band label is caption')
    assert.ok(isCaps(l), 'band label takes caps')
  }
})

test('one label line: no band shows a second text line below the tile label inside the same row cell', async () => {
  const el = await render([
    { id: 'root', component: 'Card', props: { children: ['m1', 'm2', 'bl'] }, children: ['m1', 'm2', 'bl'] },
    tile('m1', 'A', 1), tile('m2', 'B', 2), barlistTitle
  ])
  const row = el.querySelector('[data-ru-autorow="3"]')
  const bl = row.querySelector('[data-ru="BarList"]')
  // Inside the mixed row the block carries the label line as its only head — no second
  // head line; the first labelled element is the demoted title, then the item rows.
  assert.ok(bl.querySelector('[data-ru-head]'), 'the block title is on the shared label line')
  assert.ok(bl.querySelector('[data-ru-item]'), 'the block body renders below the one label line')
  assert.equal(bl.querySelectorAll('[data-ru-head], [data-ru-itemlist-title]').length, 1, 'exactly one head in the block')
})
