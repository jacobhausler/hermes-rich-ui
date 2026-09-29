---
name: rich-ui-maintaining
description: "Use when triaging an issue or PR on this repo. Repro on a fresh clone, blast-classify, walk R1-R10, rule merge|changes|decision, GitHub is the ledger."
version: 0.1.4
metadata:
  hermes:
    tags: [maintenance, triage, github, review, release]
---

# Maintaining hermes-rich-ui — issue/PR triage

GitHub is the ledger: every verdict, finding, and ruling lives in a PR/issue comment,
never in side-channel chat. Generic `gh` CLI only. Contracts (`docs/CONTRACTS.md`,
`docs/DECISIONS.md`) are FROZEN — raise an objection as an issue, never edit them in a
drive-by.

## Triage flow (every issue and every PR)

1. Read the whole thread once before touching anything, then search for a duplicate:
   `gh issue list --search "<keywords>"` and `gh pr list --search "<keywords>"`.
   An open PR on the same subject → stop, cross-link, do not race it.
   Done when: you can name the one open item this belongs to, or assert none exists.
2. Reproduce on a fresh clone — never in the maintainer tree:
   ```sh
   git clone <repo-url> /tmp/ru-repro && cd ru-repro   # <repo-url> = plugin.yaml homepage
   npm ci
   node scripts/build.mjs
   python3 scripts/suite.py . out        # expect last line: TOTAL N FAIL 0
   ```
   A report you cannot reproduce gets label `needs-repro` plus a comment naming exactly
   what is missing; the response clock starts from THAT comment.
3. Classify the blast (table below); run that blast's gates against the diff.
4. Walk R1–R10 against the diff line by line.
5. Post ONE review comment carrying a verdict — `merge`, `changes`, or `decision`.
   First line is the hidden marker `<!-- rich-ui:maintainer-review -->` so the same
   comment is updated in place on every later push:
   `gh pr comment <n> --body-file f.md --edit-last`. Never one comment per push.
6. Act on the verdict. Never merge a PR or close an issue while `needs-decision` is set.

## Blast classification (decides the gates, nothing else)

| Blast | Files | Gates that must be green |
|---|---|---|
| manifest | `plugin.yaml`, `dashboard/manifest.json`, `catalog/hermes-rich-ui.catalog.json`, tool schema in `__init__.py` | version-parity grep (release section), `python3 tests/test_api.py` (it pins schema + provides_* parity), `hermes plugins validate .` |
| desktop | `desktop/src/**`, `desktop/plugin.js` | `node scripts/build.mjs` then `git diff --exit-code desktop/plugin.js`, `node --test tests/test_chart.mjs tests/test_components.mjs tests/test_hostile_render.mjs` |
| backend | `engine/**`, `dashboard/**`, `__init__.py` | `python3 tests/test_admission.py`, `python3 tests/test_hostile_admission.py`, `python3 tests/test_store.py`, `python3 tests/test_api.py` |
| ci | `.github/**`, `scripts/**` | the workflow must actually run — open a throwaway PR; never merge an unexecuted CI change |
| docs | `README.md`, `AGENTS.md`, `INSTALL.md`, `CHANGELOG.md`, `skill/**`, `docs/**` (revision lines only) | `python3 tests/test_skill_docs.py` |
| tests | `tests/**`, `tests/fixtures/**`, `examples/**` | `python3 scripts/suite.py . out` |

Cross-blast diff → split it, or run every gate. The suite (`TOTAL N FAIL 0`) is the
merge gate; single tests are for iterating only.

## R1–R10 (condensed maintainer checklist — run it exactly)

- R1 Scope: every changed line traces to the PR's stated purpose; adjacent refactor = separate PR.
- R2 Stock core: no patched-host imports; core imports soft; absent field → `unknown`, never invented.
- R3 SDK-only desktop: `desktop/src/*` imports only `react`, `react/jsx-runtime`, `@hermes/plugin-sdk` — the content scan in `scripts/build.mjs` enforces.
- R4 Stdlib backend: no new Python dependency; imports under CPython 3.13 and macOS system python 3.9; no self-updater.
- R5 Manifest parity: `plugin.yaml` `provides_*` matches `register()` exactly; `catalog/hermes-rich-ui.catalog.json` is the single source of truth; version bumped only by the release lane.
- R6 Tests: a behaviour change ships one failing-if-broken test; no snapshot/change-detector tests; no test reads source text.
- R7 Docs drift: user-visible string changed → grep `README.md`, `AGENTS.md`, `INSTALL.md`, `skill/**` for the old form; fixed in the same PR.
- R8 Sibling completeness: grep the fixed pattern repo-wide; every sibling instance fixed or shown unaffected.
- R9 Private strings: no hostnames, LAN IPs, tokens, or personal paths in shipped files.
- R10 Migration safety: persisted card shapes keep loading old data; migration lives in the admission normalizer with a test on the old form.

## Verdict vocabulary (the only three words that close a review)

- `merge` — R1–R10 pass, blast gates green → squash-merge, authorship kept.
- `changes` — every finding one `file:line` + the exact command to re-check it.
- `decision` — needs the owner's ruling (contract reading, new dependency, new catalog
  type, persisted card shape). Set label `needs-decision`; expect an answer within a day.
  NEVER merge behind `needs-decision` — the block is the ledger's state, not a suggestion.

## GitHub as the ledger

- One review comment per PR, found by its hidden marker, updated in place (`--edit-last`).
- Labels carry state, prose does not: `P0`–`P3`, `needs-repro`, `needs-info`,
  `needs-decision`, `question`, `duplicate` — `gh issue edit <n> --add-label <label>`.
- Anything touching `plugin.yaml`, `.github/`, the catalog file, the tool schema, or the
  persisted card shape needs an issue and a `needs-decision` ruling BEFORE code.
- A branch-only test failure is the author's; a failure that also reproduces on clean
  `main` is baseline flake — say so in the PR.

## Release (release lane only)

1. Version parity — all three must print the same version, or stop:
   ```sh
   grep -n "^version:" plugin.yaml
   grep -n '"version"' package.json
   grep -n "^VERSION = " dashboard/plugin_api.py
   ```
2. CHANGELOG entry built from merged PR titles since the last tag:
   `gh pr list --state merged --json number,title` → group Changed/Fixed/Added, cite the PR number on every line.
3. Committed bundle ships with its sources: `node scripts/build.mjs` + commit
   `desktop/plugin.js` and `.sha256` together; CI's `git diff --exit-code desktop/plugin.js`
   must have been green on the release PR itself.
4. `hermes plugins validate .` → `Validation passed.`

## Pitfalls

- Merging behind `needs-decision`, or editing a FROZEN contract to make a PR pass —
  both are the unrecoverable moves; everything else is a force-push away.
- Trusting a report over a repro: a plausible rationale is not a repro; the fresh-clone
  suite run is.
- Letting the ledger rot: verdicts live in the marked comment and labels only. If it is
  not on the issue/PR, it was not decided.
