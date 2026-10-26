# Changelog

## v0.1.6 — 2026-10-26

Clean-path patch cut, 26 merged PRs since v0.1.5: defaults-epic bundles (media & containers, design-language cohesion, Checklist S2-S4), store-lock hardening including the first external fix (@apoapostolov), and the CI observe instruments (P1). External-contributor lines carry the author handle; owner lines follow the house `(#n, date)` format so the public-string scrub stays clean. Merged since v0.1.5:

- chore(graph): rebuild graphify knowledge graph (60f4c10) (#140, 2026-10-15)
- feat(#37): media & containers bundle — wf s3 (#138, 2026-10-15)
- chore(graph): rebuild graphify knowledge graph (ad9580a) (#142, 2026-10-15)
- chore(pr-compliance): v0.3 C8 teeth mirror (#130, 2026-10-16)
- fix(desktop): key every array child citeMarker/CardBody produce (#141, 2026-10-16)
- fix(tests): pin harness chrome-headless-shell ahead of ambient discovery (est-jqwuy) (#144, 2026-10-16)
- feat(#39): design-language cohesion — the composed system locked as gates (#145, 2026-10-16)
- feat(#57 S2-S4): Checklist item state+note, PhaseTracker, hostile evidence (#143, 2026-10-16)
- chore(graph): rebuild graphify knowledge graph (65d8e74) (#149, 2026-10-17)
- test(readme): pin README prose type counts to the catalog; fix stale '26' → 27 (#150, 2026-10-17)
- docs(manifest): refresh stale component-type counts 18/26 -> 27 (#152, 2026-10-17)
- fix(ci): graph regen PR body carries the C2 pr-diagram exempt token (#151, 2026-10-17)
- chore(graph): rebuild graphify knowledge graph (56df59e) (#154, 2026-10-17)
- test(fixtures): surface-all-types subtitle 'all 26 types' -> 27 (#155, 2026-10-17)
- chore(graph): rebuild graphify knowledge graph (00846af) (#153, 2026-10-17)
- test(store): direct unit tests for engine/store.py view layer — list_views order/skip/no-mkdir, save_view rejects, hermes_home override (mutant-proven) (#156, 2026-10-18)
- chore(graph): rebuild graphify knowledge graph (d05683e) (#157, 2026-10-18)
- chore(deps): react 19.3.1 + @json-render 0.21.1 consolidated (supersedes #158 #160 #161 #162) (#163, 2026-10-19)
- chore(graph): rebuild graphify knowledge graph (828bb68) (#164, 2026-10-19)
- fix(store): exclusive store lock without fcntl (fixes #165) (#166, @apoapostolov, 2026-10-20)
- chore(graph): rebuild graphify knowledge graph (a1aaf60) (#167, 2026-10-20)
- fix(store): raise hard errors in the msvcrt lock loop instead of hanging (#168, 2026-10-20)
- chore(graph): rebuild graphify knowledge graph (02602ff) (#169, 2026-10-20)
- ci(P1): observe instruments — budget.json interim, estate-ci@v1 pin, attempt-stamped ledger, burn-token registry (#170, 2026-10-21)
- chore(graph): rebuild graphify knowledge graph (0905b2d) (#171, 2026-10-22)
- chore(ci): bump actions/upload-artifact from 4 to 7 (#172, @dependabot[bot], 2026-10-26)
## v0.1.5 — 2026-10-15

Clean-path cut at the nirvana-7 cert merges; supersedes stale-conflicting #95. Merged since v0.1.4:

- test: pin ::richui directive against the upstream transcript-directive grammar (#22, 2026-09-29)
- feat(fmt): shared number/money/unit/date formatter (defaults slice 1, #24) (#42, 2026-09-30)
- ci: rename the gates check (build-test -> gates) — team standard #41 (#44, 2026-09-30)
- feat(type): nine-step type ramp through one token table (defaults slice 2, #25) (#45, 2026-10-01)
- feat(tokens): one constants module, surfaces, tone, shared citation marker (defaults slice 3, #26) (#49, 2026-10-01)
- fix(ci): graph step-6 branch+PR+auto-merge under protect-main (#46) (#48, 2026-10-01)
- feat: absent means house — admission stops baking defaults; generated tool description (#27 slice 4, part of #23) (#51, 2026-10-01)
- chore(graph): rebuild graphify knowledge graph (f49d7c2) (#52, 2026-10-01)
- fix(suite): fail-closed merge gate + ledger invalidated at start (fixes #53) (#58, 2026-10-02)
- chore(graph): rebuild graphify knowledge graph (b9c531e) (#62, 2026-10-02)
- fix(tool): view-save OSError keeps the publication receipt (#55) (#59, 2026-10-02)
- chore(graph): rebuild graphify knowledge graph (c426f10) (#63, 2026-10-02)
- fix(tool): source-args rejection names only registered tools, gives embedded-only recovery (#56) (#61, 2026-10-02)
- chore(graph): rebuild graphify knowledge graph (566acce) (#65, 2026-10-02)
- test(#21): registration repro harness — hot-swap baseline pin + counterfactual (keep #21 open, P2) (#67, 2026-10-03)
- chore(graph): rebuild graphify knowledge graph (9a498f5) (#68, 2026-10-03)
- fix(store): serialize quota check + commit under a cross-process store lock (fixes #54) (#60, 2026-10-03)
- chore(graph): rebuild graphify knowledge graph (e77d0f7) (#69, 2026-10-03)
- test(teeth): cascade-aware jsdom resolver sees !important LONGHAND mutants (#47) (#70, 2026-10-04)
- chore(graph): rebuild graphify knowledge graph (ccfe1fb) (#72, 2026-10-04)
- test(#47): Chromium-computed host-border control (blocker 2) (#73, 2026-10-04)
- chore(graph): rebuild graphify knowledge graph (53315cb) (#74, 2026-10-04)
- feat(desc): state item shapes + numeric caps on signature lines (est-2ek.1.173) (#76, 2026-10-05)
- defaults(#34): DataTable — inferred columns, one rung per column, columns that sum (slice 11) (#75, 2026-10-05)
- chore(graph): rebuild graphify knowledge graph (3f60d67) (#79, 2026-10-05)
- feat(defaults): text family inherits one table (#32, slice 9) (#78, 2026-10-05)
- docs(contributing): R5 PUBLIC-release-only carve-out (#77, 2026-10-05)
- chore(graph): rebuild graphify knowledge graph (d014c53) (#82, 2026-10-05)
- feat(defaults): microviz: BarList, Sparkline, HeatMap (defaults epic #33) (#80, 2026-10-06)
- chore(graph): rebuild graphify knowledge graph (64c0931) (#85, 2026-10-06)
- test(gate): chromium locator finds playwright caches; gate decision is mutant-tested (#86, 2026-10-06)
- chore(graph): rebuild graphify knowledge graph (e425fdc) (#87, 2026-10-06)
- fix(gate): CI lane never live-runs the runner's ambient system chrome (est-nm1g) (#89, 2026-10-07)
- chore(graph): rebuild graphify knowledge graph (d670c0a) (#90, 2026-10-07)
- test(readme): pin the README type table to the live catalog surface (#91, 2026-10-07)
- chore(graph): rebuild graphify knowledge graph (19cba61) (#92, 2026-10-07)
- feat(card-chrome): one frame, title once, honest header, nested ladder (slice 7, #30) (#64, 2026-10-08)
- chore(graph): rebuild graphify knowledge graph (44a4ba9) (#96, 2026-10-08)
- feat(defaults): number tiles inherit metric defaults (#29) (#84, 2026-10-08)
- chore(graph): rebuild graphify knowledge graph (48091bd) (#97, 2026-10-08)
- fix: card profile attribution and saved-view discovery (est-2ek.1.530) (#93, 2026-10-09)
- chore(graph): rebuild graphify knowledge graph (25d0d66) (#99, 2026-10-09)
- feat(defaults): Chart default view inherits house tokens (#35) (#83, 2026-10-09)
- chore(graph): rebuild graphify knowledge graph (5f77d1f) (#100, 2026-10-09)
- feat(release): scripts/release_check.py — version parity + publish dry-run gate (#43) (#98, 2026-10-09)
- chore(graph): rebuild graphify knowledge graph (d7e8cc2) (#104, 2026-10-09)
- feat(defaults): the composer and RowContext — compose(), auto-row, h-Stack flex, Grid as a maximum (#28) (#102, 2026-10-09)
- chore(graph): rebuild graphify knowledge graph (a1103e3) (#105, 2026-10-09)
- feat(defaults): #29 residual — Progress token EXEMPT retired (slice 6 acceptance) (#103, 2026-10-09)
- feat(defaults): DataTable aggregations — Total/Average/Median/Min/Max/Count rows (#40, G6 generalized) (#101, 2026-10-09)
- chore(graph): rebuild graphify knowledge graph (351e492) (#106, 2026-10-09)
- chore(graph): rebuild graphify knowledge graph (c67e84a) (#107, 2026-10-09)
- feat(defaults): #31 card cap toggles only on overflow, footer outside (#108, 2026-10-09)
- chore(graph): rebuild graphify knowledge graph (67c4fe6) (#109, 2026-10-09)
- feat(defaults): evidence primitives per #36 (13b) (#110, 2026-10-10)
- chore(deps): pin source-map-js 1.2.2 (GHSA-68fv-2mgg-jv7q) + docs/SECURITY.md disposition (#112, 2026-10-10)
- chore(graph): rebuild graphify knowledge graph (0fa1b57) (#111, 2026-10-10)
- chore: drop stale lowercase .github/pull_request_template.md (#117, 2026-10-10)
- feat(stage-state): five-token stage vocabulary — one state+color source (est-6i54 S1) (#114, 2026-10-11)
- fix(door): actionable field errors and combined admission reply (#38) (#121, 2026-10-11)
- docs(maintaining): scope R5 version rule to public releases (#119, 2026-10-11)
- chore(gitignore): drop dead GRAPH_REPORT.md allow-list entry (#122, 2026-10-11)
- test(helpers): discover chrome-headless-shell in the Hermes chrome cache (#116, 2026-10-11)
- chore(docs): drop stale GRAPH_REPORT.md commit claims after #122 (#128, 2026-10-11)
- ci: validate against latest stable hermes (v0.21.7), not just the floor (#133, 2026-10-12)
- chore(graph): rebuild graphify knowledge graph (0966bd9) (#134, 2026-10-12)
- ci(graph): pin graphifyy==0.9.89 and rebuild graph at the pin (#136, 2026-10-14)
- ci: state HERMES_LATEST is human/owner-maintained; deslop pin comments (N4/N5/N6) (#137, 2026-10-15)
- chore(graph.yml): drop the [ -f ]-guarded GRAPH_REPORT.md git add (post-#122 dead-end) (#131, 2026-10-15)


All notable changes to hermes-rich-ui are documented here.

## Unreleased

- **DataTable aggregations (#40, G6 generalized):** `aggregations?: AggSpec[]`
  (`{agg: sum|mean|median|min|max|count, label?, columns?}`) — every value computed
  by the RENDERER (contract L6); rows pin at the bottom, excluded from sort, filter
  and the bar scale; caption-ink label with a top hairline. `aggregations: true`
  (or sugar `totals: true`) renders ONE smart row: sum for additive number/currency/bar,
  mean for percent/fraction (never guessed from values), row-count for text/sources,
  date silent. nulls are skipped by every agg; an all-null column shows the
  unavailable glyph, never 0; unknown `columns` reject names the valid columns.
  `countDistinct` is a documented v1 non-goal. Old tables render byte-identically.

## v0.1.4 — 2026-09-29

- **Waterfall balance walk (#15, #16):** sign-coded bars for single-series
  waterfalls, signed value labels, connector lines, and a first-point
  `total: true`+`value` opening anchor; multi-series waterfalls keep per-series colours.
- **Waterfall first-point totals (semantic change, #15/#16):** a FIRST point with
  `total: true` and a numeric `value` is now the opening anchor — it pins 0→value and
  starts the running balance (main drew a zero-height bar for that shape, which is
  never what an author meant; 0 saved cards used it). Later `total: true` rows still
  pin the base to zero and show the renderer-computed running total, and their
  `value` is ignored. Catalog description updated (text-only, no shape change).
  Cross-bot review #16 fixes: key banner positioned from the uPlot plot box (with a
  top-right headroom fallback sized from the same per-item width sum the painter draws),
  per-series bar-slot value labels with one overlap walk across all series, and the
  anchor bound on each series' first non-gap index. Sign (increase/decrease/total)
  colours apply to single-series waterfalls only; multi-series waterfalls keep the
  per-series colours and the uPlot series legend, exactly as before #15.
- Waterfall colour key is skipped entirely on charts too narrow to hold it (value
  labels and bar colours still carry the meaning).

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
