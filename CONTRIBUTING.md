# Contributing to hermes-rich-ui

This repo is maintained by an agent, around the clock. Most contributions arrive from
agents too. Whichever you are, the rules below are the **exact** checklist the
maintainer runs on your PR — run it first and your PR merges the same hour CI is green.

Start with [AGENTS.md](AGENTS.md) (map, build rule, the seven laws) and
[docs/CONTRACTS.md](docs/CONTRACTS.md) — contracts are FROZEN; if one looks wrong,
raise an objection, never edit it.

## What lands fast

- Bug fixes with a failing-then-passing test.
- Doc fixes where the doc disagreed with the code.
- Small changes that stay inside the boundaries in AGENTS.md (SDK-only desktop,
  stdlib-only Python, frozen catalog).

## What needs an issue first

- Anything touching `plugin.yaml`, `.github/`, `catalog/hermes-rich-ui.catalog.json`,
  the tool schema, or the persisted card shape. Open an issue, get a
  `needs-decision` ruling, then code.
- New dependencies, new catalog types, new settings. Default answer is no; a use
  case that the current form cannot serve is what changes it.

## Before you push (mechanical gates)

```sh
node scripts/build.mjs           # → built desktop/plugin.js (+ .sha256); commit it, CI diffs it
python3 scripts/suite.py . out   # → "TOTAL N FAIL 0" (serial suite; run at merge, not per-edit)
hermes plugins validate .        # → Validation passed.
```

Every line must pass on your branch. If a test fails, run it on a clean `main` too
— a failure that also fails on `main` is a baseline flake (say so in the PR), a
failure only on your branch is yours. Single tests while iterating:
`python3 tests/test_x.py` or `node --test tests/test_x.mjs`.

## Review checklist (the maintainer runs exactly this)

R1 **Scope** — every changed line traces to the PR's stated purpose; adjacent
    refactors are a separate PR.
R2 **Stock core** — no import from a patched Hermes; core imports soft
    (`try/except`), absent field → `unknown`, never invented.
R3 **SDK-only desktop** — `desktop/src/*` imports only `react`, `react/jsx-runtime`
    (jsx()/jsxs(), no JSX), `@hermes/plugin-sdk`; no `window.hermesDesktop`,
    `localStorage`, `document.querySelector`, `innerHTML`, `eval`, dynamic
    `import()` — enforced content-wise by the D7 scan in `scripts/build.mjs`.
R4 **Stdlib backend** — no new Python dependency (no PyYAML/jsonschema/requests);
    must import under CPython 3.13 and macOS system python 3.9; no self-updater.
R5 **Manifest parity** — `plugin.yaml` `provides_*` matches `register()` exactly;
    catalog file is the single source of truth for the 18 types; version bumped
    only by the release lane.
R6 **Tests** — a behaviour change ships its check (one failing-if-broken test);
    no snapshot/change-detector tests; no test reads source text.
R7 **Docs drift** — user-visible strings changed → README/AGENTS.md/SKILL.md
    grepped for the old form and fixed in the same PR.
R8 **Sibling completeness** — the fixed pattern grepped across the repo (or
    `graphify affected <symbol> --depth 2` after `uvx --from graphifyy graphify
    update . --no-cluster`); every sibling instance fixed or shown unaffected.
R9 **Private strings** — `scripts/make_public.py` (where present) exits 0; no
    hostnames, LAN IPs, tokens, personal paths in shipped files.
R10 **Migration safety** — persisted card shapes keep loading old data; migration
    lives in the admission normalizer with a test on the old form.

## What happens after you open the PR

1. Within about 15 minutes a review comment appears: one `file:line` per finding
   and a verdict — `merge`, `changes`, or `decision`.
2. `merge` + green CI → squash-merged, your authorship kept, you are thanked by name.
3. `changes` → the comment lists exact commands to re-check. Push; the same comment
   is updated in place (no new comment per push).
4. `decision` → the maintainer needs the owner's call. Expect a reply within a day.

First PR from a fork: CI waits for a maintainer to approve the run (GitHub default).
That happens on the same tick as the review.

## Issues

Bug reports need: Hermes version (`hermes --version`), OS, the exact command or
click, what you expected, what happened, and `hermes plugins validate .` output if
relevant. A bug we cannot reproduce gets `needs-repro` and a comment saying exactly
what is missing; the clock starts from **that comment**, and replying reopens the
issue at any time. Labels you will see: `P0`–`P3`, `needs-repro`, `needs-info`,
`needs-decision`, `question`, `duplicate`.

## For agents

You are contributing on behalf of a user. Do this, in order:

1. **Search first.** `gh pr list --search "<keywords>"` and `gh issue list --search`.
   An open PR on the same issue → stop and tell your user; don't race it.
2. **Read `AGENTS.md`**, then build the code graph and navigate by it instead of
   grepping: `uvx --from graphifyy graphify update . --no-cluster` →
   `uvx --from graphifyy graphify query "<your question>"`. `graphify-out/` is
   gitignored except the committed `graph.json` + `GRAPH_REPORT.md` (the
   `graph.yml` workflow keeps them current on `main`).
3. **Reproduce before fixing.** Point at the `file:line` where the bug manifests
   and show your fix changes that line's behaviour. A plausible rationale is not a repro.
4. **Smallest diff that passes R1–R10.** No drive-by cleanups.
5. **Run the gates block above** and paste the last line of each command's output
   into the PR body under `## Gates`.
6. **PR body** = what/why in two sentences, `Fixes #n` if any, `## Gates`, and one
   line: `Author: agent (<model>) on behalf of @<user>` or `Author: human`.
7. **Do not push to `main`, do not tag, do not touch `.github/`.** Those are the
   release lane's.

A PR that follows 1–7 has historically merged on the first review.

## Boundaries that never move

- **Cards stay read-only.** No forms, actions, scripts, network calls, or
  authoring-time interactivity. If a change adds one, it is a different
  project.
- **Public-facing text** (docs, comments, test fixtures, card examples) must not
  contain private hostnames, local paths, or credentials of any kind — use
  `example.com`-style placeholders. `scripts/make_public.py` enforces this.

## Security issues

Do not open a public issue. Use your platform's private security-advisory
mechanism for the repo (e.g. "Report a security vulnerability" on the repo's
Security tab) and give the maintainer time to patch before disclosure.

## License

By contributing you agree your work is released under the repo's [LICENSE](LICENSE).
