---
name: rich-ui
description: "Use when an answer benefits from a table, chart, metrics, timeline or cited evidence. Publish a rich card with rich_present."
---

# rich-ui — publish a rich card, then answer in prose

A card is an A2UI v1.0 surface from catalog `hermes-rich-ui/1`, published by the
`rich_present` tool and rendered inline in the Hermes desktop transcript via
`::richui{id="<card_id>"}`. Cards are read-only: no forms, no actions, no scripts.

## Card vs prose (restraint)

Use a card when structure IS the answer: comparable rows, magnitudes, a distribution,
change over dated observations, a sequence of steps, salient metrics, cited evidence.
Otherwise answer in prose. One card per answer section; start with the smallest useful
composition (one section). Never replace research with a plausible-looking card, never
fabricate series, prices, or timestamps to fill a card.

## The one-call flow

1. Gather real data with your normal tools (search, files, code) first.
2. Call `rich_present` ONCE: `{title, summary, components, data, sources?, derivations?,
   view?, save_view_as?}`. `view` reuses a saved component list; `save_view_as` persists
   yours. `rich_present` rejects any source/refresh args (`source_id`, `mode`, `poll_ms`,
   `update_until`) — it is the source-free door.
3. On success, paste the returned `directive` line verbatim in your reply, then write
   ordinary prose around it. Several small cards may interleave with prose.

## Density (default posture)

Blank space is a defect. Densest legible layout: short blocks (Metrics, KV
lists, small tables, notes) go in `Stack horizontal` or `Grid columns 2..4`,
never a full-width run of 1–2-line items; a card reads as TWO columns
(timeline left, facts+notes right); charts/wide tables earn full width.

## Components (18; props frozen in docs/CONTRACTS.md §2)

All values flow through data bindings: write `{"path": "/data/x"}` (or `/meta/...`),
never inline arrays in props. `null` resolves as "unavailable", never as 0. Every
component takes `id` (required), `component` (required), optional `accessibility.label`,
`sourceIds` (ids must resolve in `/meta/sources`). Exactly one component has `id: "root"`.

| # | component | key props |
|---|---|---|
| 1 | Card | title?, subtitle?; children (1..32) |
| 2 | Stack | direction? (vertical|horizontal), gap? (none|sm|md|lg); children |
| 3 | Grid | columns 1..4, gap?; children |
| 4 | Divider | label? |
| 5 | Tabs | tabs: [{title, child}] (1..8) |
| 6 | Accordion | items: [{title, child, open?}] (1..12) |
| 7 | Heading | text, level? (1|2|3) |
| 8 | Text | text, tone? (default|muted), variant? (body|caption) |
| 9 | Callout | title?, text, tone (info|caution|success) |
| 10 | Badge | label, tone? (neutral|info|success|caution) |
| 11 | Metric | label, value (DynamicNumber|null), unit?, precision? 0..6, format? (number|currency|percent) |
| 12 | Progress | label?, current, total? (null total ⇒ indeterminate) |
| 13 | KeyValueList | items (DynamicArray ≤32): {label, value, sourceIds?} |
| 14 | Image | src (https:// only), alt (required), caption?, maxHeight? 64..600 |
| 15 | DataTable | title?, columns ≤12 {key, label, type: text|number|currency|percent|date|sources, unit?, precision?}, rows ≤100 (row keys ⊆ column keys), pageSize? 5..50 |
| 16 | Chart | kind (bar|line|histogram|scatter), title?, xLabel?, yLabel?, unit?, series 1..4 ×≤512 {label, data}, caveat? |
| 17 | Timeline | title?, items ≤30 {date?, label, text?, status? done|active|pending, sourceIds?} |
| 18 | SourceList | title?, sourceIds? (default: all /meta/sources) |

Chart data shapes: bar `[{label, value}]`; line `[{x: ISO-8601|number, y}]` (null splits
the line; all `x` in one series are numbers OR ISO-8601 strings, never mixed — "yesterday"
is rejected); scatter `[{x, y, label?}]`; histogram `[{low, high, count}]` — bins supplied,
never computed, `low < high`, sorted and non-overlapping.

## Recipes (favorites, not templates — see skill/references/recipes.md)

- Compare: Card + Metric/Callout + DataTable + bar Chart + SourceList
- Distribution: Chart (histogram) + method/inclusion caveat + SourceList
- Change over time: Chart (line, actual timestamps) + observation-window Text + SourceList
- Explain a plan: Timeline + KeyValueList + Callout caveat (no fake telemetry)
- Monitor: Metric + Progress + line Chart

## Evidence rules

- External factual claims need `sources` entries `{id, kind: web|file|tool|derived, label,
  url?, accessed_at?, note?}` (closed shape, no other keys); every `sourceIds` entry must
  resolve in `/meta/sources`. Timeline and KeyValueList items carry their own `sourceIds`;
  a DataTable cites per row through a declared column `{key, label, type: "sources"}` whose
  cell is a list of source ids (see the Compare recipe). A SourceList alone is not attribution.
- Anything computed (median, bins, estimates) needs a `derivations` entry
  `{id, method, input_paths, output_path, note?}` (closed shape). A derivation id is NOT a
  citation: never put it in `sourceIds` — cite the inputs' source and state the method in a
  Callout/Text (or add a `kind: derived` source).
- Unknown is `null` — never 0, never guessed. Compare like scopes, units and periods;
  keep accessed/observed/published timestamps separate. A single cross-section supports
  a comparison and histogram, NOT a time trend: refuse to fabricate history.
- Do not label an advertised price an out-the-door quote. No source policy is inferred
  from words like "current" — research, then publish a static timestamped card.

## Budgets (admission rejects, never truncates)

components ≤64, depth ≤8, components ≤64 KiB, dataModel ≤128 KiB, strings ≤4 KiB,
data depth ≤12, series ≤4×512, table ≤100×12, timeline ≤30, sources ≤32, kv ≤32.
Structural: root exists, refs resolve, no cycles/shared children/unreachables, no
children on leaf types, no `__proto__`/`constructor`/`prototype` keys (as keys OR ids),
ids match `[A-Za-z0-9_.:-]{1,128}`, all numbers finite (|n| ≤ 2^53), https:// URLs only
(no control/format/space characters; note any key named `url`/`src`/`href` under `/data`
is URL-checked too).

## How to read errors

`ok:false` returns `errors: ["<component id or /path>: <reason>", …]` — fix exactly what
each names and call again, at most 2 repairs. After that fall back to accurate prose.
Never fabricate data to satisfy the validator.
