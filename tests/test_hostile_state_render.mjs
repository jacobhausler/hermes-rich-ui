// est-6i54 S4 (mirror of test_hostile_render.mjs at the component layer): hostile
// labels/notes/owners/states render as plain text only; Object.prototype untouched.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })
const { PhaseTracker } = await import('../desktop/src/components/phasetracker.mjs')
const { Checklist } = await import('../desktop/src/components/checklist.mjs')
const PROTO_KEYS = Reflect.ownKeys(Object.prototype)
const collect = (el, out = []) => { if (typeof el === 'string') { out.push(el); return out }
  if (el == null || typeof el !== 'object') return out
  if (Array.isArray(el)) { el.forEach((e) => collect(e, out)); return out }
  out.push(el); if (el.props?.children !== undefined) collect(el.props.children, out); return out }
const txt = (els) => els.map((e) => typeof e === 'string' ? e : (typeof e.props?.children === 'string' ? e.props.children : '')).join(' ')
const HOSTILE = { label: '<img src=x onerror=alert(1)>', state: '__proto__', note: '${jndi:ldap://x}', owner: 'constructor' }
const WANT = { tracker: '<img src=x onerror=alert(1)>', checklist: '<svg onload=x>' }

for (const [name, els] of Object.entries({
  tracker: collect(PhaseTracker({ element: { props: { density: 'expanded', stages: [HOSTILE] } } })),
  checklist: collect(Checklist({ element: { props: { items: [{ label: '<svg onload=x>', state: 'constructor', note: '__proto__' }] } } })),
})) {
  test(`S4 hostile ${name}: plain text, proto untouched, neutral mark`, () => {
    assert.deepEqual(Reflect.ownKeys(Object.prototype), PROTO_KEYS)
    assert.ok(txt(els).includes(WANT[name]), 'hostile label renders as text (per-surface, never vacuous)')
    assert.ok(els.some((e) => e.props?.['data-ru-state'] === 'unknown'), 'unknown state falls back to neutral, never coerced')
    assert.ok(!els.some((e) => typeof e.props?.dangerouslySetInnerHTML !== 'undefined'), 'no raw html path')
  })
}
