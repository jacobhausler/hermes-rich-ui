---
name: rich-ui
description: "Use when an answer benefits from a table, chart, metrics, timeline or cited evidence. Publish a rich card with rich_present."
---

# rich-ui — publish a rich card, then answer in prose

A card is an A2UI v1.0 surface from catalog `hermes-rich-ui/1`, published by the `rich_present` tool and rendered inline in the Hermes desktop transcript via `::richui{id="<card_id>"}`. Cards are read-only: no forms, no actions, no scripts.

## Card vs prose (restraint)

Use a card when structure IS the answer: comparable rows, magnitudes, a distribution, change over dated observations, a step sequence, salient metrics, cited evidence; otherwise answer in prose. One card per answer section; start with the smallest useful composition; never replace research with a plausible-looking card or fabricate series, prices, or timestamps to fill one.

## The one-call flow

1. Gather real data with your normal tools (search, files, code) first.
2. Call `rich_present` ONCE: `{title, summary, components, data, sources?, derivations?, view?, save_view_as?}` (`view` reuses a saved component list, `save_view_as` persists yours; `source_id`/`mode`/`poll_ms`/`update_until` are rejected — it is the source-free door).
3. On success, paste the returned `directive` line verbatim in your reply, then write ordinary prose around it. Several small cards may interleave with prose.

## Density (default posture)

Blank space is a defect. Densest legible layout: short blocks (Metrics, KV
lists, small tables, notes) go in `Stack horizontal` or `Grid columns 2..4`,
never a full-width run of 1–2-line items; a card reads as TWO columns
(timeline left, facts+notes right); charts/wide tables earn full width.
A 4–12-row ranked list is a BarList, not a Chart or a DataTable; anything
already tabular (filter/paging/sources columns) stays a DataTable.

## Components (26; 1–18 frozen in docs/CONTRACTS.md §2, 19–26 additive in v0.1.1)

All values flow through data bindings: write `{"path": "/data/x"}` (or `/meta/...`), never inline arrays in props. `null` resolves as "unavailable", never as 0. Every component takes `id` (required), `component` (required), optional `accessibility.label`, `sourceIds` (ids must resolve in `/meta/sources`). Exactly one component has `id: "root"`.

| # | component | key props |
|---|---|---|
| 1 | Card | title?, subtitle?, footer? (E1 caption under children); children (1..32) |
| 2 | Stack | direction? (vertical\|horizontal), gap? (none\|sm\|md\|lg), align? (start\|center\|end; E2); children |
| 3 | Grid | columns 1..4, gap?; children |
| 4 | Divider | label?, orientation? (horizontal\|vertical; E4) |
| 5 | Tabs | tabs: [{title, child}] (1..8), defaultTab? 0..7 (E5) |
| 6 | Accordion | items: [{title, child, open?}] (1..12) |
| 7 | Heading | text, level? (1\|2\|3\|4) |
| 8 | Text | text, tone? (default\|muted), variant? (body\|caption\|mono) |
| 9 | Callout | title?, text, tone (info\|caution\|success\|error) |
| 10 | Badge | label, tone? (neutral\|info\|success\|caution\|error\|outline) |
| 11 | Metric | label, value (DynamicNumber\|null), unit?, precision? 0..6, format? (number\|currency\|percent), previous? + invertTone? (E11: renderer-computed delta row; null side ⇒ no delta) |
| 12 | Progress | label?, current, total? (null total ⇒ indeterminate), target? (E12 vs-target line), unit? |
| 13 | KeyValueList | items (DynamicArray ≤32): {label, value, sourceIds?} |
| 14 | Image | src (https:// only), alt (required), caption?, maxHeight? 64..600 |
| 15 | DataTable | title?, columns ≤12 {key, label, type: text\|number\|currency\|percent\|date\|sources, unit?, precision?}, rows ≤100 (row keys ⊆ column keys), pageSize? 5..50, defaultSort? {key, dir} (E15) |
| 16 | Chart | kind (bar\|line\|histogram\|scatter\|area\|waterfall\|range), title?, xLabel?, yLabel?, unit?, series 1..4 ×≤512 {label, data}, caveat?, stack? (bar\|area), stepped? (line), sortDesc? (bar\|histogram), height? 120..480 |
| 17 | Timeline | title?, items ≤30 {date?, label, text?, status? done\|active\|pending\|failed, sourceIds?} |
| 18 | SourceList | title?, sourceIds? (default: all /meta/sources) |
| 19 | CodeBlock | code (≤4 KiB literal text), caption?, language? (LABEL only, never parsed), showLines? |
| 20 | Checklist | title?, items (DynamicArray ≤32): {label, done? (true\|false\|null), sourceIds?}, showTally? (tally computed by the renderer). Checklist = undated booleans; Timeline = dated |
| 21 | ChipSet | labels (DynamicArray ≤24 of string; duplicates allowed), tone? (neutral\|info\|success\|caution — Badge's four), wrap? |
| 22 | AsOf | observedAt?, publishedAt?, note? — ISO-8601 only, publish only timestamps you actually observed, absent if unknown (Accessed lives in SourceList) |
| 23 | ImageGallery | items ≤8 {src (https:// only), alt (required), caption?, sourceIds?}, title?, columns? 1..4 — one evidence strip; never claim admission fetched or verified a src |
| 24 | Sparkline | values? (DynamicArray ≤512 number\|null; null = gap), direction? (line\|bar), width? 60..400, height? 14..48, tone? (default\|success\|danger) — trend chip computed, never hand-picked |
| 25 | BarList | items (DynamicArray ≤30): {label, value(number\|null), sourceIds?}, unit?, precision?, format? (number\|currency\|percent), sort? (desc\|asc\|none; nulls last, never 0) |
| 26 | HeatMap | rows ≤12 {label}, cols ≤12 {label}, cells ≤144 {row, col, value(number\|null)} (refs ⊆ declared labels, one cell per (row, col) pair — duplicates rejected), unit?, precision?, showValues? — ramp + caption min/max computed |

Chart data shapes: bar `[{label, value}]`; waterfall `[{label, value, total?}]` (signed
steps, renderer owns the baseline; a FIRST point with `total: true` + numeric `value`
is the opening anchor — pins 0→value and starts the running balance; later `total: true`
rows pin the base to zero and show the renderer-computed running total, their value is
ignored); line/area `[{x: ISO-8601|number, y}]` (null splits the
line; all `x` in one series numbers OR ISO-8601, never mixed — "yesterday" is rejected);
scatter `[{x, y, label?}]`; histogram `[{low, high, count}]` — bins supplied, never
computed, `low < high`, sorted, non-overlapping; range `[{label, low, high}]` — endpoints
both present or both null (never a midpoint), `low <= high` (equality valid). `series` is
ALWAYS a literal array (never a binding); to bind, bind each series' data:
`{label, data: {"path": "/data/..."}}`.

## Recipes (favorites, not templates — see skill/references/recipes.md)

- Compare: Card + Metric/Callout + DataTable + bar Chart + SourceList
- Distribution: Chart (histogram) + method/inclusion caveat + SourceList
- Change over time: Chart (line, actual timestamps) + observation-window Text + SourceList
- Explain a plan: Timeline + KeyValueList + Callout caveat (no fake telemetry)
- Monitor: Metric + Progress + line Chart
- KPI trend row: Metric + Sparkline pairs in one horizontal Stack; ranked list: BarList;
  day×lane matrix: HeatMap; evidence strip: ImageGallery + AsOf; show the code: CodeBlock

## Evidence rules

- External factual claims need `sources` entries `{id, kind: web|file|tool|derived, label, url?, accessed_at?, note?}` (closed shape, no other keys); every `sourceIds` entry must resolve in `/meta/sources`. Timeline, KeyValueList, Checklist and BarList items carry their own `sourceIds`; a DataTable cites per row through a declared column `{key, label, type: "sources"}` whose cell is a list of source ids (see the Compare recipe). A SourceList alone is not attribution.
- Anything computed (median, bins, estimates) needs a `derivations` entry `{id, method, input_paths, output_path, note?}` (closed shape). A derivation id is NOT a citation: never put it in `sourceIds` — cite the inputs' source and state the method in a Callout/Text (or add a `kind: derived` source).
- Unknown is `null` — never 0, never guessed. Compare like scopes, units and periods; keep accessed/observed/published timestamps separate (AsOf prints them apart). A single cross-section supports a comparison and histogram, NOT a time trend: refuse to fabricate history. Never label an advertised price an out-the-door quote; no source policy is inferred from words like "current" — research, then publish a static timestamped card.

## Budgets (admission rejects, never truncates)

components ≤64, depth ≤8, components ≤64 KiB, dataModel ≤128 KiB, strings ≤4 KiB, data depth ≤12, series ≤4×512, table ≤100×12, timeline ≤30, sources ≤32, kv ≤32, checklist ≤32, chips ≤24, gallery ≤8, heatmap cells ≤144, code ≤4 KiB.
Structural: root exists, refs resolve, no cycles/shared children/unreachables, no children on leaf types, no `__proto__`/`constructor`/`prototype` keys (as keys OR ids), ids match `[A-Za-z0-9_.:-]{1,128}`, all numbers finite (|n| ≤ 2^53), https:// URLs only (no control/format/space characters; note any key named `url`/`src`/`href` under `/data` is URL-checked too).

## How to read errors

`ok:false` returns `errors: ["<component id or /path>: <reason>", …]` — fix exactly what each names and call again, at most 2 repairs. After that fall back to accurate prose. Never fabricate data to satisfy the validator.
