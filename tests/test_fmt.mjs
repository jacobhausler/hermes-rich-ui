// Slice 1 golden faces (#24; DEFAULTS-SPEC D1, D2, D2.1, D3, D5, AD-1..AD-5, AD-11, AD-17, S1, C11-C13).
// Pure module: no DOM, no theme. Word units join with NBSP (D2); the face minus is U+2212, the readout's is ASCII.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HOUSE, SIG, COMPACT_FROM, TIERS, SCI_BELOW, LOCALE, MINUS } from '../desktop/src/components/_house.mjs'
import { num, fmt, fmtSet, fmtColumn, fmtPair, fmtTicks, UNIT_TABLE, unitLabel, axisTitle } from '../desktop/src/components/fmt.mjs'

const N = '\u00a0' // NBSP
const row = a => a.join(' · ')
const USD = { unit: 'USD' }

test('_house: number constants only, frozen', () => {
  assert.deepEqual(Object.keys(HOUSE).sort(), ['COMPACT_FROM', 'LOCALE', 'MINUS', 'SCI_BELOW', 'SIG', 'TIERS'])
  assert.ok(Object.isFrozen(HOUSE) && Object.isFrozen(TIERS))
  assert.deepEqual([SIG, COMPACT_FROM, [...TIERS], SCI_BELOW, LOCALE, MINUS], [3, 10000, ['k', 'M', 'B', 'T'], 1e-4, 'en-US', '\u2212'])
  assert.throws(() => { 'use strict'; HOUSE.SIG = 4 })
})

const GOLDEN = [0, 0.5, 3.14, 1234, 12345, 1234567, 2.5e9, -1900, 999950, 9999.6, 0.3, 0.0000123]
test('D1 golden face row', () => {
  assert.equal(row(GOLDEN.map(v => fmt(v))), '0 · 0.5 · 3.14 · 1234 · 12.3k · 1.23M · 2.5B · \u22121900 · 1M · 10k · 0.3 · 1.23×10⁻⁵')
})
test('D3 golden readout row: grouped, exact to 15 s.f., ASCII minus', () => {
  assert.equal(row(GOLDEN.map(v => fmt(v, { level: 'exact' }))),
    '0 · 0.5 · 3.14 · 1,234 · 12,345 · 1,234,567 · 2,500,000,000 · -1,900 · 999,950 · 9,999.6 · 0.3 · 0.0000123')
})
test('D1 edges: -0, float artefacts, scientific beyond 999T, strings verbatim, nulls', () => {
  assert.equal(fmt(-0), '0')
  assert.equal(fmt(0.1 + 0.2), '0.3')
  assert.equal(fmt(-0.00001), '\u22121×10⁻⁵')
  assert.equal(fmt(1e16), '1×10¹⁶')
  assert.equal(fmt(999e12), '999T')
  assert.equal(fmt(2026), '2026')                 // 1,000-9,999 bare: whole, ungrouped
  assert.equal(fmt(1234, { unit: 'req' }), `1,234${N}req`) // with a unit: grouped
  assert.equal(fmt(12345, { unit: 'req' }), `12.3k${N}req`)
  assert.equal(fmt('02139'), '02139')
  assert.equal(fmt('0.1.3'), '0.1.3')
  for (const v of [null, undefined, NaN, Infinity]) assert.equal(fmt(v), null)
})

test('D2/AD-1 money: a currency set under 10k shares cents', () => {
  assert.equal(row(fmtSet([1620.5, 12.34, 900], USD)), '$1,620.50 · $12.34 · $900.00')
  assert.equal(row(fmtSet([42, 1621], USD)), '$42 · $1,621')
  assert.equal(fmt(14.73, USD), '$14.73')
  assert.equal(fmt(4500, USD), '$4,500')
  assert.equal(fmt(18.2e6, USD), '$18.2M')
  assert.equal(fmt(0.004, USD), '$0.004')
  assert.equal(fmt(-1900, { unit: 'EUR' }), '\u2212€1,900')
  assert.equal(fmt(-1900, { unit: '€' }), '\u2212€1,900')
  assert.equal(fmt(-1900, { format: 'currency' }), '\u2212$1,900')
  assert.equal(fmt(5, { unit: 'CAD' }), 'CA$5')
  assert.equal(fmt(1e17, USD), '$100,000T')         // money is never scientific
  assert.equal(fmt(18.2e6, { ...USD, level: 'exact' }), '$18,200,000.00') // readout keeps the cents
})

test('D1/AD-4 landmarks: never 100%, never 0 for a nonzero', () => {
  assert.equal(fmt(99.96, { unit: '%' }), '99.96%')
  assert.equal(fmt(99.96, { format: 'percent' }), '99.96%')
  assert.equal(fmt(99.999, { format: 'percent' }), '99.999%')
  assert.equal(fmt(0.00004, { unit: '%' }), '<0.01%')
  assert.equal(fmt(99.96, { format: 'percent', precision: 1 }), '>99.9%')
  assert.equal(fmt(100, { format: 'percent' }), '100%')
  assert.equal(fmt(0.42, { format: 'fraction' }), '42%')
})

test('D2/AD-5 no unit ladder: the authored unit is the display rung', () => {
  assert.equal(fmt(1234, { unit: 'ms' }), `1,234${N}ms`)
  assert.equal(fmt(9120, { unit: 'GB' }), `9,120${N}GB`)
  assert.equal(fmt(512, { unit: 'B' }), `512${N}B`)
  assert.equal(fmt(1234567, { unit: 'ms' }), `1.23M${N}ms`)
  assert.equal(fmt(20.5, { unit: '°C' }), '20.5°C')
})

test('AD-11 format x unit contradiction: format wins, unit kept as a word unit', () => {
  assert.equal(fmt(12, { format: 'currency', unit: '%' }), `$12${N}%`)
  assert.equal(fmt(3, { format: 'percent', unit: 'USD' }), `3%${N}USD`)
  assert.equal(fmt(3, { format: 'fraction', unit: 'ms' }), `300%${N}ms`)
  assert.equal(fmt(5, { format: 'percent', unit: 'bp' }), `5${N}bp`) // not a contradiction: points
})

test('AD-3 collision: different exact values never share a face', () => {
  const f = fmtSet([12340, 12344, 12341, 12342])
  assert.equal(new Set(f).size, 4, row(f))
  assert.equal(row(f), '12,340 · 12,344 · 12,341 · 12,342')
  assert.equal(row(fmtSet([12340, 12344], USD)), '$12,340 · $12,344')
})

test('AD-2 additivity: parts add up to the total at the displayed step', () => {
  const f = fmtSet([1232000, 1233000, 1234000, 3699000])
  assert.equal(row(f), '1.232M · 1.233M · 1.234M · 3.699M')
  const v = f.map(s => Number(s.replace('M', '')))
  assert.ok(Math.abs(v[0] + v[1] + v[2] - v[3]) < 1e-9, row(f))
  // no collision, but 1.11 + 1.22 + 1.33 ≠ 3.67: the guard widens; opting out keeps 3 s.f.
  assert.equal(row(fmtSet([1114000, 1224000, 1334000, 3672000])), '1.114M · 1.224M · 1.334M · 3.672M')
  assert.equal(row(fmtSet([1114000, 1224000, 1334000, 3672000], { additive: false })), '1.11M · 1.22M · 1.33M · 3.67M')
})

test('C13 pairs share one tier from the larger value', () => {
  assert.equal(fmtPair(7400, 10000, USD), '$7.4k / $10k')
  assert.equal(fmtPair(750, 1000, { unit: 'GB' }), `750 / 1,000${N}GB`)
})

test('S1/C11 ticks: face grouping rule, one tier per axis, decimals from the step', () => {
  assert.equal(row(fmtTicks([0, 500, 1000, 1500, 2000, 2500], USD)), '$0 · $500 · $1,000 · $1,500 · $2,000 · $2,500')
  assert.equal(row(fmtTicks([2018, 2019])), '2018 · 2019')
  assert.equal(row(fmtTicks([0, 5000, 10000])), '0 · 5k · 10k')
  assert.equal(row(fmtTicks([0, 5e8, 1e9])), '0 · 0.5B · 1B')
  assert.equal(row(fmtTicks([0, 0.25, 0.5])), '0 · 0.25 · 0.5')
})

test('D3 num(): face, exact, aria only when they differ, tabular lining numerals', () => {
  assert.deepEqual(num(-1234567.891, USD), { face: '\u2212$1.23M', exact: '-$1,234,567.891', aria: '-$1,234,567.891',
    style: { fontVariantNumeric: 'tabular-nums lining-nums' } })
  assert.deepEqual(num(42), { face: '42', exact: '42', aria: null, style: { fontVariantNumeric: 'tabular-nums lining-nums' } })
})

// D2.1: every non-∅ cell of the Unit Resolution Table, one example per cell (spec table values).
const P = (a, b, u, surface, sep) => fmtPair(a, b, { unit: u, surface, sep })
const CELLS = {
  bare: { face: fmt(12345), kv: fmt(12345, { surface: 'kv' }), pair: P(640, 1000), cell: fmtColumn([12345])[0], header: unitLabel('label'),
    ticks: row(fmtTicks([0, 5000, 10000])), heatCell: fmt(12345, { surface: 'heatCell' }), heatCaption: P(1, 9, undefined, 'heatCaption', ' → '), readout: fmt(12345, { level: 'exact' }) },
  currency: { face: fmt(18.2e6, USD), kv: fmt(1234, { ...USD, surface: 'kv' }), pair: P(7400, 10000, 'USD'), cell: fmtColumn([1234], USD)[0], header: unitLabel('label', USD),
    ticks: row(fmtTicks([0, 500], USD)), heatCell: fmtSet([1200, 15000], { ...USD, surface: 'heatCell' })[0], heatCaption: P(1, 9, 'USD', 'heatCaption', ' → '), readout: fmt(18.2e6, { ...USD, level: 'exact' }) },
  percent: { face: fmt(12.4, { unit: '%' }), kv: fmt(12.4, { unit: '%', surface: 'kv' }), pair: P(12, 40, '%'), cell: fmtColumn([12.4], { unit: '%' })[0], header: unitLabel('label', { unit: '%' }),
    ticks: row(fmtTicks([0, 50], { unit: '%' })), heatCell: fmt(12, { unit: '%', surface: 'heatCell' }), heatCaption: P(9, 95, '%', 'heatCaption', ' → '), readout: fmt(12.4, { unit: '%', level: 'exact' }) },
  points: { face: fmt(5, { unit: 'pp' }), kv: fmt(5, { unit: 'pp', surface: 'kv' }), pair: P(3, 5, 'pp'), cell: fmtColumn([5], { unit: 'pp' })[0], header: unitLabel('label', { unit: 'pp' }),
    ticks: row(fmtTicks([0, 5], { unit: 'pp' })), axisTitle: axisTitle({ unit: 'pp' }), heatCell: fmt(5, { unit: 'pp', surface: 'heatCell' }), heatCaption: P(1, 9, 'pp', 'heatCaption', ' → '), readout: fmt(5, { unit: 'pp', level: 'exact' }) },
  attached: { face: fmt(20.5, { unit: '°C' }), kv: fmt(20.5, { unit: '°C', surface: 'kv' }), pair: P(18, 20, '°C'), cell: fmtColumn([20.5], { unit: '°C' })[0], header: unitLabel('label', { unit: '°C' }),
    ticks: row(fmtTicks([0, 10], { unit: '°C' })), heatCell: fmt(20, { unit: '°C', surface: 'heatCell' }), heatCaption: P(18, 24, '°C', 'heatCaption', ' → '), readout: fmt(20.5, { unit: '°C', level: 'exact' }) },
  word: { face: fmt(1234, { unit: 'ms' }), kv: fmt(1234, { unit: 'ms', surface: 'kv' }), pair: P(640, 1000, 'rows'), cell: fmtColumn([1234], { unit: 'ms' })[0], header: unitLabel('label', { unit: 'ms' }),
    ticks: row(fmtTicks([0, 500, 1000], { unit: 'ms' })), axisTitle: axisTitle({ unit: 'ms' }), heatCell: fmt(1234, { unit: 'ms', surface: 'heatCell' }), heatCaption: P(1, 9, 'min', 'heatCaption', ' → '), readout: fmt(1234, { unit: 'ms', level: 'exact' }) }
}
const SPEC = {
  bare: { face: '12.3k', kv: '12.3k', pair: '640 / 1,000', cell: '12.3k', header: 'label', ticks: '0 · 5k · 10k', heatCell: '12.3k', heatCaption: '1 → 9', readout: '12,345' },
  currency: { face: '$18.2M', kv: '$1,234', pair: '$7.4k / $10k', cell: '$1,234', header: 'label', ticks: '$0 · $500', heatCell: '$1.2k', heatCaption: '$1 → $9', readout: '$18,200,000.00' },
  percent: { face: '12.4%', kv: '12.4%', pair: '12% / 40%', cell: '12.4%', header: 'label', ticks: '0% · 50%', heatCell: '12%', heatCaption: '9% → 95%', readout: '12.4%' },
  points: { face: `5${N}pp`, kv: `5${N}pp`, pair: `3 / 5${N}pp`, cell: '5', header: 'label (pp)', ticks: '0 · 5', axisTitle: 'pp', heatCell: '5', heatCaption: `1 → 9${N}pp`, readout: `5${N}pp` },
  attached: { face: '20.5°C', kv: '20.5°C', pair: '18°C / 20°C', cell: '20.5°C', header: 'label', ticks: '0°C · 10°C', heatCell: '20°C', heatCaption: '18°C → 24°C', readout: '20.5°C' },
  word: { face: `1,234${N}ms`, kv: `1,234${N}ms`, pair: `640 / 1,000${N}rows`, cell: '1,234', header: 'label (ms)', ticks: '0 · 500 · 1,000', axisTitle: 'ms', heatCell: '1,234', heatCaption: `1 → 9${N}min`, readout: `1,234${N}ms` }
}
test('D2.1/AD-17 UNIT_TABLE: one frozen const, six classes x ten surfaces', () => {
  assert.ok(Object.isFrozen(UNIT_TABLE) && Object.values(UNIT_TABLE).every(Object.isFrozen))
  assert.deepEqual(Object.keys(UNIT_TABLE), ['bare', 'currency', 'percent', 'points', 'attached', 'word'])
  for (const r of Object.values(UNIT_TABLE)) assert.deepEqual(Object.keys(r), ['face', 'kv', 'pair', 'cell', 'header', 'ticks', 'axisTitle', 'heatCell', 'heatCaption', 'readout'])
  for (const cls of ['bare', 'currency', 'percent', 'attached']) assert.equal(UNIT_TABLE[cls].axisTitle, null) // ∅
  assert.equal(axisTitle(USD), null)
})
for (const cls of Object.keys(SPEC)) {
  test(`D2.1 pinned cells: ${cls}`, () => { assert.deepEqual(CELLS[cls], SPEC[cls]) })
}
