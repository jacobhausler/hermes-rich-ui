# MANIFEST — lane L2 (chart-engine) → integrator L8

Lane branch: `exp/L2-chart`. Renderer work is DONE in
`desktop/src/components/chart.mjs` (sole writer: L2). This file is the
paste-ready delta for the seams L2 may not touch: **catalog
`hermes-rich-ui.catalog.json`** (and the optional admission sibling noted at
the bottom, which RATIFY S3 co-assigns to L1 — merge only ONE copy).

## 1. Catalog — `components.Chart.properties.kind.enum`

Replace the existing enum (currently `["bar","line","histogram","scatter"]`):

```json
"kind": {
  "type": "string",
  "enum": ["bar", "line", "histogram", "scatter", "area", "waterfall", "range"]
}
```

## 2. Catalog — new Chart props (all optional; keep
`"additionalProperties": false` on the Chart component object unchanged)

```json
"stack": {
  "type": "boolean",
  "description": "bar/area only: renderer-computed cumulative stacking (no agent-precomputed baselines). Rejected on other kinds."
},
"stepped": {
  "type": "boolean",
  "description": "line only: value holds until the next observation; no interpolation or extension past the last point."
},
"sortDesc": {
  "type": "boolean",
  "description": "bar/histogram only: categories stay label-keyed, ordered by summed |value| desc (computed by the renderer)."
},
"height": {
  "type": "integer",
  "minimum": 120,
  "maximum": 480,
  "description": "Chart height in px; renderer clamps 120..480, default 240."
}
```

## 3. Catalog — `$defs` additions (place next to `ChartPoint_line`)

`area` is a pure `$ref` alias to the line point def (ratified Q ruling: no
new point def — admission inherits the line checks verbatim):

```json
"ChartPoint_area": {
  "$ref": "#/$defs/ChartPoint_line",
  "description": "area point: identical shape to line — x is a finite number or an ISO-8601 string (never mixed within one series); y is a finite number or null (gap)."
}
```

```json
"ChartPoint_waterfall": {
  "type": "object",
  "properties": {
    "label": { "type": "string", "maxLength": 4096 },
    "value": {
      "oneOf": [ { "type": "number" }, { "type": "null" } ]
    },
    "total": { "type": "boolean" }
  },
  "required": ["label", "value"],
  "additionalProperties": false,
  "description": "waterfall step: signed value (e.g. +100 revenue, -40 cost); the running baseline is computed by the renderer, never by the author. total:true pins that bar's base to 0 (its value may be null — the renderer owns the sum). Sign convention: increases positive, decreases negative."
}
```

```json
"ChartPoint_range": {
  "type": "object",
  "properties": {
    "label": { "type": "string", "maxLength": 4096 },
    "low": {
      "oneOf": [ { "type": "number" }, { "type": "null" } ]
    },
    "high": {
      "oneOf": [ { "type": "number" }, { "type": "null" } ]
    }
  },
  "required": ["label", "low", "high"],
  "additionalProperties": false,
  "description": "range interval: low and high provided TOGETHER as finite numbers with low <= high, or both null (unavailable — never a midpoint). Label what the endpoints mean in the title/caveat; these are not confidence intervals."
}
```

No other catalog edit is needed: the `series` entry (≤4 series, data ≤512
items or DataBinding) already covers the new kinds, and
`_check_leaf_specifics` validates each point against
`catalog["$defs"]["ChartPoint_%s" % kind]` automatically — so `area` inherits
`_check_line_series` (the shape check passes, then the kind-`line` branch runs
the ISO/number mix rule; see §4 note) with zero new per-type code.

## 4. Admission (admission.py) — optional sibling; S3 co-assigns to L1

The ratified N9 equality/both-or-neither rule (`_check_range_series`, sibling
of `_check_histogram_series` at admission.py:588). **If L1's lane ships this
in its manifest, merge only one copy.** Paste-ready:

```python
def _check_range_series(label, i, data, errors):
    """Range endpoints come as a pair: both finite (low <= high) or both null."""
    for j, pt in enumerate(data):
        if not isinstance(pt, dict):
            continue
        low, high = pt.get("low"), pt.get("high")
        where = "%s: /series/%d/data/%d" % (label, i, j)
        if (low is None) != (high is None):
            errors.append("%s: range endpoints must be provided together (both numeric or both null), got low=%r high=%r" % (where, low, high))
            continue
        if _is_number(low) and _is_number(high) and not low <= high:
            errors.append("%s: range low %r must be <= high %r" % (where, low, high))
```

Wire it in `_check_leaf_specifics`' kind dispatch (next to the
`elif kind == "histogram":` arm):

```python
            elif kind == "range":
                _check_range_series(label, i, data, errors)
```

Stack kind-gating (reject `stack` on non-bar/area kinds, naming valid kinds —
L4) is likewise a leaf-specific check; suggested text:

```python
        if comp.get("stack") is True and kind not in ("bar", "area"):
            errors.append("%s: /stack: valid only for kind bar or area, got %r" % (label, kind))
        if comp.get("stepped") is True and kind != "line":
            errors.append("%s: /stepped: valid only for kind line, got %r" % (label, kind))
        if comp.get("sortDesc") is True and kind not in ("bar", "histogram"):
            errors.append("%s: /sortDesc: valid only for kind bar or histogram, got %r" % (label, kind))
```

(area inherits line's x-type mix rule via the generic shape pass +
`_check_line_series` ONLY when `kind == "line"`; if you want the same rule for
`area`, extend that arm to `if kind in ("line", "area"):` — recommended, one
token, no new code.)

## 5. SKILL.md row (for the L8 SKILL merge)

| Chart kind/prop | Use when | Notes |
|---|---|---|
| `kind: "area"` | continuous volume over time (the #1 bar-misfire fix) | same points as line; fill toward zero; mixed-sign series split at zero |
| `kind: "waterfall"` | budget/P&L/variance walks | author supplies signed steps; renderer computes the running baseline (`total:true` pins a bar to 0) |
| `kind: "range"` | low–high bands (price/latency windows) | endpoints required together, `low<=high`; both-null renders unavailable, never a midpoint; label what the endpoints mean |
| `stack: true` | composition over time (bar/area) | renderer stacks; never pre-compute cumulative series by hand |
| `stepped: true` | state/level changes (line) | value holds; no interpolation after the last point |
| `sortDesc: true` | ranked categories (bar/histogram) | renderer sorts label-keyed by summed \|value\| desc; never hand-sort series |
| `height` | compact/embedded charts | integer 120..480 px, default 240 (renderer clamps) |

## 6. No other seams

- `desktop/src/components/index.mjs`: NO change (Chart already registered).
- `desktop/src/lower.mjs` KNOWN_TYPES: NO change (Chart already listed).
- `tests/fixtures/surface-all-types.json`: NO change required.
- New fixtures (shipped by this lane): `tests/fixtures/chart-area.json`,
  `chart-waterfall.json`, `chart-range.json`. They ADMIT only after §1–§3 are
  merged (until then `python3 tests/test_fixtures_admit.py` reports exactly
  those three as unknown-kind FAILs — expected pre-merge state).
