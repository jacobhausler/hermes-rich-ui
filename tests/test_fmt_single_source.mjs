// #39 (defaults slice 16): fmt single source — the number/date printers live ONLY in fmt.mjs.
// Census over the whole desktop source tree: Intl.NumberFormat / toLocaleString / toFixed /
// toPrecision / toISOString may appear in fmt.mjs and nowhere else. Comments are excluded
// (they print nothing); strings and code are the census. fmtDate/isoDay are the sanctioned
// date faces — call sites route through them, they never re-implement the printer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = path.join(ROOT, 'desktop', 'src')
const PRINTERS = ['Intl.NumberFormat', 'toLocaleString', 'toFixed', 'toPrecision', 'toISOString']

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (e.endsWith('.mjs')) out.push(p)
  }
  return out
}
// Strip // and /* */ comments only (string-aware enough for this tree: line comments never
// appear inside string literals here, block comments only between statements).
function codeOnly(src) {
  return src
    .replace(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g, m => m.replace(/\/\/[^\n]*/g, '')) // keep strings, drop // inside them? simpler below
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '')
}

const hits = []
for (const file of walk(SRC)) {
  const rel = path.relative(SRC, file)
  if (rel === path.join('components', 'fmt.mjs')) continue
  const src = codeOnly(readFileSync(file, 'utf8'))
  for (const printer of PRINTERS) {
    let i = -1
    while ((i = src.indexOf(printer, i + 1)) >= 0) {
      const line = src.slice(0, i).split('\n').length
      hits.push(`${rel}:${line} ${printer}`)
    }
  }
}

test('fmt single source: the printers appear only in fmt.mjs', () => {
  assert.deepEqual(hits, [], `printers outside fmt.mjs:\n${hits.join('\n')}`)
})

test('fmt.mjs owns the date faces: fmtDate and isoDay are exported', async () => {
  const fmt = await import('../desktop/src/components/fmt.mjs')
  assert.equal(typeof fmt.fmtDate, 'function', 'fmtDate is the one date face')
  assert.equal(typeof fmt.isoDay, 'function', 'isoDay is the one UTC day face (chart ticks)')
  assert.equal(fmt.isoDay(1758067200), '2025-09-17')
  assert.equal(fmt.isoDay(0), '1970-01-01')
})
