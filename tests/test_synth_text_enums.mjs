// L7 E-pack item 1 (enum sugar): E8 Text variant 'mono', E9 Callout tone 'error'.
// Pins the L8 additive law: existing variants/tones render byte-identically.
import { test } from 'node:test'
import { assert, renderComponent, $ } from './helpers/render.mjs'

// ---- E8 Text variant mono ----
test('E8 Text variant=mono is ui-monospace with tabular-nums', async () => {
  await renderComponent({ id: 't', component: 'Text', props: { text: 'deadbeefcafe', variant: 'mono' } })
  const t = $('[data-ru="Text"]')
  assert.equal(t.getAttribute('data-ru-variant'), 'mono')
  assert.ok(t.style.fontFamily.includes('ui-monospace'), t.style.fontFamily)
  assert.equal(t.style.fontVariantNumeric, 'tabular-nums lining-nums')
  assert.equal(t.textContent, 'deadbeefcafe')
})
test('E8 Text body/caption render exactly as before (no mono styles leak, no marker)', async () => {
  await renderComponent({ id: 't', component: 'Text', props: { text: 'plain' } })
  const t = $('[data-ru="Text"]')
  assert.equal(t.getAttribute('data-ru-variant'), null)
  assert.equal(t.style.fontFamily, '')
  assert.equal(t.style.fontVariantNumeric, '')
  assert.equal(t.style.fontSize, '13px')
  await renderComponent({ id: 't', component: 'Text', props: { text: 'cap', variant: 'caption' } })
  assert.equal($('[data-ru="Text"]').style.fontSize, '11px')
  assert.equal($('[data-ru="Text"]').getAttribute('data-ru-variant'), null)
})
test('E8 mono escapes, never renders HTML (L2/L3: jsx escapes)', async () => {
  await renderComponent({ id: 't', component: 'Text', props: { text: '<b>x</b>', variant: 'mono' } })
  assert.equal($('[data-ru="Text"]').querySelector('b'), null, 'no live element from markup')
  assert.ok($('[data-ru="Text"]').textContent.includes('<b>x</b>'))
})

// ---- E9 Callout tone error ----
test('E9 Callout tone=error uses --ui-red', async () => {
  await renderComponent({ id: 'c', component: 'Callout', props: { title: 'Publish failed', text: 'boom', tone: 'error' } })
  const c = $('[data-ru="Callout"]')
  assert.equal(c.getAttribute('data-ru-tone'), 'error')
  assert.ok(c.style.borderLeft.includes('--ui-red'), c.style.borderLeft)
})
test('E9 existing tones unchanged (info/caution/success, fallback info)', async () => {
  for (const [tone, token] of [['caution', '--ui-yellow'], ['success', '--ui-green'], ['info', '--ui-accent']]) {
    await renderComponent({ id: 'c', component: 'Callout', props: { text: 'x', tone } })
    assert.ok($('[data-ru="Callout"]').style.borderLeft.includes(token), `${tone} -> ${token}`)
  }
  await renderComponent({ id: 'c', component: 'Callout', props: { text: 'x', tone: 'nope' } })
  assert.ok($('[data-ru="Callout"]').style.borderLeft.includes('--ui-accent'), 'unknown tone still falls back to info')
})
