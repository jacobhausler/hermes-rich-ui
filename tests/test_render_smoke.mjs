// Proves the toolchain: jsdom + React 19 + zod-stubbed Renderer resolves a $state binding.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
const dom = new JSDOM('<div id="r"></div>')
globalThis.window = dom.window; globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const React = (await import('react')).default
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { Renderer, JSONUIProvider } = await import('@json-render/react')
test('renderer resolves $state through JSONUIProvider', async () => {
  const registry = { Card: ({ element, children }) => React.createElement('section', { 'data-t': 'card' }, element.props.title, children),
                     Text: ({ element }) => React.createElement('p', null, element.props.text) }
  const spec = { root: 'root', elements: { root: { type: 'Card', props: { title: 'T' }, children: ['b'] }, b: { type: 'Text', props: { text: { $state: '/data/msg' } }, children: [] } } }
  const root = createRoot(document.getElementById('r'))
  await act(async () => { root.render(React.createElement(JSONUIProvider, { registry, initialState: { data: { msg: 'hello' } } }, React.createElement(Renderer, { spec, registry }))) })
  assert.equal(document.getElementById('r').innerHTML, '<section data-t="card">T<p>hello</p></section>')
})
