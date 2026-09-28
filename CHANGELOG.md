# Changelog

All notable changes to hermes-rich-ui are documented here.

## v0.1.3 — 2026-09-28

- **Install fix (P1):** `requires_hermes` now uses the semver release (`>=0.21.5`,
  the v2026.9.24 release). The date-tag form `>=v2026.9.24` was compared by core as
  version 2026.9.24 and blocked every install on 0.21.5 (#13).

## v0.1.2 — 2026-09-28

- Tool description parity with the v0.1.1 catalog: the 8 new types, Chart kinds
  area/waterfall/range with point shapes, and new enum values are now in the
  `rich_present` description (#9, #10).
- HeatMap cells reference declared row/col LABELS (strings), not indices; documented.
- Chart `series` is always a literal array; bind per-series `data` instead (tool
  description + skill).
- New test `tests/test_tool_description.py`: catalog-to-description parity plus
  admission-level checks of the documented examples.

## v0.1.1 — 2026-09-28 (counsel-ratified expansion)

26 component types (was 18), all additive; catalog id stays `hermes-rich-ui/1`.

- **New types:** CodeBlock (literal `pre`, caption + language label, 4 KiB cap),
  Checklist (tri-state read-only, renderer-computed tally, null = UNKNOWN ≠ false),
  ChipSet (one flex-wrap row of N badges), AsOf (evidence strip: published/observed
  ISO dates, honest absent), ImageGallery (≤8 tiles, alt fallback), Sparkline (inline
  trend strip, first-vs-last-non-null chip, null gaps), BarList (ranked rows, width
  shares computed, nulls sink last as `unavailable`), HeatMap (DOM matrix, observed
  min→max accent alpha ramp, hatched nulls, 12×12 cap).
- **Chart:** kinds `+= area | waterfall | range` (waterfall deltas computed in the
  renderer; range admits zero-width intervals and both-null unavailable rows, rejects
  exactly-one-null); props `stack` (custom stack path — uPlot dist has no stackGroup),
  `stepped` (via uPlot paths.stepped), `sortDesc` (bar/histogram only), `height`
  (120–480 clamp). Admission gains cross-series x-type discipline (E16).
- **E-pack on existing types:** Card footer, Stack align, Divider orientation,
  Tabs defaultTab, Metric previous/invertTone, Progress target/unit, KeyValueList
  item format/unit/precision, DataTable bar column + defaultSort, Text variant mono,
  Heading level 4, Badge/Callout tone += error|outline, Timeline status += failed.
- Evidence grammar extended: Checklist and BarList per-item `sourceIds`, Sparkline
  bound values resolve through the dataModel.
- Skill + 10 recipes cover the full surface; fixtures admit end-to-end through the
  real engine (`tests/test_expansion_integration.mjs`).

## Publish prep — 2026-09-27

- Publish gate: `scripts/make_public.py` (private-string guard + clean-tree exporter,
  allow-list with mandatory reasons) and `tests/test_public_strings.py` (same guard over
  the repo, 0 un-allow-listed hits; picked up by the suite glob).
- Estate particulars neutralized in-tree: screenshot drivers (`round.sh` portable ssh/scp
  via `RU_SHOT_HOST`, legacy private shot-cache dir renamed to `ru-shots`), gallery seed
  (`demo-cluster`, `demo-model`),
  absolute hermes-agent paths in test/review comments → repo-relative, DECISIONS D9/D10
  prose genericized (revision line added; decisions unchanged).

## C1 polish — 2026-09-25

Measured on the Mac dev instance (10-card gallery, `scripts/screenshots/round.sh`; r1 → r4):

- Card root ships a scoped prose reset (`[data-ru-card] …`): the app's markdown `.prose` gave
  table 24px margins, li 6px + decimal markers, dt/dd margins, 20.57px line-height. handoff card
  940 → 793 px, structure 1286 → 1053 px, table 882 → 747 px at 2×.
- Horizontal Stack: 20px column-gap floor + 16px Metric right-pad — uppercase labels never touch.
  Text/Callout inside a horizontal Stack share the row (`flex:1 1 200px`); chips keep their size.
- SourceList flush-left, no marker indent. KeyValueList baseline-aligned.
- Chart: legend left-aligned, x-series legend row hidden (static card); long bar category labels
  rotate -35° instead of overlapping (8 dealer labels in 530px measured illegible).
- Image: a load error swaps the `<img>` for the dashed alt box — no broken-image glyph.
- Metric currency without explicit precision: whole dollars at |n| ≥ 1000, cents below.
- Tool schema: components doc states the FLAT shape (no `props` wrapper), every enum, that Metric
  value must be numeric, and a minimal valid example; `title` doc states it is required at top
  level. (Three rejected calls on the first live use — all three now answered by the schema.)
- `scripts/suite.py` writes a fresh ledger per run (append-only kept a stale FAIL alive).
- `scripts/screenshots/`: gallery seeder (every card through the real `rich_present` door), CDP
  card shooter with settle + overlap guards, `round.sh` push/shoot/pull loop.

## v0.1.0

First public-shaped release (C0–C3 scope; public repo/catalog PR held per D8).

- A2UI v1.0 `createSurface` records on our own read-only catalog
  `hermes-rich-ui/1` (18 component types; contracts frozen in docs/CONTRACTS.md).
- Gateway half: `rich_present` tool (source-free door), stdlib-only admission
  engine (rejects, never truncates), atomic card store under
  `$HERMES_HOME/rich-ui/cards/`, read-only REST (`/cards/{id}`, `/health`).
- Desktop half: single bundled ESM plugin registering ONE
  `TRANSCRIPT_DIRECTIVE_AREA` contribution (`richui`); deterministic lowering
  from A2UI to the zod-stubbed `@json-render/react` 0.21.0 Renderer; uPlot 1.6.32
  charts (bar/line/histogram/scatter); inline styles on `--ui-*` theme vars only.
- Agent skill: `skill/SKILL.md` (one-call flow, restraint, evidence rules, error
  repair etiquette) + `skill/references/recipes.md` (five recipes: compare,
  distribution, change-over-time, explain-a-plan, monitor).
- Docs: README, AGENTS (laws), INSTALL with negative-control section, CI that
  rebuilds and asserts the committed bundle equals a fresh `scripts/build.mjs`
  output.
- Held for C2: `rich_present_source`, capture/manual/poll refresh, views polling.

### C0 review (2026-09-25)

C0 review: 0 P0 / 15 P1 / 17 P2 → all P1 fixed, P2 fixed or deferred (list). Triage
and lane ownership in `docs/REVIEW-C0.md`; three independent adversarial reviews
(security, desktop, semantics), every finding reproduced by an executed probe.

- Fixed, engine (E1–E12): fail-closed admission on hostile structure (non-string
  child refs, NaN guard, recursion cap, ints > 2^53); `rich_present` no longer leaks
  a `trace`; id pattern `^[A-Za-z0-9_.:-]{1,128}$` for component/column/source/
  derivation ids with forbidden keys barred as ids; URL strings reject Unicode
  Cc/Cf/Zs/Zl/Zp; closed `/meta/sources` and `derivations` shapes; `re.fullmatch`
  for card/view ids; strict RFC 6901 pointer tokens; 64 KiB components budget on
  the normalized list; `view`/`components` exclusivity + `save_view_as` overwrite
  warning; DataTable `sources` column resolved under its declared key; line `x`
  must be number or ISO-8601 (unmixed); histogram bins ordered, non-overlapping.
- Fixed, desktop (D1–D10): null-prototype element maps and own-property row reads
  (no prototype pollution); `accessibility.label` honoured by Chart and DataTable;
  uPlot CSS scoped under `[data-richui="chart-canvas"]`, injected once; SourceList
  non-link fallback when the host cannot open externals; no unconditional
  `/health` probe at register; Badge/Tip/Skeleton props verified against the SDK;
  build scan bans `document.`/`window.` (single uPlot env-guard allowlisted);
  Chart/DataTable render component-level `sourceIds`; SourceList `sourceIds: []`
  is an explicit empty state; stable keys.
- Fixed, docs (W1–W5): this entry; CONTRACTS revision line 2026-09-25c (a)–(h) and
  the §6 uPlot CSS revision; every recipe in `skill/references/recipes.md` admits
  (Compare declares a `sources` column, Distribution cites a source, not a
  derivation) and `tests/test_skill_docs.py` now runs `admit()` on each; README
  drops the placeholder screenshot reference.
- Deferred (C1+): resolved-value type/size strictness (string-typed numbers under
  number columns, chars-vs-bytes on strings) pending a coercion contract decision;
  Image `<img>` to arbitrary https hosts (IP/UA disclosure) pending an owner ruling
  on allowlist-or-proxy at C3; the stale merge report is superseded by
  `docs/REVIEW-C0.md`.
- Pinned (E13): data depth counts the `/data` object as depth 1 — 11 nested lists
  under `/data/x` admit, 12 reject; documented, not changed.
- Integration verify (2026-09-25, after merging c0/fix-engine, c0/fix-desktop,
  c0/fix-docs in that order): `review/sec/attack.py` + `attack2.py` re-run against the
  merged engine — 43 of 123 cases changed verdict (N6 via a manual re-run: attack2.py now dies at its N5 `store.read_card` line because N5 is rejected, so N6/N7 were replayed by hand — N6 rejects with the finite-number error and no `trace`, N7 unchanged), every `!!`/P1 case now REJECTED;
  5 P2-listed cases remain ACCEPTED by design (B10 empty pointer key, F11/G5
  deferred resolved-type strictness, I4 admitted-with-empty-state per D9, N2 now
  warns on overwrite per E10). All 5 recipes + both examples ADMIT. Suite
  `scripts/suite.py`: 16/16 green — 8 python files (435 checks: admission 80,
  hostile_admission 212, skill_docs 105, fixtures_admit 17, tool 9, store 7, api 4,
  placeholder 1) + 8 node files (70 tests). Bundle `desktop/plugin.js` 233241 bytes,
  sha256 2a1e54a96300268cf8e7ac73a6dc82579708e52bfd282db46e554b6eba05bda1 (unchanged
  by rebuild). `hermes plugins validate .` → Validation passed (1 caution:
  system_passwd_access in test_hostile_admission.py:143 — the `../../etc/passwd`
  id-pattern probe). Fixture `tests/fixtures/table-basic.json` sources column key
  settled on `src` (rows agree).
