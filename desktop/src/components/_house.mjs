// House constants (DEFAULTS-SPEC §2 layer 1, S18): the one place the owner's taste lives. Slice 1: number constants only.
export const HOUSE = Object.freeze({
  SIG: 3,                                    // significant figures on a face
  COMPACT_FROM: 1e4,                         // faces and axes compact from 10,000 (G4a)
  TIERS: Object.freeze(['k', 'M', 'B', 'T']), // 1e3, 1e6, 1e9, 1e12 (G4b: lowercase k only)
  SCI_BELOW: 1e-4,                           // non-money faces go ×10ⁿ below this
  LOCALE: 'en-US',
  MINUS: '\u2212'                            // face minus; the readout keeps ASCII '-'
})
export const { SIG, COMPACT_FROM, TIERS, SCI_BELOW, LOCALE, MINUS } = HOUSE
