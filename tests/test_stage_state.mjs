// est-6i54 S1 (rich-ui#57 ruling 2026-10-03, amendment 1): the five-token
// stage-state vocabulary is ONE state+color source in _shared.mjs — no second
// badge primitive (StateBadge is ruled out; #36's StatusMark table extends).
// Checklist items (S2), DataTable status cells and PhaseTracker (S3) all
// render through it. Failing-first: this file lands before the implementation.
//
// Pins:
//  - STAGE_STATE is exactly pending|active|done|blocked|skipped, in order.
//  - stageMark(state, key) -> {shape, kind, stroke, aria, dash?} for every
//    token; stroke is a --ui-* custom property only (#15 surface discipline).
//  - greyscale-distinct: (shape, dash, kind) is unique per token — shape,
//    not colour, discriminates (the #18 law).
//  - an unknown state returns null: admission rejects it at author time
//    naming the five tokens (the #38 discipline); the renderer never coerces.
//  - the #36/#18 legacy marks (done / notDone / unknown) are byte-stable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })

const shared = await import('../desktop/src/components/_shared.mjs')
const { STAGE_STATE, stageMark, StatusMark } = shared

const TOKENS = ['pending', 'active', 'done', 'blocked', 'skipped']

test('S1: STAGE_STATE is exactly the five ruled tokens, in order', () => {
  assert.deepEqual(STAGE_STATE, TOKENS)
})

test('S1: every token has a mark shape with a --ui-* color source', () => {
  for (const t of TOKENS) {
    const m = stageMark(t, 'k-' + t)
    assert.ok(m, `stageMark('${t}') must exist`)
    assert.equal(typeof m.shape, 'string')
    assert.ok(['ok', 'warn', 'error', 'muted', 'info'].includes(m.kind), `${t} kind=${m.kind}`)
    assert.match(m.stroke, /^--ui-/, `${t} stroke must be a --ui-* custom property`)
    assert.equal(m.aria, t, `${t} aria names the state`)
  }
})

test('S1: blocked != skipped — blocked reads as a problem, skipped as gone', () => {
  const blocked = stageMark('blocked', 'b')
  const skipped = stageMark('skipped', 's')
  assert.equal(blocked.kind, 'error', 'blocked surfaces as a problem')
  assert.equal(blocked.dash, true, 'blocked ring is dashed (waiting, not failed)')
  assert.equal(skipped.kind, 'muted', 'skipped is de-emphasised, never an error')
  assert.equal(skipped.dash, true)
  assert.notEqual(blocked.kind, skipped.kind)
})

test('S1: greyscale-distinct — (shape, dash, kind) unique across the five', () => {
  const sigs = TOKENS.map(t => {
    const m = stageMark(t, t)
    return `${m.shape}|dash=${!!m.dash}|${m.kind}`
  })
  assert.equal(new Set(sigs).size, 5, sigs.join(' ; '))
})

test('S1: unknown state -> null (admission rejects; renderer never coerces)', () => {
  assert.equal(stageMark('weird'), null)
  assert.equal(stageMark('failed'), null, 'Timeline tokens are NOT stage tokens')
})

test('S1: the #36/#18 legacy marks stay byte-stable for stored cards', () => {
  const done = StatusMark('done', '--ui-ok', 'k1')
  assert.equal(done.props['aria-label'], 'done')
  assert.equal(done.props.stroke, '--ui-ok')
  assert.ok(done.props.children.length > 0, 'done mark non-empty')
  const open = StatusMark('notDone', 's', 'k2')
  assert.equal(open.props['aria-label'], 'notDone')
  const unknown = StatusMark('unknown', 's', 'k3')
  assert.equal(unknown.props['aria-label'], 'unknown')
  assert.ok(unknown.props.strokeDasharray, 'unknown stays dashed (the #18 repro)')
  const pending = StatusMark('pending', 's', 'k4')
  assert.equal(pending.props['aria-label'], 'pending')
})
