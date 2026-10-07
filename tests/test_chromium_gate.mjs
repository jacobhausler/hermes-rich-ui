// Tests for the chromium gate (tests/helpers/chromium.mjs): env precedence,
// playwright-cache discovery, and the honest skip/fail decision. The #47
// host-border control is only as honest as this gate — a precedence bug here
// silently swaps the binary the control runs against, or turns a hard FAIL
// into a skip. Mutant-proven per the test-teeth law (#45 round-2): flipping
// env order or the skip branch must RED.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { locateChrome, chromiumGate } from './helpers/chromium.mjs'

function withEnv(vars, fn) {
  const keys = Object.keys(vars)
  const saved = {}
  for (const k of keys) { saved[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k] }
  try { return fn() } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] }
  }
}

function fakeBin(dir, name = 'chrome') {
  mkdirSync(dir, { recursive: true })
  const p = join(dir, name)
  writeFileSync(p, '#!/bin/sh\nexit 0\n')
  chmodSync(p, 0o755)
  return p
}

const root = mkdtempSync(join(tmpdir(), 'rui-gate-'))
after(() => rmSync(root, { recursive: true, force: true }))
const binA = fakeBin(root, 'chrome-a')
const binB = fakeBin(root, 'chrome-b')

// Hosts bake PLAYWRIGHT_BROWSERS_PATH into the runner env; these tests own the
// whole discovery surface, so they pin it out unless the case sets it.
// GITHUB_ACTIONS is pinned out too: the CI-lane contract (below) changes the
// absent-binary decision, and the non-CI teeth cases must not inherit it.
const CLEAN = { RUI_CHROME_BIN: undefined, CHROME_BIN: undefined, PLAYWRIGHT_BROWSERS_PATH: undefined, GITHUB_ACTIONS: undefined }

test('RUI_CHROME_BIN wins over CHROME_BIN (precedence)', () => {
  withEnv({ ...CLEAN, RUI_CHROME_BIN: binA, CHROME_BIN: binB }, () => {
    assert.equal(locateChrome(), binA)
    assert.deepEqual(chromiumGate(), { run: true, bin: binA })
  })
})

test('CHROME_BIN is the fallback when RUI_CHROME_BIN is unset', () => {
  withEnv({ ...CLEAN, CHROME_BIN: binB }, () => {
    assert.equal(locateChrome(), binB)
    assert.deepEqual(chromiumGate(), { run: true, bin: binB })
  })
})

test('an env var pointing at a missing file is ignored, not trusted', () => {
  withEnv({ ...CLEAN, RUI_CHROME_BIN: join(root, 'nope'), CHROME_BIN: binB }, () => {
    assert.equal(locateChrome(), binB)
  })
})

test('playwright caches are searched newest-build-first, env beats cache', () => {
  const home = mkdtempSync(join(root, 'fake-home-'))
  const pw = mkdtempSync(join(root, 'fake-pw-'))
  for (const [dir, base] of [
    ['.cache/ms-playwright/chromium-1200/chrome-linux64', home],
    ['.cache/ms-playwright/chromium-1243/chrome-linux64', home],
  ]) fakeBin(join(base, dir))
  fakeBin(join(pw, 'chromium-1300/chrome-linux64'))
  // $HOME caches found, highest build wins
  withEnv({ ...CLEAN, HOME: home }, () => {
    assert.equal(locateChrome(), join(home, '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'))
    assert.deepEqual(chromiumGate(), { run: true, bin: join(home, '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome') })
  })
  // PLAYWRIGHT_BROWSERS_PATH takes precedence over the HOME caches
  withEnv({ ...CLEAN, HOME: home, PLAYWRIGHT_BROWSERS_PATH: pw }, () => {
    assert.equal(locateChrome(), join(pw, 'chromium-1300/chrome-linux64/chrome'))
  })
  // env binary still beats every cache
  withEnv({ ...CLEAN, HOME: home, PLAYWRIGHT_BROWSERS_PATH: pw, RUI_CHROME_BIN: binA }, () => {
    assert.equal(locateChrome(), binA)
  })
})

test('no binary anywhere: RUI_SKIP_CHROMIUM=1 records a skip, otherwise hard FAIL', () => {
  const emptyHome = mkdtempSync(join(root, 'empty-home-'))
  // standardPaths:[] keeps this hermetic: CI runners (ubuntu-latest) ship a
  // system chrome at a STANDARD_PATHS entry — the absent case must pin it out.
  withEnv({ ...CLEAN, HOME: emptyHome, RUI_SKIP_CHROMIUM: '1' }, () => {
    const g = chromiumGate({ standardPaths: [] })
    assert.equal(g.run, false); assert.equal(g.skip, true); assert.match(g.reason, /CHROMIUM SKIPPED/)
  })
  withEnv({ ...CLEAN, HOME: emptyHome, RUI_SKIP_CHROMIUM: undefined }, () => {
    const g = chromiumGate({ standardPaths: [] })
    assert.equal(g.run, false); assert.equal(g.fail, true); assert.match(g.reason, /CHROME MISSING/)
  })
})

test('RUI_SKIP_CHROMIUM=0 does NOT unlock the skip path (only literal 1)', () => {
  const emptyHome = mkdtempSync(join(root, 'empty-home-2-'))
  withEnv({ ...CLEAN, HOME: emptyHome, RUI_SKIP_CHROMIUM: '0' }, () => {
    assert.equal(chromiumGate({ standardPaths: [] }).fail, true)
  })
})

test('a found binary is executable-shaped (gate run:true carries the bin path)', () => {
  withEnv({ ...CLEAN, RUI_CHROME_BIN: binA }, () => {
    const g = chromiumGate()
    assert.equal(g.run, true); assert.ok(g.bin.endsWith('chrome-a'))
  })
})

// ---- est-nm1g residual (main gate run 37475567818): the GitHub Actions lane
// is a sanctioned option-B lane. The runner image preinstalls a desktop
// google-chrome-stable at a STANDARD_PATHS entry; launching it live from the
// CI lane is environment-dependent — run 37475567818 hung it for the full 90 s
// suite budget (rc=124, orphan chrome at teardown) while the IDENTICAL tree
// (e13ea142, only graphify-out/ differing) was rc=0 on two other runs minutes
// apart. The CI lane's contract is the recorded-skip fallback, never a live
// run of an ambient system chrome.

test('GitHub Actions lane: default discovery never live-runs an ambient system chrome', () => {
  // The CI-lane bug: an ambient chrome at a standard system path was auto-
  // discovered and launched live (rc=124 hang, run 37475567818). Off the CI
  // lane the same ambient chrome IS discovered (opt-in below proves the scan
  // exists); on the CI lane discovery must stop at env + playwright caches,
  // so the gate records the skip instead of claiming a live run.
  const sysLike = fakeBin(mkdtempSync(join(root, 'ci-sys-default-')), 'chrome')
  const emptyHome = mkdtempSync(join(root, 'ci-home-'))
  withEnv({ ...CLEAN, HOME: emptyHome, RUI_SKIP_CHROMIUM: undefined, GITHUB_ACTIONS: 'true' }, () => {
    // Default call: standard paths must NOT be scanned on CI — pass nothing
    // and the ambient file (reachable only via an explicit standardPaths
    // entry, simulated by its existence) must not turn the gate to run:true.
    const g = chromiumGate()
    assert.equal(g.run, false, 'CI default must not resolve standard system paths')
  })
  withEnv({ ...CLEAN, HOME: emptyHome, GITHUB_ACTIONS: 'true' }, () => {
    const g = chromiumGate({ standardPaths: [sysLike] })
    assert.equal(g.run, true, 'explicit opt-in proves the scan itself still works')
  })
})

test('GitHub Actions lane: absent binary records the sanctioned skip, never a live run or hard FAIL', () => {
  const emptyHome = mkdtempSync(join(root, 'ci-home-'))
  withEnv({ ...CLEAN, HOME: emptyHome, RUI_SKIP_CHROMIUM: undefined, GITHUB_ACTIONS: 'true' }, () => {
    const g = chromiumGate()
    assert.equal(g.run, false, 'CI lane must not launch an ambient system chrome live')
    assert.equal(g.skip, true, 'CI lane absent-binary decision is the sanctioned option-B skip')
    assert.equal(g.fail, undefined)
    assert.match(g.reason, /SKIPPED/)
  })
})

test('GitHub Actions lane: an explicit RUI_CHROME_BIN still earns the live run', () => {
  withEnv({ ...CLEAN, HOME: mkdtempSync(join(root, 'ci-home-2-')), GITHUB_ACTIONS: 'true', RUI_CHROME_BIN: binA }, () => {
    const g = chromiumGate()
    assert.equal(g.run, true); assert.equal(g.bin, binA)
  })
})

test('GitHub Actions lane: an explicit standardPaths opt-in is honored (only the DEFAULT is disabled)', () => {
  const sysLike = fakeBin(mkdtempSync(join(root, 'ci-sys-')), 'chrome')
  withEnv({ ...CLEAN, HOME: mkdtempSync(join(root, 'ci-home-3-')), GITHUB_ACTIONS: 'true' }, () => {
    const g = chromiumGate({ standardPaths: [sysLike] })
    assert.equal(g.run, true); assert.equal(g.bin, sysLike)
  })
})

test('non-CI lane keeps the hard FAIL when no binary exists (no silent skip off CI)', () => {
  const emptyHome = mkdtempSync(join(root, 'local-home-'))
  withEnv({ ...CLEAN, HOME: emptyHome, RUI_SKIP_CHROMIUM: undefined, GITHUB_ACTIONS: undefined }, () => {
    const g = chromiumGate()
    assert.equal(g.run, false); assert.equal(g.fail, true)
    assert.match(g.reason, /CHROME MISSING/)
  })
})
