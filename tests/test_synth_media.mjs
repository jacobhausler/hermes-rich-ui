// Lane L6 synth tests (expansion v0.1.1, counsel 20260928): ImageGallery (N6),
// AsOf (N5, F8-trimmed), Image (E14 sources-chip + shared tile), Badge (E10 map).
// Deterministic, no network: images never load in jsdom — the broken/unreachable
// frames are exactly what we assert. Run: node --test tests/test_synth_media.mjs
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { assert, renderComponent, registerLane, act, $ } from './helpers/render.mjs'

// Dynamic imports: the sdk-resolve hook only exists after helpers/render.mjs evaluates.
const { ImageGallery } = await import('../desktop/src/components/gallery.mjs')
const { AsOf } = await import('../desktop/src/components/asof.mjs')
const { BADGE_VARIANT, BADGE_VARIANTS_REAL, BADGE_SIZES_REAL } = await import('../desktop/src/components/_shared.mjs')

registerLane('ImageGallery', ImageGallery)
registerLane('AsOf', AsOf)

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SOURCES = [
  { id: 's1', kind: 'web', label: 'Example site', url: 'https://example.com/' },
  { id: 's2', kind: 'tool', label: 'Local computation' }
]
// registerLane adds the raw fn (no withSources wrapper), so lane props carry _sources
// exactly as desktop/src/index.mjs injects it from /meta/sources.
const dm = { data: {}, meta: { sources: SOURCES } }
const _sources = SOURCES
const fireError = async (el) => { await act(async () => { el.dispatchEvent(new window.Event('error')) }) }

// ------------------------------------------------------------- E10 Badge map
test('E10: Badge variant map pins to the real SDK list and gains error/outline', async () => {
  assert.deepEqual(BADGE_VARIANTS_REAL, ['default', 'muted', 'success', 'warn', 'destructive', 'outline', 'solid'])
  assert.deepEqual(BADGE_SIZES_REAL, ['default', 'xs', 'overlay'])
  // Same pin idiom as test_components.mjs D6: every emitted value must be real.
  for (const [tone, v] of Object.entries(BADGE_VARIANT)) {
    assert.ok(BADGE_VARIANTS_REAL.includes(v), `tone ${tone} → unknown Badge variant ${v}`)
  }
  // The four public tones are unchanged; error/outline are the additive E10 rows.
  assert.deepEqual(
    { neutral: BADGE_VARIANT.neutral, info: BADGE_VARIANT.info, success: BADGE_VARIANT.success, caution: BADGE_VARIANT.caution },
    { neutral: 'muted', info: 'default', success: 'success', caution: 'warn' }
  )
  assert.equal(BADGE_VARIANT.error, 'destructive')
  assert.equal(BADGE_VARIANT.outline, 'outline')
})

test('E10: Badge tone=error renders the destructive variant; outline renders outline; unknown tone falls back muted', async () => {
  await renderComponent({ id: 'b1', component: 'Badge', props: { label: 'failed', tone: 'error' } }, dm)
  assert.equal($('[data-ru="Badge"] [data-slot="badge"]').getAttribute('data-variant'), 'destructive')
  assert.equal($('[data-ru="Badge"] [data-slot="badge"]').getAttribute('data-ru-tone'), 'error')
  await renderComponent({ id: 'b2', component: 'Badge', props: { label: 'plain', tone: 'outline' } }, dm)
  assert.equal($('[data-ru="Badge"] [data-slot="badge"]').getAttribute('data-variant'), 'outline')
  await renderComponent({ id: 'b3', component: 'Badge', props: { label: 'weird', tone: 'nonsense' } }, dm)
  assert.equal($('[data-ru="Badge"] [data-slot="badge"]').getAttribute('data-variant'), 'muted')
})

// ------------------------------------------------------------------ E14 Image
test('E14: Image renders schema-legal sourceIds as attribution (dead prop closed)', async () => {
  await renderComponent({ id: 'i1', component: 'Image', props: { src: 'https://example.com/ok.png', alt: 'chart of sales', caption: 'figure one', sourceIds: ['s1'] } }, dm)
  const fig = $('[data-ru="Image"]')
  assert.ok(fig, 'Image root marker missing')
  const img = fig.querySelector('img')
  assert.equal(img.getAttribute('src'), 'https://example.com/ok.png')
  assert.equal(img.getAttribute('alt'), 'chart of sales')
  const sup = fig.querySelector('figcaption [data-ru-sources]')
  assert.equal(sup.textContent, 'ⓘ 1')
  assert.equal(sup.getAttribute('aria-label'), 'sources: Example site')
})

test('E14: onError swaps in the dashed unavailable frame — alt text AND attribution stay visible (S)', async () => {
  await renderComponent({ id: 'i2', component: 'Image', props: { src: 'https://example.com/404.png', alt: 'gone', sourceIds: ['s1', 's2'] } }, dm)
  const fig = $('[data-ru="Image"]')
  const img = fig.querySelector('img')
  assert.ok(img, 'img should render before the error fires')
  await fireError(img)
  assert.equal(fig.querySelector('img'), null, 'no broken-image glyph: the <img> must be gone')
  const box = fig.querySelector('[data-ru-image-blocked]')
  assert.equal(box.getAttribute('data-ru-image-blocked'), 'unreachable')
  assert.match(box.textContent, /gone/)
  assert.match(box.textContent, /image unavailable/)
  assert.match(box.style.border, /dashed/, 'unavailable frame is dashed')
  const sup = fig.querySelector('[data-ru-sources]')
  assert.ok(sup, 'attribution stays visible when the image fails')
  assert.equal(sup.textContent, 'ⓘ 2')
})

test('E14: non-https degrades to the blocked alt box; default render stays additive (no attribution, no figcaption without caption)', async () => {
  await renderComponent({ id: 'i3', component: 'Image', props: { src: 'http://example.com/x.png', alt: 'nope' } }, dm)
  assert.equal($('[data-ru="Image"] img'), null, 'non-https must never reach the network')
  const box = $('[data-ru-image-blocked]')
  assert.equal(box.getAttribute('data-ru-image-blocked'), 'scheme')
  assert.equal(box.textContent, 'nope — image blocked (https only)')
  assert.ok(box.style.border.includes('dashed'))
  // No caption, no sourceIds → no figcaption at all (byte-additive vs the pre-E14 render).
  assert.equal($('[data-ru="Image"] figcaption'), null)
  assert.equal($('[data-ru="Image"] [data-ru-sources]'), null)
})

// ----------------------------------------------------------- N6 ImageGallery
const galleryItems = [
  { src: 'https://example.com/a.png', alt: 'first evidence', caption: 'panel A', sourceIds: ['s1'] },
  { src: 'https://example.com/b.png', alt: 'second evidence' },
  { src: 'https://example.com/c.png', alt: 'third evidence', caption: 'panel C', sourceIds: ['s2'] }
]

test('N6: ImageGallery renders one tile per item with alt, caption, columns, count', async () => {
  await renderComponent({ id: 'g1', component: 'ImageGallery', props: { title: 'Evidence strip', items: galleryItems, columns: 3, sourceIds: ['s1'], _sources } }, dm)
  const root = $('[data-ru="ImageGallery"]')
  assert.ok(root, 'ImageGallery root marker missing')
  assert.equal(root.getAttribute('data-ru-count'), '3')
  const grid = root.querySelector('[data-ru-columns]')
  assert.equal(grid.getAttribute('data-ru-columns'), '3')
  const tiles = root.querySelectorAll('[data-ru-tile]')
  assert.equal(tiles.length, 3)
  assert.equal(tiles[0].getAttribute('data-ru-tile'), '0')
  assert.equal(tiles[0].querySelector('img').getAttribute('alt'), 'first evidence')
  assert.equal(tiles[1].querySelector('figcaption'), null, 'item without caption gets no figcaption (L1: nothing invented)')
  assert.equal(tiles[0].querySelector('figcaption').textContent.includes('panel A'), true)
  assert.equal(tiles[0].querySelector('figcaption [data-ru-sources]').getAttribute('aria-label'), 'sources: Example site')
  assert.equal(tiles[2].querySelector('figcaption [data-ru-sources]').getAttribute('aria-label'), 'sources: Local computation')
  assert.equal(root.querySelector('div [data-ru-sources]') !== null, true, 'gallery-level sourceIds render by the title')
})

test('N6: per-tile error handler → dashed frame with visible alt + attribution, other tiles untouched', async () => {
  await renderComponent({ id: 'g2', component: 'ImageGallery', props: { items: [galleryItems[0], galleryItems[1]], _sources } }, dm)
  const tiles = $('[data-ru="ImageGallery"]').querySelectorAll('[data-ru-tile]')
  await fireError(tiles[0].querySelector('img'))
  const box = tiles[0].querySelector('[data-ru-image-blocked]')
  assert.equal(box.getAttribute('data-ru-image-blocked'), 'unreachable')
  assert.match(box.textContent, /first evidence/, 'alt text stays visible in the broken frame')
  assert.match(box.style.border, /dashed/)
  assert.equal(tiles[0].querySelector('img'), null)
  const sup = tiles[0].querySelector('[data-ru-sources]')
  assert.ok(sup, 'attribution survives the failed image (S)')
  assert.equal(sup.textContent, 'ⓘ 1')
  // The healthy tile is untouched.
  assert.equal(tiles[1].querySelector('[data-ru-image-blocked]'), null)
  assert.ok(tiles[1].querySelector('img'), 'second tile still renders its <img>')
})

test('N6: non-https tile degrades like Image (scheme posture shared via ImageTile); renderer clamps columns 1..4; empty items honest state', async () => {
  await renderComponent({ id: 'g3', component: 'ImageGallery', props: { items: [{ src: 'http://example.com/x.png', alt: 'insecure' }], _sources } }, dm)
  const box = $('[data-ru="ImageGallery"] [data-ru-image-blocked]')
  assert.equal(box.getAttribute('data-ru-image-blocked'), 'scheme')
  assert.equal(box.textContent, 'insecure — image blocked (https only)')
  await renderComponent({ id: 'g4', component: 'ImageGallery', props: { items: [{ src: 'https://example.com/a.png', alt: 'a' }], columns: 9, _sources } }, dm)
  assert.equal($('[data-ru="ImageGallery"] [data-ru-columns]').getAttribute('data-ru-columns'), '4', 'columns clamp ≤4')
  await renderComponent({ id: 'g5', component: 'ImageGallery', props: { items: [], _sources } }, dm)
  const empty = $('[data-ru="ImageGallery"] [data-ru-empty]')
  assert.ok(empty, 'empty gallery shows an honest empty state')
  assert.equal(empty.textContent, 'no images')
})

// -------------------------------------------------------------------- N5 AsOf
test('N5: AsOf renders the caption line and omits absent/null segments (accessedAt trimmed, F8)', async () => {
  await renderComponent({ id: 'a1', component: 'AsOf', props: { observedAt: '2026-09-26T10:00:00Z', publishedAt: '2026-09-01T08:00:00Z' } }, dm)
  const root = $('[data-ru="AsOf"]')
  assert.ok(root, 'AsOf root marker missing')
  assert.equal(root.textContent, 'Observed 2026-09-26T10:00:00Z · Published 2026-09-01T08:00:00Z')
  assert.equal(root.getAttribute('data-ru-fields'), '2')
  assert.equal('accessedAt' in root.dataset, false)

  await renderComponent({ id: 'a2', component: 'AsOf', props: { observedAt: '2026-09-26T10:00:00Z', publishedAt: null } }, dm)
  const r2 = $('[data-ru="AsOf"]')
  assert.equal(r2.textContent, 'Observed 2026-09-26T10:00:00Z')
  assert.equal(r2.getAttribute('data-ru-fields'), '1', 'null field OMITS its segment (L1)')
  assert.ok(!r2.textContent.includes('Published'))

  await renderComponent({ id: 'a3', component: 'AsOf', props: { observedAt: '2026-09-26', note: 'audited by hand', sourceIds: ['s2'], _sources } }, dm)
  const r3 = $('[data-ru="AsOf"]')
  assert.equal(r3.textContent.startsWith('Observed 2026-09-26 · audited by hand'), true)
  assert.ok(r3.querySelector('[data-ru-sources]'), 'AsOf-level sourceIds resolve')
})

test('N5: AsOf with no timestamps publishes nothing — honest empty caption, never a clock', async () => {
  await renderComponent({ id: 'a4', component: 'AsOf', props: {} }, dm)
  const root = $('[data-ru="AsOf"]')
  assert.equal(root.getAttribute('data-ru-fields'), '0')
  assert.equal(root.textContent, 'no timestamps published')
})

test('N5 grep-pin: asof.mjs (and the media files) contain no clock calls — the card stays a static artifact', () => {
  const files = ['asof.mjs', 'gallery.mjs', 'image.mjs', '_shared.mjs']
  for (const f of files) {
    const src = readFileSync(path.join(HERE, '..', 'desktop', 'src', 'components', f), 'utf8')
      .split('\n').map(l => l.replace(/\/\/[^\n]*/, '')).join('\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    for (const re of [/Date\.now\s*\(/, /new\s+Date\b/, /performance\.now\s*\(/]) {
      assert.ok(!re.test(src), `${f} must never call ${re} — renderers are clock-free (Q)`)
    }
  }
})
