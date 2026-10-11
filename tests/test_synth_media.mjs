// Lane L6 synth tests (expansion v0.1.1, counsel 20260928): ImageGallery (N6),
// AsOf (N5, F8-trimmed), Image (E14 sources-chip + shared tile), Badge (E10 map).
// Deterministic, no network: images never load in jsdom — the broken/unreachable
// frames are exactly what we assert. Run: node --test tests/test_synth_media.mjs
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { assert, renderComponent, renderSpec, fixtureJson, lower, registerLane, act, $ } from './helpers/render.mjs'
import { B, R, HOUSE } from '../desktop/src/components/_house.mjs'

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
  const sup = fig.querySelector('figcaption [data-ru-citation]')
  assert.equal(sup.textContent, '1')
  assert.equal(sup.getAttribute('aria-label'), 'sources 1')
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
  const sup = fig.querySelector('[data-ru-citation]')
  assert.ok(sup, 'attribution stays visible when the image fails')
  assert.equal(sup.textContent, '1,2')
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
  assert.equal($('[data-ru="Image"] [data-ru-citation]'), null)
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
  assert.equal(tiles[0].querySelector('figcaption [data-ru-citation]').getAttribute('aria-label'), 'sources 1')
  assert.equal(tiles[2].querySelector('figcaption [data-ru-citation]').getAttribute('aria-label'), 'sources 2')
  assert.equal(root.querySelector('div [data-ru-citation]') !== null, true, 'gallery-level sourceIds render by the title')
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
  const sup = tiles[0].querySelector('[data-ru-citation]')
  assert.ok(sup, 'attribution survives the failed image (S)')
  assert.equal(sup.textContent, '1')
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

// ---------------------------------------------------------- #37 media defaults
const click = async el => { await act(async () => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))) }
const fireLoad = async el => { await act(async () => el.dispatchEvent(new window.Event('load'))) }
// The shared harness reuses its React root, so unmount the previous leaf's state.
const renderFresh = async component => {
  await renderComponent({ id: 'reset-media', component: 'Text', props: { text: '' } }, dm)
  await renderComponent(component, dm)
}

test('#37 Image: empty-alt failed image is a full-width absent frame naming the host, without fill', async () => {
  await renderFresh({ id: 'defaults-image-host', component: 'Image', props: { src: 'https://cdn.example.org/x.png', alt: '' } }, dm)
  await fireError($('[data-ru="Image"] img'))
  const frame = $('[data-ru-image-blocked]')
  assert.match(frame.textContent, /cdn\.example\.org/)
  assert.equal(frame.style.width, '100%')
  assert.equal(frame.style.boxSizing, 'border-box', 'padding and border must stay within the figure width')
  const expected = document.createElement('div')
  expected.style.border = B.absent
  assert.equal(frame.style.border, expected.style.border)
  assert.equal(frame.style.borderRadius, `${R.box}px`)
  assert.ok(['', 'none', 'transparent'].includes(frame.style.background))
  assert.notEqual(frame.style.display, 'inline-block', 'never an inline alt-text pill')
})

test('#37 Image: failed label precedence is alt, caption, host; scheme-blocked images follow it too', async () => {
  const cases = [
    { src: 'https://cdn.example.org/a.png', alt: 'authored alt', caption: 'authored caption', label: 'authored alt' },
    { src: 'https://cdn.example.org/b.png', alt: '', caption: 'authored caption', label: 'authored caption' },
    { src: 'https://cdn.example.org/c.png', alt: '', label: 'cdn.example.org' },
    { src: 'http://cdn.example.org/d.png', alt: '', label: 'cdn.example.org' }
  ]
  for (const [i, { label, ...props }] of cases.entries()) {
    await renderFresh({ id: `defaults-label-${i}`, component: 'Image', props }, dm)
    const img = $('[data-ru="Image"] img')
    if (img) await fireError(img)
    assert.equal($('[data-ru-image-blocked]').textContent,
      label + (img ? ' — image unavailable' : ' — image blocked (https only)'))
  }
})

test('#37 Image: loaded image opens and closes the SDK lightbox with the same src; failed images have no trigger', async () => {
  const src = 'https://example.com/lightbox.png'
  await renderFresh({ id: 'defaults-lightbox', component: 'Image', props: { src, alt: 'detail' } }, dm)
  const img = $('[data-ru="Image"] img')
  assert.equal(img.style.borderRadius, `${R.box}px`)
  assert.equal(img.style.maxHeight, `${HOUSE.IMAGE_MAX_H}px`)
  await fireLoad(img)
  const trigger = img.closest('button')
  assert.ok(trigger, 'keyboard-accessible image trigger')
  assert.equal(trigger.getAttribute('type'), 'button')
  assert.match(trigger.getAttribute('aria-label'), /detail/)
  await click(trigger)
  const dialog = document.querySelector('[role="dialog"]')
  assert.ok(dialog, 'SDK Dialog content opens')
  assert.equal(dialog.querySelector('img').getAttribute('src'), src)
  assert.equal(dialog.querySelector('img').getAttribute('alt'), 'detail')
  await click(dialog.querySelector('button[aria-label="Close"]'))
  assert.equal(document.querySelector('[role="dialog"]'), null)
  await fireError(img)
  assert.equal($('[data-ru="Image"] button'), null, 'no lightbox for failed/blocked media')
})

test('#37 Gallery: count defaults 1/2/3/5/8 map to 1/2/3/3/4; uniform contain boxes align captions', async () => {
  for (const [n, columns] of [[1, 1], [2, 2], [3, 3], [5, 3], [8, 4]]) {
    const items = Array.from({ length: n }, (_, i) => ({ src: `https://example.com/${i}.png`, alt: `tile ${i}`, caption: i % 2 ? 'two\nlines' : 'one' }))
    await renderFresh({ id: `defaults-gallery-${n}`, component: 'ImageGallery', props: { items } }, dm)
    const grid = $('[data-ru="ImageGallery"] [data-ru-columns]')
    assert.equal(grid.getAttribute('data-ru-columns'), String(columns))
    assert.equal(grid.style.gridTemplateColumns, `repeat(${columns}, minmax(0, 1fr))`)
    for (const tile of grid.querySelectorAll('[data-ru-tile]')) {
      const img = tile.querySelector('img')
      assert.equal(img.style.objectFit, 'contain')
      assert.equal(img.closest('button').style.aspectRatio, '3 / 2')
      assert.equal(img.style.width, '100%')
      assert.equal(img.style.height, '100%')
      assert.ok(tile.querySelector('figcaption'))
    }
    await fireError(grid.querySelector('img'))
    assert.equal(grid.querySelector('[data-ru-image-blocked]').style.aspectRatio, '3 / 2', 'failed tile keeps the caption baseline')
  }
})

test('#37 Gallery: original saved fixture columns:2 remains 2 through lower + render', async () => {
  const saved = fixtureJson('expansion-gallery.json')
  const original = JSON.stringify(saved)
  const { spec, initialState } = lower(saved)
  await renderSpec(spec, initialState)
  assert.equal($('[data-ru="ImageGallery"] [data-ru-columns]').getAttribute('data-ru-columns'), '2')
  assert.equal(JSON.stringify(saved), original, 'renderer never rewrites the saved record')
})

test('#37 Tabs: eight long labels stay small/one-line/capped with full titles in a scrolling strip', async () => {
  const titles = Array.from({ length: 8 }, (_, i) => `${i} ${'long title '.repeat(4)}`)
  await renderFresh({ id: 'defaults-tabs', component: 'Tabs', props: { tabs: titles.map(title => ({ title })) } }, dm)
  const strip = $('[data-ru="Tabs"] [role="tablist"]')
  assert.equal(strip.style.overflowX, 'auto')
  assert.equal(strip.style.flexWrap, 'nowrap')
  assert.equal(strip.style.minWidth, '0')
  for (const [i, tab] of [...strip.querySelectorAll('[role="tab"]')].entries()) {
    assert.equal(tab.style.fontSize, '12px')
    assert.equal(tab.style.whiteSpace, 'nowrap')
    assert.equal(tab.style.textOverflow, 'ellipsis')
    assert.equal(tab.style.overflow, 'hidden')
    assert.equal(tab.style.maxWidth, '24ch')
    assert.equal(tab.style.flexShrink, '0', 'overflow scrolls rather than shrinking all labels')
    assert.equal(tab.getAttribute('title'), titles[i])
  }
})

test('#37 Accordion: absent open seeds first only; explicit false/true wins; SVG chevron toggles', async () => {
  await renderFresh({ id: 'defaults-accordion', component: 'Accordion', props: { items: [{ title: 'one' }, { title: 'two' }, { title: 'three' }] } }, dm)
  const buttons = [...$('[data-ru="Accordion"]').querySelectorAll('button')]
  assert.deepEqual(buttons.map(b => b.getAttribute('aria-expanded')), ['true', 'false', 'false'])
  assert.ok(buttons.every(b => b.querySelector('svg[aria-hidden="true"]')), 'SVG chevrons, not glyphs')
  const before = buttons[0].querySelector('svg').style.transform
  await click(buttons[0])
  assert.equal(buttons[0].getAttribute('aria-expanded'), 'false')
  assert.notEqual(buttons[0].querySelector('svg').style.transform, before)
  await renderFresh({ id: 'explicit-accordion', component: 'Accordion', props: { items: [{ title: 'one', open: false }, { title: 'two', open: true }] } }, dm)
  assert.deepEqual([...$('[data-ru="Accordion"]').querySelectorAll('button')].map(b => b.getAttribute('aria-expanded')), ['false', 'true'])
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
  assert.ok(r3.querySelector('[data-ru-citation]'), 'AsOf-level sourceIds resolve')
})

test('N5: AsOf with no timestamps publishes nothing — honest empty caption, never a clock', async () => {
  await renderComponent({ id: 'a4', component: 'AsOf', props: {} }, dm)
  const root = $('[data-ru="AsOf"]')
  assert.equal(root.getAttribute('data-ru-fields'), '0')
  assert.equal(root.textContent, 'No timestamps published')
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
