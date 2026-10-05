// #34: the fmt corpus — table faces as identity. Each entry: component ctx before → after
// faces. Identity pairs (before === after) prove the house face equals the authored face.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fmtColumn, fmt } from '../desktop/src/components/fmt.mjs'

const face = (v, ctx) => fmtColumn([v], ctx)[0]

test('table identity: currency with cents keeps cents as the identity face', () => {
  assert.equal(face(1620.50, { format: 'currency' }), '$1,620.50')
  assert.equal(face(1620.50, { format: 'currency' }), fmt(1620.50, { format: 'currency' }))
})
test('table one rung: uniform decimals across a column', () => {
  assert.deepEqual(fmtColumn([3.5, 2, 4.25, 1], { format: 'number', precision: 2 }), ['3.50', '2.00', '4.25', '1.00'])
})
test('table word unit: header carries the unit, cells are grouped digits', () => {
  assert.deepEqual(fmtColumn([9120, 412, 88], { format: 'number', unit: 'GB' }), ['9,120', '412', '88'])
})
test('table additivity: the first three faces sum to the fourth', () => {
  const f = fmtColumn([1232000, 1233000, 1234000, 3699000], { format: 'number' })
  const val = (s) => { const t = /([\d,]+(?:\.\d+)?)(k|M|B|T)?/.exec(s); return Number(t[1].replaceAll(',', '')) * ({ k: 1e3, M: 1e6, B: 1e9, T: 1e12 }[t[2]] ?? 1) }
  assert.equal(val(f[0]) + val(f[1]) + val(f[2]), val(f[3]), 'faces add: ' + f.join(' + ') + ' = ' + f[3])
})
test('table collision: neighbors never share a face', () => {
  const [a, b] = fmtColumn([23495, 23450], { format: 'currency', unit: 'EUR' })
  assert.notEqual(a, b, a + ' vs ' + b)
})
