// React key hygiene: every array-rendered child CardBody creates must carry a key.
// A missing key never fails a DOM assertion — it only poisons the console in every
// user session — so nothing else catches it. Mutant-proven: drop the key argument on
// the CardBoundary in desktop/src/card.mjs and this test goes RED.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { React, act, registry, mount } from './helpers/render.mjs'

const { CardBody } = await import('../desktop/src/card.mjs')
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIR = path.join(ROOT, 'tests/fixtures/saved')
const FILES = readdirSync(DIR).filter(f => f.endsWith('.json')).sort()
const { createRoot } = await import('react-dom/client')
const root = createRoot(mount)

test('saved corpus renders through CardBody with zero React key warnings', async () => {
  assert.ok(FILES.length > 0, 'corpus present')
  const seen = []
  const orig = console.error
  console.error = (...a) => { seen.push(a.map(String).join(' ')) }
  try {
    for (const f of FILES) {
      const record = JSON.parse(readFileSync(path.join(DIR, f), 'utf8'))
      await act(async () => { root.render(React.createElement(CardBody, { record, registry })) })
    }
  } finally {
    console.error = orig
  }
  const warns = seen.filter(m => /unique ["']key["'] prop/.test(m))
  assert.deepEqual(warns, [], `missing-key warning: ${warns[0] || ''}`)
})
