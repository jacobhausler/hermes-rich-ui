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

test('all named steps spread the exact four-property ramp, only 400/600', () => {
  assert.deepEqual(Object.keys(TYPE).sort(), Object.keys(EXPECTED).sort())
  for (const [step, expected] of Object.entries(EXPECTED)) {
    assert.deepEqual(quad(TYPE[step]), expected, step)
    assert.deepEqual(quad(type(step)), expected, `type(${step})`)
  }
  assert.deepEqual(quad(type('small', { mono: true, num: true, caps: true })), [12, 400, 17, '0.04em'])
  assert.match(type('small', { mono: true }).fontFamily, /monospace/)
  assert.match(type('small', { num: true }).fontVariantNumeric, /tabular-nums/)
  assert.equal(type('caption', { caps: true }).textTransform, 'uppercase')
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
      [`${expected[0]}px`, String(expected[1]), `${expected[2]}px`, expected[3]], String(level))
    assert.equal(el.style.textTransform, level === 5 ? 'uppercase' : '', String(level))
  }
})

// EXEMPT is a shrinking list: non-text glyphs / SDK-owned chrome, never authored content.
// File:line points to the owner of each exemption at the base of #25.
const EXEMPT = new Map([
  ['_shared.mjs:58 Badge SDK chip', '[data-ru="Badge"]'],
  ['_shared.mjs:77 citation superscript', '[data-ru-sources]'],
  ['chart.mjs:580 uPlot canvas labels', '[data-richui="chart-canvas"]'],
  ['sparkline.mjs:122 trend glyph', '[data-ru-chip]'],
  ['accordion.mjs:19 chevron glyph', '[data-ru="Accordion"] button > span:first-child'],
  ['codeblock.mjs:15 language chrome pill', '[data-ru-lang]']
])
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const saved = ['ru-f3af0e45428d', 'ru-c69fc582e9a9', 'ru-97cb020cd21b', 'ru-000000000022']
const { CardBody } = await import('../desktop/src/card.mjs')
const { createRoot } = await import('react-dom/client')
const cardRoot = createRoot(mount)

test('saved-card rendered text pairs are ramp-only or named shrinking exemptions', async () => {
  const pairs = new Set(Object.values(EXPECTED).map(([size, weight]) => `${size}/${weight}`))
  let checked = 0
  for (const name of saved) {
    const record = JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures/saved', name + '.json'), 'utf8'))
    await act(async () => { cardRoot.render(React.createElement(CardBody, { record, registry })) })
    const walk = document.createTreeWalker(mount, 4)
    for (let node = walk.nextNode(); node; node = walk.nextNode()) {
      if (!node.textContent.trim()) continue
      const el = node.parentElement
      if (!el.closest('[data-ru]')) continue
      if ([...EXEMPT.values()].some(sel => el.closest(sel))) continue
      let size, weight
      for (let ancestor = el; ancestor && ancestor !== mount; ancestor = ancestor.parentElement) {
        size ||= ancestor.style?.fontSize
        weight ||= ancestor.style?.fontWeight
      }
      assert.ok(size && weight, `${name} ${el.outerHTML.slice(0, 140)} has explicit size and weight`)
      assert.ok(pairs.has(`${parseFloat(size)}/${weight}`), `${name} ${el.textContent.slice(0, 40)}: ${size}/${weight}`)
      assert.ok(parseFloat(size) >= 11, `${name} content floor: ${el.textContent.slice(0, 40)}`)
      checked++
    }
  }
  assert.ok(checked > 120, `census checked ${checked} saved text nodes`)
  assert.ok(EXEMPT.size <= 6, 'exemption list may only shrink')
})
