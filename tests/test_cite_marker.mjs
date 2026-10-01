// #26: citation numbers are renderer-derived indices, not authored identifiers.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import './helpers/render.mjs'
import { TYPE, INK } from '../desktop/src/components/_house.mjs'
const shared = await import('../desktop/src/components/_shared.mjs')

const sources = Array.from({ length: 9 }, (_, i) => ({ id: `src-${i + 1}`, kind: 'web', label: `Reference ${i + 1}` }))
const ids = (...ns) => ns.map(n => `src-${n}`)
function marker(ns, list = sources) {
  const node = shared.citeMarker?.(ns, list)
  assert.ok(node, 'a known id yields a marker')
  assert.equal(node.type, 'sup')
  assert.deepEqual(Object.fromEntries(['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'].map(k => [k, node.props.style?.[k]])), TYPE.micro)
  assert.equal(node.props.style?.color, INK.meta)
  assert.equal(node.props.style?.verticalAlign, 'super')
  return node
}

test('D10: runs of three collapse to an en-dash, with an aria-label in words', () => {
  const m = marker(ids(4, 2, 3, 3))
  assert.equal(m.props.children, '2–4')
  assert.equal(m.props['aria-label'], 'sources 2 to 4')
})
test('D10: more than four resulting tokens show three and +N', () => {
  const m = marker(ids(9, 3, 1, 7, 5))
  assert.equal(m.props.children, '1,3,5 +2')
  assert.equal(m.props['aria-label'], 'sources 1, 3, 5, 7, and 9')
})
test('D10: contiguous runs collapse only at length three and preserve a trailing singleton', () => {
  const m = marker(ids(5, 3, 1, 2))
  assert.equal(m.props.children, '1–3,5')
  assert.equal(m.props['aria-label'], 'sources 1 to 3 and 5')
  assert.equal(marker(ids(2, 1)).props.children, '1,2', 'two is not a run')
})
test('D10: an unknown id is never rendered or counted, even beside a known id', () => {
  assert.equal(shared.citeMarker?.(['missing'], sources), null)
  assert.equal(marker(['missing', 'src-4']).props.children, '4')
  assert.equal(shared.citeMarker?.([], sources), null)
})
