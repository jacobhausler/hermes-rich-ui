# AGENTS.md — front door for agents working on this repo

`hermes-rich-ui`: a two-halved Hermes plugin. A stdlib-only Python gateway half
(tools + admission + card store + REST) and a bundled-ESM desktop half (a
`TRANSCRIPT_DIRECTIVE_AREA` renderer). Cards are A2UI v1.0 `createSurface` records
from catalog `hermes-rich-ui/1`, rendered by the zod-stubbed `Renderer` from
`@json-render/react` 0.21.0 with uPlot 1.6.32 charts.

## Layout

```
dashboard/            gateway half: plugin entry, tools, REST (installs to ~/.hermes/plugins/hermes-rich-ui/)
engine/               stdlib-only admission engine (Python)
catalog/              hermes-rich-ui.catalog.json — single source of truth for the 18 types
desktop/src/*.mjs     renderer sources (plain ESM, no JSX)
desktop/plugin.js     committed esbuild bundle (scripts/build.mjs output; must equal a fresh build)
skill/                agent-facing skill (SKILL.md) + references/recipes.md
tests/                test_*.py (python3) and test_*.mjs (node --test)
scripts/              build.mjs, suite.py, make_public.py (publish gate)
docs/CONTRACTS.md     FROZEN contracts — read first
docs/DECISIONS.md     ratified decisions (D1–D11)
```

## Build & test

```
npm ci                      # node_modules are pinned; node 22
node scripts/build.mjs      # rebuilds desktop/plugin.js (+ .sha256)
python3 scripts/suite.py . out   # serial runner: every tests/test_*.py + test_*.mjs, out/*.log + out/exits.json
python3 scripts/make_public.py /tmp/public-tree   # publish gate: private-string audit + clean tree export
```

Single tests: `python3 tests/test_x.py` or `node --test tests/test_x.mjs`.
CI (`.github/workflows/ci.yml`) additionally asserts `git diff --exit-code
desktop/plugin.js` after a fresh build — always commit the bundle with its sources.
`tests/test_public_strings.py` (picked up by the suite glob) runs the same
private-string guard over the repo and asserts 0 un-allow-listed hits: never
ship an estate particular (host names, personal machine names, absolute home
paths, estate CLI/tooling words, seat/model seeds). Prefer neutralizing the
wording in-tree; `scripts/make_public.py`'s ALLOWLIST entries each require a
reason and are reserved for the guards themselves and intended-public author
metadata.

## Laws (violations are rejected in review)

1. **Frozen contracts.** `docs/CONTRACTS.md` and `docs/DECISIONS.md` are FROZEN. If a
   contract looks wrong, do not edit it — raise it as an objection; a change needs a
   new revision line and a retest of every reading lane.
2. **Python: stdlib only.** No third-party imports (no PyYAML, jsonschema, requests).
   Must import under CPython 3.13 and macOS system python 3.9: `from __future__ import
   annotations` at the top of every module; no `match`, no runtime `X | Y` unions, no
   walrus in comprehensions.
3. **Desktop: SDK only.** Imports come from `react`, `react/jsx-runtime` (jsx()/jsxs()
   — no JSX syntax), and `@hermes/plugin-sdk` only. Never `window.hermesDesktop`,
   `localStorage`, `document.querySelector`, `innerHTML`, `eval`, dynamic `import()`.
4. **Styling: inline styles only** using `--ui-*` CSS vars (`--ui-text-primary`,
   `--ui-text-secondary`, `--ui-text-tertiary`, `--ui-stroke-secondary`,
   `--ui-stroke-tertiary`, `--ui-bg-elevated`, `--ui-bg-tertiary`, `--ui-accent`,
   `--ui-green`, `--ui-red`, `--ui-yellow`, `--ui-purple`, `--ui-orange`).
   Tailwind utility classes are purged from the app CSS — they will not exist.
5. **No self-updater.** Nothing downloads or swaps code at runtime. The committed
   bundle is the artifact.
6. **One chart engine** (uPlot), one catalog file, deterministic lowering
   (`desktop/src/lower.mjs`): `components[]` → elements, `{path}` → `{$state: path}`.
7. **Read-only catalog.** No actions, no `sendDataModel`, no `on`/watch fields, no
   catalogId overrides. Refresh belongs to trusted chrome (C2), never to spec fields.

Start authoring agent-facing guidance from `skill/SKILL.md`; the five recipes are in
`skill/references/recipes.md`.

## Maintaining this plugin

- Issue/PR triage, blast classification, R1–R10, verdict vocabulary, release gates:
  `skill/maintaining/` (SKILL.md).
- Card lifecycle failure map — symptom → where to look → exact command:
  `skill/debugging/` (SKILL.md).
