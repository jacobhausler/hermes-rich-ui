// The one value→text module (DEFAULTS-SPEC D1–D5, D2.1; issue #24). Pure: no DOM, no theme, no clock.
import { SIG, COMPACT_FROM, TIERS, SCI_BELOW, LOCALE, MINUS } from './_house.mjs'
const NBSP = '\u00a0', TIER_AT = TIERS.map((t, i) => [10 ** (3 * i + 3), t]), TOP = TIER_AT[TIER_AT.length - 1]
const SYM = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' }
const ISO4217 = (() => { try { return new Set(Intl.supportedValuesOf('currency')) } catch { return new Set(['USD', 'EUR', 'GBP', 'JPY']) } })()
const nf = (a, o) => new Intl.NumberFormat(LOCALE, o).format(a)
const clean = n => Number(n.toPrecision(15))
const SUP = { '-': '\u207b', 0: '\u2070', 1: '\u00b9', 2: '\u00b2', 3: '\u00b3', 4: '\u2074', 5: '\u2075', 6: '\u2076', 7: '\u2077', 8: '\u2078', 9: '\u2079' }
const sci = (a, sig) => { const [m, e] = Number(a.toPrecision(sig)).toExponential().split('e'); return m + '\u00d710' + [...String(Number(e))].map(c => SUP[c]).join('') }
const sigStr = (a, sig, group = false) => nf(a, { maximumSignificantDigits: sig, useGrouping: group })
const curOpts = cur => new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur })
const minorOf = cur => curOpts(cur).resolvedOptions().maximumFractionDigits
const symOf = cur => { const v = curOpts(cur).formatToParts(0).find(p => p.type === 'currency').value; return /[A-Za-z]$/.test(v) ? v + NBSP : v }
// D2.1: where a unit prints, per class × surface. ride = on every value; sibling = a span beside a display face; once = after the last value; label/header/title/caption = printed once elsewhere; none/null = ∅.
const RIDE = { face: 'ride', kv: 'ride', pair: 'ride', cell: 'ride', header: 'label', ticks: 'ride', axisTitle: null, heatCell: 'ride', heatCaption: 'ride', readout: 'ride' }
const ONCE = { face: 'sibling', kv: 'ride', pair: 'once', cell: 'header', header: 'label (unit)', ticks: 'title', axisTitle: 'unit', heatCell: 'caption', heatCaption: 'once', readout: 'ride' }
const BARE = Object.fromEntries(Object.entries(RIDE).map(([k, v]) => [k, v === 'ride' ? 'none' : v]))
export const UNIT_TABLE = Object.freeze(Object.fromEntries(Object.entries({ bare: BARE, currency: RIDE, percent: RIDE, points: ONCE, attached: RIDE, word: ONCE })
  .map(([k, v]) => [k, Object.freeze({ ...v })])))
export function unitSpec(format, unit) {  // format × unit → one spec; a contradiction renders with format winning, the unit kept as a word unit (AD-11)
  const u = typeof unit === 'string' ? unit.trim() : '', code = SYM[u] || (/^[A-Z]{3}$/.test(u) && ISO4217.has(u) ? u : null)
  const mk = (cls, x = {}) => ({ cls, suffix: '', scale: format === 'fraction' ? 100 : 1, currency: 'USD', ...x })
  if (format === 'currency') return code || !u ? mk('currency', { currency: code || 'USD' }) : mk('currency', { suffix: u, contra: true })
  if (format === 'percent' || format === 'fraction') {
    if (!u || u === '%') return mk('percent')
    return format === 'percent' && /^(pp|bp)$/.test(u) ? mk('points', { suffix: u }) : mk('percent', { suffix: u, contra: true })
  }
  if (!u || u === '%' || code) return mk(!u ? 'bare' : code ? 'currency' : 'percent', code ? { currency: code } : {})
  return mk(/^(pp|bp)$/.test(u) ? 'points' : /^(°|‰|×|\/)/.test(u) ? 'attached' : 'word', { suffix: u })
}
const place = (spec, surface) => (spec.contra ? 'ride' : UNIT_TABLE[spec.cls][surface])
function tierOf(a, minor = 0) {  // choose AFTER rounding at the displayable unit; cents must not prematurely cross 10k.
  if (Math.round(a * 10 ** minor) / 10 ** minor < COMPACT_FROM) return [1, '']
  let i = TIER_AT.length - 1; while (i > 0 && a < TIER_AT[i][0]) i--
  return TIER_AT[Number((a / TIER_AT[i][0]).toPrecision(SIG)) >= 1000 ? i + 1 : i] || null
}
function finish(neg, body, spec, surface, face = true) {  // sign + currency symbol + digits + unit. A '<'/'>' bound flips for negatives (|n| < 0.01 ⇔ n > −0.01).
  const m = /^([<>])(.*)$/.exec(body), lead = !m ? '' : neg === (m[1] === '<') ? '>' : '<', p = place(spec, surface)
  let s = lead + (neg ? (face ? MINUS : '-') : '') + (spec.cls === 'currency' ? symOf(spec.currency) : '') + (m ? m[2] : body) + (spec.cls === 'percent' ? '%' : '')
  if (spec.suffix && (p === 'ride' || p === 'sibling')) s += (spec.cls === 'attached' ? '' : NBSP) + spec.suffix
  return s
}
function body(a, spec, o) {  // one magnitude a ≥ 0 → digits. o = { precision, exact, cents, sig, tier, fixed, group }
  const money = spec.cls === 'currency', pct = spec.cls === 'percent', p = o.precision
  if (p !== undefined) { // explicit precision = exact mode: grouped, N decimals, never compacted; landmarks become bounds
    if (a > 0 && Number(a.toFixed(p)) === 0) return '<' + (1 / 10 ** p).toFixed(p)
    if (pct && a !== 100 && Number(a.toFixed(p)) === 100) return a < 100 ? '>' + (100 - 1 / 10 ** p).toFixed(p) : '<' + (100 + 1 / 10 ** p).toFixed(p)
    return nf(a, { minimumFractionDigits: p, maximumFractionDigits: p })
  }
  if (o.exact) {
    const minor = money ? minorOf(spec.currency) : 0
    return money ? nf(a, { minimumFractionDigits: o.cents === false ? 0 : minor,
      maximumFractionDigits: Math.min(100, Math.max(minor, a ? 14 - Math.floor(Math.log10(a)) : minor)) })
      : nf(a, { maximumSignificantDigits: 15 })
  }
  if (a === 0) return '0'
  if (pct && a < 0.01) return '<0.01'
  const sig = o.sig ?? SIG, [div, t] = o.tier ?? tierOf(a, money ? minorOf(spec.currency) : 0) ?? (money ? TOP : [0, ''])
  if (!div) return sci(a, sig)
  if (t) return (o.fixed !== undefined ? (a / div).toFixed(o.fixed) : sigStr(a / div, sig, true)) + t
  const group = o.group ?? spec.cls !== 'bare', minor = money ? minorOf(spec.currency) : 0
  if (money) return a < 10 ** -minor ? sigStr(a, sig) : nf(a, { minimumFractionDigits: o.cents ? minor : 0, maximumFractionDigits: o.cents ? minor : 0 })
  if (o.fixed !== undefined) return nf(a, { minimumFractionDigits: o.fixed, maximumFractionDigits: o.fixed, useGrouping: group })
  if (a < SCI_BELOW) return sci(a, sig)
  if (a >= 1000 && sig <= SIG) return nf(Math.round(a), { useGrouping: group }) // 1,000–9,999 print whole
  let s = sigStr(a, sig, group)
  for (let w = sig + 1; pct && a !== 100 && Number(s) === 100 && w <= 6; w++) s = sigStr(a, w) // landmark guard (AD-4)
  return pct && a !== 100 && Number(s) === 100 ? (a < 100 ? '>99.9999' : '<100.0001') : s
}
const cents = (n, spec) => {
  if (spec.cls !== 'currency') return false
  // No second threshold: compact faces ignore cents; the rung decision owns 10k.
  const scale = 10 ** minorOf(spec.currency), units = Math.round(Math.abs(n) * scale)
  return units % scale !== 0
}
const prec = p => (Number.isInteger(p) && p >= 0 && p <= 6 ? p : undefined)
const numOf = (v, spec) => (typeof v === 'number' && Number.isFinite(v) ? clean(v * spec.scale) : null)
function one(v, n, spec, o, surface) {
  if (n === null) return typeof v === 'string' ? v : null // strings verbatim ('02139'); null → the caller's null word
  const b = body(Math.abs(n), spec, o)
  return finish(n < 0 && /[1-9]/.test(b), b, spec, surface, o.face ?? !o.exact)
}
// D1/D2: one value (a currency set of one). level:'exact' = the readout: grouped, 15 s.f., ASCII '-', minor units.
export function fmt(value, { format, unit, precision, level = 'face', surface = 'face' } = {}) {
  const spec = unitSpec(format, unit), n = numOf(value, spec), exact = level === 'exact'
  return one(value, n, spec, { precision: exact ? undefined : prec(precision), exact, cents: exact ? undefined : n !== null && cents(n, spec) }, exact ? 'readout' : surface)
}
export function num(value, opts = {}) {  // D3: the only way a component prints a number.
  const face = fmt(value, opts), exact = fmt(value, { ...opts, level: 'exact' })
  return { face, exact, aria: face === exact ? null : exact, style: { fontVariantNumeric: 'tabular-nums lining-nums' } }
}
// Sets (AD-1/2/3): one tier from the largest value, shared cents, collision → widen one → exact; additivity (≥ 3 values, exactly one equals the sum of the others) → widen ≤ 2 decimals → exact.
export function fmtSet(values, ctx = {}) {
  const spec = unitSpec(ctx.format, ctx.unit), p = prec(ctx.precision), surface = ctx.surface || 'face'
  const nums = values.map(v => numOf(v, spec)), fin = nums.filter(n => n !== null), max = Math.max(0, ...fin.map(Math.abs)), tier = tierOf(max, spec.cls === 'currency' ? minorOf(spec.currency) : 0)
  const base = { precision: p, group: ctx.group, cents: fin.some(n => cents(n, spec)), tier: p === undefined && tier && tier[1] ? tier : undefined }
  const run = o => values.map((v, i) => one(v, nums[i], spec, o, surface))
  const exact = () => {
    const minor = spec.cls === 'currency' ? 10 ** minorOf(spec.currency) : 1
    return run({ exact: true, face: true, cents: fin.some(n => Math.round(Math.abs(n) * minor) % minor !== 0) })
  }
  const collide = f => f.some((s, i) => nums[i] !== null && f.some((t, j) => nums[j] !== null && t === s && nums[j] !== nums[i]))
  let faces = run(base)
  if (p !== undefined) return faces
  if (collide(faces) && collide(faces = run({ ...base, sig: SIG + 1 }))) return exact()
  const k = ctx.additive !== false && fin.length >= 3 ? additiveRow(nums) : -1
  const val = s => { // read the numeric face at its printed rung, including scientific and signed faces
    const m = /([\d,]+(?:\.\d+)?)(?:×10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+))?([kMBT])?/.exec(s)
    if (!m) return NaN
    const supers = { '⁻': '-', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }
    const exp = m[2] ? Number([...m[2]].map(c => supers[c]).join('')) : 0
    return (s.includes(MINUS) || s.startsWith('-') ? -1 : 1) * Number(m[1].replaceAll(',', '')) * 10 ** exp * (TIER_AT.find(t => t[1] === m[3])?.[0] ?? 1)
  }
  const adds = f => {
    if (f.some((s, i) => nums[i] !== null && (s.startsWith('<') || s.startsWith('>') ||
      (nums[i] !== 0 && val(s) === 0) || (spec.cls === 'percent' && nums[i] !== 100 && val(s) === 100)))) return false
    const v = f.map((s, i) => (nums[i] === null ? 0 : val(s))), rest = v.reduce((a, x, i) => (i === k ? a : a + x), 0)
    return Number.isFinite(rest) && Math.abs(rest - v[k]) <= 1e-9 * Math.max(1, Math.abs(v[k])) && !collide(f)
  }
  if (k < 0 || adds(faces)) return faces
  const d0 = Math.max(...faces.map(s => (/\.(\d+)/.exec(s || '') || ['', ''])[1].length))
  for (let d = d0; d <= d0 + 2; d++) { const f = run({ ...base, fixed: d }); if (adds(f)) return f }
  return exact()
}
function additiveRow(nums) {
  const tot = nums.reduce((s, n) => s + (n ?? 0), 0), hits = nums.map((n, i) => (n !== null && Math.abs(2 * n - tot) <= 1e-9 * Math.abs(n) ? i : -1)).filter(i => i >= 0)
  return hits.length === 1 ? hits[0] : -1
}
export const fmtColumn = (values, ctx = {}) => fmtSet(values, { ...ctx, surface: 'cell' })
export function fmtPair(a, b, ctx = {}) {  // C13: a pair shares one tier from the larger value, grouped; a word unit prints once, after the second value.
  const spec = unitSpec(ctx.format, ctx.unit), surface = ctx.surface || 'pair', [x, y] = fmtSet([a, b], { ...ctx, group: true, surface })
  return [x, y].filter(s => s !== null).join(ctx.sep ?? ' / ') + (place(spec, surface) === 'once' && y !== null ? NBSP + spec.suffix : '')
}
export function fmtTicks(ticks, ctx = {}) {  // one axis rung; widen from step until every distinct tick has a distinct nonzero/landmark-safe face.
  const spec = unitSpec(ctx.format, ctx.unit), vals = ticks.filter(Number.isFinite).map(v => clean(v * spec.scale))
  const tier = tierOf(Math.max(0, ...vals.map(Math.abs)), spec.cls === 'currency' ? minorOf(spec.currency) : 0)
  if (!tier) return fmtSet(ticks, { ...ctx, surface: 'ticks', additive: false }) // scientific beyond 999T (money stays on T)
  const [div, t] = tier
  let d = 0
  const ok = digits => vals.every(v => {
    const rounded = Number((v / div).toFixed(digits))
    return Math.abs(v / div - rounded) <= 1e-12 * Math.max(1, Math.abs(v / div)) &&
      (v === 0 || rounded !== 0) && (spec.cls !== 'percent' || v === 100 || rounded * div !== 100) &&
      !vals.some(w => w !== v && Number((w / div).toFixed(digits)) === rounded)
  })
  while (d < 20 && !ok(d)) d++
  if (!ok(d)) return fmtSet(ticks, { ...ctx, surface: 'ticks', additive: false })
  return ticks.map(v => {
    if (!Number.isFinite(v)) return ''
    const m = clean(v * spec.scale) / div, b = nf(Math.abs(m), { maximumFractionDigits: d, useGrouping: spec.cls !== 'bare' && !t })
    return finish(m < 0 && /[1-9]/.test(b), m === 0 ? '0' : b + t, spec, 'ticks')
  })
}
// D2.1 header and axis-title cells: a word/points unit prints once, beside the label or as the axis title.
export const unitLabel = (label, ctx = {}) => { const s = unitSpec(ctx.format, ctx.unit); return place(s, 'header') === 'label (unit)' ? `${label} (${s.suffix})` : label }
export const axisTitle = (ctx = {}) => { const s = unitSpec(ctx.format, ctx.unit); return place(s, 'axisTitle') === 'unit' ? s.suffix : null }
// D4: ISO-only parsing; calendar dates (and midnight UTC) never shift; floating wall clocks print as written; zoned instants print in the viewer zone (or opts.timeZone) with its abbreviation; en-US; never relative.
export const ISO_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:[T ](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?)?$/
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const daysIn = (year, month) => month === 2 ? ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31
export function fmtDate(v, { timeZone, level = 'face' } = {}) {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string' || !ISO_RE.test(v) || level === 'exact') return String(v)
  const [y, mo, d] = v.slice(0, 10).split('-').map(Number)
  if (d > daysIn(y, mo)) return v
  const cal = `${MON[mo - 1]} ${d}, ${y}`
  if (v.length === 10 || /[T ]00:00(:00(\.0+)?)?(Z|[+-]00:?00)$/.test(v)) return cal
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(v)) { const h = +v.slice(11, 13); return `${cal}, ${h % 12 || 12}:${v.slice(14, 16)} ${h < 12 ? 'AM' : 'PM'}` }
  const t = Date.parse(v.replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2')); if (!Number.isFinite(t)) return v
  const P = Object.fromEntries(new Intl.DateTimeFormat(LOCALE, { timeZone, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' })
    .formatToParts(new Date(t)).map(x => [x.type, x.value]))
  return `${P.month} ${P.day}, ${P.year}, ${P.hour}:${P.minute} ${P.dayPeriod} ${P.timeZoneName}` // ASCII spaces (spec golden; ICU may emit U+202F)
}
