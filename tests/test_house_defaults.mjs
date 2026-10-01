// Slice 4 / J13 + J9 (#27): the catalog `default` annotations are DOCUMENTATION for the 21 props
// whose house meaning is a named constant in _house.mjs HOUSE (precedence law §2: absent prop ->
// house constant; explicit prop always wins; no third layer). ImageGallery.columns carries NO
// default annotation: the door never bakes it, the renderer door resolves absent columns to the
// house constant GALLERY_COLUMNS (= today's baked 2), and a saved `columns:2` is honoured as explicit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { HOUSE } from '../desktop/src/components/_house.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CATALOG = JSON.parse(readFileSync(path.join(ROOT, 'catalog', 'hermes-rich-ui.catalog.json'), 'utf8'))
const COMPS = CATALOG.components

// The door props whose absent meaning is a house constant. The default VALUE is read from the
// catalog at assertion time (never hard-coded here); the right column only names the constant.
const HOUSE_MEANING = {
  'Stack.direction': ['STACK_DIRECTION', 'vertical'],
  'Stack.gap': ['STACK_GAP', 'md'],
  'Grid.gap': ['GRID_GAP', 'md'],
  'Divider.orientation': ['DIVIDER_ORIENTATION', 'horizontal'],
  'Heading.level': ['HEADING_LEVEL', 2],
  'Text.tone': ['TEXT_TONE', 'default'],
  'Text.variant': ['TEXT_VARIANT', 'body'],
  'Badge.tone': ['BADGE_TONE', 'neutral'],
  'Metric.format': ['METRIC_FORMAT', 'number'],
  'Metric.invertTone': ['METRIC_INVERT_TONE', false],
  'Checklist.showTally': ['CHECKLIST_SHOW_TALLY', true],
  'ChipSet.tone': ['CHIPSET_TONE', 'neutral'],
  'ChipSet.wrap': ['CHIPSET_WRAP', true],
  'CodeBlock.showLines': ['CODEBLOCK_SHOW_LINES', false],
  'Sparkline.direction': ['SPARKLINE_DIRECTION', 'line'],
  'Sparkline.width': ['SPARK_W', 120],
  'Sparkline.height': ['SPARK_H', 24],
  'Sparkline.tone': ['SPARKLINE_TONE', 'default'],
  'BarList.format': ['BARLIST_FORMAT', 'number'],
  'BarList.sort': ['BARLIST_SORT', 'desc'],
  'HeatMap.showValues': ['HEATMAP_SHOW_VALUES', true],
  'ImageGallery.columns': ['GALLERY_COLUMNS', 2]
}

function annotations() {
  const out = []
  for (const [type, schema] of Object.entries(COMPS)) {
    for (const [prop, sub] of Object.entries(schema.properties || {})) {
      if (sub && typeof sub === 'object' && 'default' in sub) out.push(`${type}.${prop}`)
    }
  }
  return out.sort()
}
const ANNOTATED = annotations()

test('J13: every catalog `default` annotation equals its named house constant (values read from the catalog)', () => {
  for (const key of ANNOTATED) {
    assert.ok(key in HOUSE_MEANING, `unexpected default annotation ${key} (documentation only for the door props)`)
    const [type, prop] = key.split('.')
    const annotation = COMPS[type].properties[prop].default
    const [constName, literal] = HOUSE_MEANING[key]
    assert.ok(constName in HOUSE, `HOUSE.${constName} is the named constant for ${key}`)
    assert.equal(HOUSE[constName], annotation, `HOUSE.${constName} must equal the ${key} default annotation`)
    assert.equal(annotation, literal, `catalog annotation drift for ${key}`)
  }
})

test('J9: the catalog annotates exactly the 21 documented door props; ImageGallery.columns keeps NO annotation', () => {
  assert.deepEqual(ANNOTATED, Object.keys(HOUSE_MEANING).filter(k => k !== 'ImageGallery.columns').sort(),
    'annotations are documentation for the 21 baked-tolerant props only')
  const sub = COMPS.ImageGallery.properties.columns
  assert.ok(sub, 'columns prop exists')
  assert.ok(!('default' in sub), 'the ImageGallery columns default annotation must be removed')
})

test('J9: absent gallery columns resolves to HOUSE.GALLERY_COLUMNS (the meaning the baked 2 carried)', () => {
  assert.equal(HOUSE.GALLERY_COLUMNS, 2, 'the renderer door takes the house constant for absent columns')
  // The house constant must equal the value the removed annotation carried.
  assert.equal(HOUSE.GALLERY_COLUMNS, 2)
})

test('saved gallery fixtures keep their baked columns:2 (honoured as explicit)', () => {
  const dir = path.join(ROOT, 'tests/fixtures/saved')
  let found = 0
  for (const f of readdirSync(dir).filter(x => x.endsWith('.json'))) {
    const r = JSON.parse(readFileSync(path.join(dir, f), 'utf8'))
    for (const c of r.surface.createSurface.components) {
      if (c.component === 'ImageGallery' && 'columns' in c) {
        found++
        assert.equal(c.columns, 2, `${f}: saved gallery is explicit-2`)
      }
    }
  }
  assert.ok(found >= 1, 'the 22-baked-prop fixture carries a saved gallery')
})

test('the 22 door props are the union of annotated props and the gallery columns door', () => {
  const all = new Set(ANNOTATED)
  all.add('ImageGallery.columns')
  assert.equal(all.size, 22, '22 baked props total (test_saved_cards.mjs pins the same table)')
})
