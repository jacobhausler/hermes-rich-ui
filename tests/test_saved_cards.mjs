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
    const seen = new Set($$('[data-ru]').map(el => el.getAttribute('data-ru')))
    for (const c of record.surface.createSurface.components) assert.ok(seen.has(c.component), `marker for ${c.component}`)
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
