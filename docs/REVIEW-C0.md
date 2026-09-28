# C0 review triage — 2026-09-25 (integrator: main session)

Sources: review/sec/findings.md (P0 0 · P1 8 · P2 6, no_go), review/desk/findings.md (P0 0 · P1 2 · P2 6, go-conditional), review/sem/findings.md (P0 0 · P1 5 · P2 5, no_go). All findings were produced by executed probes; scripts sit next to each findings.md. Ruling below is the integrator's; every ACCEPT becomes a fix item with an owner lane, every DEFER/WITHDRAW has a reason.

## Lane ownership (file-disjoint)

| Lane | Owns | Items |
|---|---|---|
| fix-engine | engine/*.py, tests/test_*.py (python), examples/**, catalog/*.json | E1–E12 |
| fix-desktop | desktop/src/**, tests/*.mjs, tests/fixtures/**, scripts/build.mjs | D1–D9 |
| fix-docs | docs/CONTRACTS.md (revision lines only), skill/**, README.md, AGENTS.md, INSTALL.md, CHANGELOG.md | W1–W5 |

## ACCEPTED — fix-engine

- E1 (sec P1-1) admit() crashes on hostile structure → fail-closed only via tool.py's catch. `_check_graph`: `if not isinstance(child, str) or child not in by_id`; guard `math.isnan` with `isinstance(v, float)`; hard recursion/depth cap in `_walk` and the components `_scan_values` (max_depth); ints > 2**53 rejected ("finite JSON values" = representable in JS double). Regression tests: D7, E6, F7/F8, L1, N6 from review/sec/attack.py.
- E2 (sec P1-2) rich_present leaks `trace`. Drop the key; log via `logging.getLogger("hermes_rich_ui")`; error string `"/: admission failed (internal)"`. CONTRACTS §4 stands as written.
- E3 (sec P1-3 + P1-4 + P2-6) ComponentId / DataTable column.key / source.id / derivation.id must `re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}")` AND not be in FORBIDDEN_KEYS (case-sensitive per contract). Tests: A4, A5, A6, D1, D2.
- E4 (sec P1-5) URL check: reject any char with `unicodedata.category(c)` in {Cc, Cf, Zs, Zl, Zp} anywhere in a URL string; keep existing checks. Tests: C4, C5, C6, M8, M10.
- E5 (sec P1-6 + sem F8) `/meta/sources` entries: closed object `{id, kind∈{web,file,tool,derived}, label: str(1..256), url?: str(check_url), accessed_at?: str, note?: str(≤1024)}`; unknown keys reject. Tests: M1–M5, C15, C16.
- E6 (sec P1-7) derivations: closed object `{id (unique, id-pattern), method: str(1..256), input_paths: [pointer], output_path: pointer, note?}`. Tests: M6, M7.
- E7 (sec P1-8) store.py: `re.fullmatch` for card/view ids. Tests: `"abc\n"`, `"ru-abcdef123456\n"` → invalid.
- E8 (sec P2-1) pointers: reject `~` not followed by 0/1; index token regex with `\Z`. Tests: B3, B4, B5, J6.
- E9 (sec P2-2) 64 KiB components budget measured on the NORMALIZED components (after defaults applied, `json.dumps(separators=(",",":"), ensure_ascii=False).encode()`); CONTRACTS revision line W2 states it. Test: K1 flips to reject if normalized > 65536.
- E10 (sec P2-3) tool: reject when both `view` and `components` given ("/: give view OR components, not both"); `save_view_as` on an existing name returns `warnings: ["view '<name>' overwritten"]`.
- E11 (sem F4 + F1 recipes side) DataTable `sources` column: the ONLY admitted shape is column `{key, label, type: "sources"}` and each row's value under that `key` is a list of source ids (resolved against /meta/sources; dangling → reject). Admission must resolve under the declared key, not a hard-coded `sourceIds`. Catalog JSON updated to match. Fixture tests/fixtures/table-basic.json and examples/** must ADMIT (add `tests/test_fixtures_admit.py` that runs admit() on every JSON under examples/ and tests/fixtures/ that has `components`).
- E12 (sem F5 + F7) Chart line `x`: every x must be a finite number OR an ISO-8601 string parseable by `datetime.fromisoformat` (Python 3.9 — so normalize a trailing `Z` to `+00:00` before parsing); mixed within one series → reject. Histogram bins: `low < high` and bins non-overlapping, sorted → else reject. Tests for both.
- E13 (sec "12/11 data depth" off-by-one) Pin: data depth counts the `/data` object as depth 1; document in W2 rather than change code — UNLESS the test shows the code rejects depth 11 lists, then fix to allow exactly 12 levels. Lane decides from a probe and reports which.
- E14 (sem F2) recipes `sourceIds: ["d1"]` citing a derivation: admission RULE stands (sourceIds cite sources only). The recipe is wrong, not the validator → W3.

## ACCEPTED — fix-desktop

- D1 (sec P1-3 mirror) lower.mjs: `const elements = Object.create(null)`; table.mjs: `Object.prototype.hasOwnProperty.call(row, col.key) ? row[col.key] : undefined`. Then RUN review/sec/desktop_probe.mjs from the plugin dir as a test (tests/test_hostile_render.mjs) proving `__proto__` id / `constructor` column render as plain text or are ignored — never touch Object.prototype.
- D2 (desk P1-1 + sem F3) table.mjs / chart.mjs read `props.accessibility?.label` (like _shared common()). Test: aria-label equals the given label for both.
- D3 (desk P1-2) uPlot CSS: prefix every selector with `[data-richui="chart-canvas"] `; render the `<style>` once per document (module-level flag or a single style element keyed by `data-richui-uplot-css`); CONTRACTS revision line W4.
- D4 (desk P2-1) SourceList fallback when `osOpen` is null: render a non-link `<span>` with the URL text (no `target=_blank` — Electron window-open policy denies it, so the anchor was dead). Fix the comment.
- D5 (desk P2-2) Remove the unconditional `ctx.rest('/health')` probe in index.mjs register().
- D6 (desk P2-3) VERIFY Badge/Tip/Skeleton props against `apps/desktop/src/components/ui/{badge,tooltip,skeleton}.tsx` (paths relative to a hermes-agent checkout) and the SDK re-export. Badge variants must be from its cva variant list (probe: `grep -n "variant" badge.tsx`); if `muted`/`warn`/`success`/`xs` are not real, map to real ones. Report the real list in the lane output.
- D7 (desk P2-4) scripts/build.mjs banned-surface scan: add `/\bdocument\./` and `/\bwindow\./` with an explicit allowlist for the single uPlot env-guard line (matched by content, not line number). Build must still pass.
- D8 (sem F6) Chart and DataTable: render component-level `sourceIds` as the evidence superscript like the other components (via withSources).
- D9 (sem F9 + sec P2-4) SourceList: `sourceIds: []` renders "No sources cited" (empty state); absent → all sources. Test both.
- D10 (desk P2-6 minor) sourcelist.mjs li key → `s.id + ':' + i`; chart.mjs remount key: replace `String(Math.random())` fallback with a stable counter.

## ACCEPTED — fix-docs

- [x] W1 Transcribe: this triage stays as docs/REVIEW-C0.md (this file). Add CHANGELOG entry "C0 review: 0 P0 / 15 P1 / 17 P2 → all P1 fixed, P2 fixed or deferred (list)".
- [x] W2 CONTRACTS revision line 2026-09-25c: (a) id pattern `^[A-Za-z0-9_.:-]{1,128}$` for component/column/source/derivation ids, FORBIDDEN_KEYS also apply to ids; (b) URL strings reject Unicode categories Cc/Cf/Zs/Zl/Zp; (c) 64 KiB budget measured on normalized components; (d) `/meta/sources` and `derivations` closed shapes (copy from E5/E6); (e) DataTable `sources` column rule (E11); (f) Chart line `x` rule + histogram bin rule (E12); (g) data depth pin (E13, per lane report); (h) `save_view_as` overwrite warning + view/components exclusivity (E10).
- [x] W3 recipes.md: "Compare" — declare the sources column `{key:"sources", label:"Sources", type:"sources"}` and put the ids under `sources` in each row; "Distribution" — cite a source id, not `d1`; move the derivation reference to the Text/Callout prose. Every recipe must ADMIT (fix-engine's test_fixtures_admit.py will also cover `skill/references/recipes.md` fenced JSON blocks — coordinate: recipes JSON blocks must be ```json fenced and complete).
- [x] W4 CONTRACTS §6 revision: "uPlot's class CSS is carried by the bundle, scoped under `[data-richui="chart-canvas"]`, injected once."
- [x] W5 README: remove the `assets/card-research.png` reference until C2 captures a real screenshot (no placeholder images).

## DEFERRED (C1+ with reason)

- sec P2-5 type/size laxity at resolved-value layer (string-typed number under number column, 2**53 precision, chars-vs-bytes on strings) → E1 covers the 2**53 part; the rest goes to C1 backlog as "resolved-type strictness" — needs a contract decision on coercion.
- desk P2-5 Image `<img>` to arbitrary https host (IP/UA disclosure) → sanctioned by CONTRACTS row 14; backlog item "Image: allowlist or proxy" for owner ruling at C3.
- desk P2-6 stale merge report → superseded by this document.

## WITHDRAWN

- none. Every finding reproduced.

## Verify step (integrator, after merge)

1. `python3 review/sec/attack.py` and `attack2.py` re-run from the plugin dir with the fixed engine: every line previously marked `!!`/ACCEPTED must flip (the lane adds these as `tests/test_hostile_admission.py` so this is permanent).
2. `python3 review/sem/admit_recipes.py` → all recipes ADMIT.
3. `node review/sec/desktop_probe.mjs` (cwd = plugin dir) → no prototype pollution.
4. `npm test`, `node scripts/build.mjs`, `/opt/hermes/.venv/bin/hermes plugins validate .` all green; bundle sha recorded.
