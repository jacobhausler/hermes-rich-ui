// Whole-card chrome behavior through both CardBody and the shipped directive.
import { test, after } from 'node:test'
import { spawnSync } from 'node:child_process'
import { registerHooks } from 'node:module'
import { React, act, registry, assert } from './helpers/render.mjs'
import { createRoot } from 'react-dom/client'
const { CardBody } = await import('../desktop/src/card.mjs')
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@hermes/plugin-sdk') return { url: new URL('./helpers/card-boundary-sdk.mjs', import.meta.url).href, shortCircuit: true }
  return next(specifier, context)
} })
const plugin = (await import('../desktop/plugin.js')).default
let directive
plugin.register({ rest() { throw Error('unexpected network request') }, register(spec) { directive = spec } })
assert.equal(directive.data.name, 'richui')
const mount = document.createElement('div')
document.body.append(mount)
const root = createRoot(mount)
after(async () => { await act(async () => root.unmount()); mount.remove(); delete globalThis.cardBoundaryRecord })
const fold = s => String(s).trim().toLowerCase()
const directText = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()
const occurrences = text => [...mount.querySelectorAll('*')].filter(el => fold(directText(el)) === fold(text))
const sources = [
  { id: 'primary', kind: 'web', label: 'Primary evidence', url: 'https://example.com/primary' },
  { id: 'detail', kind: 'web', label: 'Detail evidence', url: 'https://example.com/detail' }
]
const body = { id: 'body', component: 'Text', text: 'Authored body remains intact' }
const components = props => [{ id: 'root', component: 'Card', title: 'Annual overview', sourceIds: ['primary'], children: ['body'], ...props }, body]
const record = (cs, meta = {}, data = {}) => ({
  envelope: { card_id: 'ru-0123456789ab', policy: 'embedded', revision: 1 },
  surface: { version: 'v1.0', createSurface: {
    surfaceId: 's', catalogId: 'hermes-rich-ui/1', components: cs,
    dataModel: { data, meta: { title: 'ANNUAL OVERVIEW', summary: 'Separate introductory prose', authored_at: '2026-09-29', dataset: { id: 'd', revision: 1, observed_at: null, published_at: null }, sources, derivations: [], ...meta } }, metadata: {}
  } }
})
const admissions = new Set()
function admitted(r) {
  const bytes = JSON.stringify(r)
  if (admissions.has(bytes)) return
  const p = spawnSync(process.env.PYTHON || 'python3', ['-c', `import json,sys
from engine.admission import admit
cs=json.load(sys.stdin)['surface']['createSurface']
errors,norm=admit(cs['components'],cs['dataModel'])
print(json.dumps({'errors':errors,'unchanged':norm==cs['components']}))`], { cwd: new URL('..', import.meta.url), input: bytes, encoding: 'utf8' })
  assert.equal(p.status, 0, p.stderr)
  assert.deepEqual(JSON.parse(p.stdout), { errors: [], unchanged: true }, 'record re-admits without rewriting persisted content')
  assert.equal(JSON.stringify(r), bytes)
  admissions.add(bytes)
}
async function render(path, r) {
  admitted(r)
  const before = JSON.stringify(r)
  globalThis.cardBoundaryRecord = r
  await act(async () => root.render(path === 'CardBody' ? React.createElement(CardBody, { record: r, registry }) : directive.data.render({ attrs: { id: r.envelope.card_id } })))
  assert.equal(mount.querySelectorAll('[data-ru-error],[data-ru-unlowerable],[data-ru-unknown]').length, 0, 'actual rendering succeeds')
  assert.equal(JSON.stringify(r), before, 'rendering never mutates the record')
}
const markerLabels = () => [...mount.querySelectorAll('[data-ru-sources]')].map(el => el.getAttribute('aria-label')).sort()
const rootKinds = {
  Card: { children: ['body'] }, Stack: { children: ['body'] }, Grid: { columns: 2, children: ['body'] }, Divider: {},
  Tabs: { tabs: [{ title: 'One', child: 'body' }] }, Accordion: { items: [{ title: 'One', child: 'body' }] },
  Heading: { text: 'Heading content' }, Text: { text: 'Text content' }, Callout: { text: 'Callout content', tone: 'info' },
  Badge: { label: 'Badge content' }, Metric: { label: 'Amount', value: 7 }, Progress: { current: 7 },
  KeyValueList: { items: [{ label: 'Count', value: 7 }] }, Image: { src: 'https://example.com/image.png', alt: 'Evidence image' },
  DataTable: { rows: [{ count: 7 }] }, Chart: { kind: 'bar', series: [{ label: 'Count', data: [{ label: 'A', value: 7 }] }] },
  Timeline: { items: [{ date: '2026-09-29', label: 'Event' }] }, SourceList: {}, Checklist: { items: [{ label: 'Step', done: true }] },
  ChipSet: { labels: ['Label'] }, CodeBlock: { code: 'value = 7' }, ImageGallery: { items: [{ src: 'https://example.com/image.png', alt: 'Evidence image' }] },
  AsOf: {}, Sparkline: { values: [1, 2] }, BarList: { items: [{ label: 'Count', value: 7 }] }, HeatMap: { rows: [{ label: 'A' }], cols: [{ label: 'B' }], cells: [{ row: 'A', col: 'B', value: 7 }] }
}
for (const path of ['CardBody', 'registered bundle']) {
  for (const bound of [false, true]) test(`${path}: ${bound ? 'bound' : 'literal'} matching title keeps root attribution exactly once`, async () => {
    const r = record(components({ title: bound ? { path: '/data/title' } : ' annual OVERVIEW ' }), {}, { title: ' annual OVERVIEW ' })
    await render(path, r)
    assert.equal(occurrences('annual overview').length, 1, 'title deduplicated')
    assert.deepEqual(markerLabels(), ['sources: Primary evidence'], 'root citation retained and label resolved')
    assert.ok(mount.querySelector('[data-ru-header] [data-ru-sources]'), 'replacement header owns root attribution')
  })
  test(`${path}: distinct root title retains h2 and attribution`, async () => {
    await render(path, record(components({ title: 'Detail heading' })))
    assert.equal(occurrences('Detail heading').length, 1)
    const heading = mount.querySelector('h2')
    assert.equal(directText(heading), 'Detail heading')
    assert.equal(heading.style.fontSize, '14px')
    assert.equal(heading.style.fontWeight, '600')
    assert.deepEqual(markerLabels(), ['sources: Primary evidence'])
    assert.ok(heading.querySelector('[data-ru-sources]'))
  })
  test(`${path}: nested cited cards keep both markers and title ladder`, async () => {
    await render(path, record([
      ...components({ children: ['middle'] }).slice(0, 1),
      { id: 'middle', component: 'Card', title: 'Middle heading', sourceIds: ['detail'], children: ['inner'] },
      { id: 'inner', component: 'Card', title: 'Inner heading', children: ['body'] }, body
    ]))
    assert.deepEqual(markerLabels(), ['sources: Detail evidence', 'sources: Primary evidence'])
    for (const [tag, title, size] of [['h3', 'Middle heading', '13px'], ['h4', 'Inner heading', '12px']]) {
      const h = mount.querySelector(tag)
      assert.equal(directText(h), title)
      assert.equal(h.style.fontSize, size)
      assert.equal(h.style.fontWeight, '600')
      const card = h.closest('[data-ru="Card"]')
      assert.equal(card.style.border, '')
      assert.equal(card.style.padding, '')
      assert.equal(card.style.background, '')
    }
  })
  for (const [kind, props] of Object.entries(rootKinds)) test(`${path}: ${kind} root has one whole-card frame`, async () => {
    const cs = [{ id: 'root', component: kind, ...props }]
    if (props.children || kind === 'Tabs' || kind === 'Accordion') cs.push(body)
    await render(path, record(cs))
    const frames = [...mount.querySelectorAll('section')].filter(el => /^1px solid/.test(el.style.border))
    assert.equal(frames.length, 1)
    assert.ok(frames[0].contains(mount.querySelector('[data-ru-header]')), 'frame includes header')
    assert.ok(frames[0].contains(mount.querySelector('[data-ru-summary]')), 'frame includes summary')
    assert.ok(frames[0].contains(mount.querySelector('[data-ru-body]')), 'frame includes body')
    assert.equal(frames[0].style.paddingTop, '16px')
  })
  test(`${path}: Stack siblings share a boundary without suppressing their titles or sources`, async () => {
    await render(path, record([
      { id: 'root', component: 'Stack', children: ['a', 'b'] },
      { id: 'a', component: 'Card', title: 'ANNUAL OVERVIEW', sourceIds: ['primary'], children: ['inner'] },
      { id: 'b', component: 'Card', title: 'Sibling heading', sourceIds: ['detail'], children: ['siblingBody'] },
      { id: 'siblingBody', component: 'Text', text: 'Sibling body' },
      { id: 'inner', component: 'Card', title: 'Deeper heading', children: ['body'] }, body
    ]))
    assert.equal([...mount.querySelectorAll('section')].filter(el => /^1px solid/.test(el.style.border)).length, 1)
    assert.deepEqual(markerLabels(), ['sources: Detail evidence', 'sources: Primary evidence'])
    assert.deepEqual([...mount.querySelectorAll('h2')].map(directText), ['ANNUAL OVERVIEW', 'Sibling heading'])
    assert.equal(directText(mount.querySelector('h3')), 'Deeper heading')
    for (const card of mount.querySelectorAll('[data-ru="Card"]')) {
      assert.equal(card.style.border, '')
      assert.equal(card.style.padding, '')
      assert.equal(card.style.background, '')
    }
  })
  const pairs = [
    ['subtitle/header', { title: 'Detail heading', subtitle: ' annual overview ' }, {}, 'annual overview'],
    ['summary/subtitle', { subtitle: ' Paired prose ' }, { summary: 'PAIRED PROSE' }, 'paired prose'],
    ['summary/root title', { title: ' Detail heading ' }, { summary: 'DETAIL HEADING' }, 'detail heading']
  ]
  for (const [pair, props, meta, repeated] of pairs) for (const bound of [false, true]) test(`${path}: ${pair} ${bound ? 'resolved bindings' : 'literal'} exact duplicates render once with attribution`, async () => {
    const data = { title: props.title, subtitle: props.subtitle }
    const authored = bound ? Object.fromEntries(Object.entries(props).map(([key, value]) => [key, { path: '/data/' + key }])) : props
    await render(path, record(components(authored), meta, data))
    assert.equal(occurrences(repeated).length, 1, 'only exact trimmed/casefold duplicate removed')
    assert.deepEqual(markerLabels(), ['sources: Primary evidence'])
    assert.equal(occurrences(body.text).length, 1, 'body unchanged')
    if (pair === 'summary/root title') assert.equal(directText(mount.querySelector('h2')), props.title.trim(), 'root h2 retained rather than discarded in favor of summary')
  })
  test(`${path}: blank chrome titles do not hide root attribution`, async () => {
    await render(path, record(components({ title: '' }), { title: '', summary: 'Separate introductory prose' }))
    assert.deepEqual(markerLabels(), ['sources: Primary evidence'])
    assert.equal(occurrences(body.text).length, 1)
  })
  test(`${path}: root body siblings retain their layout rhythm inside the boundary`, async () => {
    await render(path, record([
      ...components({ children: ['body', 'second'] }),
      { id: 'second', component: 'Text', text: 'Second body block' }
    ]))
    const blocks = [...mount.querySelectorAll('[data-ru="Text"]')]
    assert.equal(blocks.length, 2)
    assert.equal(blocks[0].parentElement, blocks[1].parentElement, 'body siblings remain together')
    assert.equal(blocks[0].parentElement.style.display, 'flex')
    assert.equal(blocks[0].parentElement.style.flexDirection, 'column')
    assert.equal(blocks[0].parentElement.style.gap, '8px')
  })
  test(`${path}: distinct title, subtitle, summary and body remain even with similar wording`, async () => {
    await render(path, record(components({ title: 'Detail heading', subtitle: 'Detail heading!' }), { summary: 'Detail  heading' }))
    for (const text of ['ANNUAL OVERVIEW', 'Detail heading', 'Detail heading!', 'Detail  heading', body.text]) assert.equal(occurrences(text).length, 1, text)
    assert.deepEqual(markerLabels(), ['sources: Primary evidence'])
  })
}
