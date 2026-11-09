// est-vgmex: direct behavior pins for the clean15 float-hygiene export (rui nightly pass 2026-11-09).
// metric.mjs imports clean15 as the single-sourced toPrecision path per the #39 printer census;
// until now fmt.mjs carried 0 direct test references to it. These pins close that gap.
// Pure module: no DOM, no theme. The pass-through cases rely on Infinity/NaN toPrecision
// round-tripping as their own names ("Infinity" -> Infinity, "NaN" -> NaN).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clean15 } from '../desktop/src/components/fmt.mjs'

test('clean15 erases binary float artifacts to 15 significant digits', () => {
  assert.equal(clean15(0.1 * 3), 0.3)              // 0.30000000000000004 -> 0.3
  assert.equal(clean15(1.0000000000000002), 1)
})

test('clean15 truncates beyond-precision integers deterministically', () => {
  assert.equal(clean15(1234567890123456789), 1234567890123460000)
})

test('clean15 passes non-finite values through unchanged', () => {
  assert.ok(Object.is(clean15(Infinity), Infinity))
  assert.ok(Object.is(clean15(-Infinity), -Infinity))
  assert.ok(Number.isNaN(clean15(NaN)))
})

test('clean15 leaves signed integers and zero unchanged', () => {
  for (const n of [-42, -1, 0, 1, 7]) assert.ok(Object.is(clean15(n), n))
  // measured, not assumed: (-0).toPrecision(15) renders "0.00000000000000", so the
  // hygiene pass maps -0 to +0 — callers must not rely on signed zero surviving.
  assert.ok(Object.is(clean15(-0), 0))
})
