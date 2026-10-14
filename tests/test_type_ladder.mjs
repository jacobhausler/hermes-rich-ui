// #25: observable type ladder, not a source snapshot. A saved-card render is the census.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { React, act, renderComponent, mount, registry } from './helpers/render.mjs'
const { TYPE } = await import('../desktop/src/components/_house.mjs')
const { type } = await import('../desktop/src/components/_shared.mjs')

const EXPECTED = {
  kpi: [20, 600, 26, '-0.01em'], title: [16, 600, 22, '-0.01em'],
  h2: [14, 600, 20, '0em'], h3: [13, 600, 18, '0em'],
  body: [13, 400, 19, '0em'], h4: [12, 600, 17, '0em'],
  small: [12, 400, 17, '0em'], caption: [11, 400, 16, '0em'],
  eyebrow: [11, 600, 16, '0.04em'], micro: [10, 400, 12, '0em']
}
const quad = s => [s.fontSize, s.fontWeight, s.lineHeight, s.letterSpacing]
for (const row of Object.values(EXPECTED)) row[2] += 'px'

test('all named steps spread the exact four-property ramp, only 400/600', () => {
  assert.deepEqual(Object.keys(TYPE).sort(), Object.keys(EXPECTED).sort())
  for (const [step, expected] of Object.entries(EXPECTED)) {
    assert.deepEqual(quad(TYPE[step]), expected, step)
    assert.deepEqual(quad(type(step)), expected, `type(${step})`)
  }
  assert.deepEqual(quad(type('small', { mono: true, num: true, caps: true })), [12, 400, '17px', '0em'])
  assert.match(type('small', { mono: true }).fontFamily, /monospace/)
  assert.match(type('small', { num: true }).fontVariantNumeric, /tabular-nums/)
  assert.equal(type('caption', { caps: true }).textTransform, 'uppercase')
  assert.deepEqual(quad(type('caption', { caps: true })), [11, 400, '16px', '0em'], 'caps does not borrow eyebrow tracking')
  assert.ok(Object.values(TYPE).every(s => s.fontWeight !== 500))
})

test('R1 structural order and content floor come from the table', () => {
  const size = step => TYPE[step].fontSize
  assert.ok(size('title') > size('h2') && size('h2') > size('h3'))
  assert.ok(size('h3') >= size('body') && size('body') >= size('h4'))
  assert.equal(size('h4'), size('small'))
  assert.ok(size('small') > size('caption') && size('caption') > size('micro'))
  assert.ok(size('kpi') > size('title'))
  assert.ok(['title', 'h2', 'h3', 'h4', 'eyebrow'].every(s => size(s) <= size('title')))
  assert.ok(['body', 'small', 'caption', 'eyebrow'].every(s => size(s) >= 11))
})

test('Heading 1–5, absent level, and every quad defeat prose inheritance', async () => {
  for (const [level, step] of [[1, 'title'], [2, 'h2'], [3, 'h3'], [4, 'h4'], [5, 'eyebrow'], [undefined, 'h2']]) {
    await renderComponent({ id: 'h', component: 'Heading', props: { text: 'Section', ...(level ? { level } : {}) } })
    const el = mount.querySelector('[data-ru="Heading"]')
    assert.equal(el.tagName, `H${level || 2}`)
    const expected = EXPECTED[step]
    assert.deepEqual([el.style.fontSize, el.style.fontWeight, el.style.lineHeight, el.style.letterSpacing],
      [`${expected[0]}px`, String(expected[1]), expected[2], expected[3]], String(level))
    assert.equal(el.style.textTransform, level === 5 ? 'uppercase' : '', String(level))
  }
})

// Only uPlot owns text outside our type() path. The remaining micro-sized
// exceptions are pinned rendered quads, not exemptions from the census.
const EXEMPT = new Map([
  ['chart.mjs:580 uPlot canvas labels', '[data-richui="chart-canvas"]']
])
const PINNED_MICRO = new Map([
  ['sparkline trend glyph', '[data-ru="Sparkline"] [data-ru-chip][aria-hidden="true"]'],
  ['CodeBlock language pill', '[data-ru="CodeBlock"] [data-ru-lang]'],
  ['DataTable citation', '[data-ru="DataTable"] [data-ru-citation]']
])
const CHIP_LABEL = '[data-ru="ChipSet"] [data-ru-chip]'
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const saved = ['ru-f3af0e45428d', 'ru-c69fc582e9a9', 'ru-97cb020cd21b', 'ru-000000000022']
const { CardBody } = await import('../desktop/src/card.mjs')
const { createRoot } = await import('react-dom/client')
const cardMount = document.createElement('div')
document.body.append(cardMount)
const cardRoot = createRoot(cardMount)

test('saved-card rendered text pairs are ramp-only or named shrinking exemptions', async () => {
  const pairs = new Set(Object.values(EXPECTED).map(([size, weight]) => `${size}/${weight}`))
  let checked = 0
  let markers = 0
  let chipLabels = 0
  const pinned = new Map([...PINNED_MICRO.keys()].map(name => [name, 0]))
  for (const name of saved) {
    const record = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/saved', name + '.json'), 'utf8'))
    await act(async () => { cardRoot.render(React.createElement(CardBody, { record, registry })) })
    for (const [kind, selector] of PINNED_MICRO) {
      for (const el of cardMount.querySelectorAll(selector)) {
        assert.deepEqual([el.style.fontSize, el.style.fontWeight, el.style.lineHeight, el.style.letterSpacing],
          ['10px', '400', '12px', '0em'], `${name} ${kind} rendered micro quad`)
        pinned.set(kind, pinned.get(kind) + 1)
      }
    }
    for (const chip of cardMount.querySelectorAll(CHIP_LABEL)) {
      assert.deepEqual([chip.style.fontSize, chip.style.fontWeight, chip.style.lineHeight, chip.style.letterSpacing],
        ['11px', '400', '16px', '0em'], `${name} authored ChipSet label caption quad`)
      chipLabels++
    }
    // Citation markers are provenance chrome: micro (10px) is permitted below the
    // content floor, but the full rendered quad is not exempt from the ramp.
    for (const sup of cardMount.querySelectorAll('sup[data-ru-citation]')) {
      assert.deepEqual([sup.style.fontSize, sup.style.fontWeight, sup.style.lineHeight, sup.style.letterSpacing],
        ['10px', '400', '12px', '0em'], `${name} citation marker micro quad`)
      markers++
    }
    const walk = document.createTreeWalker(cardMount, 4)
    for (let node = walk.nextNode(); node; node = walk.nextNode()) {
      if (!node.textContent.trim()) continue
      const el = node.parentElement
      if (!el.closest('[data-ru]')) continue
      if ([...EXEMPT.values()].some(sel => el.closest(sel))) continue
      let size, weight
      for (let ancestor = el; ancestor && ancestor !== cardMount; ancestor = ancestor.parentElement) {
        size ||= ancestor.style?.fontSize
        weight ||= ancestor.style?.fontWeight
      }
      assert.ok(size && weight, `${name} ${el.outerHTML.slice(0, 140)} has explicit size and weight`)
      assert.ok(pairs.has(`${parseFloat(size)}/${weight}`), `${name} ${el.textContent.slice(0, 40)}: ${size}/${weight}`)
      if (!el.closest('sup[data-ru-citation]') && ![...PINNED_MICRO.values()].some(sel => el.closest(sel)))
        assert.ok(parseFloat(size) >= 11, `${name} content floor: ${el.textContent.slice(0, 40)}`)
      checked++
    }
  }
  assert.ok(checked > 120, `census checked ${checked} saved text nodes`)
  assert.ok(markers > 0, 'saved cards exercise citation markers')
  assert.ok(chipLabels > 0, 'saved cards exercise authored ChipSet labels')
  for (const [kind, count] of pinned) assert.ok(count > 0, `saved cards exercise ${kind}`)
})
