// #21 registration repro harness (issue #21 IDLE-DRIVE plan, 2026-10-01 + 2026-10-03
// validation). Exec-loads the COMMITTED desktop bundle twice as fresh ESM identities
// against a fake host registry honoring the IDLE-DRIVE contract, and pins the settled
// render of the real saved fixture through the captured directive claim.
// Baseline pin, NOT a fix claim: controls (a)-(c) are the validated not-reproduced
// hot-swap behavior; (d) is an explicit counterfactual, NOT host behavior (upstream
// activate() unloads before register). If a future host-order/registry readback race
// lands settled prose, it goes RED here, at the settled-prose seam.
// No source-text parsing (R6); the SDK shim is test-local (tests/helpers/registration-sdk-shim.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { JSDOM } from 'jsdom'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const SHIM = pathToFileURL(path.join(HERE, 'helpers/registration-sdk-shim.mjs')).href
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@hermes/plugin-sdk') return { url: SHIM, shortCircuit: true }
    return next(specifier, context)
  }
})

const dom = new JSDOM('<div id="r"></div>', { pretendToBeVisual: true })
globalThis.window = dom.window; globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
globalThis.devicePixelRatio = 1
for (const k of ['CustomEvent', 'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }) } catch { /* readonly */ }
}
const mm = () => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
globalThis.matchMedia = mm; dom.window.matchMedia = mm
const swallow = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : swallow),
  apply: () => swallow, set: () => true
})
dom.window.HTMLCanvasElement.prototype.getContext = () => swallow
globalThis.Path2D = class Path2D { moveTo() {} lineTo() {} rect() {} arc() {} closePath() {} addPath() {} }
globalThis.ResizeObserver = class { observe() {} disconnect() {} }

const React = (await import('react')).default
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { __resetQueryCache } = await import('./helpers/registration-sdk-shim.mjs')
const PLUGIN_ID = 'hermes-rich-ui'
const AREA = 'transcript.directives'
const BUNDLE = fileURLToPath(new URL('../desktop/plugin.js', import.meta.url))
const RECORD = JSON.parse(readFileSync(new URL('fixtures/saved/ru-f3af0e45428d.json', import.meta.url), 'utf8'))
const CARD_ID = RECORD.envelope.card_id
const mountEl = document.getElementById('r')
const root = createRoot(mountEl)

// Fake host registry (plugin.ts:275-288 + registry.ts:40-49,114-137 contract):
// namespace id to `<plugin>:<id>`, replace-by-same-id, first-match claim by name,
// area snapshot, prose on absent claim. Unload deletes IN PLACE — a rebound map
// would let stale disposer closures mutate a dead map and silently defeat the
// counterfactual (validated trap #2). register() returns undefined on this
// bundle, so disposers come from a captured-disposers array.
function fakeHost({ rest = async () => { throw new Error('rest not wired') } } = {}) {
  const area = new Map()
  const disposers = []
  const byLoad = new Map() // tag -> disposers from that load's register() (hot-swap = a re-activation of the same plugin id)
  let seq = 0
  const ctx = {
    register(c, tag = '') {
      const key = `${PLUGIN_ID}:${c.id}`
      area.delete(key)
      area.set(key, { key, seq: seq++, area: c.area, data: c.data })
      const d = () => { area.delete(key) } // host registry.ts: disposer closes over the live area map
      disposers.push(d)
      if (tag) { if (!byLoad.has(tag)) byLoad.set(tag, []); byLoad.get(tag).push(d) }
    },
    rest: (p, opts) => rest(p, opts),
    os: { openExternal() {} }
  }
  return {
    ctx,
    disposers,
    byLoad,
    area,
    unload() { for (const k of [...area.keys()]) area.delete(k) }, // in-place clear — a rebound map lets stale disposer closures mutate a dead map and silently defeats control d (validated trap #2)
    claimsFor(name) { return [...area.values()].filter(e => e.area === AREA && e.data?.name === name) },
    view(directive) {
      const m = /^::(\w+)\{(.*)\}$/.exec(directive)
      if (!m) return { kind: 'prose', text: directive }
      const attrs = Object.fromEntries(m[2].split(',').map(kv => { const [k, v] = kv.split('='); return [k.trim(), (v || '').trim().replace(/^"|"$/g, '')] }))
      const claims = this.claimsFor(m[1])
      if (claims.length === 0) return { kind: 'prose', text: directive }
      assert.equal(claims.length, 1, `divergent '${m[1]}' claims detected (zero / >1 discriminated)`)
      return { kind: 'claim', render: claims[0].data.render, attrs }
    }
  }
}

// Load the committed bundle as a FRESH ESM identity (distinct query string).
const loadBundle = tag => import(`${pathToFileURL(BUNDLE).href}?${tag}#${CARD_ID}`)

// Hot-swap controls share ONE host across two fresh bundle identities
// (the same plugin id re-activating); (a)/(b) get their own pristine host.
async function registerFresh(tag, rest, host = fakeHost({ rest })) {
  const mod = await loadBundle(tag)
  await mod.default.register({ ...host.ctx, register: c => host.ctx.register(c, tag) })
  return { host, mod }
}

const restFixture = async p => (p === '/cards/' + CARD_ID ? { card: RECORD } : {})

async function settle(view) {
  __resetQueryCache()
  const el = () => view.render({ attrs: view.attrs, source: {} })
  await act(async () => { root.render(el()) })   // first pass kicks queryFn off
  await act(async () => {})                       // let it resolve into the shim cache
  await act(async () => { root.render(el()) })    // second pass reads the settled data
  return {
    html: mountEl.innerHTML,
    metric: mountEl.querySelector('[data-ru="Metric"]'),
    card: mountEl.querySelector('[data-ru-card]'),
    error: mountEl.querySelector('[data-ru-error]')
  }
}

const DIRECTIVE = `::richui{id="${CARD_ID}"}`

async function assertCardRendered(what) {
  assert.ok(!/\[object Object\]|::richui\{/.test(mountEl.innerHTML), `${what}: settled view leaked raw ::richui prose`)
  assert.equal(mountEl.querySelectorAll('[data-ru-error]').length, 0, `${what}: no inline error`)
  assert.equal(mountEl.querySelectorAll('[data-ru-unknown]').length, 0, `${what}: no unknown component`)
  assert.equal(mountEl.querySelectorAll('[data-ru-loading]').length, 0, `${what}: must settle past the Skeleton`)
  assert.ok(mountEl.querySelector('[data-ru-card]'), `${what}: card root mounted`)
  assert.ok(mountEl.querySelector('[data-ru="Metric"]'), `${what}: Metric component rendered`)
  assert.ok(mountEl.innerHTML.includes('$4,500'), `${what}: authored $4,500 from the saved fixture is on screen`)
}

test('control a: fresh single install registers the richui claim exactly once', async () => {
  const { host } = await registerFresh('single', restFixture)
  const claims = host.claimsFor('richui')
  assert.equal(claims.length, 1, 'exactly one richui claim (zero / >1 divergent detected here)')
  assert.ok(claims.every(e => e.key === `${PLUGIN_ID}:directive`), 'namespaced hermes-rich-ui:directive')
  assert.equal(claims[0].data.name, 'richui')
  assert.equal(typeof claims[0].data.render, 'function', 'claim carries a render function')
})

test('control b: claim.render drives the real component path (settled card, not prose)', async () => {
  const { host } = await registerFresh('render', restFixture)
  const view = host.view(DIRECTIVE)
  assert.equal(view.kind, 'claim', 'claim present -> component path chosen')
  await settle(view)
  await assertCardRendered('settled render')
})

test('control c: host-order hot-swap (unload old in place, register new same id) renders the card', async () => {
  // Validated not-reproduced baseline pin (upstream activate() unloads before register;
  // spike on origin/main 5cb4cbe: 4/4 pass, issue #21 comment 5969162065).
  const host = fakeHost({ rest: restFixture })
  const old = await registerFresh('swap-old', restFixture, host)
  const swapped = await registerFresh('swap-new', async p => (p === '/cards/' + CARD_ID ? { card: RECORD } : {}), host)
  void old
  host.unload()
  await swapped.mod.default.register(swapped.host.ctx)
  const claims = host.claimsFor('richui')
  assert.equal(claims.length, 1, 'hot-swap settles to exactly one claim')
  const view = host.view(DIRECTIVE)
  assert.equal(view.kind, 'claim')
  await settle(view)
  await assertCardRendered('hot-swap settled render')
})

test('control d (COUNTERFACTUAL, NOT host behavior): late old disposer removes the new same-id claim -> settled prose', async () => {
  // Upstream activate() unloads before register, so this order is NOT pinned as the
  // #21 cause. It reproduces the incident SHAPE (raw ::richui prose) and pins that
  // the fake chooses prose on an absent claim — the seam a real regression must hit.
  const host = fakeHost({ rest: restFixture })
  const first = await registerFresh('cf-first', restFixture, host)
  const firstDisposers = host.byLoad.get('cf-first')
  assert.equal(firstDisposers.length, 1, 'disposer captured from the FIRST registration (register() returns undefined on this bundle)')
  const second = await registerFresh('cf-second', restFixture, host)
  void second
  assert.equal(host.claimsFor('richui').length, 1, 'replace-by-same-id: new claim live before the stale disposer lands')
  firstDisposers[0]() // late old disposer deletes by the same namespaced id
  const view = host.view(DIRECTIVE)
  assert.equal(view.kind, 'prose', 'absent claim -> the fake chooses prose (incident shape)')
  assert.equal(view.text, DIRECTIVE, 'settled view is the raw ::richui directive text')
  assert.equal(host.claimsFor('richui').length, 0, 'zero-claim detection')
})
