// #24 (AD-11): direct behavior pins for the unitSpec export (rui nightly pass 2026-11-12, sweep-c).
// unitSpec is the format x unit matrix every face consults to decide where a unit prints; until
// now it carried 0 direct test references. Pure function: no DOM, no theme; behavior-only, no
// source-text reads (R6). Mutant-proven per the test-teeth law (#45) — ledger in the PR body.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unitSpec } from '../desktop/src/components/fmt.mjs'

const sp = (cls, x) => ({ cls, suffix: '', scale: 1, currency: 'USD', ...x })

test('#24 currency: ISO4217 codes pass through trimmed, case-strict; symbols resolve by table', () => {
  assert.deepEqual(unitSpec('currency', 'EUR'), sp('currency', { currency: 'EUR' }))
  assert.deepEqual(unitSpec('currency', ' eur '), sp('currency', { suffix: 'eur', contra: true }))
  assert.deepEqual(unitSpec('currency', '€'), sp('currency', { currency: 'EUR' }))
  assert.deepEqual(unitSpec('currency', 'AAA'), sp('currency', { suffix: 'AAA', contra: true }))
})

test('#24 currency: an absent unit defaults USD; a non-string unit is absent, not contra', () => {
  for (const u of [undefined, '', '   ', null, 5]) assert.deepEqual(unitSpec('currency', u), sp('currency'))
})

test('#24 currency contra: format wins and the unknown unit rides as a word suffix (AD-11)', () => {
  assert.deepEqual(unitSpec('currency', 'Meters'), sp('currency', { suffix: 'Meters', contra: true }))
})

test('#24 percent/fraction: % and an absent unit print percent; fraction rescales by 100', () => {
  for (const u of [undefined, '', '%']) {
    assert.deepEqual(unitSpec('percent', u), sp('percent'))
    assert.deepEqual(unitSpec('fraction', u), sp('percent', { scale: 100 }))
  }
})

test('#24 points: pp/bp is a percent-format affordance — fraction+pp stays contra percent', () => {
  assert.deepEqual(unitSpec('percent', 'pp'), sp('points', { suffix: 'pp' }))
  assert.deepEqual(unitSpec('percent', 'bp'), sp('points', { suffix: 'bp' }))
  assert.deepEqual(unitSpec('fraction', 'pp'), sp('percent', { scale: 100, suffix: 'pp', contra: true }))
})

test('#24 percent contra: a foreign unit rides as a word; the scale follows the format, never the unit', () => {
  assert.deepEqual(unitSpec('percent', 'kg'), sp('percent', { suffix: 'kg', contra: true }))
  assert.deepEqual(unitSpec('fraction', 'kg'), sp('percent', { scale: 100, suffix: 'kg', contra: true }))
})

test('#24 no-format: unitless is bare, % detects percent, an ISO code detects currency', () => {
  assert.deepEqual(unitSpec('number'), sp('bare'))
  assert.deepEqual(unitSpec('number', '%'), sp('percent'))
  assert.deepEqual(unitSpec('number', 'GBP'), sp('currency', { currency: 'GBP' }))
})

test('#24 no-format classes: pp/bp points, leading-sign units attached, everything else a word', () => {
  assert.deepEqual(unitSpec('number', 'pp'), sp('points', { suffix: 'pp' }))
  for (const u of ['°C', '‰', '×10', '/s']) assert.deepEqual(unitSpec('number', u), sp('attached', { suffix: u }))
  assert.deepEqual(unitSpec('number', 'Meters'), sp('word', { suffix: 'Meters' }))
})
