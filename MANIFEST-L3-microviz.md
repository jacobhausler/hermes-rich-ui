# MANIFEST — lane L3 (microviz): N12 Sparkline · N13 BarList · N14 HeatMap

Integrator (L8): paste each block verbatim into the named shared seam. Lane owns
`desktop/src/components/{sparkline,barlist,heatmap}.mjs`, `tests/test_synth_microviz.mjs`,
`tests/test_synth_microviz_admission.py`, `tests/helpers/microviz_checks.py` (the admission
check bodies below are kept byte-identical to that file's functions).
Caps: NO new admission.py caps constants — the single reachable HeatMap cap is the catalog
`cells maxItems: 144` (S4; maxItems is enforced at admission.py:283-284; no
MAX_HEATMAP_CELLS anywhere). Sparkline ≤512 and BarList ≤30 likewise live in the catalog.

---

## 1. catalog/hermes-rich-ui.catalog.json — add 3 components entries

Insert these three keys into `components` (after `SourceList`). `additionalProperties: false`
on every object, `hermes-rich-ui/1` untouched, additive only (L8 law). They validate against
the mini-interpreter as shipped (all-positive + cap/enum/binding negatives checked at lane
time); no new `$defs` needed.

```json
{
  "Sparkline": {
    "type": "object",
    "description": "Tiny inline trend strip for KPI rows, rendered beside a Metric. min/max normalization and the up/down/flat trend chip are computed by the renderer (never hand-pick arrows); null values are gaps, never 0.",
    "properties": {
      "id": {
        "$ref": "#/$defs/ComponentId"
      },
      "component": {
        "const": "Sparkline"
      },
      "accessibility": {
        "$ref": "#/$defs/Accessibility"
      },
      "sourceIds": {
        "type": "array",
        "items": {
          "type": "string",
          "maxLength": 4096
        },
        "maxItems": 32,
        "description": "Evidence links; every id must resolve in /meta/sources."
      },
      "values": {
        "description": "Up to 512 number|null points; null renders a gap (never 0). Provide values or series, never both hand-duplicated.",
        "oneOf": [
          {
            "type": "array",
            "items": {
              "oneOf": [
                {
                  "type": "number"
                },
                {
                  "type": "null"
                }
              ]
            },
            "maxItems": 512
          },
          {
            "$ref": "#/$defs/DataBinding"
          }
        ]
      },
      "series": {
        "description": "Alias for values (at most one of values/series). Up to 512 number|null points; null renders a gap (never 0).",
        "oneOf": [
          {
            "type": "array",
            "items": {
              "oneOf": [
                {
                  "type": "number"
                },
                {
                  "type": "null"
                }
              ]
            },
            "maxItems": 512
          },
          {
            "$ref": "#/$defs/DataBinding"
          }
        ]
      },
      "direction": {
        "type": "string",
        "enum": [
          "line",
          "bar"
        ],
        "default": "line"
      },
      "width": {
        "type": "integer",
        "minimum": 60,
        "maximum": 400,
        "default": 120
      },
      "height": {
        "type": "integer",
        "minimum": 14,
        "maximum": 48,
        "default": 24
      },
      "tone": {
        "type": "string",
        "enum": [
          "default",
          "success",
          "danger"
        ],
        "default": "default"
      }
    },
    "required": [
      "id",
      "component"
    ],
    "additionalProperties": false
  },
  "BarList": {
    "type": "object",
    "description": "Ranked list with inline bars (typically 4..12 rows). Widths proportional to value/columnMax are computed by the renderer; null values sink last and render 'unavailable', never 0-width or 0-valued; negatives clip at 0 with a blank share. Values render via the Metric formatter (format/precision/unit). Anything already tabular belongs in DataTable.",
    "properties": {
      "id": {
        "$ref": "#/$defs/ComponentId"
      },
      "component": {
        "const": "BarList"
      },
      "accessibility": {
        "$ref": "#/$defs/Accessibility"
      },
      "sourceIds": {
        "type": "array",
        "items": {
          "type": "string",
          "maxLength": 4096
        },
        "maxItems": 32,
        "description": "Evidence links; every id must resolve in /meta/sources."
      },
      "items": {
        "description": "Up to 30 ranked rows {label, value(number|null), sourceIds?}.",
        "oneOf": [
          {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "label": {
                  "type": "string",
                  "maxLength": 4096
                },
                "value": {
                  "oneOf": [
                    {
                      "type": "number"
                    },
                    {
                      "type": "null"
                    }
                  ]
                },
                "sourceIds": {
                  "type": "array",
                  "items": {
                    "type": "string",
                    "maxLength": 4096
                  },
                  "maxItems": 32,
                  "description": "Evidence links; every id must resolve in /meta/sources."
                }
              },
              "required": [
                "label",
                "value"
              ],
              "additionalProperties": false
            },
            "maxItems": 30
          },
          {
            "$ref": "#/$defs/DataBinding"
          }
        ]
      },
      "unit": {
        "type": "string",
        "maxLength": 4096
      },
      "precision": {
        "type": "integer",
        "minimum": 0,
        "maximum": 6
      },
      "format": {
        "type": "string",
        "enum": [
          "number",
          "currency",
          "percent"
        ],
        "default": "number"
      },
      "sort": {
        "type": "string",
        "enum": [
          "desc",
          "asc",
          "none"
        ],
        "default": "desc"
      }
    },
    "required": [
      "id",
      "component",
      "items"
    ],
    "additionalProperties": false
  },
  "HeatMap": {
    "type": "object",
    "description": "rows x cols matrix as a DOM grid (max 12 rows x 12 cols, max 144 cells \u2014 the single reachable cap; no separate engine constant). The color ramp across the OBSERVED min/max is computed by the renderer; the caption prints observed min/max with the unit. null/missing cells hatch as an em-dash, never a guessed color.",
    "properties": {
      "id": {
        "$ref": "#/$defs/ComponentId"
      },
      "component": {
        "const": "HeatMap"
      },
      "accessibility": {
        "$ref": "#/$defs/Accessibility"
      },
      "sourceIds": {
        "type": "array",
        "items": {
          "type": "string",
          "maxLength": 4096
        },
        "maxItems": 32,
        "description": "Evidence links; every id must resolve in /meta/sources."
      },
      "rows": {
        "description": "Up to 12 row labels.",
        "oneOf": [
          {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "label": {
                  "type": "string",
                  "maxLength": 4096
                }
              },
              "required": [
                "label"
              ],
              "additionalProperties": false
            },
            "maxItems": 12
          },
          {
            "$ref": "#/$defs/DataBinding"
          }
        ]
      },
      "cols": {
        "description": "Up to 12 column labels.",
        "oneOf": [
          {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "label": {
                  "type": "string",
                  "maxLength": 4096
                }
              },
              "required": [
                "label"
              ],
              "additionalProperties": false
            },
            "maxItems": 12
          },
          {
            "$ref": "#/$defs/DataBinding"
          }
        ]
      },
      "cells": {
        "description": "Up to 144 cells {row, col, value(number|null)}; every row/col must name a declared label and one cell per (row, col) pair (admission rejects duplicates and dangling refs).",
        "oneOf": [
          {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "row": {
                  "type": "string",
                  "maxLength": 4096
                },
                "col": {
                  "type": "string",
                  "maxLength": 4096
                },
                "value": {
                  "oneOf": [
                    {
                      "type": "number"
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "row",
                "col"
              ],
              "additionalProperties": false
            },
            "maxItems": 144
          },
          {
            "$ref": "#/$defs/DataBinding"
          }
        ]
      },
      "unit": {
        "type": "string",
        "maxLength": 4096
      },
      "precision": {
        "type": "integer",
        "minimum": 0,
        "maximum": 6
      },
      "showValues": {
        "type": "boolean",
        "default": true
      }
    },
    "required": [
      "id",
      "component",
      "rows",
      "cols",
      "cells"
    ],
    "additionalProperties": false
  }
}
```

Also append these three refs to `$defs.anyComponent.oneOf`, after the SourceList ref:

```json
[
  {
    "$ref": "#/components/Sparkline"
  },
  {
    "$ref": "#/components/BarList"
  },
  {
    "$ref": "#/components/HeatMap"
  }
]
```

---

## 2. engine/admission.py — two pure checks + call sites (table-column-keys pattern, admission.py:633)

Paste the two functions verbatim (identical to tests/helpers/microviz_checks.py, which the
lane tests run directly — see tests/test_synth_microviz_admission.py) above `_check_leaf_specifics`,
then add ONE branch inside `_check_leaf_specifics` (next to the Chart/DataTable branches, ~line 607):

```python
    elif t == "HeatMap":
        found, rows = _resolve_prop(comp, "rows", data_model)
        if not found:
            return
        found, cols = _resolve_prop(comp, "cols", data_model)
        if not found:
            return
        found, cells = _resolve_prop(comp, "cells", data_model)
        if not found:
            return
        _check_heatmap_matrix(label, rows, cols, cells, errors)
    elif t == "Sparkline":
        _check_sparkline_values(label, comp.get("values"), comp.get("series"), errors)
```

(PUT the elifs inside the same `if t == "Chart": ... elif t == "DataTable":` chain.)

Function bodies:

```python
def _check_heatmap_matrix(label, rows, cols, cells, errors):
    """N14 (S9): cells are a closed matrix over the declared row/col labels.
    refs must be declared labels (refs subset of rows/cols) and one cell per
    (row, col) pair — duplicates reject (L4: every error names the property)."""
    if not (isinstance(rows, list) and isinstance(cols, list) and isinstance(cells, list)):
        return
    row_labels = [r.get("label") for r in rows if isinstance(r, dict)]
    col_labels = [c.get("label") for c in cols if isinstance(c, dict)]
    if len(set(row_labels)) != len(row_labels):
        errors.append("%s: /rows: duplicate row label" % label)
    if len(set(col_labels)) != len(col_labels):
        errors.append("%s: /cols: duplicate column label" % label)
    seen = set()
    for i, cell in enumerate(cells):
        if not isinstance(cell, dict):
            continue
        where = "%s: /cells/%d" % (label, i)
        r, c = cell.get("row"), cell.get("col")
        if r not in row_labels:
            errors.append("%s/row: %r is not a declared row label (cells must reference /rows)" % (where, r))
        if c not in col_labels:
            errors.append("%s/col: %r is not a declared column label (cells must reference /cols)" % (where, c))
        key = (r, c)
        if key in seen:
            errors.append("%s: duplicate cell for (row %r, col %r) — one cell per (row, col) pair" % (where, r, c))
        seen.add(key)


def _check_sparkline_values(label, values, series, errors):
    """N12: at least one of values/series must be a (literal or bound) array.
    The renderer reads values first, then series; item shapes/caps are catalog's
    (oneOf number|null, maxItems 512)."""
    if not isinstance(values, list) and not isinstance(series, list):
        errors.append("%s: /values: Sparkline requires a 'values' (or 'series') array of number|null" % label)
```

BarList needs NO leaf check (schema covers it: oneOf item shapes + maxItems 30). Its
per-item `sourceIds` DO need the collection branch below.

### _collect_source_ids — add BarList to the KeyValueList/Timeline items branch (~line 676)

Change:

```python
    if t in ("KeyValueList", "Timeline"):
```

to:

```python
    if t in ("KeyValueList", "Timeline", "BarList"):
```

(items shape `{label, value, sourceIds?}` matches the existing /items/%d/sourceIds/%d walk;
BarList cells carry no sourceIds.)

---

## 3. desktop/src/components/index.mjs — import + registry lines

Append to the import block (after the SourceList import, line 19):

```js
import { Sparkline } from './sparkline.mjs'
import { BarList } from './barlist.mjs'
import { HeatMap } from './heatmap.mjs'
```

Extend the export (line 21) from
`... Timeline, SourceList }` to:

```js
export const components = { Card, Stack, Grid, Divider, Tabs, Accordion, Heading, Text, Callout, Badge, Metric, Progress, KeyValueList, Image, DataTable, Chart, Timeline, SourceList, Sparkline, BarList, HeatMap }
```

(Update the header comment `18 types` -> `21 types`.)

---

## 4. desktop/src/lower.mjs — KNOWN_TYPES (line 14-17)

Add the three names to the set (they are leaf types — no children; `items`/`rows`/`cols`/
`cells`/`values`/`series` all flow through `props` via the generic copy, and `items` is
already re-bound at line 68 for BarList's DynamicArray):

```js
export const KNOWN_TYPES = new Set([
  'Card', 'Stack', 'Grid', 'Divider', 'Tabs', 'Accordion', 'Heading', 'Text', 'Callout', 'Badge',
  'Metric', 'Progress', 'KeyValueList', 'Image', 'DataTable', 'Chart', 'Timeline', 'SourceList',
  'Sparkline', 'BarList', 'HeatMap'
])
```

---

## 5. skill/SKILL.md — component table rows (append after row 18, keep the 18-row Chart shapes note untouched)

```
| 19 | Sparkline | values? (DynamicArray ≤512 number|null; null = gap), direction? (line|bar), width? 60..400, height? 14..48, tone? (default|success|danger) — trend chip computed, never hand-picked |
| 20 | BarList | items (DynamicArray ≤30): {label, value(number|null), sourceIds?}, unit?, precision?, format? (number|currency|percent), sort? (desc|asc|none; nulls always last, never 0) |
| 21 | HeatMap | rows ≤12 {label}, cols ≤12 {label}, cells ≤144 {row, col, value(number|null)} (refs ⊆ declared labels, one per pair — duplicates rejected), unit?, precision?, showValues? — ramp + caption min/max computed |
```

Density-law sentence to append after the table (the E15/BarList line the counsel ruled):
`A 4-12-row ranked list is a BarList, not a Chart or a DataTable; anything already tabular
(filter/paging/sources columns) stays a DataTable.`

---

## 6. skill/references/recipes.md — three recipes (each admits as written; verified against
the mini-interpreter with the entries in §1)

### KPI trend row
```json
{
  "components": [
    {
      "id": "root",
      "component": "Card",
      "title": "Throughput",
      "children": [
        "row",
        "note"
      ]
    },
    {
      "id": "row",
      "component": "Stack",
      "direction": "horizontal",
      "gap": "md",
      "children": [
        "m1",
        "sp1",
        "m2",
        "sp2"
      ]
    },
    {
      "id": "m1",
      "component": "Metric",
      "label": "Requests",
      "value": {
        "path": "/data/rps"
      },
      "unit": "rps"
    },
    {
      "id": "sp1",
      "component": "Sparkline",
      "values": {
        "path": "/data/rps_series"
      }
    },
    {
      "id": "m2",
      "component": "Metric",
      "label": "Errors",
      "value": {
        "path": "/data/err"
      },
      "unit": "%",
      "precision": 1
    },
    {
      "id": "sp2",
      "component": "Sparkline",
      "values": {
        "path": "/data/err_series"
      },
      "tone": "danger",
      "direction": "bar"
    },
    {
      "id": "note",
      "component": "Text",
      "text": "Trend chips are computed first-vs-last by the renderer.",
      "variant": "caption"
    }
  ],
  "data": {
    "rps": 1240,
    "rps_series": [
      900,
      980,
      1010,
      null,
      1150,
      1240
    ],
    "err": 0.4,
    "err_series": [
      0.9,
      0.8,
      0.6,
      null,
      0.5,
      0.4
    ]
  },
  "sources": [
    {
      "id": "s1",
      "kind": "web",
      "label": "Example metrics",
      "url": "https://example.com/metrics",
      "accessed_at": "2026-09-26T10:00:00Z"
    }
  ],
  "derivations": []
}
```

### Ranked list
```json
{
  "components": [
    {
      "id": "root",
      "component": "Card",
      "title": "Top traffic sources",
      "children": [
        "bl",
        "src"
      ]
    },
    {
      "id": "bl",
      "component": "BarList",
      "items": {
        "path": "/data/rows"
      },
      "unit": " sessions",
      "sort": "desc",
      "sourceIds": [
        "s1"
      ]
    },
    {
      "id": "src",
      "component": "SourceList"
    }
  ],
  "data": {
    "rows": [
      {
        "label": "Search",
        "value": 4820,
        "sourceIds": [
          "s1"
        ]
      },
      {
        "label": "Direct",
        "value": 2310,
        "sourceIds": [
          "s1"
        ]
      },
      {
        "label": "Referral",
        "value": null,
        "sourceIds": [
          "s1"
        ]
      }
    ]
  },
  "sources": [
    {
      "id": "s1",
      "kind": "web",
      "label": "Example metrics",
      "url": "https://example.com/metrics",
      "accessed_at": "2026-09-26T10:00:00Z"
    }
  ],
  "derivations": []
}
```

### Matrix
```json
{
  "components": [
    {
      "id": "root",
      "component": "Card",
      "title": "Build minutes by day and lane",
      "children": [
        "hm"
      ]
    },
    {
      "id": "hm",
      "component": "HeatMap",
      "rows": {
        "path": "/data/rows"
      },
      "cols": {
        "path": "/data/cols"
      },
      "cells": {
        "path": "/data/cells"
      },
      "unit": "min",
      "sourceIds": [
        "s1"
      ]
    }
  ],
  "data": {
    "rows": [
      {
        "label": "Mon"
      },
      {
        "label": "Tue"
      },
      {
        "label": "Wed"
      }
    ],
    "cols": [
      {
        "label": "lint"
      },
      {
        "label": "test"
      },
      {
        "label": "build"
      }
    ],
    "cells": [
      {
        "row": "Mon",
        "col": "lint",
        "value": 2
      },
      {
        "row": "Mon",
        "col": "test",
        "value": 9
      },
      {
        "row": "Mon",
        "col": "build",
        "value": 5
      },
      {
        "row": "Tue",
        "col": "lint",
        "value": 1
      },
      {
        "row": "Tue",
        "col": "test",
        "value": null
      },
      {
        "row": "Wed",
        "col": "build",
        "value": 7
      }
    ]
  },
  "sources": [
    {
      "id": "s1",
      "kind": "web",
      "label": "Example metrics",
      "url": "https://example.com/metrics",
      "accessed_at": "2026-09-26T10:00:00Z"
    }
  ],
  "derivations": []
}
```

---

## 7. caps constants — NONE (S4 ruling)

No new admission.py constants for this lane: `cells` cap = catalog `maxItems: 144`
(12×12, the single reachable cap); Sparkline points = `maxItems: 512`; BarList rows =
`maxItems: 30`. The renderer clamps are defense-in-depth only (sparkline.mjs MAX_POINTS=512,
barlist.mjs MAX_ITEMS=30, heatmap.mjs MAX_ROWS/MAX_COLS=12 / MAX_CELLS=144 mirror the cap).
If the integrator's drift guard wants a constant, add `MAX_HEATMAP_CELLS = 144` ONLY as an
alias consumed by nothing else — the catalog maxItems stays the enforcement point.

---

## 8. Deferred / notes for the integrator

- Lane ACCEPT runs direct-render (registerLane), per S5: full registration + admission of the
  three types must be asserted in tests/test_expansion_integration.mjs after §1-§4 merge.
  The lane's catalog entries + admission checks were exercised here through the REAL
  mini-interpreter (positives incl. bound values/items/rows/cols/cells, negatives for
  maxItems/tone-enum/width clamps/bogus props/duplicate cells/dangling refs — see
  tests/test_synth_microviz_admission.py and this manifest §1-§2).
- A `heatmap-basic.json`-style fixture could not be committed here (tests/fixtures is a shared
  seam); the §6 HeatMap recipe is the paste-ready admit-check content — add it as
  tests/fixtures/heatmap-basic.json (surface form) with the merge so it enters
  tests/test_fixtures_admit.py.
- theme tokens used: --ui-accent/--ui-green/--ui-red/--ui-text-*/--ui-bg-tertiary/--ui-stroke-tertiary
  only (L7); HeatMap ramp is `color-mix(in srgb, var(--ui-accent) N%, var(--ui-bg-tertiary))` —
  both tokens exist in this repo's palette, and the ladder follows the theme in both modes
  (bg3 dark in dark, light in light); Chromium supports color-mix in-bundle-scan-adjacent.
