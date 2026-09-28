// End-to-end (node half): spawn tests/e2e_present.py (python: importlib-load __init__.py under a
// throwaway HERMES_HOME, call the registered rich_present handler with examples/research/
// present-args.json, re-admit the record on disk), then take the record it wrote, lower() it,
// render through the real json-render Renderer + CardBody in jsdom and assert the summary text,
// the meta.title header and >=6 distinct component markers.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync, mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'

registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })

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
const { JSONUIProvider, Renderer } = await import('@json-render/react')
const { lower } = await import('../desktop/src/lower.mjs')
const { registry } = await import('../desktop/src/index.mjs')
const { CardBody, UnknownType } = await import('../desktop/src/card.mjs')

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const args = JSON.parse(readFileSync(join(ROOT, 'examples/research/present-args.json'), 'utf8'))
const mount = document.getElementById('r')
const root = createRoot(mount)
const $ = sel => mount.querySelector(sel)
const $$ = sel => [...mount.querySelectorAll(sel)]

let record = null

test('python: registered rich_present handler publishes the research example and it re-admits', () => {
  const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'richui-e2e-'))
  const out = join(dir, 'record.json')
  const py = process.env.PYTHON || 'python3'
  const r = spawnSync(py, [join(ROOT, 'tests/e2e_present.py'), out], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, TMPDIR: dir } })
  assert.equal(r.status, 0, `e2e_present.py exit ${r.status}\n${r.stdout}\n${r.stderr}`)
  assert.ok(/RESULT PASS/.test(r.stdout), r.stdout)
  assert.ok(!/^FAIL /m.test(r.stdout), r.stdout)
  record = JSON.parse(readFileSync(out, 'utf8'))
  assert.equal(record.surface.createSurface.dataModel.meta.title, args.title)
})

test('node: the record lowers and renders through the real Renderer with >=6 component markers', async () => {
  assert.ok(record, 'python half produced a record')
  const cs = record.surface.createSurface
  const { spec, initialState } = lower(cs)
  assert.equal(Object.keys(spec.elements).length, cs.components.length, 'one element per component')
  await act(async () => {
    root.render(React.createElement(JSONUIProvider, { registry, initialState }, React.createElement(Renderer, { spec, registry, fallback: UnknownType })))
  })
  const types = new Set($$('[data-ru]').map(el => el.getAttribute('data-ru')))
  assert.ok(types.size >= 6, `expected >=6 distinct component markers, got ${types.size}: ${[...types].join(',')}`)
  const expected = new Set(cs.components.map(c => c.component))
  for (const t of expected) assert.ok(types.has(t), `marker for ${t} missing`)
  assert.equal($$('[data-ru-unknown]').length, 0, 'no unknown types')
  assert.ok($$('[data-ru="Chart"]').length >= 1 && $$('[data-ru="DataTable"]').length >= 1, 'chart + table rendered')
})

test('node: CardBody shows the authored summary and the meta.title header', async () => {
  assert.ok(record, 'python half produced a record')
  await act(async () => { root.render(React.createElement(CardBody, { record, registry })) })
  assert.equal($('[data-ru-summary]').textContent, args.summary)
  assert.ok($('[data-ru-header]').textContent.includes(args.title), 'header carries meta.title')
  assert.ok($$('[data-ru]').length >= 6, 'body rendered components')
})
