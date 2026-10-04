// Locates a Chromium/Chrome binary and runs one-shot headless CDP probes, plus the
// stored Chromium-computed expected set (issue #47's sanctioned fallback when the CI
// runner has no browser — ubuntu-latest does; the dogfood lane does).
import { existsSync, readdirSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function findChromium() {
  const safeReadDir = dir => { try { return readdirSync(dir, { withFileTypes: true }) } catch { return [] } }
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN
  const candidates = [
    'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/usr/bin/chromium-browser/chrome', '/opt/google/chrome/chrome',
    '/opt/chromium.org/chromium/chrome', '/opt/chromium.org/chromium/headless_shell',
    '/snap/bin/chromium'
  ]
  for (const c of candidates) {
    if (c.includes('/')) { if (existsSync(c)) return c; continue }
    const dirs = (process.env.PATH || '').split(':')
    for (const d of dirs) { if (d && existsSync(join(d, c))) return join(d, c) }
  }
  // dogfood lanes: a Hermes-managed pinned toolchain may ship a pinned Chromium
  // build under a versioned tools dir (env RU_CHROMIUM_TOOLS_DIR overrides the
  // scan roots). Bounded BFS, 3 levels deep, for a chromium-<ver>/…/chrome build.
  const toolsRoots = (process.env.RU_CHROMIUM_TOOLS_DIR || '/opt:/usr/lib').split(':')
  const rels = ['chrome-linux64/chrome', 'headless_shell', 'chrome']
  const hit = dir => rels.map(rel => join(dir, rel)).find(p => existsSync(p))
  for (const root of toolsRoots) {
    let frontier = [root]
    for (let depth = 0; depth < 3 && frontier.length; depth++) {
      const next = []
      for (const dir of frontier) {
        for (const ent of safeReadDir(dir)) {
          if (!ent.isDirectory()) continue
          if (ent.name.startsWith('chromium-')) { const p = hit(join(dir, ent.name)); if (p) return p }
          else next.push(join(dir, ent.name))
        }
      }
      frontier = next
    }
  }
  return null
}

// Stored expected set — what headless Chromium (>=130, border-collapse:collapse) computes
// for the saved 97cb HeatMap probe page (tests/test_host_border_chromium.mjs). Verified by
// the live probe runs recorded in PR #47's body; used to make skip-vs-green honest and to
// document the sanctioned CI-without-browser fallback.
export const EXPECTED = {
  hostEdge: { width: '0px', style: 'none' },           // shipped reset wins the cascade
  hostEdgeMutant: { width: '1px', style: 'solid' },    // reset removed -> host rule lands
  cellEdge: { width: '1px', style: 'solid' }           // declared heat-cell edge survives
}

// Launch headless Chromium on an OS-assigned port, run `fn(session)`, always kill the
// browser. session: { navigate(url), evaluate(expr) } — the fetch+WebSocket CDP pattern
// from scripts/screenshots/probe-legend.mjs, minus the fixed :9333.
export async function withBrowser(bin, fn) {
  const userDataDir = mkdtempSync(join(tmpdir(), 'ru-host-border-'))
  const proc = spawn(bin, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=0', `--user-data-dir=${userDataDir}`,
    '--hide-scrollbars', 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] })
  const state = { stderr: '' }
  proc.stderr.on('data', d => { state.stderr += d.toString() })
  try {
    const wsUrl = await waitForWsUrl(proc, state)
    const ws = new WebSocket(wsUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true })
      ws.addEventListener('error', () => rej(new Error('CDP websocket connect failed')), { once: true })
      setTimeout(() => rej(new Error('CDP websocket open timed out')), 15000).unref?.()
    })
    let seq = 0
    const pending = new Map()
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    })
    const send = (method, params = {}) => new Promise((res, rej) => {
      const id = ++seq
      pending.set(id, m => (m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)))
      ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`CDP ${method} timed out`)) } }, 20000).unref?.()
    })
    const evaluate = async expr => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
      return r.result.value
    }
    return await fn({
      async navigate(url) {
        await send('Page.enable')
        await send('Page.navigate', { url })
        await waitReady(send, evaluate)
      },
      evaluate
    })
  } finally {
    try { proc.kill('SIGKILL') } catch { /* already gone */ }
    try { rmSync(userDataDir, { recursive: true, force: true }) } catch { /* best effort */ }
  }
}

async function waitForWsUrl(proc, state) {
  // --remote-debugging-port=0 prints "DevTools listening on ws://127.0.0.1:PORT/devtools/browser/..."
  const deadline = Date.now() + 30000
  for (;;) {
    const m = state.stderr.match(/DevTools listening on (ws:\/\/\S+)/)
    if (m) {
      // Derive the page target from /json/list like probe-legend.mjs does.
      const http = m[1].replace(/^ws:/, 'http:').replace(/\/devtools\/browser\/.*$/, '')
      const targets = await (await fetch(`${http}/json/list`)).json()
      const page = targets.find(t => t.type === 'page') ?? targets[0]
      return page.webSocketDebuggerUrl
    }
    if (proc.exitCode !== null) throw new Error(`chromium exited early (code ${proc.exitCode})`)
    if (Date.now() > deadline) throw new Error('timed out waiting for DevTools endpoint')
    await new Promise(r => setTimeout(r, 100))
  }
}

async function waitReady(send, evaluate) {
  const deadline = Date.now() + 10000
  for (;;) {
    try {
      const st = await evaluate('document.readyState')
      if (st === 'complete') return
    } catch { /* not there yet */ }
    if (Date.now() > deadline) throw new Error('probe page never reached readyState=complete')
    await new Promise(r => setTimeout(r, 120))
  }
}
