// L8 saved-card law boundary (desktop/src/card.mjs:13-17): vintageOf sorts records by
// their envelope stamp — missing / non-string / unparsable = saved-first ('legacy');
// instants BEFORE NUMBER_TILES_CUTOVER are 'legacy'; at-or-after are 'house'. The
// compare is by instant, not by string: an offset-equivalent stamp is 'house'.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { resolve } from './helpers/fixtures-sdk-resolve.mjs'

registerHooks({ resolve })
const { vintageOf, NUMBER_TILES_CUTOVER } = await import('../desktop/src/card.mjs')

const rec = (created_at) => ({ envelope: { created_at } })

test('missing or non-string stamp is saved-first (legacy)', () => {
  for (const r of [undefined, {}, { envelope: {} }, rec(null), rec(1759878000000)]) {
    assert.equal(vintageOf(r), 'legacy')
  }
})

test('unparsable stamp string is legacy', () => {
  for (const s of ['', 'not-a-date', '2026-13-45T00:00:00Z']) {
    assert.equal(vintageOf(rec(s)), 'legacy')
  }
})

test('one second before cutover is legacy', () => {
  assert.equal(vintageOf(rec('2026-10-06T23:59:59Z')), 'legacy')
})

test('one second after cutover is house', () => {
  assert.equal(vintageOf(rec('2026-10-07T00:00:01Z')), 'house')
})

test('cutover instant in another offset is house (instant compare, not string)', () => {
  assert.equal(vintageOf(rec('2026-10-06T19:00:00-05:00')), 'house')
})

test('exactly at cutover is house', () => {
  assert.equal(vintageOf(rec(NUMBER_TILES_CUTOVER)), 'house')
})

test('cutover constant is the pinned instant', () => {
  assert.equal(NUMBER_TILES_CUTOVER, '2026-10-07T00:00:00Z')
})
