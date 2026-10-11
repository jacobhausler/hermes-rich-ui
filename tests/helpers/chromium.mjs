// Headless Chromium launcher + CDP session for the host-border computed-style
// control (#47 blocker 2). CDP pattern shared with scripts/screenshots/ru-cdp.mjs
// and probe-legend.mjs (fetch /json/list -> WebSocket -> Runtime.evaluate), but
// self-contained: spawns its own chrome-headless-shell on an ephemeral port.
//
// Binary discovery (no silent skips — the whole point of this control is no
// false greens): RUI_CHROME_BIN (then CHROME_BIN) env, then the playwright
// browser caches under $HOME (~/.cache/ms-playwright, ~/.pw-browsers,
// ~/.hermes/*, newest chromium-* build wins). Standard system paths are the
// last resort and are DISABLED by default on the GitHub Actions lane
// (GITHUB_ACTIONS=true): the runner image preinstalls a desktop
// google-chrome-stable whose live launch is environment-dependent — main gate
// run 37475567818 hung it for the full 90 s suite budget (rc=124, orphan
// chrome at teardown) while the identical tree was rc=0 on two other runs
// minutes apart. The CI lane's contract is the recorded-skip fallback (option
// B); the live run lives on the dogfood lane via an explicit RUI_CHROME_BIN,
// and callers that really want an ambient system chrome opt in with
// chromiumGate({ standardPaths }). When no binary is found, chromiumGate()
// decides:
//   GITHUB_ACTIONS=true  -> recorded skip + stored expected-set fallback (the
//                          sanctioned CI option-B lane, est-nm1g)
//   RUI_SKIP_CHROMIUM=1  -> recorded skip + stored expected-set fallback (issue
//                          option B; keeps a Chromium-less runner at FAIL 0)
//   otherwise            -> hard FAIL 'CHROME MISSING — set RUI_CHROME_BIN'
//
// The dogfood lane binary this was authored against (pin for reproducibility):
// chrome-headless-shell 154.0.8037.92 linux64 from
// https://googlechromelabs.github.io/chrome-for-testing/ (last-known-good,
// Stable channel, 2026-10-03 manifest), unpacked under a work dir as
// chrome-shell/154.0.8037.92/ and pointed at via RUI_CHROME_BIN.
import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const STANDARD_PATHS = [
  '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/usr/bin/chromium-headless-shell', '/usr/bin/chrome-headless-shell',
  '/snap/bin/chromium'
]

// Playwright-style browser caches, newest chromium-<build>/chrome-linux64/chrome
// wins. Roots in order: $PLAYWRIGHT_BROWSERS_PATH, ~/.cache/ms-playwright,
// ~/.pw-browsers, ~/.hermes/pw-browsers (the Hermes lane caches), plus the
// Hermes chrome cache ~/.hermes/cache/chromium (chrome-for-testing layout:
// chrome-headless-shell-linux64/chrome-headless-shell, the binary the #47
// control is authored against — chrome-headless-shell speaks CDP fine).
function newestPlaywrightChrome() {
  const home = process.env.HOME || homedir()
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(home, '.cache', 'ms-playwright'),
    join(home, '.pw-browsers'),
    join(home, '.hermes', 'pw-browsers'),
    join(home, '.hermes', 'cache', 'chromium')].filter(Boolean)
  for (const root of roots) {
    if (!existsSync(root)) continue
    let dirs
    try { dirs = readdirSync(root) } catch { continue }
    const builds = dirs
      .map(d => ({ d, m: d.match(/^(?:chromium-(\d+)|chrome-headless-shell-linux64)$/) }))
      .filter(x => x.m)
      .sort((a, b) => Number(b.m[1] ?? -1) - Number(a.m[1] ?? -1))
    for (const { d } of builds) {
      for (const leaf of ['chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-headless-shell']) {
        const p = join(root, d, leaf)
        if (existsSync(p)) return p
      }
    }
  }
  return null
}

// First executable-looking path from env, then playwright caches, then the
// standard list; null when no binary exists. `standardPaths` is injectable:
// production callers pass nothing and get STANDARD_PATHS off CI, but [] on
// the GitHub Actions lane (see the header — the runner's ambient desktop
// chrome must never be live-run there), so tests that exercise the real
// default and callers that want a system chrome pass the list explicitly.
export function locateChrome({ standardPaths = (process.env.GITHUB_ACTIONS === 'true' ? [] : STANDARD_PATHS) } = {}) {
  for (const key of ['RUI_CHROME_BIN', 'CHROME_BIN']) {
    const v = process.env[key]
    if (v && existsSync(v)) return v
  }
  return newestPlaywrightChrome() || standardPaths.find(p => existsSync(p)) || null
}

// Honest self-gate: {run:true} | {run:false, skip:true, reason} | {run:false, fail:true, reason}.
export function chromiumGate(opts = {}) {
  const bin = locateChrome(opts)
  if (bin) return { run: true, bin }
  // The GitHub Actions lane is the sanctioned option-B lane (est-nm1g): an
  // absent binary there records the skip — the CI runner is treated as
  // Chromium-less by contract, and the runner's ambient chrome is deliberately
  // out of reach (see header) so a flaky live launch can never hang the gate.
  if (process.env.GITHUB_ACTIONS === 'true') {
    return { run: false, skip: true, reason: 'CHROMIUM SKIPPED (GitHub Actions lane): expected-set fallback only — live getComputedStyle NOT run (dogfood lane runs it with RUI_CHROME_BIN)' }
  }
  if (process.env.RUI_SKIP_CHROMIUM === '1') {
    return { run: false, skip: true, reason: 'CHROMIUM SKIPPED (RUI_SKIP_CHROMIUM=1): expected-set fallback only — live getComputedStyle NOT run' }
  }
  return { run: false, fail: true, reason: 'CHROME MISSING — set RUI_CHROME_BIN' }
}

// Boot chrome-headless-shell with an ephemeral debugging port, attach to the
// blank page target, and return {evaluate, close}. evaluate(expr) runs JS with
// awaitPromise+returnByValue and throws on page-side exceptions.
export async function launchChromium(bin, { timeoutMs = 20000 } = {}) {
  const proc = spawn(bin, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', 'about:blank'],
    { stdio: ['ignore', 'pipe', 'pipe'] })
  proc.stdout.resume() // keep the pipe drained so the child never blocks
  let port = null
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(`chrome-headless-shell did not print a DevTools port within ${timeoutMs}ms`)), timeoutMs)
    proc.stderr.on('data', d => {
      const m = String(d).match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//)
      if (m) { port = +m[1]; clearTimeout(t); res() }
    })
    proc.on('exit', c => { clearTimeout(t); rej(new Error(`chrome-headless-shell exited early (code ${c})`)) })
  })
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const page = targets.find(t => t.type === 'page')
  if (!page) { proc.kill(); throw new Error('no page CDP target') }
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise(res => ws.addEventListener('open', res, { once: true }))
  let seq = 0
  const pending = new Map()
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  })
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++seq
    pending.set(id, m => (m.error ? rej(new Error(`${method}: ${JSON.stringify(m.error)}`)) : res(m.result)))
    ws.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result.value
  }
  const close = () => { try { ws.close() } catch { /* already gone */ } try { proc.kill() } catch { /* already dead */ } }
  return { evaluate, close }
}
