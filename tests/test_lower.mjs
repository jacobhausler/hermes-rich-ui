// lower(): A2UI createSurface -> json-render spec (CONTRACTS §6). Pure, no DOM.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { lower, unlowerable, bind } from '../desktop/src/lower.mjs'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/surface-all-types.json', import.meta.url), 'utf8'))

const surface = (components, dataModel = { data: {}, meta: {} }) => ({ surfaceId: 'ru-0123456789ab', catalogId: 'hermes-rich-ui/1', components, dataModel })

test('root, ids, type and nesting', () => {
  const { spec, initialState } = lower(surface([
    { id: 'root', component: 'Card', title: 'T', children: ['a', 'b'] },
    { id: 'a', component: 'Stack', children: ['c'] },
    { id: 'b', component: 'Text', text: 'x' },
    { id: 'c', component: 'Text', text: 'y' }
  ], { data: { k: 1 }, meta: {} }))
  assert.equal(spec.root, 'root')
  assert.deepEqual(Object.keys(spec.elements).sort(), ['a', 'b', 'c', 'root'])
  assert.equal(spec.elements.root.type, 'Card')
  assert.deepEqual(spec.elements.root.children, ['a', 'b'])
  assert.deepEqual(spec.elements.a.children, ['c'])
  assert.deepEqual(spec.elements.b.children, [])
  assert.deepEqual(initialState, { data: { k: 1 }, meta: {} })
})

test('props exclude id/component/children; keep accessibility + sourceIds', () => {
  const { spec } = lower(surface([
    { id: 'root', component: 'Card', title: 'T', accessibility: { label: 'L' }, sourceIds: ['s1'], children: ['a'] },
    { id: 'a', component: 'Text', text: 'x' }
  ]))
  const p = spec.elements.root.props
  assert.deepEqual(Object.keys(p).sort(), ['accessibility', 'sourceIds', 'title'])
  assert.deepEqual(p.accessibility, { label: 'L' })
  assert.deepEqual(p.sourceIds, ['s1'])
  assert.equal('id' in p, false)
  assert.equal('component' in p, false)
  assert.equal('children' in p, false)
})

test('tabs: children from tabs[].child AND tabs kept in props with bindings', () => {
  const { spec } = lower(surface([
    { id: 'root', component: 'Tabs', tabs: [{ title: 'A', child: 't1' }, { title: { path: '/data/t' }, child: 't2' }] },
    { id: 't1', component: 'Text', text: '1' },
    { id: 't2', component: 'Text', text: '2' }
  ]))
  assert.deepEqual(spec.elements.root.children, ['t1', 't2'])
  assert.deepEqual(spec.elements.root.props.tabs, [{ title: 'A', child: 't1' }, { title: { $state: '/data/t' }, child: 't2' }])
})

test('accordion: children from items[].child AND items kept (open flag preserved)', () => {
  const { spec } = lower(surface([
    { id: 'root', component: 'Accordion', items: [{ title: 'A', child: 'i1', open: true }, { title: 'B', child: 'i2' }] },
    { id: 'i1', component: 'Text', text: '1' },
    { id: 'i2', component: 'Text', text: '2' }
  ]))
  assert.deepEqual(spec.elements.root.children, ['i1', 'i2'])
  assert.equal(spec.elements.root.props.items[0].open, true)
  assert.equal(spec.elements.root.props.items[1].child, 'i2')
})

test('KeyValueList/Timeline items are data, not children', () => {
  const { spec } = lower(surface([
    { id: 'root', component: 'Card', children: ['kv', 'tl'] },
    { id: 'kv', component: 'KeyValueList', items: [{ label: 'a', value: { path: '/data/v' } }] },
    { id: 'tl', component: 'Timeline', items: { path: '/data/events' } }
  ]))
  assert.deepEqual(spec.elements.kv.children, [])
  assert.deepEqual(spec.elements.kv.props.items, [{ label: 'a', value: { $state: '/data/v' } }])
  assert.deepEqual(spec.elements.tl.props.items, { $state: '/data/events' })
})

test('{path} -> {$state} at top level, nested in objects, and deep inside arrays', () => {
  const { spec } = lower(surface([
    { id: 'root', component: 'Chart', kind: 'bar', series: [{ label: 'a', data: { path: '/data/a' } }, { label: 'b', data: [{ x: { path: '/data/x' } }] }], title: { path: '/meta/summary' } }
  ]))
  const p = spec.elements.root.props
  assert.deepEqual(p.title, { $state: '/meta/summary' })
  assert.deepEqual(p.series[0].data, { $state: '/data/a' })
  assert.deepEqual(p.series[1].data[0].x, { $state: '/data/x' })
  assert.equal(p.kind, 'bar')
})

test('bind(): only an object whose sole key is `path` is a binding', () => {
  assert.deepEqual(bind({ path: '/a' }), { $state: '/a' })
  assert.deepEqual(bind({ path: '/a', extra: 1 }), { path: '/a', extra: 1 })
  assert.deepEqual(bind({ path: 5 }), { path: 5 })
  assert.deepEqual(bind([{ path: '/a' }, 'x', null]), [{ $state: '/a' }, 'x', null])
  assert.equal(bind(null), null)
})

test('template ChildList (object children) throws', () => {
  assert.throws(() => lower(surface([
    { id: 'root', component: 'Card', children: { componentId: 'row', path: '/data/rows' } },
    { id: 'row', component: 'Text', text: 'x' }
  ])), /template ChildList/)
})

test('unlowerable(): reports missing root', () => {
  const r = unlowerable(surface([{ id: 'a', component: 'Text', text: 'x' }]))
  assert.ok(r.some(s => /missing root/.test(s)), r.join('; '))
})

test('unlowerable(): unknown surface keys, unknown component, unresolved child, template children', () => {
  const r = unlowerable({ ...surface([
    { id: 'root', component: 'Card', children: ['ghost'] },
    { id: 'x', component: 'Button' },
    { id: 'y', component: 'Card', children: { componentId: 'x', path: '/data' } }
  ]), sendDataModel: true })
  assert.ok(r.some(s => s === 'unknown surface key: sendDataModel'), r.join('; '))
  assert.ok(r.some(s => /x: unknown component Button/.test(s)), r.join('; '))
  assert.ok(r.some(s => /root: child ghost does not resolve/.test(s)), r.join('; '))
  assert.ok(r.some(s => /y: template ChildList/.test(s)), r.join('; '))
})

test('unlowerable(): clean surface -> []; non-object -> reason', () => {
  assert.deepEqual(unlowerable(fixture), [])
  assert.deepEqual(unlowerable(null), ['createSurface is not an object'])
  assert.ok(unlowerable({ components: 'nope' }).includes('components is not an array'))
})

test('fixture: all 26 types lower, deterministic, every child resolves', () => {
  const a = lower(fixture), b = lower(fixture)
  assert.deepEqual(a, b)
  const types = new Set(Object.values(a.spec.elements).map(e => e.type))
  assert.equal(types.size, 26)
  for (const [id, el] of Object.entries(a.spec.elements)) for (const c of el.children) assert.ok(a.spec.elements[c], `${id} -> ${c}`)
  assert.equal(a.initialState.meta.sources.length, 2)
  assert.deepEqual(a.spec.elements.root.props.title, { $state: '/data/title' })
})

test('missing dataModel -> initialState {}', () => {
  const { initialState } = lower({ components: [{ id: 'root', component: 'Divider' }] })
  assert.deepEqual(initialState, {})
})
