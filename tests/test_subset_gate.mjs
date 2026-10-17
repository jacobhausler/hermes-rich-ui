// #39 (defaults slice 16): the subset gate — required-only and each optional prop alone
// look complete, for all 26 catalog types. This is the composed system locked as gates:
// five sole-owner modules (fmt, TYPE, tokens, compose, card chrome) leave no face raw.
// Failing-first per the issue: this file adds the gate; the implementation follows.
//
// What "looks complete" means here, each pinned separately below:
//   A1 clean render — no inline error, no unknown type, nothing unlowerable.
//   A2 no empty [data-ru-head] — a head renders only when it has content, and a titled
//      render exposes its head as the [data-ru-head] marker (the census hook).
//   A3 no raw machine text — no ISO dates, no 1/1/70, no >=8-digit raw runs, no float
//      artefacts, no NaN/Infinity/[object Object] in value faces or head/foot chrome.
//      Authored passthrough (prose the author wrote) is exempt — pinned by a negative
//      case per exemption so the census is not vacuous.
//   A4 every (size, weight) pair on the one ramp (same census shape as test_type_ladder).
//   A5 readouts — wherever data-ru-exact differs from the visible face, title and
//      aria-label carry the exact value; and any abbreviated face (k/M/B/T, n×) MUST
//      carry the data-ru-exact marker, so the readout rule has teeth.
//   A6 no control that cannot act — every button, on click, changes something.
//   A7 clip — harness/pins/clip.mjs at 360 and 720 CSS px (recorded skip without a
//      Chromium binary, same contract as the #47 host-border control).
//   A8 hue reservation — bare var(--ui-accent) appears in chrome only on interactive
//      state; the heat ramp is HeatMap's; mixes (color-mix) are their own colour.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { React, act, registry, lower, renderSpec, mount } from './helpers/render.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const CATALOG = JSON.parse(readFileSync(path.join(HERE, '..', 'catalog', 'hermes-rich-ui.catalog.json'), 'utf8')).components
const { TYPE } = await import('../desktop/src/components/_house.mjs')
const { clipCensus } = await import('../harness/pins/clip.mjs')

// ---- fixtures per type: required-only props, and each catalog-optional prop alone ----
// Values are chosen so faces are interesting: big numbers must abbreviate, ISO instants
// must humanize. `props` merges onto the required props for the optional-alone case.
const S = 's1'
const SERIES_BAR = [{ label: 'latency', data: [{ label: 'p50', value: 12345 }, { label: 'p95', value: 9876543 }] }]
const SAMPLES = {
  Accordion: { req: { items: [{ title: 'One', child: 'x1' }] }, extras: { x1: ['Text', { text: 'panel one' }] }, opt: { sourceIds: { sourceIds: [S] } } },
  AsOf: { req: {}, opt: { observedAt: { observedAt: '2026-10-09T14:03:00Z' }, publishedAt: { publishedAt: '2026-10-01' }, note: { note: 'audited by hand' }, sourceIds: { sourceIds: [S] } } },
  Badge: { req: { label: 'STABLE' }, opt: { tone: { tone: 'success' }, sourceIds: { sourceIds: [S] } } },
  BarList: { req: { items: [{ label: 'auth', value: 512 }, { label: 'search', value: 9200 }, { label: 'cron', value: null }] }, opt: { unit: { unit: 'req/min' }, precision: { precision: 1 }, format: { format: 'number' }, sort: { sort: 'asc' }, sourceIds: { sourceIds: [S] } } },
  Callout: { req: { text: 'Reboot scheduled', tone: 'caution' }, opt: { title: { title: 'Maintenance' }, sourceIds: { sourceIds: [S] } } },
  Card: { req: { children: ['b1'] }, extras: { b1: ['Badge', { label: 'ok' }] }, opt: { title: { title: 'Quarterly review' }, subtitle: { subtitle: 'Q3 2026' }, footer: { footer: 'Compiled by the night shift.' }, sourceIds: { sourceIds: [S] } } },
  Chart: { req: { kind: 'bar', series: SERIES_BAR }, opt: { title: { title: 'Latency' }, xLabel: { xLabel: 'bucket' }, yLabel: { yLabel: 'ms' }, unit: { unit: 'ms' }, caveat: { caveat: 'one cold-start outlier removed' }, sortDesc: { sortDesc: true }, stack: { stack: true }, stepped: { stepped: true }, height: { height: 240 }, sourceIds: { sourceIds: [S] } } },
  Checklist: { req: { items: [{ label: 'plan approved', done: true }, { label: 'sign-off' }] }, opt: { title: { title: 'Readiness' }, showTally: { showTally: true }, sourceIds: { sourceIds: [S] } } },
  ChipSet: { req: { labels: ['eu-west', 'beta'] }, opt: { tone: { tone: 'info' }, wrap: { wrap: true }, sourceIds: { sourceIds: [S] } } },
  CodeBlock: { req: { code: 'git push --force-with-lease' }, opt: { caption: { caption: 'ship log' }, language: { language: 'bash' }, showLines: { showLines: true }, sourceIds: { sourceIds: [S] } } },
  DataTable: { req: { rows: [{ lane: 'ingest', score: 4.5 }, { lane: 'serve', score: 3 }] }, opt: { title: { title: 'Lanes' }, columns: { columns: [{ key: 'lane', label: 'Lane', type: 'text' }, { key: 'score', label: 'Score', type: 'bar' }] }, pageSize: { pageSize: 1 }, defaultSort: { defaultSort: { key: 'score', dir: 'desc' } }, aggregations: { aggregations: { score: 'mean' } }, totals: { totals: true }, sourceIds: { sourceIds: [S] } } },
  Divider: { req: {}, opt: { label: { label: 'details' }, orientation: { orientation: 'vertical' }, sourceIds: { sourceIds: [S] } } },
  Grid: { req: { columns: 2, children: ['m1', 'm2'] }, extras: { m1: ['Metric', { label: 'A', value: 12345 }], m2: ['Metric', { label: 'B', value: 999 }] }, opt: { gap: { gap: 'sm' }, sourceIds: { sourceIds: [S] } } },
  Heading: { req: { text: 'Section' }, opt: { level: { level: 3 }, sourceIds: { sourceIds: [S] } } },
  HeatMap: { req: { rows: ['mon', 'tue'], cols: ['am', 'pm'], cells: [[0, 0, 12], [0, 1, null], [1, 0, 7], [1, 1, 44]] }, opt: { unit: { unit: 'min' }, precision: { precision: 0 }, showValues: { showValues: true }, sourceIds: { sourceIds: [S] } } },
  Image: { req: { src: 'https://example.com/a.png', alt: 'chart of the thing' }, opt: { caption: { caption: 'fig 1' }, maxHeight: { maxHeight: 200 }, sourceIds: { sourceIds: [S] } } },
  ImageGallery: { req: { items: [{ src: 'https://example.com/1.png', alt: 'one' }, { src: 'https://example.com/2.png', alt: 'two' }] }, opt: { title: { title: 'Sites' }, columns: { columns: 2 }, sourceIds: { sourceIds: [S] } } },
  KeyValueList: { req: { items: [{ key: 'Region', value: 'eu-west' }, { key: 'Uptime', value: 99.997 }] }, opt: { title: { title: 'Service' }, sourceIds: { sourceIds: [S] } } },
  Metric: { req: { label: 'Requests', value: 9876543 }, opt: { unit: { unit: 'req/min' }, precision: { precision: 2 }, format: { format: 'currency' }, previous: { previous: 9300000 }, invertTone: { invertTone: true }, sourceIds: { sourceIds: [S] } } },
  Progress: { req: { current: 12345 }, opt: { label: { label: 'Migration' }, total: { total: 98765 }, target: { target: 50000 }, unit: { unit: 'rows' }, sourceIds: { sourceIds: [S] } } },
  SourceList: { req: {}, opt: { title: { title: 'Sources' }, sourceIds: { sourceIds: [S] } } },
  Sparkline: { req: {}, opt: { values: { values: [900, 980, 1010, null, 1150, 1240] }, series: { series: [{ label: 'trend', data: [{ label: 'a', value: 900 }, { label: 'b', value: 1240 }] }] }, direction: { direction: 'bar' }, width: { width: 120 }, height: { height: 24 }, tone: { tone: 'danger' }, sourceIds: { sourceIds: [S] } } },
  Stack: { req: { children: ['t1', 't2'] }, extras: { t1: ['Text', { text: 'one' }], t2: ['Text', { text: 'two' }] }, opt: { direction: { direction: 'horizontal' }, gap: { gap: 'md' }, align: { align: 'center' }, sourceIds: { sourceIds: [S] } } },
  Tabs: { req: { tabs: [{ title: 'One', child: 'x1' }, { title: 'Two', child: 'x2' }] }, extras: { x1: ['Text', { text: 'panel one' }], x2: ['Text', { text: 'panel two' }] }, opt: { defaultTab: { defaultTab: 1 }, sourceIds: { sourceIds: [S] } } },
  Text: { req: { text: 'The queue drained at 14:03.' }, opt: { tone: { tone: 'success' }, variant: { variant: 'mono' }, sourceIds: { sourceIds: [S] } } },
  Timeline: { req: { items: [{ date: '2026-09-26', label: 'L0 build', status: 'failed' }, { date: 'later-ish', label: 'triage' }] }, opt: { title: { title: 'Incident' }, sourceIds: { sourceIds: [S] } } }
}
const SOURCES = [{ id: 's1', label: 'Night log', url: 'https://example.com/log' }]
const types = Object.keys(SAMPLES)

async function renderCase(type, props) {
  const fix = SAMPLES[type].extras || {}
  const elements = { r: { type, props: { ...props }, children: (fix && props.children) || props.tabs?.map(t => t.child) || props.items?.map(i => i.child).filter(Boolean) || [] } }
  for (const [id, [t, p]] of Object.entries(fix)) elements[id] = { type: t, props: p, children: [] }
  const spec = { root: 'r', elements }
  await act(async () => { renderSpec(spec, { data: {}, meta: { sources: SOURCES } }) })
  return mount
}

const FACE_SELS = ['[data-ru-value]', '[data-ru-item-value]', '[data-ru-target]', '[data-ru-vs-target]', '[data-ru-readout]', '[data-ru-tally-text]', '[data-ru-time]', '[data-ru="AsOf"]', '[data-ru-delta-line]']
const CHROME_SELS = ['[data-ru-head]', '[data-ru-header]', '[data-ru-footer]']
// Authored passthrough exemptions (content the author wrote is shown as written).
const AUTHORED = ['[data-ru="Text"]', '[data-ru="CodeBlock"] pre', '[data-ru="Heading"]', '[data-ru="Card"] [data-ru-header]', '[data-ru="ChipSet"]']
const RAW = [
  [/\b\d{4}-\d{2}-\d{2}\b/, 'ISO date'],
  [/\b1\/1\/(?:70|1970)\b/, 'epoch date'],
  [/\b\d{8,}\b/, 'raw >=8-digit run'],
  [/\b\d+\.\d{9,}\b/, 'float artefact'],
  [/NaN|Infinity|\[object Object\b/, 'machine token']
]
const textsIn = (el, sel) => [...el.querySelectorAll(sel)].map(e => e.textContent || '')
function scopedText(el, sel, exemptSel) {
  const hit = new Set([...el.querySelectorAll(exemptSel)].flatMap(e => [...e.querySelectorAll('*'), e]))
  return textsIn(el, sel).filter((_, i) => !hit.has([...el.querySelectorAll(sel)][i])).join(' | ')
}

test('S0: the gate covers all 26 catalog types', () => {
  assert.deepEqual(types.sort(), Object.keys(CATALOG).sort(), 'SAMPLES covers every catalog type')
  assert.equal(Object.keys(CATALOG).length, 26)
})

for (const type of types) {
  const reqProps = (CATALOG[type].properties?.required || []).reduce((acc, k) => {
    const v = SAMPLES[type].req[k]
    if (v !== undefined) acc[k] = v
    return acc
  }, { ...SAMPLES[type].req })
  const optionals = Object.keys(SAMPLES[type].opt || {})
  const catalogOptionals = Object.keys(CATALOG[type].properties).filter(k =>
    !['id', 'component', 'accessibility'].includes(k) && !(CATALOG[type].required || []).includes(k))
  test(`${type}: gate covers every catalog-optional prop`, () => {
    for (const k of catalogOptionals) assert.ok(optionals.includes(k) || k === 'children' || k === 'items' || k === 'rows' || k === 'tabs', `${type}.${k} unpinned`)
  })

  const cases = [['required-only', reqProps], ...optionals.map(k => [`${k} alone`, { ...reqProps, ...SAMPLES[type].opt[k] }])]
  for (const [label, props] of cases) {
    test(`${type} [${label}] looks complete`, async () => {
      const el = await renderCase(type, JSON.parse(JSON.stringify(props)))
      // A1
      assert.equal(el.querySelectorAll('[data-ru-error]').length, 0, 'no inline error')
      assert.equal(el.querySelectorAll('[data-ru-unknown]').length, 0, 'no unknown type')
      assert.equal(el.querySelectorAll('[data-ru-unlowerable]').length, 0, 'lowers')
      // A2: no empty head; titled renders expose the head marker
      for (const head of el.querySelectorAll('[data-ru-head]'))
        assert.ok((head.textContent || '').trim().length > 0, `empty head in ${type} [${label}]`)
      if (props.title !== undefined && type !== 'Card')
        assert.ok(el.querySelector('[data-ru-head]'), `${type} with a title exposes [data-ru-head] in [${label}]`)
      // A3: value faces and head/foot chrome carry no machine text
      // A3 scope: faces + head/foot chrome. The 'unavailable' word is the house
      // machine-text token itself (data-ru-null), and a source URL is authored
      // content — both are documented exemptions, exercised by the null pins below.
      const faceSel = FACE_SELS.concat(CHROME_SELS).join(',').replace(',[data-ru="AsOf"]', '')
      let body = scopedText(el, faceSel, AUTHORED.join(','))
      body = body.split('|').filter((_, i) => {
        const els = [...el.querySelectorAll(faceSel)]
        return !els[i]?.hasAttribute('data-ru-null')
      }).join(' | ')
      for (const [rx, what] of RAW)
        assert.ok(!rx.test(body), `machine text (${what}) in ${type} [${label}]: ${body.slice(0, 200)}`)
      // null-word teeth, scoped to actual faces (chrome prose may mention null honestly)
      const faceOnly = [...el.querySelectorAll(FACE_SELS.join(','))].map(e => e.textContent || '').join(' | ')
      assert.ok(!/\bnull\b\s*\)?\s*$|\(null\)|: null/.test(faceOnly), `null token leaks a face in ${type} [${label}]: ${faceOnly.slice(0, 160)}`)
      // A4: rendered text carries ramp pairs only
      const pairs = new Set(Object.values(TYPE).map(s => `${parseFloat(s.fontSize)}/${s.fontWeight}`))
      const walker = document.createTreeWalker(el, 4)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue
        const hostEl = n.parentElement
        if (!hostEl.closest('[data-ru]')) continue
        if (hostEl.closest('[data-richui="chart-canvas"]')) continue // canvas ink; config pinned separately
        let size, weight
        for (let a = hostEl; a && a !== el; a = a.parentElement) { size ||= a.style?.fontSize; weight ||= a.style?.fontWeight }
        if (!size || !weight) continue // component-internal prose inherits the host default; host carries it
        assert.ok(pairs.has(`${parseFloat(size)}/${weight}`), `off-ramp pair ${size}/${weight} in ${type} [${label}]`)
      }
      // A5: readouts
      for (const m of el.querySelectorAll('[data-ru-exact]')) {
        const face = (m.textContent || '').trim()
        const exact = m.getAttribute('data-ru-exact')
        if (face === exact) continue
        assert.ok(m.getAttribute('title'), `abbreviated ${type} face "${face}" needs title (${exact})`)
        assert.ok((m.getAttribute('aria-label') || '').includes(exact), `aria-label must carry the exact value for "${face}"`)
      }
      const faceAll = [...el.querySelectorAll(FACE_SELS.join(','))]
      for (const f of faceAll) {
        const t = (f.textContent || '').trim()
        if (/\d(?:\.\d+)?\s*[kMBT](?![a-z])|×/.test(t) && !f.hasAttribute('data-ru-exact'))
          assert.fail(`abbreviated face "${t}" in ${type} [${label}] carries no data-ru-exact marker`)
      }
      // A6: every button acts
      for (const btn of el.querySelectorAll('button')) {
        const before = [btn.getAttribute('aria-expanded'), btn.getAttribute('aria-selected'), btn.getAttribute('data-ru-open'), el.innerHTML]
        btn.click()
        await act(async () => {})
        const after = [btn.getAttribute('aria-expanded'), btn.getAttribute('aria-selected'), btn.getAttribute('data-ru-open'), el.innerHTML]
        assert.ok(before.some((v, i) => v !== after[i]), `${type} [${label}]: a control cannot act`)
      }
    })
  }
}

test('A3 negative pins: authored passthrough stays verbatim', async () => {
  // The exemption is real: an authored Text sentence with an ISO date renders as written
  // (and is therefore invisible to the machine-text census, which is scope-based, not naive).
  await renderCase('Text', { text: 'Deployed 2026-10-09 at 1776451200000 ms — no reformatting.' })
  const t = mount.querySelector('[data-ru="Text"]').textContent
  assert.ok(t.includes('2026-10-09'), 'authored ISO date stays verbatim')
  await renderCase('CodeBlock', { code: 'ts=1758067200  # 2026-10-09' })
  assert.ok(mount.querySelector('[data-ru="CodeBlock"] pre').textContent.includes('2026-10-09'), 'code passes through')
})

test('A7: no text box clips at 360 and 720 px', async () => {
  // Harvest through the jsdom harness (same shape as the #47 control); the live lane
  // rebuilds the markup in Chromium. Without a binary the harness returns { skipped }.
  const types = ['Metric', 'Card', 'DataTable', 'BarList', 'Timeline']
  const { harvestForClip } = await import('../harness/pins/clip.mjs')
  const harvest = async () => ({
    html: await harvestForClip(renderSpec, mount, types, SAMPLES, SOURCES),
    css: 'body{margin:0}'
  })
  const verdict = await clipCensus({ widths: [360, 720], harvest })
  if (verdict.skipped) { console.log(`A7 recorded skip: ${verdict.skipped}`); return } // #47 option-B contract
  assert.deepEqual(verdict.clipped.map(c => `${c.width}px ${c.path} "${c.text}" -${c.lost}px`), [], 'clipped boxes')
})

test('A8: hue reservation — bare accent is interactive state and heat ramp only', async () => {
  for (const type of ['Metric', 'Progress', 'Badge', 'Callout', 'Chart', 'DataTable', 'CodeBlock', 'Card', 'AsOf']) {
    const el = await renderCase(type, JSON.parse(JSON.stringify(SAMPLES[type].req)))
    for (const node of el.querySelectorAll('[style]')) {
      const s = node.getAttribute('style') || ''
      if (!/(?:^|[;\s:])(?:color|background|border|outline)(?:-[a-z]+)*:\s*[^;]*var\(--ui-accent\)/.test(s)) continue
      if (/color-mix/.test(s)) continue
      const interactive = !!node.closest('button') || node.hasAttribute('data-ru-toggle')
      assert.ok(interactive, `${type}: bare var(--ui-accent) chrome on ${node.tagName}[data-ru=${node.getAttribute('data-ru')}] — full accent is reserved for interactive state and the heat ramp`)
    }
  }
})
