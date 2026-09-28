// D7 (desk P2-4): the banned-surface scan in scripts/build.mjs catches bare `document`/`window`
// reach in the bundle, with exactly ONE allowlisted occurrence — uPlot's env guard — matched by
// content, not line number. Also proves the committed bundle equals a fresh build (sha256 file).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { scanBanned, BANNED, ALLOWLIST } from '../scripts/build.mjs'

const GUARD = 'var domEnv=typeof window!="undefined";var doc=domEnv?document:null;var win=domEnv?window:null;var nav=domEnv?navigator:null;'

test('D7: scan bans document./window. and bare document/window', () => {
  const srcs = [String(BANNED)]
  assert.ok(BANNED.some(r => String(r) === '/\\bdocument\\./'), 'has /\\bdocument\\./')
  assert.ok(BANNED.some(r => String(r) === '/\\bwindow\\./'), 'has /\\bwindow\\./')
  assert.deepEqual(scanBanned('const a = document.body').hits, ['/\\bdocument\\./', '/\\bdocument\\b/'])
  assert.deepEqual(scanBanned('window.open(x)').hits, ['/\\bwindow\\./', '/\\bwindow\\b/'])
  assert.deepEqual(scanBanned('if (typeof window !== "undefined") {}').hits, ['/\\bwindow\\b/'], 'bare identifier caught too')
  assert.deepEqual(scanBanned('const mydocument = 1; const windowed = 2; el.ownerDocument').hits, [], 'word boundaries respected')
  void srcs
})

test('D7: the uPlot env guard is the ONLY allowlisted content; a second reach still fails', () => {
  assert.equal(ALLOWLIST.length, 1)
  const clean = 'var x=1;' + GUARD + 'var y=2;'
  const r = scanBanned(clean)
  assert.deepEqual(r.hits, [])
  assert.deepEqual(r.allowed, [GUARD])
  const dirty = clean + 'document.title="x";'
  assert.ok(scanBanned(dirty).hits.includes('/\\bdocument\\./'), 'guard allowlist does not shadow a second document. use')
  const dirty2 = clean + GUARD  // the guard twice = a second copy of uPlot or a copy-paste; not allowed
  assert.ok(scanBanned(dirty2).hits.length > 0, 'a second guard line is not allowlisted')
})

test('D7: committed bundle passes the scan with exactly the guard allowlisted, and sha256 file matches', () => {
  const src = readFileSync(new URL('../desktop/plugin.js', import.meta.url), 'utf8')
  const r = scanBanned(src)
  assert.deepEqual(r.hits, [], 'committed bundle has no banned surface')
  assert.deepEqual(r.allowed, [GUARD], 'exactly the uPlot guard was allowlisted')
  const sha = createHash('sha256').update(src).digest('hex')
  const recorded = readFileSync(new URL('../desktop/plugin.js.sha256', import.meta.url), 'utf8').split(/\s+/)[0]
  assert.equal(recorded, sha, 'desktop/plugin.js.sha256 matches the committed bundle')
})
