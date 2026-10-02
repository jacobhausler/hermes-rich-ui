// #26: the token law is a rendered-card census, not a source-text snapshot.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { React, act, registry } from './helpers/render.mjs'
import * as house from '../desktop/src/components/_house.mjs'
const { CardBody } = await import('../desktop/src/card.mjs')
const { createRoot } = await import('react-dom/client')

const HERE = fileURLToPath(new URL('.', import.meta.url))
const FILES = ['ru-000000000022', 'ru-97cb020cd21b', 'ru-c69fc582e9a9', 'ru-f3af0e45428d']
const mount = document.createElement('div')
document.body.append(mount)
const root = createRoot(mount)
const theme = value => /^var\(--ui-[a-z-]+\)$/.test(value)
const paint = value => theme(value) || /^color-mix\(in srgb, var\(--ui-[a-z-]+\) \d+%, var\(--ui-[a-z-]+\)\)$/.test(value)

// Measured on the four saved cards at 3beb897. A later restyle removes entries;
// adding an entry requires a separately reviewed, named before→after pair.
const EXEMPT = new Set([
  'Accordion button border=medium', 'Accordion button gap=6px',
  'Accordion button padding=6px 10px', 'Accordion div border-top=medium',
  'BarList div gap=6px', 'Callout div padding=8px 10px',
  'Chart div background=rgb(156, 163, 175)', 'Chart div background=rgb(59, 130, 246)',
  'Chart div background=rgba(34, 197, 94, 0.18)', 'Chart div background=rgba(59, 130, 246, 0.18)',
  'Chart div border=2px solid rgb(34, 197, 94)', 'Chart div border=2px solid rgb(59, 130, 246)',
  'Chart figure gap=6px', 'Checklist div gap=6px', 'Checklist sup margin-left=3px',
  'CodeBlock div gap=6px', 'CodeBlock pre padding=8px 10px',
  'CodeBlock span border-radius=999px', 'CodeBlock span padding-left=34px',
  'CodeBlock span padding=0px 5px', 'DataTable button padding=5px 8px',
  'DataTable div gap=6px',
  'DataTable span border-radius=2px',
  'DataTable span gap=6px',
  'HeatMap div gap=6px',
  'HeatMap sup margin-left=3px', 'HeatMap td padding=4px 6px',
  'HeatMap th padding=3px 6px', 'ImageGallery div gap=6px',
  'Progress div border-radius=1px', 'SourceList li gap=6px',
  'SourceList ol gap=3px', 'Tabs button border-left=medium',
  'Tabs button border-right=medium', 'Tabs button border-top=medium',
  'Tabs button margin-bottom=-1px', 'Tabs button padding=4px 10px',
  'Timeline div gap=1px', 'Timeline div gap=6px',
  'Timeline sup margin-left=3px'
])

// Own inline styles only: host prose/SDK CSS and canvas are not renderer tokens.
// A signature includes its component, tag, CSS property and actual value, so a
// newly invented off-scale value cannot hide behind an exception in another role.
function violations(node) {
  const out = new Set()
  for (const el of node.querySelectorAll('[style]')) {
    const component = el.closest('[data-ru]')?.getAttribute('data-ru') || 'chrome'
    if (component === 'chrome') continue // SDK tooltip/controls are outside the renderer.
    for (const entry of el.getAttribute('style').split(';').filter(Boolean)) {
      const [rawProp, ...parts] = entry.split(':')
      const prop = rawProp.trim()
      const value = parts.join(':').trim()
      const kind = /^(padding|margin|gap)(-|$)|^(row|column)-gap$/.test(prop) ? 'space'
        : prop === 'border-radius' ? 'radius'
          : /^(color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left)(?:-color)?)?|outline(?:-color)?|fill|stroke)$/.test(prop) ? 'paint' : null
      if (!kind) continue
      let ok = true
      if (kind === 'space') ok = value.split(/\s+/).every(v => /^(?:0|0px|2px|4px|8px|12px|16px|20px|24px)$/.test(v))
      if (kind === 'radius') ok = value === '50%' || /^(3|4|6)px$/.test(value)
      if (kind === 'paint') {
        // Strip only CSS geometry/keywords and valid theme paints. Any residual
        // word/hex/rgb is a new literal colour, even inside a gradient or mix.
        const residual = value
          .replace(/color-mix\(in srgb, var\(--ui-[a-z-]+\) \d+%, var\(--ui-[a-z-]+\)\)/g, '')
          .replace(/var\(--ui-[a-z-]+\)/g, '')
          .replace(/\b(?:transparent|none|currentColor|inherit|solid|dashed|repeating-linear-gradient|linear-gradient)\b/g, '')
          .replace(/\b\d+(?:\.\d+)?(?:px|deg|%)?\b/g, '')
          .replace(/[(),\s-]/g, '')
        ok = residual === ''
      }
      if (!ok) out.add(`${component} ${el.tagName.toLowerCase()} ${prop}=${value}`)
    }
  }
  return out
}

test('T1–T5: one frozen space/radius/border/surface/tone/ink/series vocabulary', () => {
  assert.deepEqual(house.S, { hair: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24 })
  assert.deepEqual(house.R, { mark: 3, control: 4, box: 6, circle: '50%' })
  assert.deepEqual(Object.keys(house.B), ['hair', 'head', 'rail', 'tab', 'absent'])
  assert.equal(house.B.hair, '1px solid var(--ui-stroke-tertiary)')
  assert.equal(house.B.head, '1px solid var(--ui-stroke-secondary)')
  assert.equal(house.B.rail(house.TONE.error), '3px solid var(--ui-red)')
  assert.equal(house.B.tab, '2px solid var(--ui-accent)')
  assert.equal(house.B.absent, '1px dashed var(--ui-stroke-tertiary)')
  assert.deepEqual(Object.keys(house.SURFACE), ['card', 'inset', 'flat'])
  assert.deepEqual(house.SURFACE.card, { background: 'var(--ui-bg-elevated)', border: house.B.hair, borderRadius: 6, padding: 16 }) // #30 slice 7 (C15): padding 12->16, the named saved-card restyle
  assert.deepEqual(house.SURFACE.inset, { background: 'var(--ui-bg-tertiary)', borderRadius: 6, padding: '8px 12px' })
  assert.deepEqual(house.SURFACE.flat, {})
  assert.deepEqual(house.TONE, { neutral: 'var(--ui-text-secondary)', info: 'var(--ui-accent)', success: 'var(--ui-green)', caution: 'var(--ui-yellow)', error: 'var(--ui-red)' })
  assert.deepEqual(house.INK, { value: 'var(--ui-text-primary)', label: 'var(--ui-text-secondary)', meta: 'var(--ui-text-tertiary)' })
  assert.deepEqual(house.SERIES, ['var(--ui-accent)', 'var(--ui-orange)', 'var(--ui-purple)', 'var(--ui-green)'])
  for (const [tone, color] of Object.entries(house.TONE)) {
    assert.equal(house.TONE_TEXT[tone], `color-mix(in srgb, ${color} 72%, var(--ui-text-primary))`)
    assert.ok(paint(house.TONE_TEXT[tone]), `${tone} uses theme paint`)
  }
  for (const name of ['S', 'R', 'B', 'SURFACE', 'TONE', 'TONE_TEXT', 'INK', 'SERIES']) assert.ok(Object.isFrozen(house[name]), `${name} immutable`)
})

test('S18: layout floors/caps and mark/heat mixes have one house home', () => {
  assert.deepEqual(Object.fromEntries(['TILE_FLOOR', 'BLOCK_FLOOR', 'WIDE_FLOOR', 'CAP', 'CAP_WHOLE', 'FADE', 'MEASURE', 'MARK_FILL_MIX', 'HEAT_MIX'].map(k => [k, house.HOUSE?.[k]])),
    { TILE_FLOOR: 140, BLOCK_FLOOR: 240, WIDE_FLOOR: 280, CAP: 480, CAP_WHOLE: 600, FADE: 32, MEASURE: '72ch', MARK_FILL_MIX: 85, HEAT_MIX: [12, 60] }) // #33: mark-fill mix moved 55->85 to pass the 3:1 both-themes pin (helpers/mark_fill.mjs); the rule never moved
  assert.ok(Object.isFrozen(house.HOUSE) && Object.isFrozen(house.HOUSE?.HEAT_MIX))
})

test('saved-card own inline tokens: only named baseline exceptions may remain', async () => {
  const seen = new Set()
  let checked = 0
  for (const name of FILES) {
    const record = JSON.parse(readFileSync(path.join(HERE, 'fixtures/saved', name + '.json'), 'utf8'))
    await act(async () => root.render(React.createElement(CardBody, { record, registry })))
    checked += mount.querySelectorAll('[style]').length
    for (const v of violations(mount)) if (!EXEMPT.has(v)) seen.add(v)
  }
  assert.ok(checked > 150, `census covered ${checked} styled nodes`)
  assert.deepEqual([...seen].sort(), [], `new off-scale renderer styles (EXEMPT may only shrink):\n${[...seen].sort().join('\n')}`)
})
