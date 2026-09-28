// Build desktop/plugin.js from desktop/src/index.mjs.
// Rules: externals are exactly the loader-mapped specifiers; zod is stubbed because the
// Renderer never calls it (proven: docs/DECISIONS.md D4); output is one ESM file.
import * as esbuild from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

// ---- banned-surface scan (D7, desk P2-4) --------------------------------------------------
// Anything that reaches past the SDK is banned in the bundle. `document.` / `window.` (and the
// bare identifiers) are banned too; the ONLY allowed occurrence is uPlot's module-level env
// guard, allowlisted BY CONTENT (never by line number — the bundle is whitespace-minified):
//   var domEnv=typeof window!="undefined";var doc=domEnv?document:null;var win=domEnv?window:null;var nav=domEnv?navigator:null;
// Allowlisted text is removed BEFORE the scan, so any second `document`/`window` anywhere fails.
export const BANNED = [
  /window\.hermesDesktop/, /localStorage/, /document\.querySelector/, /innerHTML/, /\beval\(/,
  /new Function\(/, /import\(/, /adoptedStyleSheets/,
  /\bdocument\./, /\bwindow\./, /\bdocument\b/, /\bwindow\b/
]
export const ALLOWLIST = [
  // uPlot 1.6.32 env guard — node_modules/uplot/dist/uPlot.esm.js: `const domEnv = typeof window != 'undefined'` block
  /var domEnv=typeof window!="undefined";var doc=domEnv\?document:null;var win=domEnv\?window:null;var nav=domEnv\?navigator:null;/
]
export function scanBanned(src) {
  let text = src
  const allowed = []
  for (const a of ALLOWLIST) { const m = a.exec(text); if (m) { allowed.push(m[0]); text = text.replace(a, '') } }
  const hits = BANNED.filter(r => r.test(text)).map(String)
  return { hits, allowed }
}

export async function build(OUT = 'desktop/plugin.js') {
  const zodStub = {
    name: 'zod-stub',
    setup(b) {
      b.onResolve({ filter: /^zod(\/.*)?$/ }, () => ({ path: 'zod', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: 'const z = new Proxy(function(){}, { get: () => z, apply: () => z }); export { z }; export default z;',
        loader: 'js'
      }))
    }
  }
  await esbuild.build({
    entryPoints: ['desktop/src/index.mjs'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    external: ['react', 'react/jsx-runtime', 'react-dom', '@hermes/plugin-sdk'],
    minifyWhitespace: true,
    legalComments: 'none',
    outfile: OUT,
    plugins: [zodStub],
    logLevel: 'error'
  })
  const src = readFileSync(OUT, 'utf8')
  const { hits, allowed } = scanBanned(src)
  if (hits.length) { console.error('BANNED SURFACE IN BUNDLE:', hits.join(' ')); process.exit(1) }
  if (allowed.length !== ALLOWLIST.length) { console.error('ALLOWLIST STALE: uPlot env guard not found verbatim in bundle'); process.exit(1) }
  const sha = createHash('sha256').update(src).digest('hex')
  writeFileSync(OUT + '.sha256', sha + '  ' + OUT + '\n')
  console.log(`built ${OUT} ${src.length} bytes sha256 ${sha.slice(0, 16)}`)
  return { src, sha }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await build(process.argv[2] || 'desktop/plugin.js')
}
