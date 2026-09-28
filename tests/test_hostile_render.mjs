// D1 (REVIEW-C0 / sec P1-3 mirror): desktop-side consequence of hostile ids/keys.
// Adapted from review/sec/desktop_probe.mjs to run from the plugin dir with the sdk-loader fixture.
// A surface whose component id is '__proto__' and whose DataTable column key is 'constructor'
// must render as plain text or be ignored — Object.prototype must be untouched afterwards.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { JSDOM } from 'jsdom'

registerHooks({ resolve: (await import('./fixtures/sdk-loader.mjs')).resolve })

const dom = new JSDOM('<div id="r"></div>')
globalThis.window = dom.window; globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const React = (await import('react')).default
const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { lower, unlowerable } = await import('../desktop/src/lower.mjs')
const { DataTable, normColumns, formatCell, sortKey } = await import('../desktop/src/components/table.mjs')
const { getByPointer } = await import('../desktop/src/card.mjs')

// Snapshot of Object.prototype BEFORE anything hostile runs.
const PROTO_KEYS = Reflect.ownKeys(Object.prototype)
function assertProtoUntouched(where) {
  assert.deepEqual(Reflect.ownKeys(Object.prototype), PROTO_KEYS, `${where}: Object.prototype own keys changed`)
  assert.equal(({}).type, undefined, `${where}: ({}).type leaked through the prototype chain`)
  assert.equal(({}).props, undefined, `${where}: ({}).props leaked through the prototype chain`)
  assert.equal(({}).children, undefined, `${where}: ({}).children leaked`)
  assert.equal(Object.getPrototypeOf({}), Object.prototype, `${where}: prototype chain rewired`)
}

// review/sec/proto_card.json — component id '__proto__'
const protoCard = {
  surfaceId: 'ru-e9e4f6b77466', catalogId: 'hermes-rich-ui/1',
  components: [
    { id: 'root', component: 'Card', title: 'T', children: ['__proto__'] },
    { id: '__proto__', component: 'Text', text: 'PWN', tone: 'default', variant: 'body' }
  ],
  dataModel: { data: {}, meta: { title: 't', summary: 's', sources: [], derivations: [] } },
  metadata: { extensions: { hermes_policy: 'embedded' } }
}
// review/sec/proto_cols.json — DataTable column keys 'constructor' and '__proto__'
const protoCols = [
  { key: 'constructor', label: 'C', type: 'text' },
  { key: '__proto__', label: 'P', type: 'number' }
]

test('P1: lowering a "__proto__" component id never touches Object.prototype', () => {
  assert.deepEqual(unlowerable(protoCard), [], 'the probe surface is structurally lowerable')
  const { spec } = lower(protoCard)
  assertProtoUntouched('after lower()')
  assert.equal(Object.getPrototypeOf(spec.elements), null, 'elements must be a null-prototype dictionary')
  assert.ok(Object.prototype.hasOwnProperty.call(spec.elements, '__proto__'), '__proto__ is an OWN key of elements')
  assert.deepEqual(Object.keys(spec.elements).sort(), ['__proto__', 'root'])
  const el = spec.elements['__proto__']
  assert.notEqual(el, Object.prototype)
  assert.equal(el.type, 'Text')
  assert.equal(el.props.text, 'PWN')
  assert.deepEqual(spec.elements.root.children, ['__proto__'])
})

test('P2: "constructor" / "__proto__" column keys on an empty row read as unavailable, not inherited', async () => {
  const nc = normColumns(protoCols)
  assert.equal(nc.length, 2)
  const row = {}
  assert.equal(formatCell(nc[0], row), null, 'constructor column on {} → null (unavailable), not Function text')
  assert.equal(formatCell(nc[1], row), null, '__proto__ column on {} → null, not Object.prototype')
  assert.equal(sortKey(nc[0], row), null)
  assert.equal(sortKey(nc[1], row), null)
  // A row that OWNS a 'constructor' key renders it as plain text.
  assert.equal(formatCell(nc[0], { constructor: 'own text' }), 'own text')

  const host = document.createElement('div'); document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(React.createElement(DataTable, { element: { id: 't', type: 'DataTable', props: { columns: protoCols, rows: [{}, {}] } } }))
  })
  const cells = [...host.querySelectorAll('tbody td')].map(td => td.textContent)
  assert.deepEqual(cells, ['unavailable', 'unavailable', 'unavailable', 'unavailable'])
  assert.ok(!host.textContent.includes('function'), 'no Function source text leaked into the table')
  assertProtoUntouched('after DataTable render')
  await act(async () => { root.unmount() })
})

test('P3: getByPointer never walks into the prototype chain', () => {
  assert.equal(getByPointer({ data: {} }, '/data/__proto__'), undefined)
  assert.equal(getByPointer({ data: {} }, '/data/constructor'), undefined)
  assert.equal(getByPointer({ data: { arr: ['a', 'b'] } }, '/data/arr/1'), 'b')
  assert.equal(getByPointer({ data: { '': 'empty' } }, '/data/'), 'empty')
  assertProtoUntouched('after getByPointer')
})

test('Object.prototype untouched at the end of the file', () => assertProtoUntouched('end'))
