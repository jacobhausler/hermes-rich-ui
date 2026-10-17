// est-6i54 S2 (rich-ui#57 ruling, amendment 2): Checklist items gain additive
// state (five stage tokens) + note. The old boolean form stays byte-stable and
// renders SIDE-BY-SIDE with the new form (R10); admission never rewrites the
// boolean — the renderer maps it at compose time. Failing-first: lands before impl.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })
const { Checklist } = await import('../desktop/src/components/checklist.mjs')

function collect(el, out = []) {
  if (typeof el === 'string') { out.push(el); return out }
  if (el == null || typeof el !== 'object') return out
  if (Array.isArray(el)) { for (const e of el) collect(e, out); return out }
  out.push(el)
  if (el.props && el.props.children !== undefined) collect(el.props.children, out)
  if (el.children !== undefined && el.children !== el.props?.children) collect(el.children, out)
  return out
}
const render = (props) => collect(Checklist({ element: { props } }))
const attrs = (els, k) => els.filter((e) => e.props && e.props[k] !== undefined).map((e) => e.props[k])
const text = (els) => els.map((e) => typeof e === 'string' ? e : (typeof e.props?.children === 'string' ? e.props.children : '')).join(' ')

test('S2: old boolean form renders exactly as before (byte-stable markers)', () => {
  const els = render({ items: [{ label: 'a', done: true }, { label: 'b', done: false }, { label: 'c' }] })
  assert.deepEqual(attrs(els, 'data-ru-state'), ['done', 'unchecked', 'unknown'])
  assert.deepEqual(attrs(els, 'data-ru-marker'), ['done', 'unchecked', 'unknown'])
})

test('S2: new state form renders through the five-token table, note as text', () => {
  const els = render({ items: [{ label: 'x', state: 'blocked', note: 'waiting on deps' }, { label: 'y', state: 'skipped' }, { label: 'z', state: 'done' }] })
  assert.deepEqual(attrs(els, 'data-ru-state'), ['blocked', 'skipped', 'done'])
  assert.ok(text(els).includes('waiting on deps'), 'note renders as plain text')
  const strokes = els.filter((e) => typeof e.props?.stroke === 'string' && String(e.props.stroke).startsWith('var(')).map((e) => e.props.stroke)
  assert.ok(strokes.some((s) => s === 'var(--ui-error)'), 'blocked strokes --ui-error')
  assert.ok(strokes.every((s) => /^var\(--ui-/.test(s)), '--ui-* only (#15)')
})

test('S2: boolean and state forms side-by-side (R10) — no coercion, tally unchanged', () => {
  const els = render({ items: [{ label: 'old-true', done: true }, { label: 'new-active', state: 'active' }] })
  assert.deepEqual(attrs(els, 'data-ru-state'), ['done', 'active'])
  assert.ok(text(els).includes('1/2'), 'tally still counts boolean done only')
})

test('S2 (re-cert pin): tally counts state:"done" — the same resolution the marker takes', () => {
  const els = render({ items: [{ label: 'a', state: 'done' }, { label: 'b', state: 'done' }, { label: 'c', state: 'pending' }] })
  assert.ok(text(els).includes('2/3'), 'state-form done items count (renders 0/3 under done marks was the defect)')
  const mix = render({ items: [{ label: 'x', done: false, state: 'done' }, { label: 'y', state: 'exploded', done: true }] })
  assert.ok(text(mix).includes('2/2'), 'known state wins over contradicting done; unknown state falls back to the boolean')
})
