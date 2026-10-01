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

export const HOUSE = Object.freeze({
  SIG: 3,                                    // significant figures on a face
  COMPACT_FROM: 1e4,                         // faces and axes compact from 10,000 (G4a)
  TIERS: Object.freeze(['k', 'M', 'B', 'T']), // 1e3, 1e6, 1e9, 1e12 (G4b: lowercase k only)
  SCI_BELOW: 1e-4,                           // non-money faces go ×10ⁿ below this
  LOCALE: 'en-US',
  MINUS: '\u2212'                            // face minus; the readout keeps ASCII '-'
})
export const { SIG, COMPACT_FROM, TIERS, SCI_BELOW, LOCALE, MINUS } = HOUSE
