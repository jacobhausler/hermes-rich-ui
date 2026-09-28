# MANIFEST — lane L7 (existing-components E-pack), branch exp/L7-epack

Integrator (L8) merge list. Every renderer change is already committed on this branch;
these are the SHARED-SEAM deltas (catalog JSON + one admission.py branch). All additive;
catalog stays `hermes-rich-ui/1` (L8 law: no renames, no removals).

## 1. catalog/hermes-rich-ui.catalog.json — full replacement entries (additionalProperties:false kept)

Replace `components.<Name>` with each fragment below (generated mechanically from the
committed 0.1.0 catalog + this lane's prop deltas — the only changed keys are listed in
the summary first, then the FULL entry to paste):

- Card: + `footer` (DynamicString)
- Stack: + `align` (enum start|center|end)
- Divider: + `orientation` (enum horizontal|vertical, default horizontal)
- Tabs: + `defaultTab` (integer 0..7, matches tabs maxItems 8; renderer clamps)
- Heading: `level.enum` -> [1,2,3,4] (size 12 in the renderer SIZE map)
- Text: `variant.enum` -> [body, caption, mono]
- Callout: `tone.enum` -> [info, caution, success, error] (tone STAYS required, S-E9)
- Metric: + `previous` (NullableDynamicNumber) + `invertTone` (boolean)
- Progress: + `target` (NullableDynamicNumber) + `unit` (string)
- KeyValueList: items[] + `format`/`unit`/`precision`
- DataTable: columns[].type enum + `bar`; + `defaultSort` {key,dir}
- Timeline: items[].status enum + `failed`  (catalog is shared — if admit() rejects
  `failed` pre-merge, the renderer already pins it: tests/test_synth_table.mjs E17)

```json
{
 "Card": {
  "type": "object",
  "description": "Container with an optional title/subtitle; the usual root. Expands beyond the initial 480 px cap on user click.",
  "properties": {
   "id": {
    "$ref": "#/$defs/ComponentId"
   },
   "component": {
    "const": "Card"
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
   "title": {
    "$ref": "#/$defs/DynamicString"
   },
   "subtitle": {
    "$ref": "#/$defs/DynamicString"
   },
   "children": {
    "type": "array",
    "items": {
     "$ref": "#/$defs/ComponentId"
    },
    "minItems": 1,
    "maxItems": 32,
    "description": "Ordered child component ids (1..32). Each id may be used by exactly one parent."
   },
   "footer": {
    "$ref": "#/$defs/DynamicString",
    "description": "E1: caption line rendered under children (replaces the trailing Text variant=caption + its id ceremony)."
   }
  },
  "required": [
   "id",
   "component",
   "children"
  ],
  "additionalProperties": false
 },
 "Stack": {
  "type": "object",
  "description": "Linear layout container.",
  "properties": {
   "id": {
    "$ref": "#/$defs/ComponentId"
   },
   "component": {
    "const": "Stack"
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
   "direction": {
    "type": "string",
    "enum": [
     "vertical",
     "horizontal"
    ],
    "default": "vertical"
   },
   "gap": {
    "type": "string",
    "enum": [
     "none",
     "sm",
     "md",
     "lg"
    ],
    "default": "md",
    "description": "Spacing between children."
   },
   "children": {
    "type": "array",
    "items": {
     "$ref": "#/$defs/ComponentId"
    },
    "minItems": 1,
    "maxItems": 32,
    "description": "Ordered child component ids (1..32). Each id may be used by exactly one parent."
   },
   "align": {
    "type": "string",
    "enum": [
     "start",
     "center",
     "end"
    ],
    "description": "E2: cross-axis alignment. ABSENT keeps the direction defaults (vertical stretch / horizontal flex-start)."
   }
  },
  "required": [
   "id",
   "component",
   "children"
  ],
  "additionalProperties": false
 },
 "Divider": {
  "type": "object",
  "description": "Horizontal rule with an optional label.",
  "properties": {
   "id": {
    "$ref": "#/$defs/ComponentId"
   },
   "component": {
    "const": "Divider"
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
   "label": {
    "type": "string",
    "maxLength": 4096
   },
   "orientation": {
    "type": "string",
    "enum": [
     "horizontal",
     "vertical"
    ],
    "default": "horizontal",
    "description": "E4: vertical is a 1px-wide full-height rule for horizontal Stacks (not the floating 1px stub)."
   }
  },
  "required": [
   "id",
   "component"
  ],
  "additionalProperties": false
 },
 "Tabs": {
  "type": "object",
  "description": "Tabbed container; each tab shows exactly one child component.",
  "properties": {
   "id": {
    "$ref": "#/$defs/ComponentId"
   },
   "component": {
    "const": "Tabs"
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
   "tabs": {
    "type": "array",
    "minItems": 1,
    "maxItems": 8,
    "items": {
     "type": "object",
     "properties": {
      "title": {
       "$ref": "#/$defs/DynamicString"
      },
      "child": {
       "$ref": "#/$defs/ComponentId"
      }
     },
     "required": [
      "title",
      "child"
     ],
     "additionalProperties": false
    }
   },
   "defaultTab": {
    "type": "integer",
    "minimum": 0,
    "maximum": 7,
    "description": "E5: seed tab index. Out-of-range values are clamped into range by the renderer (min/max here name the bound; tabs has maxItems 8)."
   }
  },
  "required": [
   "id",
   "component",
   "tabs"
  ],
  "additionalProperties": false
 },
 "Heading": {
  "type": "object",
  "description": "Section heading.",
  "properties": {
   "id": {
    "$ref": "#/$defs/ComponentId"
   },
   "component": {
    "const": "Heading"
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
   "text": {
    "$ref": "#/$defs/DynamicString"
   },
   "level": {
    "type": "integer",
    "enum": [
     1,
     2,
     3,
     4
    ],
    "default": 2
   }
  },
  "required": [
   "id",
   "component",
   "text"
  ],
  "additionalProperties": false
 },
 "Text": {
  "type": "object",
  "description": "Plain text paragraph. Newlines are kept; no markdown, no HTML.",
  "properties": {
   "id": {
    "$ref": "#/$defs/ComponentId"
   },
   "component": {
    "const": "Text"
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
   "text": {
    "$ref": "#/$defs/DynamicString"
   },
   "tone": {
    "type": "string",
    "enum": [
     "default",
     "muted"
    ],
    "default": "default"
   },
   "variant": {
    "type": "string",
    "enum": [
     "body",
     "caption",
     "mono"
    ],
    "default": "body"
   }
  },
  "required": [
   "id",
   "component",
   "text"
  ],
  "additionalProperties": false
 },
 "Callout": {
  "type": "object",
  "description": "Emphasised note (takeaway, caveat, confirmation).",
  "properties": {
   "id": {
    "$ref": "#/$defs/ComponentId"
   },
   "component": {
    "const": "Callout"
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
   "title": {
    "$ref": "#/$defs/DynamicString"
   },
   "text": {
    "$ref": "#/$defs/DynamicString"
   },
   "tone": {
    "type": "string",
    "enum": [
     "info",
     "caution",
     "success",
     "error"
    ]
   }
  },
  "required": [
   "id",
   "component",
   "text",
   "tone"
  ],
  "additionalProperties": false
 },
 "Metric": {
  "type": "object",
  "description": "Single number with label. null renders as unavailable, never as 0.",
  "properties": {
   "id": {
    "$ref": "#/$defs/ComponentId"
   },
   "component": {
    "const": "Metric"
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
   "label": {
    "type": "string",
    "maxLength": 4096
   },
   "value": {
    "$ref": "#/$defs/NullableDynamicNumber"
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
   "previous": {
    "$ref": "#/$defs/NullableDynamicNumber",
    "description": "E11: prior-period value. The RENDERER computes delta and percent-delta (L6): null previous or null value renders NO delta row; previous 0 renders percent as unavailable, never inf/100% (RATIFY S9)."
   },
   "invertTone": {
    "type": "boolean",
    "default": false,
    "description": "E11: lower-is-better metrics (costs): up renders red, down green. Default false = neutral direction tone mapping."
   }
  },
  "required": [
   "id",
   "component",
   "label",
   "value"
  ],
  "additionalProperties": false
 },
 "Progress": {
  "type": "object",
  "description": "Progress bar; missing/null total or current renders indeterminate.",
  "properties": {
   "id": {
    "$ref": "#/$defs/ComponentId"
   },
   "component": {
    "const": "Progress"
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
   "label": {
    "type": "string",
    "maxLength": 4096
   },
   "current": {
    "$ref": "#/$defs/NullableDynamicNumber"
   },
   "total": {
    "$ref": "#/$defs/NullableDynamicNumber"
   },
   "target": {
    "$ref": "#/$defs/NullableDynamicNumber",
    "description": "E12: target tick + 'vs target' counter line. target greater than total names the relation instead of silently clamping the display."
   },
   "unit": {
    "type": "string",
    "maxLength": 4096,
    "description": "E12: unit suffix for the current/total counter (ends unitless '73 / 100')."
   }
  },
  "required": [
   "id",
   "component",
   "current"
  ],
  "additionalProperties": false
 },
 "KeyValueList": {
  "type": "object",
  "description": "Definition list of label/value pairs.",
  "properties": {
   "id": {
    "$ref": "#/$defs/ComponentId"
   },
   "component": {
    "const": "KeyValueList"
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
    "description": "Up to 32 label/value pairs (literal or bound).",
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
           "type": "string",
           "maxLength": 4096
          },
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
        },
        "format": {
         "type": "string",
         "enum": [
          "number",
          "currency",
          "percent"
         ],
         "description": "E13: routed through formatMetric ONLY when value is a JSON number; any string value + format renders the raw string verbatim (never coerced, L1)."
        },
        "unit": {
         "type": "string",
         "maxLength": 4096
        },
        "precision": {
         "type": "integer",
         "minimum": 0,
         "maximum": 6
        }
       },
       "required": [
        "label",
        "value"
       ],
       "additionalProperties": false
      },
      "maxItems": 32
     },
     {
      "$ref": "#/$defs/DataBinding"
     }
    ]
   }
  },
  "required": [
   "id",
   "component",
   "items"
  ],
  "additionalProperties": false
 },
 "DataTable": {
  "type": "object",
  "description": "Sortable/filterable/paged table (local interaction only). Null never sorts as 0.",
  "properties": {
   "id": {
    "$ref": "#/$defs/ComponentId"
   },
   "component": {
    "const": "DataTable"
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
   "title": {
    "type": "string",
    "maxLength": 4096
   },
   "columns": {
    "type": "array",
    "minItems": 1,
    "maxItems": 12,
    "items": {
     "type": "object",
     "properties": {
      "key": {
       "type": "string",
       "minLength": 1,
       "maxLength": 128,
       "pattern": "^[A-Za-z0-9_.:-]{1,128}$",
       "description": "Row key this column reads. A `sources` column reads a string[] of source ids under THIS key (REVIEW-C0 E11)."
      },
      "label": {
       "type": "string",
       "maxLength": 4096
      },
      "type": {
       "type": "string",
       "enum": [
        "text",
        "number",
        "currency",
        "percent",
        "date",
        "sources",
        "bar"
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
      }
     },
     "required": [
      "key",
      "label",
      "type"
     ],
     "additionalProperties": false
    }
   },
   "rows": {
    "description": "Up to 100 row objects whose keys are declared column keys; cells are finite scalars. For a column of type `sources` the cell under that column's key is a string[] of source ids, each resolving in /meta/sources (dangling ids reject).",
    "oneOf": [
     {
      "type": "array",
      "items": {
       "type": "object"
      },
      "maxItems": 100
     },
     {
      "$ref": "#/$defs/DataBinding"
     }
    ]
   },
   "pageSize": {
    "type": "integer",
    "minimum": 5,
    "maximum": 50
   },
   "defaultSort": {
    "type": "object",
    "properties": {
     "key": {
      "type": "string"
     },
     "dir": {
      "type": "string",
      "enum": [
       "asc",
       "desc"
      ]
     }
    },
    "required": [
     "key",
     "dir"
    ],
    "additionalProperties": false,
    "description": "E15: seed sort (deletes agent pre-sorting). Unknown key falls back to unsorted. Nulls sort last in both directions; nonnumeric cells never Number()-coerced."
   }
  },
  "required": [
   "id",
   "component",
   "columns",
   "rows"
  ],
  "additionalProperties": false
 },
 "Timeline": {
  "type": "object",
  "description": "Ordered list of dated/status steps.",
  "properties": {
   "id": {
    "$ref": "#/$defs/ComponentId"
   },
   "component": {
    "const": "Timeline"
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
   "title": {
    "type": "string",
    "maxLength": 4096
   },
   "items": {
    "description": "Up to 30 items (literal or bound).",
    "oneOf": [
     {
      "type": "array",
      "items": {
       "type": "object",
       "properties": {
        "date": {
         "type": "string",
         "maxLength": 4096
        },
        "label": {
         "type": "string",
         "maxLength": 4096
        },
        "text": {
         "type": "string",
         "maxLength": 4096
        },
        "status": {
         "type": "string",
         "enum": [
          "done",
          "active",
          "pending",
          "failed"
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
        "label"
       ],
       "additionalProperties": false
      },
      "maxItems": 30
     },
     {
      "$ref": "#/$defs/DataBinding"
     }
    ]
   }
  },
  "required": [
   "id",
   "component",
   "items"
  ],
  "additionalProperties": false
 }
}
```

## 2. engine/admission.py — E15/S10 bar-column row-level check (RATIFY S10)

Inside the `elif t == "DataTable":` block of the shape-check function (~line 653, the
per-row cell loop `for k, v in row.items():`), add the `bar` branch BEFORE the generic
scalar branch. Mirrors the tested pure helper `barColumnViolations(rows, key)` exported
from desktop/src/components/table.mjs (row-level numeric-or-null, NOT self-referential
type==bar). `_is_number` already exists (admission.py:153):

```python
                if kinds[k] == "sources":
                    # ... existing sources branch unchanged ...
                elif kinds[k] == "bar":
                    # E15/S10: every cell under a bar column's declared key must be a
                    # finite number or null (null renders 'unavailable', never 0-width).
                    if not (_is_number(v) or v is None):
                        errors.append("%s: row %d column '%s' (bar) must be a finite number or null, got %r" % (label, i, k, type(v).__name__))
                elif isinstance(v, (dict, list)):
                    # ... existing scalar branch unchanged ...
```

(The renderer-side unit test for this rule is
tests/test_synth_table.mjs::'E15/S10 barColumnViolations checks ROW VALUES'.)

## 3. E18 SourceList — VERIFIED HONEST LEAVE (F7 ruling), zero code

F7 says sourcelist.mjs:49 already prints accessed_at. VERIFIED TRUE on this branch:
desktop/src/components/sourcelist.mjs:49 renders
`s.accessed_at ? jsx('span', { style: { color: V.text3, fontSize: 11 }, children: String(s.accessed_at) }, 'd') : null`,
and `accessed_at` is a legal SOURCE_KEYS field (engine/admission.py:80). The SYNTHESIS
E18 premise ('a legal schema field that sourcelist.mjs never prints') is FALSE — the
field is rendered as a caption span after the URL/kind badge. No sourcelist.mjs change
made; nothing to merge for E18. (This matches the F7 honest-leave ruling.)

## 4. E3 Grid / E6 Accordion — named leaves (ratified), zero code.

## 5. No changes needed (deliberate)

- index.mjs / lower.mjs KNOWN_TYPES / fixtures / SKILL.md / recipes.md: every E-pack
  change is a PROP on an existing registered type — no new types, no registry churn.
  SKILL.md authors' note worth adding (optional, L8's call): Metric delta is
  renderer-computed (never hand-compute deltas, L6); Progress target must be <= total.
- tests/test_components.mjs untouched; all pre-existing assertions pass unmodified
  (defaults byte-preserve old render output — L8 pins are inside the synth tests).

## 6. Renderer files changed on this branch (already committed, NOT shared seams)

card.mjs(E1) stack.mjs(E2) divider.mjs(E4) tabs.mjs(E5) heading.mjs(E7) text.mjs(E8)
callout.mjs(E9) metric.mjs(E11 +S9) progress.mjs(E12) keyvaluelist.mjs(E13 +verbatim
pin) table.mjs(E15 +S10 helper +defaultSort) timeline.mjs(E17 +failed/ISO/unclassified)

New lane tests: tests/test_synth_layout.mjs, test_synth_text_enums.mjs,
test_synth_fmt.mjs, test_synth_table.mjs (ACCEPT:
`node --test tests/test_synth_layout.mjs tests/test_synth_text_enums.mjs tests/test_synth_fmt.mjs tests/test_synth_table.mjs && node --test tests/test_components.mjs tests/test_lower.mjs`).
