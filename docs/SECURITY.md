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
- Path: `source-map-js` 1.2.1 was a transitive **dev-only** dependency. Its
  only reverse edge in `package-lock.json` is
  `css-tree` (`^1.2.1`), itself dev-only via `jsdom 27.0.0`
  (`jsdom -> cssstyle -> css-tree -> source-map-js`, plus jsdom's own
  `@asamuzakjp/dom-selector -> css-tree` edge); every node on the chain
  carries `"dev": true`. It never appears in the shipped artifact:
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
