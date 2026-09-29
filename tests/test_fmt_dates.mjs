// Slice 1 date faces (#24; DEFAULTS-SPEC D4, C14). The viewer's zone is the only viewer-dependent
// input, so every case runs in two child processes: TZ=America/Chicago and TZ=Asia/Tokyo.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

const FMT = new URL('../desktop/src/components/fmt.mjs', import.meta.url).href
const INPUTS = ['2026-09-28', '2026-09-29T04:30:00Z', '2026-09-28T23:30:00-05:00', '2026-09-28T00:00:00Z',
  '2026-09-28T14:05', 'Q3 2026', '42', '09/28/2026', '']

function facesIn(TZ) {
  const src = `const { fmtDate } = await import(${JSON.stringify(FMT)}); const xs = ${JSON.stringify(INPUTS)};` +
    `console.log(JSON.stringify({ face: xs.map(x => fmtDate(x)), exact: xs.map(x => fmtDate(x, { level: 'exact' })), nul: fmtDate(null) }))`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', src], { encoding: 'utf8', env: { ...process.env, TZ } })
  assert.equal(r.status, 0, r.stderr)
  return Object.fromEntries(JSON.parse(r.stdout).face.map((f, i) => [INPUTS[i], f]).concat([['exact', JSON.parse(r.stdout).exact], ['null', JSON.parse(r.stdout).nul]]))
}

test('D4 dates in Chicago and Tokyo', () => {
  const chi = facesIn('America/Chicago'), tok = facesIn('Asia/Tokyo')
  // a calendar date (and midnight UTC) is never shifted: identical in both zones
  assert.equal(chi['2026-09-28'], 'Sep 28, 2026')
  assert.equal(tok['2026-09-28'], 'Sep 28, 2026')
  assert.equal(chi['2026-09-28T00:00:00Z'], 'Sep 28, 2026')
  assert.equal(tok['2026-09-28T00:00:00Z'], 'Sep 28, 2026')
  // a zoned instant shows in the viewer's zone with its abbreviation, no seconds
  assert.equal(chi['2026-09-29T04:30:00Z'], 'Sep 28, 2026, 11:30 PM CDT')
  assert.equal(tok['2026-09-29T04:30:00Z'], 'Sep 29, 2026, 1:30 PM GMT+9')
  assert.equal(chi['2026-09-28T23:30:00-05:00'], 'Sep 28, 2026, 11:30 PM CDT')
  assert.equal(tok['2026-09-28T23:30:00-05:00'], 'Sep 29, 2026, 1:30 PM GMT+9')
  // a floating wall clock shows as written, in every zone
  assert.equal(chi['2026-09-28T14:05'], 'Sep 28, 2026, 2:05 PM')
  assert.equal(tok['2026-09-28T14:05'], 'Sep 28, 2026, 2:05 PM')
  // ISO-only parsing: everything else is verbatim
  for (const z of [chi, tok]) {
    assert.equal(z['Q3 2026'], 'Q3 2026')
    assert.equal(z['42'], '42')
    assert.equal(z['09/28/2026'], '09/28/2026')
    assert.equal(z[''], null)
    assert.equal(z.null, null)
    assert.deepEqual(z.exact.slice(0, 8), INPUTS.slice(0, 8)) // the readout is the authored string
  }
})
