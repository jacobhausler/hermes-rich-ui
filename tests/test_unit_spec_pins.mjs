// est-yue73: direct behavior pins for the unitSpec export — the AD-11 format x unit
// matrix, a zero-reference export flagged by the 2026-11-12 nightly census (sweep-c).
// One pin per dispatch branch; behavior-only reads (R6): no source-text introspection.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unitSpec } from '../desktop/src/components/fmt.mjs'

const A = assert.equal

test('currency: ISO code wins clean; non-code units contra or USD-default', () => {
  const clean = unitSpec('currency', 'EUR')
  A(clean.cls, 'currency'); A(clean.currency, 'EUR'); A(clean.suffix, ''); A(clean.contra, undefined)
  A(JSON.stringify(unitSpec('currency', ' EUR ')), JSON.stringify(clean))
  A(unitSpec('currency', '€').currency, 'EUR')
  for (const [u, cur, suf, con] of [['widgets', 'USD', 'widgets', true], ['eur', 'USD', 'eur', true],
    ['XYZ', 'USD', 'XYZ', true], [undefined, 'USD', '', undefined], [42, 'USD', '', undefined]]) {
    const s = unitSpec('currency', u)
    A(s.cls, 'currency'); A(s.currency, cur); A(s.suffix, suf); A(s.contra, con)
  }
})

test('percent/fraction + no unit or %: cls percent, scale 1 vs 100; % matches bare', () => {
  A(unitSpec('percent').cls, 'percent'); A(unitSpec('percent').scale, 1)
  A(JSON.stringify(unitSpec('percent', '%')), JSON.stringify(unitSpec('percent')))
  A(unitSpec('fraction').cls, 'percent'); A(unitSpec('fraction').scale, 100)
  A(JSON.stringify(unitSpec('fraction', '%')), JSON.stringify(unitSpec('fraction')))
})

test('pp/bp ride as points on percent only; fraction + pp contra at scale 100; word rides contra', () => {
  for (const u of ['pp', 'bp']) {
    const s = unitSpec('percent', u)
    A(s.cls, 'points'); A(s.suffix, u); A(s.contra, undefined); A(s.scale, 1)
  }
  const f = unitSpec('fraction', 'pp')
  A(f.cls, 'percent'); A(f.suffix, 'pp'); A(f.contra, true); A(f.scale, 100)
  const w = unitSpec('percent', ' widgets ')
  A(w.cls, 'percent'); A(w.suffix, 'widgets'); A(w.contra, true); A(w.scale, 1)
})

test('number or no format + no unit: bare; the currency key rides on every spec', () => {
  for (const f of ['number', undefined]) {
    const s = unitSpec(f)
    A(s.cls, 'bare'); A(s.suffix, ''); A(s.scale, 1); A(s.currency, 'USD'); A(s.contra, undefined)
  }
  for (const s of [unitSpec('number', 'pp'), unitSpec('percent', 'kg'), unitSpec('fraction')])
    A('currency' in s, true)
})

test('number format infers the class from the unit', () => {
  A(unitSpec('number', '%').cls, 'percent')
  A(unitSpec('number', 'EUR').cls, 'currency'); A(unitSpec('number', 'EUR').currency, 'EUR')
  A(unitSpec('number', 'pp').cls, 'points'); A(unitSpec('number', 'pp').suffix, 'pp')
  for (const u of ['°C', '‰', '×3', '/s']) { const s = unitSpec('number', u); A(s.cls, 'attached'); A(s.suffix, u) }
  const w = unitSpec('number', ' kg ')
  A(w.cls, 'word'); A(w.suffix, 'kg')
})
