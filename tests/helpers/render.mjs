// Shared jsdom + react + json-render harness for lane-local render tests
// (expansion cycle 2026-09-28). Environment copied verbatim from
// tests/test_components.mjs so lane tests render the SAME way the suite does.
// Usage:
//   import { renderSpec, mount, $, $$, cleanup } from './helpers/render.mjs'
//   import { renderComponent } from './helpers/render.mjs'  // direct leaf render
// '@hermes/plugin-sdk' is mapped to tests/fixtures/sdk-stub.mjs.
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { JSDOM } from 'jsdom'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')

registerHooks({ resolve: (await import(path.join(HERE, 'fixtures-sdk-resolve.mjs'))).resolve })

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

export const React = (await import('react')).default
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
export { act }
export const { JSONUIProvider, Renderer } = await import('@json-render/react')
export const { lower } = await import('../../desktop/src/lower.mjs')
export const { registry } = await import('../../desktop/src/index.mjs')

export const mount = document.getElementById('r')
const root = createRoot(mount)
export const $ = sel => mount.querySelector(sel)
export const $$ = sel => [...mount.querySelectorAll(sel)]

// Full-spec render through the real Renderer (lower() output or hand spec).
export async function renderSpec(spec, initialState) {
  await act(async () => {
    root.render(React.createElement(JSONUIProvider, { registry, initialState },
      React.createElement(Renderer, { spec, registry, fallback: () => React.createElement('div', { 'data-ru-unknown': '1' }) })))
  })
}

// Direct single-component render: mounts one component from the registry under
// a Card-less root, bypassing admission (lane-local ACCEPT; L8 owns full-catalog
// registration asserts). component = {id, component, props, children?}.
export async function renderComponent(component, initialState) {
  const el = { type: String(component.component), props: component.props || {}, children: component.children || [] }
  await renderSpec({ root: component.id, elements: { [component.id]: el } }, initialState)
}

// Lane-local registration: adds a component fn to the live registry under its
// type name WITHOUT touching components/index.mjs (shared seam — L8 owns that
// merge). Lanes call this at the top of their synth test, then renderComponent.
export function registerLane(type, fn) {
  registry[type] = fn
}

export function fixtureJson(name) {
  return JSON.parse(readFileSync(path.join(ROOT, 'tests/fixtures', name), 'utf8'))
}

export { assert }
