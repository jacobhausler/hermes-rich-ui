// The old-form suite (#24, DEFAULTS-SPEC §5): saved cards must keep loading and rendering through
// every later slice. tests/fixtures/saved/ holds three showcase records (public strings neutralised)
// and one record that writes all 22 catalog defaults explicitly, as admission bakes them today.
// Each record re-admits with 0 errors (normalized form unchanged) and renders through the real
// CardBody with no [data-ru-error], no unknown type and a marker for every authored component.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { React, act, registry, $$, mount } from './helpers/render.mjs'

const { CardBody } = await import('../desktop/src/card.mjs')
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIR = path.join(ROOT, 'tests/fixtures/saved')
const FILES = readdirSync(DIR).filter(f => f.endsWith('.json')).sort()
const load = f => JSON.parse(readFileSync(path.join(DIR, f), 'utf8'))
const render = async record => { await act(async () => { root.render(React.createElement(CardBody, { record, registry })) }) }
const { createRoot } = await import('react-dom/client')
const root = createRoot(mount)

test('saved fixtures: 3 showcase records + the 22-baked-prop record', () => {
  assert.deepEqual(FILES, ['ru-000000000022.json', 'ru-97cb020cd21b.json', 'ru-c69fc582e9a9.json', 'ru-f3af0e45428d.json'])
  for (const f of FILES) {
    const r = load(f)
    assert.equal(r.envelope.card_id + '.json', f)
    assert.equal(r.envelope.session_id, 'session-fixture', 'neutral session string')
    assert.equal(r.envelope.profile, null, 'neutral profile')
  }
})

test('saved fixtures re-admit with 0 errors and their stored components are the normalized form', () => {
  const py = `import json, sys\nsys.path.insert(0, ${JSON.stringify(ROOT)})\nfrom engine.admission import admit\nout = {}\n` +
    `for f in ${JSON.stringify(FILES)}:\n    cs = json.load(open(${JSON.stringify(DIR)} + '/' + f, encoding='utf-8'))['surface']['createSurface']\n` +
    `    errors, norm = admit(cs['components'], cs['dataModel'])\n    out[f] = {'errors': errors, 'same': norm == cs['components']}\nprint(json.dumps(out))`
  const r = spawnSync(process.env.PYTHON || 'python3', ['-c', py], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(r.stdout)
  for (const f of FILES) assert.deepEqual(out[f], { errors: [], same: true }, f)
})

for (const f of FILES) {
  test(`saved card ${f} renders with no [data-ru-error]`, async () => {
    const record = load(f)
    await render(record)
    // open every collapsed Accordion item so its child mounts too (closed items render nothing by design)
    for (const btn of $$('[data-ru="Accordion"] button[aria-expanded="false"]')) await act(async () => { btn.click() })
    assert.equal($$('[data-ru-error]').length, 0, 'no inline error')
    assert.equal($$('[data-ru-unknown]').length, 0, 'no unknown type')
    assert.equal($$('[data-ru-unlowerable]').length, 0, 'lowers')
    // Cardinality is per INSTANCE, not per type: a missing second Metric must fail.
    const components = record.surface.createSurface.components
    const inactive = new Set(components.flatMap(c => c.component === 'Tabs' ? (c.tabs || []).slice(1).map(t => t.child) : []))
    const counts = new Map()
    for (const c of components.filter(c => !inactive.has(c.id))) counts.set(c.component, (counts.get(c.component) || 0) + 1)
    for (const [type, count] of counts) assert.equal($$('[data-ru]').filter(el => el.getAttribute('data-ru') === type).length, count, `${f}: ${type} instances`)
    // The old formatter is still used here. Pin actual authored numeric faces by id,
    // not just a wrapper: a Metric that renders '???' must fail even if its root remains.
    const metricFaces = {
      'ru-000000000022.json': { m1: '1,234.5', m2: '1,234,567' },
      'ru-97cb020cd21b.json': { k1: '99.94%', k2: '318 ms', k3: 'unavailable' },
      'ru-f3af0e45428d.json': { m1: '$4,500', m2: '$5,435', m3: '12.4%' }
    }
    for (const c of components.filter(c => c.component === 'Metric')) {
      const el = $$('[data-ru="Metric"]').find(node => node.textContent.includes(c.label))
      assert.ok(el, `${f}: Metric ${c.id} (${c.label}) mounted`)
      assert.equal(el.querySelector('[data-ru-value]')?.textContent, metricFaces[f][c.id], `${f}: Metric ${c.id} authored value`)
    }
    // Test-only identity labels preserve the stored fixture while proving each common
    // component id has its own rendered node (the registry doesn't expose ids in DOM).
    const tagged = structuredClone(record)
    for (const c of tagged.surface.createSurface.components) c.accessibility = { label: `saved-id:${c.id}` }
    await render(tagged)
    for (const btn of $$('[data-ru="Accordion"] button[aria-expanded="false"]')) await act(async () => { btn.click() })
    const seenIds = new Set()
    const collect = () => { for (const el of $$('[data-ru][aria-label^="saved-id:"]')) seenIds.add(el.getAttribute('aria-label').slice(9).split(':')[0]) }
    collect()
    for (const tab of $$('[role="tab"]').filter(el => el.getAttribute('aria-selected') === 'false')) {
      await act(async () => { tab.click() })
      collect()
    }
    for (const c of components) {
      assert.ok(seenIds.has(c.id), `${f}: component id ${c.id} mounted`)
    }
  })
}

// Slice 4 ("absent means house") stops baking these; until then a baked default must render exactly as its absence.
const BAKED = { Stack: ['direction', 'gap'], Grid: ['gap'], Divider: ['orientation'], Heading: ['level'], Text: ['tone', 'variant'],
  Badge: ['tone'], Metric: ['format', 'invertTone'], Checklist: ['showTally'], ChipSet: ['tone', 'wrap'], CodeBlock: ['showLines'],
  ImageGallery: ['columns'], Sparkline: ['direction', 'width', 'height', 'tone'], BarList: ['format', 'sort'], HeatMap: ['showValues'] }
test('the 22 baked defaults render identically to their absence', async () => {
  const baked = load('ru-000000000022.json')
  const bare = structuredClone(baked)
  const hit = new Set()
  for (const c of bare.surface.createSurface.components) for (const k of BAKED[c.component] || []) { assert.ok(k in c, `${c.component}.${k} baked`); delete c[k]; hit.add(c.component + '.' + k) }
  assert.equal(hit.size, 22)
  await render(baked); const a = mount.innerHTML
  await render(bare); const b = mount.innerHTML
  assert.equal(b, a)
})
