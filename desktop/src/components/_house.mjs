// House constants (DEFAULTS-SPEC §2 layer 1, S18): one place for the owner's taste.
// #25: the full inline quad defeats host .prose typography on nested table/dt/h*.
// Ten names in the binding table (described there as "nine steps"); all ten are kept.
export const TYPE = Object.freeze(Object.fromEntries(Object.entries({
  kpi: [20, 600, 26, '-0.01em'], title: [16, 600, 22, '-0.01em'],
  h2: [14, 600, 20, '0em'], h3: [13, 600, 18, '0em'],
  body: [13, 400, 19, '0em'], h4: [12, 600, 17, '0em'],
  small: [12, 400, 17, '0em'], caption: [11, 400, 16, '0em'],
  eyebrow: [11, 600, 16, '0.04em'], micro: [10, 400, 12, '0em']
}).map(([name, [fontSize, fontWeight, lineHeight, letterSpacing]]) =>
  [name, Object.freeze({ fontSize, fontWeight, lineHeight: `${lineHeight}px`, letterSpacing })])))
export const INK = Object.freeze({ value: 'var(--ui-text-primary)', label: 'var(--ui-text-secondary)', meta: 'var(--ui-text-tertiary)' })

// #26: foundation tokens only. No call sites move until their separately tested slices.
// Space is physical px; the catalog's saved gap names keep their 0/4/8/16 meaning.
export const S = Object.freeze({ hair: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24 })
export const R = Object.freeze({ mark: 3, control: 4, box: 6, circle: '50%' })
export const TONE = Object.freeze({
  neutral: 'var(--ui-text-secondary)', info: 'var(--ui-accent)',
  success: 'var(--ui-green)', caution: 'var(--ui-yellow)', error: 'var(--ui-red)'
})
export const SERIES = Object.freeze(['var(--ui-accent)', 'var(--ui-orange)', 'var(--ui-purple)', 'var(--ui-green)'])
export const B = Object.freeze({
  hair: '1px solid var(--ui-stroke-tertiary)', head: '1px solid var(--ui-stroke-secondary)',
  rail: tone => `3px solid ${tone}`, tab: '2px solid var(--ui-accent)',
  absent: '1px dashed var(--ui-stroke-tertiary)'
})
export const SURFACE = Object.freeze({
  card: Object.freeze({ background: 'var(--ui-bg-elevated)', border: B.hair, borderRadius: R.box, padding: S.md }),
  inset: Object.freeze({ background: 'var(--ui-bg-tertiary)', borderRadius: R.box, padding: `${S.sm}px ${S.md}px` }),
  flat: Object.freeze({})
})

export const HOUSE = Object.freeze({
  SIG: 3,                                    // significant figures on a face
  COMPACT_FROM: 1e4,                         // faces and axes compact from 10,000 (G4a)
  TIERS: Object.freeze(['k', 'M', 'B', 'T']), // 1e3, 1e6, 1e9, 1e12 (G4b: lowercase k only)
  SCI_BELOW: 1e-4,                           // non-money faces go ×10ⁿ below this
  LOCALE: 'en-US',
  MINUS: '\u2212',                           // face minus; the readout keeps ASCII '-'
  TILE_FLOOR: 140, BLOCK_FLOOR: 240, WIDE_FLOOR: 280,
  CAP: 480, CAP_WHOLE: 600, FADE: 32, MEASURE: '72ch',
  CHART_PLOT_H: 180, PAGE: 10, PAGE_GRACE: 1.5,
  SPARK_W: 120, SPARK_H: 24, IMAGE_MAX_H: 320,
  // #33 (harness mark-fill pin): 55 failed 3:1 vs the card in dark (2.61); the constant
  // moves, the RULE (3:1 both themes) does not — tests/helpers/mark_fill.mjs proves 85 passes.
  MARK_FILL_MIX: 85, HEAT_MIX: Object.freeze([12, 60]), TONE_TEXT_MIX: 72,
  CITE_RUN_MIN: 3, CITE_TOKEN_LIMIT: 4, CITE_VISIBLE: 3,
  // #27 (J9/J13, spec §2 layer 1): the 22 door defaults. An absent prop takes THESE
  // at render; the catalog `default` annotations are documentation of exactly these
  // values (tests/test_house_defaults.mjs pins the equality, admission never writes them).
  STACK_DIRECTION: 'vertical', STACK_GAP: 'md', GRID_GAP: 'md',
  DIVIDER_ORIENTATION: 'horizontal', HEADING_LEVEL: 2,
  TEXT_TONE: 'default', TEXT_VARIANT: 'body', BADGE_TONE: 'neutral',
  METRIC_FORMAT: 'number', METRIC_INVERT_TONE: false,
  CHECKLIST_SHOW_TALLY: true, CHIPSET_TONE: 'neutral', CHIPSET_WRAP: true,
  CODEBLOCK_SHOW_LINES: false, GALLERY_COLUMNS: 2,
  SPARKLINE_DIRECTION: 'line', SPARKLINE_TONE: 'default',
  BARLIST_FORMAT: 'number', BARLIST_SORT: 'desc', HEATMAP_SHOW_VALUES: true
})
export const TONE_TEXT = Object.freeze(Object.fromEntries(Object.entries(TONE).map(([name, color]) =>
  [name, `color-mix(in srgb, ${color} ${HOUSE.TONE_TEXT_MIX}%, ${INK.value})`])))
// #33: the ONE mark-fill expression every drawn bar/fill rides (BarList bar, DataTable bar
// cell, Progress fill). The mix constant lives above and the contrast rule (>= 3:1 vs the
// card, both themes) is pinned by tests/helpers/mark_fill.mjs — the constant may move, the
// rule never does.
export const MARK_FILL = (color = 'var(--ui-accent)', surface = 'var(--ui-bg-tertiary)') =>
  `color-mix(in srgb, ${color} ${HOUSE.MARK_FILL_MIX}%, ${surface})`
export const { SIG, COMPACT_FROM, TIERS, SCI_BELOW, LOCALE, MINUS } = HOUSE
