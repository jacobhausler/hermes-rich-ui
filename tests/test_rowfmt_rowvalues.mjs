// #29 (KPI row): direct behavior pins for the rowValuesFrom export (rui nightly census 2026-11-11).
// grid.mjs calls it with the child Metric elements to share one fmtSet across a number row;
// until now the export carried 0 direct test references (coverage was indirect, via saved-card
// renders only). These pins close that gap. Pure function: no DOM, no theme; behavior-only,
// no source-text reads (R6). Mutant-proven per the test-teeth law (#45) — ledger in the PR body.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rowValuesFrom } from '../desktop/src/components/rowfmt.mjs'

const m = (props) => ({ type: 'Metric', props: { ...props } })

test('#29 rowValuesFrom returns the values in input order when every tile is a plain number tile', () => {
  assert.deepEqual(rowValuesFrom([m({ value: 7 }), m({ value: 3.5 })]), [7, 3.5])
  // order is the authored order, not sorted, not scaled
  assert.deepEqual(rowValuesFrom([m({ value: 1e9 }), m({ value: 2 }), m({ value: -0.5 })]), [1e9, 2, -0.5])
})

test('#29 rowValuesFrom returns null for a non-array or short tile list', () => {
  for (const bad of [undefined, null, {}, 'ab', 42]) assert.equal(rowValuesFrom(bad), null)
  assert.equal(rowValuesFrom([]), null)
  assert.equal(rowValuesFrom([m({ value: 1 })]), null) // the >=2 guard: a lone tile formats alone
})

test('#29 rowValuesFrom returns null when any entry is not a Metric tile (even with a live value)', () => {
  assert.equal(rowValuesFrom([m({ value: 1 }), { type: 'Text', props: { value: 5 } }]), null)
  assert.equal(rowValuesFrom([m({ value: 1 }), { props: { value: 5 } }]), null) // type missing
  assert.equal(rowValuesFrom([m({ value: 1 }), null]), null)
})

test('#29 rowValuesFrom returns null for a missing, non-number or non-finite value', () => {
  assert.equal(rowValuesFrom([m({ value: 1 }), m({})]), null)             // value absent
  assert.equal(rowValuesFrom([m({ value: 1 }), m({ value: null })]), null)
  assert.equal(rowValuesFrom([m({ value: 1 }), m({ value: '7' })]), null) // string is not a number
  assert.equal(rowValuesFrom([m({ value: 1 }), m({ value: NaN })]), null)
  assert.equal(rowValuesFrom([m({ value: 1 }), m({ value: Infinity })]), null)
})

test('#29 rowValuesFrom returns null when any tile authors format, unit or precision', () => {
  assert.equal(rowValuesFrom([m({ value: 1, format: 'k' }), m({ value: 2 })]), null)
  assert.equal(rowValuesFrom([m({ value: 1 }), m({ value: 2, unit: '%' })]), null)
  assert.equal(rowValuesFrom([m({ value: 1 }), m({ value: 2, precision: 1 })]), null)
})

test('#29 a key authored as undefined is absent, not authored: the tile stays a plain number tile', () => {
  assert.deepEqual(rowValuesFrom([m({ value: 1, format: undefined }), m({ value: 2, precision: undefined })]), [1, 2])
})
