// Lane L5 (mono) ACCEPT: CodeBlock render asserts through the real Renderer
// (jsdom harness in tests/helpers/render.mjs; lane-local registration only).
// Pins (N1 ratified): ui-monospace font-family; literal content char-for-char
// (hostile strings render as TEXT, never elements — no dangerouslySetInnerHTML);
// caption + language LABEL render; showLines renders renderer-side line numbers;
// pre-wrap + break-all + bg3/stroke3 tokens; null stays "unavailable" (L1).
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { assert, renderComponent, registerLane, $, $$, mount } from './helpers/render.mjs'

// Dynamic import: the harness registers the '@hermes/plugin-sdk' resolve hook
// in its module body, so component imports must happen AFTER it has loaded.
const { CodeBlock } = await import('../desktop/src/components/codeblock.mjs')

registerLane('CodeBlock', CodeBlock)

const txt = () => mount.textContent || ''

test('CodeBlock: marker, mono font, literal content char-for-char', async () => {
  const code = "const x = '<img src=x onerror=1>';\nif (x && y) { emit(a>b); }"
  await renderComponent({ id: 'root', component: 'CodeBlock', props: { code } })
  const rootEl = $('[data-ru="CodeBlock"]')
  assert.ok(rootEl, 'data-ru="CodeBlock" marker missing')
  const pre = $('pre')
  assert.ok(pre, 'pre element missing')
  assert.match(pre.getAttribute('style') || '', /ui-monospace/, 'ui-monospace font-family present')
  assert.equal(pre.textContent, code, 'literal content must survive char-for-char')
})

test('CodeBlock: hostile string is TEXT, never an element (no HTML injection)', async () => {
  await renderComponent({ id: 'root', component: 'CodeBlock', props: { code: '<img src=x onerror=1><script>alert(1)</script>' } })
  assert.equal($$('img').length, 0, 'hostile img must not become an element')
  assert.equal($$('script').length, 0, 'hostile script must not become an element')
  const pre = $('pre')
  assert.ok(pre.textContent.includes('<img src=x onerror=1>'), 'hostile string must appear as text')
  const src = readFileSync(new URL('../desktop/src/components/codeblock.mjs', import.meta.url), 'utf8')
  assert.ok(!/dangerouslySetInnerHTML\s*[=:]/.test(src), 'component must never use dangerouslySetInnerHTML')
})

test('CodeBlock: caption and language label render (language is a label, never parsed)', async () => {
  await renderComponent({ id: 'root', component: 'CodeBlock', props: { code: 'echo hi', caption: 'deploy snippet', language: 'bash' } })
  assert.match(txt(), /deploy snippet/, 'caption renders')
  const lang = $('[data-ru-lang]')
  assert.ok(lang, 'language pill missing')
  assert.equal(lang.textContent, 'bash', 'language label renders verbatim')
  assert.match(lang.getAttribute('style') || '', /ui-monospace/, 'language pill is mono')
})

test('CodeBlock: showLines adds renderer-side per-line number markers', async () => {
  const code = 'alpha\nbravo\ncharlie\ndelta'
  await renderComponent({ id: 'root', component: 'CodeBlock', props: { code, showLines: true } })
  const pre = $('pre')
  assert.equal(pre.getAttribute('data-ru-lines'), '4', 'data-ru-lines counts lines')
  const nums = $$('[data-ru-line-no]').map(n => n.textContent)
  assert.deepEqual(nums, ['1', '2', '3', '4'], 'per-line numbers rendered by the renderer, not the agent')
  const expected = code.split('\n').map((ln, i, all) => (i === all.length - 1 ? ln : ln + '\n'))
  const lines = $$('[data-ru-line]').map(s => s.textContent.slice(s.firstElementChild.textContent.length))
  assert.deepEqual(lines, expected, 'numbered render stays char-for-char faithful')
  const gutters = $$('[data-ru-line]').map(s => s.firstElementChild.textContent)
  assert.deepEqual(gutters, ['1', '2', '3', '4'], 'gutter holds the number, nothing else')
})

test('CodeBlock: pre-wrap, break-all, and bg3/stroke3 theme tokens', async () => {
  await renderComponent({ id: 'root', component: 'CodeBlock', props: { code: 'x' } })
  const st = $('pre').getAttribute('style') || ''
  assert.match(st, /white-space:\s*pre-wrap/, 'pre-wrap')
  assert.match(st, /word-break:\s*break-all/, 'break-all for long tokens')
  assert.match(st, /var\(--ui-bg-tertiary\)/, 'bg3 token')
  assert.match(st, /var\(--ui-stroke-tertiary\)/, 'stroke3 token')
})

test('CodeBlock: null code renders "unavailable", never empty and never 0 (L1)', async () => {
  await renderComponent({ id: 'root', component: 'CodeBlock', props: { code: null } })
  assert.match(txt(), /unavailable/, 'null must surface as unavailable')
  assert.ok(!$('pre'), 'null code must not render a pre body')
})

test('CodeBlock: bound code resolves from the data model', async () => {
  await renderComponent(
    { id: 'root', component: 'CodeBlock', props: { code: { $state: '/data/snippet' }, language: 'toml' } },
    { data: { snippet: 'key = "value"' } }
  )
  assert.equal($('pre').textContent, 'key = "value"', 'binding must resolve through the provider')
})

test('CodeBlock: sourceIds superscript renders (shared sources idiom)', async () => {
  await renderComponent({ id: 'root', component: 'CodeBlock', props: { code: 'ls', sourceIds: ['s1'], _sources: [{ id: 's1', label: 'runbook' }] } })
  const sup = $('[data-ru-sources]')
  assert.ok(sup, 'sources superscript missing')
  assert.equal(sup.getAttribute('aria-label'), 'sources: runbook', 'resolved source label appears')
})

test('CodeBlock: renderer never truncates long code (admission owns the cap)', async () => {
  const code = 'a'.repeat(5000)
  await renderComponent({ id: 'root', component: 'CodeBlock', props: { code } })
  assert.equal($('pre').textContent.length, 5000, 'renderer must not truncate — admission rejects over-cap, loudly')
})
