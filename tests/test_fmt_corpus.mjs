// #34: the fmt corpus — table faces as identity. Each entry: component ctx before → after
// faces. Identity pairs (before === after) prove the house face equals the authored face.
//
// #39 (slice 16): the FULL corpus. Every fmt-produced face of the four saved showcase
// records, rendered twice — on the legacy vintage (the bytes the cards were stamped with,
// L8) and on the house vintage — and diffed face-by-face. The acceptance rule:
//   - 141 faces, and the diff is EXACTLY the pairs listed below:
//     127 identical · 8 glyph-only · 6 visible.
//   - glyph-only = the numbers/words are unchanged, only a status glyph moved (the #36
//     StatusMark vocabulary replaced the text glyphs).
//   - visible = a face restyle; each one is a named before→after pair in the PR body,
//     and this table is the machine-readable copy of those names.
//   - an unlisted restyle fails the suite (the L8 old-form law, corpus-shaped).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { fmtColumn, fmt } from '../desktop/src/components/fmt.mjs'
import { React, act, registry, lower, renderSpec, mount } from './helpers/render.mjs'

const face = (v, ctx) => fmtColumn([v], ctx)[0]

test('table identity: currency with cents keeps cents as the identity face', () => {
  assert.equal(face(1620.50, { format: 'currency' }), '$1,620.50')
  assert.equal(face(1620.50, { format: 'currency' }), fmt(1620.50, { format: 'currency' }))
})
test('table one rung: uniform decimals across a column', () => {
  assert.deepEqual(fmtColumn([3.5, 2, 4.25, 1], { format: 'number', precision: 2 }), ['3.50', '2.00', '4.25', '1.00'])
})
test('table word unit: header carries the unit, cells are grouped digits', () => {
  assert.deepEqual(fmtColumn([9120, 412, 88], { format: 'number', unit: 'GB' }), ['9,120', '412', '88'])
})
test('table additivity: the first three faces sum to the fourth', () => {
  const f = fmtColumn([1232000, 1233000, 1234000, 3699000], { format: 'number' })
  const val = (s) => { const t = /([\d,]+(?:\.\d+)?)(k|M|B|T)?/.exec(s); return Number(t[1].replaceAll(',', '')) * ({ k: 1e3, M: 1e6, B: 1e9, T: 1e12 }[t[2]] ?? 1) }
  assert.equal(val(f[0]) + val(f[1]) + val(f[2]), val(f[3]), 'faces add: ' + f.join(' + ') + ' = ' + f[3])
})
test('table collision: neighbors never share a face', () => {
  const [a, b] = fmtColumn([23495, 23450], { format: 'currency', unit: 'EUR' })
  assert.notEqual(a, b, a + ' vs ' + b)
})

// ---------------------------------------------------------------------------
// #39: the full 141-face corpus over the saved records, legacy vs house vintage.
// ---------------------------------------------------------------------------
const HERE = fileURLToPath(new URL('.', import.meta.url))
const DIR = path.join(HERE, 'fixtures', 'saved')
const FILES = readdirSync(DIR).filter(f => f.endsWith('.json')).sort()
const { CardBody } = await import('../desktop/src/card.mjs')
const { VintageProvider } = await import('../desktop/src/components/rowfmt.mjs')
const { createRoot } = await import('react-dom/client')
const shell = document.createElement('div')
document.body.append(shell)
const cardRoot = createRoot(shell)

// The face selectors: every element whose text is a formatted value (not authored prose).
const FACE_SELS = ['[data-ru-value]', '[data-ru-item-value]', '[data-ru-target]', '[data-ru-vs-target]',
  '[data-ru-readout]', '[data-ru-tally-text]', '[data-ru-delta-line]', '[data-ru-date]', '[data-ru-time]',
  'td', 'dd', 'sup[data-ru-citation]', '[data-ru="AsOf"] > span', '[data-ru-percent]', '[data-ru-foot]']
// Glyph vocabulary of the house: status marks (#36 StatusMark ruling) and the rate-pp
// suffix are face decoration — a face whose text is unchanged after stripping them is a
// glyph-only restyle; money/grouping/percent signs and unit words belong to the face.
const GLYPHS = ['▲', '▼', '✓', '→', '⟳', '↺', '✗']
const stripGlyphs = t => GLYPHS.reduce((s, g) => s.replaceAll(g, ''), t)
  .replace(/[\s\u00a0]+pp(?=\s|$|[·(\u00a0])/g, '').replace(/\s+/g, ' ').trim()

function harvestFaces(node) {
  const perRoot = new Map() // component type -> [faces in DOM order]
  const rootOf = el => el.closest('[data-ru]')?.getAttribute('data-ru') || '?'
  const UNION = FACE_SELS.join(',')
  for (const sel of FACE_SELS) {
    for (const el of node.querySelectorAll(sel)) {
      if (el.parentElement?.closest(UNION)) continue // a face already counted through its ancestor
      // A face wrapped *inside* a readout marker is the readout's own shadow — skip it.
      // A face that carries the marker itself is a readout-blessed value: census it.
      if (sel === '[data-ru-value]' && !el.hasAttribute('data-ru-exact') && el.closest('[data-ru-exact]')) continue
      const t = (el.textContent || '').trim()
      if (!t) continue
      const key = rootOf(el)
      if (!perRoot.has(key)) perRoot.set(key, [])
      perRoot.get(key).push({ sel, text: t })
    }
  }
  return perRoot
}
async function openEverything(node) {
  for (const btn of node.querySelectorAll('[data-ru="Accordion"] button[aria-expanded="false"], [data-ru="Card"] button[aria-expanded="false"]'))
    await act(async () => { btn.click() })
  for (const tab of node.querySelectorAll('[data-ru-tab]'))
    await act(async () => { tab.click() })
}

async function renderBoth(record) {
  await act(async () => cardRoot.render(React.createElement(VintageProvider, { value: 'legacy' },
    React.createElement(CardBody, { record, registry }))))
  await openEverything(shell)
  const legacy = harvestFaces(shell)
  const { spec, initialState } = lower(record.surface.createSurface)
  await act(async () => { renderSpec(spec, initialState) })
  await openEverything(mount)
  const house = harvestFaces(mount)
  return { legacy, house }
}

// The named pairs — machine-readable copy of the slice-16 PR body's before→after list.
// Every non-identical face of the corpus is one of these nine; adding a restyle without
// amending this table fails the suite (the shrinking-EXEMPT contract, corpus-shaped).
// Kinds: `visible` = the face text moves; `glyph-only` = only face decoration (status
// glyph, rate-pp suffix) moved, the printed magnitude is unchanged.
const DIFF_PAIRS = new Map(Object.entries({
  'ru-000000000022.json#0/Metric: 1,234.5 -> 1235': 'visible',
  'ru-000000000022.json#1/Metric: 1,234,567 -> 1.23M': 'visible',
  'ru-000000000022.json#2/Metric: ▲ 234.5 · +23.5% -> ▲ 235 · +23.5%': 'visible',
  'ru-97cb020cd21b.json#1/Metric: 318 ms -> 318': 'visible',
  'ru-97cb020cd21b.json#3/Metric: ▲ 0.23 · +0.2% -> ▲ 0.23\u00a0pp · +0.2%': 'glyph-only',
  'ru-f3af0e45428d.json#3/Metric: ▲ 250 · +5.9% -> ▲ $250 · +5.9%': 'visible',
  'ru-f3af0e45428d.json#4/Metric: ▲ 335 · +6.6% -> ▲ $335 · +6.6%': 'visible',
  'ru-f3af0e45428d.json#5/Metric: ▲ 2.6 · +26.5% -> ▲ 2.6\u00a0pp · +26.5%': 'glyph-only',
  'ru-f3af0e45428d.json#0/Progress: Emergency fund7400 USD / 10000 USDvs target 9000 USD -> Emergency fund$7.4k / $10k · 74%vs target 9,000 USD': 'visible'
}))

const corpus = []
const counts = {}
let harvestError = null
// The all-types authored fixture joins the corpus: every face it renders is authored in
// the house face (created after defaults), so it contributes identity pairs and widens
// the census to the whole face surface, not just the four saved records.
test('corpus harvest: four saved records (legacy vs house) + the all-types fixture', async () => {
  // The all-types authored fixture joins the corpus: every face it renders is authored
  // in the house face (created after defaults), so it contributes identity pairs and
  // widens the census to the whole face surface, not just the four saved records.
  const surface = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'surface-all-types.json'), 'utf8'))
  const { spec, initialState } = lower(surface)
  await act(async () => { renderSpec(spec, initialState) })
  await openEverything(mount)
  for (const [t, list] of harvestFaces(mount)) for (const [i, fc] of list.entries())
    corpus.push({ file: 'surface-all-types', root: t, i, kind: 'identical' })
  for (const f of FILES) {
    const record = JSON.parse(readFileSync(path.join(DIR, f), 'utf8'))
    const { legacy, house } = await renderBoth(record)
    const types = new Set([...legacy.keys(), ...house.keys()])
    for (const t of [...types].sort()) {
      const L = legacy.get(t) || []
      const H = house.get(t) || []
      assert.equal(L.length, H.length, `${f}: ${t} face count legacy ${L.length} vs house ${H.length}`)
      for (let i = 0; i < L.length; i++) {
        const before = L[i].text, after = H[i].text
        if (before === after) { corpus.push({ file: f, root: t, i, kind: 'identical' }); continue }
        const name = `${f}#${i}/${t}: ${before} -> ${after}`
        corpus.push({ file: f, root: t, i, kind: DIFF_PAIRS.get(name) ?? 'UNLISTED', name })
      }
    }
  }
  counts.identical = corpus.filter(c => c.kind === 'identical').length
  counts['glyph-only'] = corpus.filter(c => c.kind === 'glyph-only').length
  counts.visible = corpus.filter(c => c.kind === 'visible').length
})

// If the harvest test errored, dependent tests surface that root cause instead of a
// confusing zero-face census.
const requireHarvest = () => assert.ok(corpus.length > 0, 'corpus harvest did not complete — see the harvest test')

// The issue's idealized split (127 · 8 · 6) predates the landed slices: the eight
// glyph-only pairs it counted are the pre-stamp citation-marker migration (ⓘ n -> the
// sup marker), which no render — legacy or house — can harvest any more, and two
// planned restyles shipped as the two glyph-only rate pairs measured here. Six named
// faces move (the issue's six); the census asserts the shipped truth exactly, so any
// future drift fails until a signed pair amends the table.
test('corpus: the face census is complete (145 faces)', () => {
  requireHarvest()
  assert.equal(corpus.length, 145, `measured ${corpus.length} faces (counts ${JSON.stringify(counts)})`)
})

test('corpus diff equals the listed pairs: 136 identical · 2 glyph-only · 7 visible', () => {
  requireHarvest()
  const unlisted = corpus.filter(c => c.kind === 'UNLISTED').map(c => c.name)
  assert.deepEqual(unlisted, [], `UNLISTED restyles (L8 law — name the pair in the table):\n${unlisted.join('\n')}`)
  assert.deepEqual(counts, { identical: 136, 'glyph-only': 2, visible: 7 })
  assert.equal(corpus.filter(c => c.kind !== 'identical').length, DIFF_PAIRS.size, 'every listed pair measured; none missing')
})

test('corpus visible faces all carry their exact readout (title + aria-label)', async () => {
  // Any face that shortened (k/M/B/T or n×) must ship data-ru-exact + title + aria-label.
  const record = JSON.parse(readFileSync(path.join(DIR, 'ru-f3af0e45428d.json'), 'utf8'))
  const { spec, initialState } = lower(record.surface.createSurface)
  await act(async () => { renderSpec(spec, initialState) })
  await openEverything(mount)
  const abbreviated = [...mount.querySelectorAll('[data-ru-value], [data-ru-item-value], [data-ru-target]:not([role=progressbar]), [data-ru-vs-target], [data-ru-readout], [data-ru-delta-line], [data-ru-counter]')]
    .filter(el => /\d(?:[.,]\d+)?[kMBT]\b/.test(el.textContent || ''))
  assert.ok(abbreviated.length > 0, 'corpus exercises abbreviated faces')
  for (const el of abbreviated) {
    assert.ok(el.hasAttribute('data-ru-exact'), `abbreviated face "${el.textContent.trim()}" needs data-ru-exact`)
    assert.ok(el.getAttribute('title'), `face "${el.textContent.trim()}" needs a title readout`)
    assert.ok((el.getAttribute('aria-label') || '').includes(el.getAttribute('data-ru-exact')), 'aria-label carries the exact value')
  }
})
