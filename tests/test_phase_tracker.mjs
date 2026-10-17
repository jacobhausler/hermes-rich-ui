// est-6i54 S3 (rich-ui#57 ruling): PhaseTracker — compact segment bar + expanded
// rows over the five stage tokens, renderer-COMPUTED current pointer (first active),
// blocked surfaces note/owner, --ui-* vars only. Failing-first.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })
const { PhaseTracker } = await import('../desktop/src/components/phasetracker.mjs')

function collect(el, out = []) {
  if (el == null || typeof el !== 'object') return out
  if (Array.isArray(el)) { for (const e of el) collect(e, out); return out }
  out.push(el)
  if (el.props && el.props.children !== undefined) collect(el.props.children, out)
  return out
}
const render = (props) => collect(PhaseTracker({ element: { props } }))
const a = (els, k) => els.filter((e) => e.props && e.props[k] !== undefined).map((e) => e.props[k])
const txt = (els) => els.map((e) => typeof e === 'string' ? e : (typeof e.props?.children === 'string' ? e.props.children : '')).join(' ')
const ST = [{ label: 'Plan', state: 'done' }, { label: 'Build', state: 'active' }, { label: 'Block', state: 'blocked', note: 'awaiting keys', owner: 'ops' }, { label: 'Ship', state: 'pending' }]

test('S3: compact density renders one node per stage, current = first active', () => {
  const els = render({ stages: ST })
  assert.equal(a(els, 'data-ru-pt')[0], 'compact')
  assert.equal(a(els, 'data-ru-stage').length, 4)
  assert.ok(els.some((e) => e.props?.['aria-current'] === 'step' && e.props?.['data-ru-state'] === 'active'))
})

test('S3: expanded rows surface note/owner; --ui-* strokes only', () => {
  const els = render({ density: 'expanded', stages: ST })
  assert.equal(a(els, 'data-ru-pt')[0], 'expanded')
  assert.ok(txt(els).includes('awaiting keys') && txt(els).includes('ops'), 'blocked row shows note + owner')
  const strokes = els.filter((e) => typeof e.props?.stroke === 'string' && String(e.props.stroke).startsWith('var(')).map((e) => e.props.stroke)
  assert.ok(strokes.length > 0 && strokes.every((s) => /^var\(--ui-/.test(s)))
})

test('S3: no active stage -> no current pointer', () => {
  const els = render({ stages: [{ label: 'a', state: 'pending' }, { label: 'b', state: 'skipped' }] })
  assert.equal(els.filter((e) => e.props?.['aria-current']).length, 0)
})
