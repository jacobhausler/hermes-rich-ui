# SECURITY — dependency advisories

## Reproducing the audit baseline

```
npm ci
npm audit --audit-level=high   # expected exit code 0 on main head >= this note
```

Exit code 0 with `found 0 vulnerabilities` = no advisory. A non-zero exit
names the affected package; match it against the register below.

## Advisory register

### GHSA-68fv-2mgg-jv7q — source-map-js DoS via indexed source-map section offsets (RESOLVED by upgrade)

- Severity: high (CVSS 7.5, CWE-1284), vulnerable range `>=1.0.0 <1.2.2`.
- Found: 2026-10-08 by an independent PR review running `npm ci && npm audit`
  against an unchanged lockfile — i.e. pre-existing on `main`, not introduced
  by any PR.
- Path: `source-map-js` 1.2.1 was a transitive **dev-only** dependency. At
  discovery its only reverse edge in `package-lock.json` was
  `css-tree` (`^1.2.1`), itself dev-only via `jsdom 27.0.0`
  (`jsdom -> cssstyle -> css-tree -> source-map-js`, plus jsdom's own
  `@asamuzakjp/dom-selector -> css-tree` edge); every node on the chain
  carried `"dev": true`. Historical note: at the jsdom 31.0.0 pin this
  chain is absent from the lockfile entirely — jsdom 29+ generates its
  CSSOM in-tree and dropped `cssstyle`/`css-tree`. It never appears in the shipped artifact:
  `desktop/plugin.js` is the esbuild bundle over `desktop/src/**` (react +
  `@json-render/react` + uPlot only) and contains zero `source-map`
  references, and the prod tree (`npm ls --omit=dev`, 6 packages) does not
  contain it at all.
- Disposition (b) upgrade: pinned `source-map-js` to **1.2.2** (patch release
  containing the upstream offset-bounds fix) via a `package-lock.json`-only
  change; `css-tree`'s `^1.2.1` range resolves to 1.2.2 with no other lockfile
  churn. `npm audit --omit=dev` was already 0 findings before the change
  (prod tree: `@json-render/*` + uPlot only, 6 packages).
- Verification at the upgrade head: `npm ci && npm audit --audit-level=high`
  -> exit 0; `node scripts/build.mjs` -> committed `desktop/plugin.js` and
  `desktop/plugin.js.sha256` byte-identical (0-diff against the committed
  bundle); full serial suite (`python3 scripts/suite.py . out`) green;
  `scripts/make_public.py` zero-hit public export green.

### GHSA-mrhx-c7xc-m3w5 — zod memory exhaustion while validating oversized constrained collections (RESOLVED by upgrade)

- Severity: high (CVE-2023-54404), vulnerable range `<4.6.6`, first
  patched in 4.6.6 (advisory published 2026-10-01, updated 2026-10-23).
- Found: 2026-11-11 by the repo-admin rui lane (estate row est-b875s),
  seeded from an `ra-pr` review note on PR #215: `npm ci && npm audit
  --audit-level=high` exited 1 (1 high) against an unchanged lockfile at
  main `9dff786` — pre-existing on `main`, not introduced by that PR, and
  it re-confirmed red at tip `c254439`. The "expected exit code 0"
  baseline above was genuinely broken until this entry's roll landed.
- Path: `zod` 4.6.5 was a transitive **prod** dependency. Its sole
  reverse edge in `package-lock.json` is `@json-render/core 0.22.0`
  (requires `zod ^4.3.6`); `package.json` carries no `zod` line and the
  lock entry has no `"dev": true`, so the advisory was red under
  `npm audit --omit=dev` too — the opposite of source-map-js above, which
  was dev-only. The shipped artifact is nonetheless not exposed:
  `scripts/build.mjs` rewrites `^zod(/.*)?$` to a Proxy stub at bundle
  time, so `desktop/plugin.js` vendors zero zod code — the bundle's only
  two `ZodArray` occurrences are string literals in @json-render/core's
  example generator. Exposure is the npm install tree, not the desktop
  bundle.
- Disposition (b) upgrade: rolled `zod` to **4.6.7** (past the 4.6.6
  first-patched, in range for `^4.3.6`) via `npm update zod` — a
  `package-lock.json`-only 3-line diff (version, resolved, integrity).
  No `package.json` edit and no `overrides` block needed.
- Verification at the upgrade head: `npm ci && npm audit
  --audit-level=high` -> exit 0 with `found 0 vulnerabilities` (full tree
  and `--omit=dev`); `node scripts/build.mjs` -> committed
  `desktop/plugin.js` and `desktop/plugin.js.sha256` byte-identical
  (0-diff against the committed bundle); full serial suite
  (`python3 scripts/suite.py . out`) green; `node --test tests/*.mjs`
  -> 736 pass / 0 fail.
