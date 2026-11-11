// est-yehb8 (nightly census 2026-11-11): direct behavior pins for rowValuesFrom
// (desktop/src/components/rowfmt.mjs:25) — until now covered only indirectly via
// saved-card renders. One pin per observable branch; the PR body's mutant table
// shows each guard's mutant killed (test-teeth law, #45). Pins contract, not
// implementation — no source-text reads (R6).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rowValuesFrom } from '../desktop/src/components/rowfmt.mjs'

const m = (props) => ({ type: 'Metric', props })

test('non-array input yields null — array-like with 2 Metric-shaped entries included', () => {
  for (const t of [null, undefined, 'abc', {}, { length: 2, 0: m({ value: 1 }), 1: m({ value: 2 }) }]) {
    assert.strictEqual(rowValuesFrom(t), null, String(t))
  }
})

test('fewer than 2 tiles yields null', () => {
  assert.strictEqual(rowValuesFrom([]), null)
  assert.strictEqual(rowValuesFrom([m({ value: 7 })]), null)
})

test('non-Metric entry (carrying a value) yields null; missing entry yields null', () => {
  assert.strictEqual(rowValuesFrom([m({ value: 1 }), { type: 'Card', props: { value: 9 } }]), null)
  assert.strictEqual(rowValuesFrom([m({ value: 1 }), null]), null)
})

test('missing/null/non-number/non-finite values yield null', () => {
  for (const p of [{}, { value: null }, { value: '42' }, { value: NaN }, { value: Infinity }]) {
    assert.strictEqual(rowValuesFrom([m({ value: 1 }), m(p)]), null, String(p.value))
  }
})

test('a tile authored with format, unit or precision opts the whole row out', () => {
  for (const k of ['format', 'unit', 'precision']) {
    assert.strictEqual(rowValuesFrom([m({ value: 1 }), m({ value: 2, [k]: 'x' })]), null, k)
  }
})

test('happy path returns the numeric values in tile order', () => {
  assert.deepStrictEqual(rowValuesFrom([m({ value: 3 }), m({ value: 1 }), m({ value: 2 })]), [3, 1, 2])
})

test('zero and negative values are values, not absences', () => {
  assert.deepStrictEqual(rowValuesFrom([m({ value: 5 }), m({ value: 0 })]), [5, 0])
  assert.deepStrictEqual(rowValuesFrom([m({ value: -2 }), m({ value: -1 })]), [-2, -1])
})
