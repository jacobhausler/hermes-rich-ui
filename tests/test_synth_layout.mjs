// L7 E-pack item 1 (layout sugar): E1 Card footer, E2 Stack align, E4 Divider
// orientation, E5 Tabs defaultTab, E7 Heading level 4 — plus the L8 additive-law
// pins: ABSENT prop must keep the pre-E-pack render exactly.
import { test } from 'node:test'
import { assert, renderComponent, renderSpec, $, $$ } from './helpers/render.mjs'

// The Renderer reconciles positionally: a stateful root (Tabs) keeps its useState fiber
// across renderSpec calls. Flush an unrelated root in between to force a fresh mount.
const flush = () => renderSpec({ root: 'f', elements: { f: { type: 'Text', props: { text: '' }, children: [] } } })

const textEl = (id, t) => ({ id, type: 'Text', props: { text: t }, children: [] })

// ---- E1 Card footer ----
test('E1 Card footer renders a caption line under children', async () => {
  await renderSpec({ root: 'root', elements: {
    root: { type: 'Card', props: { title: 'T', footer: 'as of report version' }, children: ['t'] },
    t: textEl('t', 'body')
  } })
  const f = $('[data-ru="Card"] [data-ru-footer]')
  assert.ok(f, 'footer element present')
  assert.equal(f.textContent, 'as of report version')
  assert.ok(f.compareDocumentPosition($('[data-ru="Card"] [data-ru="Text"]')) & 2, 'footer sits after children')
})
test('E1 Card without footer renders exactly as before (no extra node)', async () => {
  await renderSpec({ root: 'root', elements: {
    root: { type: 'Card', props: { title: 'T' }, children: ['t'] },
    t: textEl('t', 'body')
  } })
  assert.equal($('[data-ru="Card"] [data-ru-footer]'), null)
  assert.ok(!$('[data-ru="Card"]').textContent.includes('version'))
})

// ---- E2 Stack align ----
test('E2 Stack align maps to the cross-axis; absent keeps defaults', async () => {
  await renderComponent({ id: 's', component: 'Stack', props: { align: 'center', children: ['a'] }, children: ['a'] })
  const st = $('[data-ru="Stack"]')
  assert.equal(st.style.alignItems, 'center')
  assert.equal(st.getAttribute('data-ru-align'), 'center')
  await renderComponent({ id: 's', component: 'Stack', props: { direction: 'horizontal', align: 'end', children: ['a'] }, children: ['a'] })
  assert.equal($('[data-ru="Stack"]').style.alignItems, 'flex-end')
  // defaults (L8): vertical stretch, horizontal flex-start, no align marker
  await renderComponent({ id: 's', component: 'Stack', props: { children: ['a'] }, children: ['a'] })
  assert.equal($('[data-ru="Stack"]').style.alignItems, 'stretch')
  assert.equal($('[data-ru="Stack"]').getAttribute('data-ru-align'), null)
  await renderComponent({ id: 's', component: 'Stack', props: { direction: 'horizontal', children: ['a'] }, children: ['a'] })
  assert.equal($('[data-ru="Stack"]').style.alignItems, 'flex-start')
})

// ---- E4 Divider orientation ----
test('E4 Divider orientation=vertical is a width-1 rule, not the flex:1;height:1 stub', async () => {
  await renderComponent({ id: 'd', component: 'Divider', props: { orientation: 'vertical' } })
  const d = $('[data-ru="Divider"]')
  assert.equal(d.getAttribute('data-ru-orientation'), 'vertical')
  assert.equal(d.getAttribute('aria-orientation'), 'vertical')
  const rule = d.children[0]
  assert.equal(rule.style.width, '1px', 'vertical rule is 1px WIDE')
  assert.notEqual(rule.style.height, '1px', 'vertical rule is NOT the horizontal stub height')
  assert.notEqual(rule.style.flex, '1 0 auto', 'no flex-grow stub')
})
test('E4 Divider default stays the horizontal rule exactly', async () => {
  await renderComponent({ id: 'd', component: 'Divider', props: { label: 'details' } })
  const d = $('[data-ru="Divider"]')
  assert.equal(d.getAttribute('data-ru-orientation'), null)
  assert.equal(d.getAttribute('aria-orientation'), null)
  assert.equal(d.children[0].style.height, '1px', 'horizontal stub intact')
  assert.ok(d.textContent.includes('details'))
})

// ---- E5 Tabs defaultTab ----
// NOTE: unique root id per mount — re-rendering the SAME element id keeps React state
// (useState would leak the previous test's active tab into the next assertion).
let tabsN = 0
const tabsSpec = (props) => {
  const id = 'tabs' + (++tabsN)
  return { root: id, elements: {
    [id]: { type: 'Tabs', props: { tabs: [{ title: 'A', child: 'a' + tabsN }, { title: 'B', child: 'b' + tabsN }], ...props }, children: ['a' + tabsN, 'b' + tabsN] },
    ['a' + tabsN]: textEl('a' + tabsN, 'panel one body'), ['b' + tabsN]: textEl('b' + tabsN, 'panel two body')
  } }
}
test('E5 Tabs defaultTab seeds the active panel', async () => {
  await flush()
  await renderSpec(tabsSpec({ defaultTab: 1 }))
  assert.ok($('[data-ru="Tabs"]').textContent.includes('panel two body'))
  assert.ok(!$('[data-ru="Tabs"]').textContent.includes('panel one body'))
  assert.equal($('[data-ru="Tabs"]').querySelectorAll('[role="tab"]')[1].getAttribute('aria-selected'), 'true')
})
test('E5 Tabs defaultTab clamps out-of-range (past-end -> last, negative -> 0)', async () => {
  await flush()
  await renderSpec(tabsSpec({ defaultTab: 99 }))
  assert.equal($('[data-ru="Tabs"]').getAttribute('data-ru-default-tab'), '1', 'clamped to last')
  assert.ok($('[data-ru="Tabs"]').textContent.includes('panel two body'))
  await flush()
  await renderSpec(tabsSpec({ defaultTab: -3 }))
  assert.equal($('[data-ru="Tabs"]').getAttribute('data-ru-default-tab'), '0', 'clamped to first')
  assert.ok($('[data-ru="Tabs"]').textContent.includes('panel one body'))
})
test('E5 Tabs without defaultTab still opens tab 0 (L8 default)', async () => {
  await flush()
  await renderSpec(tabsSpec({}))
  assert.equal($('[data-ru="Tabs"]').getAttribute('data-ru-default-tab'), null)
  assert.ok($('[data-ru="Tabs"]').textContent.includes('panel one body'))
})

// ---- E7 Heading level 4 ----
test('E7 Heading level 4 renders h4 at size 12', async () => {
  await renderComponent({ id: 'h', component: 'Heading', props: { text: 'sub', level: 4 } })
  const h = $('[data-ru="Heading"]')
  assert.equal(h.tagName, 'H4')
  assert.equal(h.style.fontSize, '12px')
})
test('E7 Heading default/unknown level still falls back to h2 (L8 default)', async () => {
  await renderComponent({ id: 'h', component: 'Heading', props: { text: 'x' } })
  assert.equal($('[data-ru="Heading"]').tagName, 'H2')
  await renderComponent({ id: 'h', component: 'Heading', props: { text: 'x', level: 5 } })
  assert.equal($('[data-ru="Heading"]').tagName, 'H2', 'level 5 stays non-admitted fallback')
})
