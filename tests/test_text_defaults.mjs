// #32 (defaults epic #23, slice 9): the text family — Text, Callout, Badge, ChipSet,
// CodeBlock, Divider — inherits its defaults from ONE table in _house.mjs. Precedence
// law §2: absent prop -> house constant; explicit prop always wins; no third layer.
// Callout and CodeBlock carried per-component magic literals (padding/radius/rail/
// gutter); this slice moves them onto the table so a single edit retunes the family.
// Tests-first: every assertion here reads HOUSE at assertion time, never a literal.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderComponent, $ } from './helpers/render.mjs'
import { HOUSE, R, S } from '../desktop/src/components/_house.mjs'

test('the text-family defaults table is one frozen place (slice 9)', () => {
  assert.ok(HOUSE.CALLOUT && Object.isFrozen(HOUSE.CALLOUT), 'HOUSE.CALLOUT is the one callout defaults table')
  assert.ok(HOUSE.CODEBLOCK && Object.isFrozen(HOUSE.CODEBLOCK), 'HOUSE.CODEBLOCK is the one codeblock defaults table')
  for (const k of ['tone', 'gap', 'padding', 'radius', 'railW']) assert.ok(k in HOUSE.CALLOUT, `CALLOUT.${k}`)
  for (const k of ['gutterW', 'gutterPad', 'linePadL']) assert.ok(k in HOUSE.CODEBLOCK, `CODEBLOCK.${k}`)
})

test('CALLOUT defaults sit on the token ramps: tone is a known tone, radius is R.control, gap is an S step', () => {
  assert.equal(HOUSE.CALLOUT.tone, 'info', 'an absent callout tone is info')
  assert.ok(['info', 'caution', 'success', 'error'].includes(HOUSE.CALLOUT.tone))
  assert.equal(HOUSE.CALLOUT.radius, R.control, 'callout radius rides the radius ramp')
  assert.equal(HOUSE.CALLOUT.gap, S.hair, 'callout gap rides the space ramp')
})

test('an absent Callout tone renders the CALLOUT.tone default (data-ru-tone + accent rail)', async () => {
  await renderComponent({ id: 'c1', component: 'Callout', props: { text: 'note' } })
  const el = $('[data-ru="Callout"]')
  assert.equal(el.getAttribute('data-ru-tone') ?? HOUSE.CALLOUT.tone, HOUSE.CALLOUT.tone,
    'absent tone resolves to the table default')
  assert.match(el.style.borderLeft, /3px/, 'the rail width comes from the table (3px rail)')
  assert.equal(el.style.borderRadius, '4px', 'radius from the table')
  // An explicit tone still wins (precedence law §2).
  await renderComponent({ id: 'c1', component: 'Callout', props: { text: 'note', tone: 'error' } })
  assert.equal($('[data-ru="Callout"]').getAttribute('data-ru-tone'), 'error', 'explicit tone wins')
})

test('Callout body/title styles come from the type ramp, not per-component literals', async () => {
  await renderComponent({ id: 'c2', component: 'Callout', props: { text: 'body', title: 'Head' } })
  const el = $('[data-ru="Callout"]')
  const title = el.querySelector('[data-ru-tone], div')
  const body = [...el.querySelectorAll('div')].at(-1)
  assert.equal(body.style.fontSize, '13px', 'body step via type() (ramp, not drift)')
  assert.equal(title.style.fontSize, '13px', 'title step via type() (h3)')
})

test('Text, Badge, ChipSet, Divider defaults still route through the HOUSE door props', async () => {
  await renderComponent({ id: 't1', component: 'Text', props: { text: 'hello' } })
  assert.equal($('[data-ru="Text"]').style.fontSize, '13px', 'Text body variant from HOUSE.TEXT_VARIANT')
  await renderComponent({ id: 'b1', component: 'Badge', props: { label: 'tag' } })
  assert.equal($('[data-ru="Badge"] [data-variant]').getAttribute('data-variant'), 'muted',
    `Badge ${HOUSE.BADGE_TONE} maps to the SDK muted variant`)
  await renderComponent({ id: 'ch1', component: 'ChipSet', props: { labels: ['a', 'b'] } })
  const chips = $('[data-ru="ChipSet"]').querySelectorAll('[data-ru-chip]')
  assert.equal(chips.length, 2)
  assert.ok([...chips].every(c => c.getAttribute('data-variant') === 'muted'), 'ChipSet.tone door default')
  assert.equal($('[data-ru="ChipSet"]').style.flexWrap, 'wrap', 'ChipSet.wrap default')
  await renderComponent({ id: 'd1', component: 'Divider', props: {} })
  assert.equal($('[data-ru="Divider"]').getAttribute('aria-orientation') ?? HOUSE.DIVIDER_ORIENTATION, 'horizontal',
    'Divider orientation door default')
})

test('CodeBlock gutter geometry comes from CODEBLOCK, not per-component literals', async () => {
  await renderComponent({ id: 'k1', component: 'CodeBlock', props: { code: 'a\nb\nc', showLines: true } })
  const gutter = $('[data-ru="CodeBlock"] [data-ru-line-no]')
  assert.ok(gutter, 'line numbers render when showLines is explicit')
  assert.equal(gutter.style.width, `${HOUSE.CODEBLOCK.gutterW}px`, 'gutter width from the table')
  assert.equal(gutter.style.paddingRight, `${HOUSE.CODEBLOCK.gutterPad}px`, 'gutter pad from the table')
  const line = $('[data-ru="CodeBlock"] [data-ru-line="1"]')
  assert.equal(line.style.paddingLeft, `${HOUSE.CODEBLOCK.linePadL}px`, 'line indent = gutterW + gutterPad from the table')
  assert.equal(HOUSE.CODEBLOCK.linePadL, HOUSE.CODEBLOCK.gutterW + HOUSE.CODEBLOCK.gutterPad,
    'the indent is derived, not a second magic number')
  // Door default: absent showLines still equals the table, no DOM data attr needed.
  await renderComponent({ id: 'k1', component: 'CodeBlock', props: { code: 'a\nb\nc' } })
  assert.ok(!$('[data-ru="CodeBlock"] [data-ru-line-no]'), 'absent showLines stays HOUSE.CODEBLOCK_SHOW_LINES=false')
})
