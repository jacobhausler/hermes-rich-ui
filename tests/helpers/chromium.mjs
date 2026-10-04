// Headless Chromium launcher + CDP session for the host-border computed-style
// control (#47 blocker 2). CDP pattern shared with scripts/screenshots/ru-cdp.mjs
// and probe-legend.mjs (fetch /json/list -> WebSocket -> Runtime.evaluate), but
// self-contained: spawns its own chrome-headless-shell on an ephemeral port.
//
// Binary discovery (no silent skips — the whole point of this control is no
// false greens): RUI_CHROME_BIN (then CHROME_BIN) env, then standard
// chrome/chromium paths. When none exist, chromiumGate() decides:
//   RUI_SKIP_CHROMIUM=1  -> recorded skip + stored expected-set fallback (issue
//                          option B; keeps the Chromium-less CI runner at FAIL 0)
//   otherwise            -> hard FAIL 'CHROME MISSING — set RUI_CHROME_BIN'
//
// The dogfood lane binary this was authored against (pin for reproducibility):
// chrome-headless-shell 154.0.8037.92 linux64 from
// https://googlechromelabs.github.io/chrome-for-testing/ (last-known-good,
// Stable channel, 2026-10-03 manifest), unpacked under a work dir as
// chrome-shell/154.0.8037.92/ and pointed at via RUI_CHROME_BIN.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const STANDARD_PATHS = [
  '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome',
  '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/usr/bin/chromium-headless-shell', '/usr/bin/chrome-headless-shell',
  '/snap/bin/chromium'
]

// First executable-looking path from env then the standard list; null when no binary exists.
export function locateChrome() {
  for (const key of ['RUI_CHROME_BIN', 'CHROME_BIN']) {
    const v = process.env[key]
    if (v && existsSync(v)) return v
  }
  return STANDARD_PATHS.find(p => existsSync(p)) || null
}

// Honest self-gate: {run:true} | {run:false, skip:true, reason} | {run:false, fail:true, reason}.
export function chromiumGate() {
  const bin = locateChrome()
  if (bin) return { run: true, bin }
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
