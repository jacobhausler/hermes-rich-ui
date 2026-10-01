// Slice 4 / J9 (#27): absent means house. For each of the 22 catalog-defaulted props, an ABSENT
// prop must render DOM-identically to the explicit house (catalog default) value — the renderer's
// absent path carries the house meaning. New records must PERSIST no baked defaults at all
// (admission stops writing catalog `default` annotations; they stay as documentation).
// Saved records keep every baked key they carry; an explicit prop always wins. Two layers, no third.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { React, act, registry, mount } from './helpers/render.mjs'

const { CardBody } = await import('../desktop/src/card.mjs')
const { createRoot } = await import('react-dom/client')
const root = createRoot(mount)
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIR = path.join(ROOT, 'tests/fixtures/saved')
const load = f => JSON.parse(readFileSync(path.join(DIR, f), 'utf8'))
const render = async record => { await act(async () => { root.render(React.createElement(CardBody, { record, registry })) }) }

// The 22 props admission bakes today (the same table tests/test_saved_cards.mjs pins).
export const BAKED = {
  Stack: ['direction', 'gap'], Grid: ['gap'], Divider: ['orientation'], Heading: ['level'],
  Text: ['tone', 'variant'], Badge: ['tone'], Metric: ['format', 'invertTone'],
  Checklist: ['showTally'], ChipSet: ['tone', 'wrap'], CodeBlock: ['showLines'],
  ImageGallery: ['columns'], Sparkline: ['direction', 'width', 'height', 'tone'],
  BarList: ['format', 'sort'], HeatMap: ['showValues']
}
const PAIRS = Object.entries(BAKED).flatMap(([c, ks]) => ks.map(k => `${c}.${k}`))

// The 22-baked-prop record, with every Accordion item opened once up front so both renders
// cover identical subtrees (closed items render nothing by design).
const BAKED_FILE = 'ru-000000000022.json'
const openEvery = () => {
  for (const btn of mount.querySelectorAll('[data-ru="Accordion"] button[aria-expanded="false"]')) btn.click()
}
const renderStable = async record => {
  await render(record)
  await act(async () => { openEvery() })
  return mount.innerHTML
}

test('the 22-prop fixture carries every baked prop', () => {
  assert.ok(readdirSync(DIR).includes(BAKED_FILE))
  const comps = load(BAKED_FILE).surface.createSurface.components
  const hit = new Set()
  for (const c of comps) for (const k of BAKED[c.component] || []) { assert.ok(k in c, `${c.component}.${k} baked`); hit.add(`${c.component}.${k}`) }
  assert.equal(hit.size, 22, `22 baked props present, saw ${hit.size}`)
  assert.deepEqual(PAIRS.length, 22)
})

for (const pair of PAIRS) {
  test(`${pair}: absent renders DOM-identical to the explicit house value`, async () => {
    const [type, key] = pair.split('.')
    const bakedRecord = load(BAKED_FILE)
    const bareRecord = structuredClone(bakedRecord)
    let touched = 0
    for (const c of bareRecord.surface.createSurface.components) {
      if (c.component === type && key in c) { delete c[key]; touched++ }
    }
    assert.ok(touched > 0, `fixture exercises ${pair}`)
    const withExplicit = await renderStable(bakedRecord)
    const without = await renderStable(bareRecord)
    assert.equal(without, withExplicit, `${pair}: absence must take the house constant (explicit value always wins when present)`)
  })
}

test('J9: admitting a record with the 22 house props absent persists them ABSENT (no baked keys)', () => {
  const stripped = structuredClone(load(BAKED_FILE))
  for (const c of stripped.surface.createSurface.components) for (const k of BAKED[c.component] || []) delete c[k]
  const inFile = path.join(tmpdir(), 'rui-slice4-stripped.json')
  const outFile = path.join(tmpdir(), 'rui-slice4-normalized.json')
  writeFileSync(inFile, JSON.stringify(stripped))
  const py = `import json, sys
sys.path.insert(0, ${JSON.stringify(ROOT)})
from engine.admission import admit
cs = json.load(open(${JSON.stringify(inFile)}, encoding='utf-8'))['surface']['createSurface']
errors, norm = admit(cs['components'], cs['dataModel'])
json.dump({'errors': errors, 'same': norm == cs['components'], 'norm': norm}, open(${JSON.stringify(outFile)}, 'w'))`
  const r = spawnSync(process.env.PYTHON || 'python3', ['-c', py], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(readFileSync(outFile, 'utf8'))
  assert.deepEqual(out.errors, [], 'stripped record admits')
  // The door for new records: what came in is what persists — no third layer, no baked defaults.
  assert.equal(out.same, true, 'normalized === input (admission baked defaults into the persisted record)')
  for (const c of out.norm) for (const k of BAKED[c.component] || []) {
    assert.ok(!(k in c), `${c.component}.${k} was baked into a new record`)
  }
})

test('J9: saved records keep their baked values as explicit', () => {
  const record = load(BAKED_FILE)
  const inFile = path.join(tmpdir(), 'rui-slice4-saved.json')
  const outFile = path.join(tmpdir(), 'rui-slice4-saved-norm.json')
  writeFileSync(inFile, JSON.stringify(record))
  const py = `import json, sys
sys.path.insert(0, ${JSON.stringify(ROOT)})
from engine.admission import admit
cs = json.load(open(${JSON.stringify(inFile)}, encoding='utf-8'))['surface']['createSurface']
errors, norm = admit(cs['components'], cs['dataModel'])
json.dump({'errors': errors, 'same': norm == cs['components']}, open(${JSON.stringify(outFile)}, 'w'))`
  const r = spawnSync(process.env.PYTHON || 'python3', ['-c', py], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  const out = JSON.parse(readFileSync(outFile, 'utf8'))
  assert.deepEqual(out.errors, [], 'saved record re-admits')
  assert.equal(out.same, true, 'saved baked values are byte-identical after re-admission (never stripped, never rewritten)')
})

test('J9: an explicit prop always wins (explicit differs from house)', async () => {
  // A third layer would let an authored value be silently overwritten by house; the only
  // override is absent -> house. Metric format:'percent' vs absent renders a different face.
  const base = load(BAKED_FILE)
  const plain = structuredClone(base)
  for (const c of plain.surface.createSurface.components) if (c.component === 'Metric') c.format = 'percent'
  const house = await renderStable(base)
  const explicit = await renderStable(plain)
  assert.notEqual(explicit, house, 'explicit format:percent must render differently from the house face')
})
