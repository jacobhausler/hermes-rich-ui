# hermes-rich-ui — frozen contracts (C0)

Status: FROZEN 2026-09-25 for C0–C3. Changes require a new revision line here and a
retest of every lane that reads the changed section.

Revision line 2026-09-25c (C0 review, docs/REVIEW-C0.md W2/W4; each letter is amended in
place in the section it names):
- (a) §2/§3 ids: every component id, DataTable column `key`, source `id` and derivation
  `id` matches `^[A-Za-z0-9_.:-]{1,128}$`; the forbidden keys (`__proto__`, `constructor`,
  `prototype`, case-sensitive) are also forbidden as ids.
- (b) §3 URLs: any character whose Unicode category is Cc, Cf, Zs, Zl or Zp anywhere in a
  URL string rejects (in addition to the https-only / no-credentials rules).
- (c) §3 the 64 KiB components budget is measured on the NORMALIZED components (after
  defaults are applied), serialized as `json.dumps(separators=(",", ":"), ensure_ascii=False)`
  and encoded UTF-8.
- (d) §1 `/meta/sources` and `/meta/derivations` entries are CLOSED objects (unknown keys
  reject): source `{id, kind: web|file|tool|derived, label: str(1..256), url?: str
  (URL rules), accessed_at?: str, note?: str(≤1024)}`; derivation `{id (unique),
  method: str(1..256), input_paths: [pointer], output_path: pointer, note?: str}`.
  Supersedes the `caveat` key in the §1 example and the `kind: synthetic` value in older
  examples.
- (e) §2 DataTable `sources` column: the ONLY admitted shape is a declared column
  `{key, label, type: "sources"}`; each row's value under that `key` is a list of source
  ids resolved against `/meta/sources` (dangling → reject). Rows carry no other citation
  key; a row key that is not a declared column key rejects.
- (f) §2 Chart line `x`: every `x` is a finite number OR an ISO-8601 string (parseable by
  `datetime.fromisoformat` after normalizing a trailing `Z` to `+00:00`); a series mixing
  the two rejects. Histogram bins: `low < high` per bin, bins sorted ascending and
  non-overlapping, else reject.
- (g) §3 data depth pin: `/dataModel` is depth 0 and the `/data` object is depth 1; a
  container at depth > 12 rejects. Hence a value stored at `/data/<key>` may itself
  contain at most 10 further nested containers (11 nested lists under `/data/x` admit,
  12 reject). Probe: 11 lists ADMIT, 12 lists REJECT on the C0 engine (fix-docs lane,
  2026-09-25); the wording pins that behavior rather than changing code (E13).
- (h) §4 `rich_present`: giving both `view` and `components` rejects
  (`"/: give view OR components, not both"`); `save_view_as` naming an existing view
  overwrites it and returns `warnings: ["view '<name>' overwritten"]`.
- (W4) §6 uPlot's class CSS is carried by the bundle, scoped under
  `[data-richui="chart-canvas"]`, injected once per document.

## 0. Identity

| Thing | Value |
|---|---|
| plugin id | `hermes-rich-ui` |
| tools | `rich_present`, `rich_present_source` (C2) |
| transcript directive | `::richui{id="<card_id>"}` |
| catalog id | `hermes-rich-ui/1` |
| wire format | A2UI **v1.0** `createSurface` message (single-message instantiation) |
| renderer engine | `@json-render/react` 0.21.0 `Renderer` (zod stubbed, ~88 KB) |
| chart engine | `uplot` 1.6.32 (bar / line / histogram / scatter — ONE engine) |
| card store | `$HERMES_HOME/rich-ui/cards/<card_id>.json` (atomic tmp+rename) |
| view store | `$HERMES_HOME/rich-ui/views/<view_id>.json` |
| REST | `/api/plugins/hermes-rich-ui/...` (mounted at `hermes serve` start) |

## 1. The record (what is persisted, what the desktop fetches)

```json
{
  "envelope": {
    "card_id": "ru-3f9a1c2b7d4e",
    "session_id": "<HERMES_SESSION_ID at publish or null>",
    "profile": "<profile or null>",
    "created_at": "2026-09-25T10:11:12Z",
    "policy": "embedded",              // embedded | capture | manual | poll (C2)
    "source": null,                    // C2: {source_id, dataset_id, mode, poll_ms, update_until}
    "revision": 1                      // data-bundle revision currently stored
  },
  "surface": {
    "version": "v1.0",
    "createSurface": {
      "surfaceId": "ru-3f9a1c2b7d4e",
      "catalogId": "hermes-rich-ui/1",
      "components": [ { "id": "root", "component": "Card", "title": "…", "children": ["a","b"] }, … ],
      "dataModel": {
        "data": { … agent data … },
        "meta": {
          "title": "card title (also the root Card's title when the agent sets one)",
          "summary": "authored plain-text summary (fallback text)",
          "authored_at": "2026-09-25T10:11:12Z",
          "dataset": { "id": "<dataset_id>", "revision": 1, "observed_at": null, "published_at": "…" },
          "sources": [ { "id": "s1", "kind": "web", "label": "…", "url": "https://…", "accessed_at": "…", "note": "…" } ],
          "derivations": [ { "id": "d1", "output_path": "/data/median", "input_paths": ["/data/offers"], "method": "median of advertised price", "note": "…" } ]
        }
      },
      "metadata": { "extensions": { "hermes_policy": "embedded" } }
    }
  }
}
```

Rules
- `components[0..]` is an A2UI adjacency list; exactly one component has `id: "root"`.
- Every bound value is an A2UI `DataBinding` `{ "path": "/data/…" }` or `{ "path": "/meta/…" }`
  (RFC 6901, strict escape decoding). No functions, no actions, no `sendDataModel`, no
  `catalogId` overrides on components.
- `dataModel` has exactly two top-level keys: `data`, `meta`. `meta` is host-authored
  (the tool writes it); the agent supplies `title`, `summary`, `sources`, `derivations` as tool args.
  Revision line 2026-09-25b: `meta.title` added (backend lane objection — the desktop header
  and plain-text fallback need a title outside the component tree).
- Manual/poll refresh (C2) = `updateDataModel{path:"/", value:{data, meta}}` semantics:
  data + sources + derivations replaced atomically; components never change after publish.
- Revision line 2026-09-25c (d): `sources[]` and `derivations[]` entries are closed objects —
  source `{id, kind: web|file|tool|derived, label: str(1..256), url?, accessed_at?, note?: str(≤1024)}`,
  derivation `{id, method: str(1..256), input_paths: [pointer], output_path: pointer, note?}`;
  unknown keys reject. Source/derivation ids follow the §2 id pattern and are unique.

## 2. Catalog `hermes-rich-ui/1` — 18 component types, all read-only

Dynamic types (A2UI common_types): `DynamicString` = string | DataBinding;
`DynamicNumber` = number | DataBinding; `DynamicArray` = array | DataBinding. `null` is
a valid resolved value for any nullable prop and renders as "unavailable", never as 0.

Every component accepts the common envelope: `id` (required), `component` (required),
`accessibility?: {label?: string}`, `sourceIds?: string[]` (evidence link; ids must
resolve in `/meta/sources`). No other keys.
Revision line 2026-09-25c (a): ids (component `id`, DataTable column `key`, source `id`,
derivation `id`) match `^[A-Za-z0-9_.:-]{1,128}$` and are never a forbidden key
(`__proto__`, `constructor`, `prototype`).

| # | component | props (finite) | children |
|---|---|---|---|
| 1 | `Card` | `title?: DynamicString`, `subtitle?: DynamicString` | `children: ComponentId[]` (1..32) |
| 2 | `Stack` | `direction?: vertical\|horizontal` (vertical), `gap?: none\|sm\|md\|lg` (md) | `children` |
| 3 | `Grid` | `columns: 1..4`, `gap?` | `children` |
| 4 | `Divider` | `label?: string` | — |
| 5 | `Tabs` | `tabs: [{title: DynamicString, child: ComponentId}]` (1..8) | via `tabs[].child` |
| 6 | `Accordion` | `items: [{title: DynamicString, child: ComponentId, open?: boolean}]` (1..12) | via `items[].child` |
| 7 | `Heading` | `text: DynamicString`, `level?: 1\|2\|3` (2) | — |
| 8 | `Text` | `text: DynamicString` (plain text, newlines kept), `tone?: default\|muted`, `variant?: body\|caption` | — |
| 9 | `Callout` | `title?: DynamicString`, `text: DynamicString`, `tone: info\|caution\|success` | — |
| 10 | `Badge` | `label: DynamicString`, `tone?: neutral\|info\|success\|caution` | — |
| 11 | `Metric` | `label: string`, `value: DynamicNumber\|null`, `unit?: string`, `precision?: 0..6`, `format?: number\|currency\|percent` | — |
| 12 | `Progress` | `label?: string`, `current: DynamicNumber\|null`, `total?: DynamicNumber\|null` (missing/null ⇒ indeterminate) | — |
| 13 | `KeyValueList` | `items: DynamicArray<{label: string, value: string\|number\|null, sourceIds?}>` ≤32 | — |
| 14 | `Image` | `src: string` (https:// only), `alt: string` (required), `caption?: string`, `maxHeight?: 64..600` | — |
| 15 | `DataTable` | `title?: string`, `columns: [{key, label, type: text\|number\|currency\|percent\|date\|sources, unit?, precision?}]` ≤12, `rows: DynamicArray<object>` ≤100, `pageSize?: 5..50` | — |
| 16 | `Chart` | `kind: bar\|line\|histogram\|scatter`, `title?: string`, `xLabel?: string`, `yLabel?: string`, `unit?: string`, `series: [{label: string, data: DynamicArray}]` (1..4, ≤512 points each), `caveat?: string` | — |
| 17 | `Timeline` | `title?: string`, `items: DynamicArray<{date?: string, label: string, text?: string, status?: done\|active\|pending, sourceIds?}>` ≤30 | — |
| 18 | `SourceList` | `title?: string`, `sourceIds?: string[]` (default: all of `/meta/sources`) | — |

Chart data shapes: bar `[{label: string, value: number|null}]`; line `[{x: ISO-8601 string | number, y: number|null}]` (null splits the line); scatter `[{x: number, y: number, label?: string}]`; histogram `[{low: number, high: number, count: integer}]` (bins are supplied, never computed). Bar charts have a zero baseline. Scatter draws no fitted line.
Revision line 2026-09-25c (f): line `x` values are each a finite number OR an ISO-8601 string
(`datetime.fromisoformat`-parseable, trailing `Z` normalized to `+00:00`); one series never
mixes the two. Histogram bins satisfy `low < high`, are sorted ascending and do not overlap.

Table cells: finite JSON values only. Unknown/null never sorts as 0; the table shows "N of M rows" when filtered.
Revision line 2026-09-25c (e), supersedes "renders the row's `sourceIds`": a `sources` column is
declared as `{key, label, type: "sources"}` and each row's value under that `key` is a list of
source ids resolved against `/meta/sources` (dangling → reject); the renderer reads the cell under
the declared `key`. Every row key must be a declared column key.

Local interaction (built into components, never in the spec): table sort/filter/page,
chart hover readout + legend toggle, accordion/tabs, card expand beyond the initial
480 px height cap, source links (user click → host external-link path only).

## 3. Budgets (admission rejects, never truncates)

components ≤64, depth ≤8, components JSON ≤64 KiB, dataModel ≤128 KiB, string values
≤4 KiB, data depth ≤12, series ≤4×512, table ≤100×12, timeline ≤30, sources ≤32,
kv items ≤32. Structural: root exists, every ref resolves, no cycles, no shared children,
no unreachable components, no children on leaf types, no `__proto__`/`constructor`/
`prototype` keys anywhere, all numbers finite. URLs: `https://` only, no credentials,
no control chars. Every `sourceIds` entry resolves. Every derivation `output_path`/
`input_paths` resolves in the data model.
Revision line 2026-09-25c: (b) URL strings reject any character of Unicode category
Cc/Cf/Zs/Zl/Zp; (c) the 64 KiB components budget is measured on the normalized components
(defaults applied, compact `json.dumps(separators=(",", ":"), ensure_ascii=False)`, UTF-8
bytes); "finite" numbers also means |n| ≤ 2^53 (representable as a JS double); (g) data
depth: `/dataModel` = depth 0, `/data` = depth 1, containers at depth > 12 reject (11 nested
lists under `/data/x` admit, 12 reject); (a) forbidden keys are also forbidden as ids.

## 4. Tools

### `rich_present` (source-free, the default door)
```
args: { title: string, summary: string,
        components: A2UI component list, data: object,
        sources?: [...], derivations?: [...],
        view?: "<view_id>"           // reuse a saved component list (title/components from the view)
        save_view_as?: "<view_id>" } // persist components+title for reuse
returns: { ok: true, card_id, directive: '::richui{id="…"}', summary, warnings: [] }
      | { ok: false, errors: ["<component id or /path>: <reason>", …] }
```
Rejects (schema level) any of: `source_id`, `mode`, `poll_ms`, `update_until`.
One call publishes; the agent then writes ordinary prose and includes the directive line.
Revision line 2026-09-25c (h): `view` and `components` are mutually exclusive — both given
rejects with `"/: give view OR components, not both"`; `save_view_as` onto an existing view
name overwrites it and returns `warnings: ["view '<name>' overwritten"]`. Admission failures
that are internal errors surface as `"/: admission failed (internal)"` (no trace in the reply).

### `rich_present_source` (C2)
```
args: { source_id: string, mode: capture|manual|poll, summary: string,
        view?: "<view_id>", components?: [...], poll_ms?: 250..5000, update_until?: ISO-8601 }
```
Source registrations live in config `plugins.entries.hermes-rich-ui.settings.sources`
(`{source_id: {root: "/abs/dir", dataset_id}}`); the file convention is
`<root>/snapshot.json` = `{format:"hermes-rich-ui.snapshot/1", dataset_id, revision, observed_at, published_at, data, sources, derivations}`.

## 5. REST (dashboard/plugin_api.py, read-only except refresh)

| Route | Returns |
|---|---|
| `GET /cards/{card_id}` | the record above (`{ok:true, card}`) or `{ok:false, error}` |
| `GET /health` | `{ok:true, cards:<count>, version}` |
| `POST /cards/{card_id}/refresh` (C2, manual) | new bundle or `{ok:false, error}` keeping the old data |
| `GET /cards/{card_id}/poll?rev=<n>` (C2) | `{changed:false}` or the new bundle |

## 6. Desktop half

`desktop/plugin.js` — ONE bundled ESM file. Imports only `@hermes/plugin-sdk`, `react`,
`react/jsx-runtime`. Built by `scripts/build.mjs` (esbuild) from `desktop/src/` +
`vendor/` with zod stubbed; the committed `desktop/plugin.js` must equal a fresh build.
Registers ONE contribution: `TRANSCRIPT_DIRECTIVE_AREA` name `richui`.
Lowering A2UI → json-render is deterministic (`desktop/src/lower.mjs`):
`components[]` → `elements{id}`; `component` → `type`; `children`/`child`/`tabs[].child`/
`items[].child` → `children[]`; `{path}` → `{$state: path}`; `root` = `"root"`.
Styling: inline `style` + `--ui-*` theme vars only (app Tailwind is purged).
Zero `window.hermesDesktop`, `localStorage`, `document.querySelector`, `innerHTML`.
Revision line 2026-09-25c (W4): uPlot's class CSS is carried by the bundle, scoped under
`[data-richui="chart-canvas"]` (every selector prefixed), injected once per document.
