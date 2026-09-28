# MANIFEST — lane L1 (admission-engine), rich-ui expansion v0.1.1

Owner: **L8 integrator** pastes everything below verbatim. This lane owns only
`tests/lanes/L1_admission_checks.py` and `tests/test_synth_admission.py`; the
shared seams (`engine/admission.py`, `catalog/hermes-rich-ui.catalog.json`)
are untouched here per the shared-seam ban. Every function below is already
implemented, tested, and byte-for-byte identical to the code in
`tests/lanes/L1_admission_checks.py` (ACCEPT: `python3
tests/test_synth_admission.py` exits 0; the full pipeline was additionally
verified in-memory against a patched copy of the catalog).

Items: **E16** (Chart cross-series x-mix, N9 `range` kind check per RATIFY
S3, `sortDesc` plumbing) and **E17** (Timeline status `failed` + date-hint
admission, honest absent status).

---

## 1. engine/admission.py

### 1.1 New functions — paste after `_check_histogram_series` (≈ line 605)

These are pure: they take resolved data and RETURN error strings (the caller
extends `errors`). When pasted into `engine/admission.py` **drop the lane
module's imports** — `_is_number`, `_resolve_prop`, `_type_of`, and
`parse_iso8601` are already module-level there. Constants go with them.

```python
# Chart kinds whose x axis is continuous (numbers or ISO-8601 timestamps).
# 'area' is the N7 kind (point shape == line); it shares the line discipline.
CONTINUOUS_X_KINDS = ("line", "area", "scatter")
# Kinds that honour the E16 sortDesc prop (renderer sorts categories, L6).
SORT_DESC_KINDS = ("bar", "histogram")
# E17: the Timeline status enum including the new 'failed' value.
TIMELINE_STATUSES = ("done", "active", "pending", "failed")
# N9 range point shape, quoted verbatim in rejection messages (L4).
RANGE_POINT_SHAPE = "{label, low: number|null, high: number|null}"


def _check_chart_x_mix(label, kind, series, data_model):
    """E16: cross-series x-type discipline for non-categorical charts.

    ``_check_line_series`` already forbids mixing numbers and ISO-8601 strings
    WITHIN one series; this closes the cross-series gap (admission.py:569-585
    neighbours): across ALL series of a continuous-x chart the resolved x
    values must not mix ISO-date strings vs numbers vs plain strings, which
    today admits and renders no chart (chart.mjs 'mixed date and numeric x
    values' fires only after publication).

    ``label`` is the component id used as the error prefix (same as the other
    per-kind checks), ``kind`` the resolved chart kind, ``series`` the raw
    component ``series`` list (per-series ``data`` may be a literal array or a
    DataBinding — resolved here via ``_resolve_prop``), and ``data_model`` the
    surface dataModel for binding resolution.

    Returns a list of error strings; the single error names the property
    ('x'), the rule, and EVERY offending series index (L4).
    """
    if kind not in CONTINUOUS_X_KINDS:
        return []
    per_series = []  # (series index, set of x type names) in ascending index order
    for i, s in enumerate(series):
        if not isinstance(s, dict):
            continue
        found, data = _resolve_prop(s, "data", data_model)
        if not found or not isinstance(data, list):
            continue
        types = set()
        for pt in data:
            if not isinstance(pt, dict) or "x" not in pt:
                continue
            x = pt["x"]
            if _is_number(x):
                types.add("number")
            elif isinstance(x, str):
                types.add("iso8601" if parse_iso8601(x) is not None else "string")
        if types:
            per_series.append((i, types))
    all_types = set()
    for _i, types in per_series:
        all_types |= types
    if len(all_types) <= 1:
        return []
    # Deterministic order: first appearance scanning series ascending, types
    # alphabetical within a series.
    order = []
    for _i, types in per_series:
        for ty in sorted(types):
            if ty in all_types and ty not in order:
                order.append(ty)
    parts = []
    for ty in order:
        idxs = [i for i, types in per_series if ty in types]
        parts.append("series %s use %s" % (idxs, ty))
    return [
        "%s: /series: chart x values mix types across series — %s; rule: every "
        "series of a %s chart must use the same x type (all finite numbers, or "
        "all ISO-8601 strings)" % (label, ", ".join(parts), kind)
    ]


def _check_range_series(series, path):
    """N9 Chart kind 'range': a sibling of ``_check_histogram_series``.

    ``series`` is ONE series' resolved point list; ``path`` is the error-path
    prefix, e.g. ``"%s: /series/%d/data" % (label, i)`` — each point error is
    ``<path>/<j>: ...`` exactly like the histogram check's points.

    Point shape (L4 messages quote it verbatim): {label, low: number|null,
    high: number|null}. Rules:
    - low and high BOTH null  -> admitted: an unavailable row (L1, renders
      "unavailable", never a midpoint).
    - EXACTLY ONE null         -> rejected, naming the low/high pair rule.
    - both present             -> must be finite numbers (non-numeric rejected
      naming the expected shape); low <= high is VALID (RATIFY S3 equality
      ruling — a zero-width interval is legal), low > high is rejected naming
      the expected shape.
    """
    errors = []
    for j, pt in enumerate(series):
        if not isinstance(pt, dict):
            continue
        low, high = pt.get("low"), pt.get("high")
        low_null, high_null = low is None, high is None
        where = "%s/%d" % (path, j)
        if low_null and high_null:
            continue  # unavailable row (L1) — never fabricate an endpoint
        if low_null or high_null:
            null_key = "low" if low_null else "high"
            other_key = "high" if low_null else "low"
            other_val = high if low_null else low
            errors.append(
                "%s: range point has %s null but %s = %r; rule: low and high "
                "must be provided together as numbers, or both null for an "
                "unavailable row — exactly-one-null is not admitted (expected "
                "shape %s)" % (where, null_key, other_key, other_val, RANGE_POINT_SHAPE)
            )
            continue
        for name, v in (("low", low), ("high", high)):
            if not _is_number(v):
                errors.append(
                    "%s: range %s must be a finite number or null, got %s "
                    "(expected shape %s)" % (where, name, _type_of(v), RANGE_POINT_SHAPE)
                )
        if _is_number(low) and _is_number(high) and low is not None and high is not None and not low <= high:
            errors.append(
                "%s: range low %r must be <= high %r; rule: low <= high "
                "(equality is a valid zero-width interval) (expected shape %s)"
                % (where, low, high, RANGE_POINT_SHAPE)
            )
    return errors


def _check_chart_sort_desc(label, comp):
    """E16: ``sortDesc`` admission plumbing (the renderer sorts categories, L6).

    A boolean ``sortDesc`` is accepted on the bar/histogram kinds ONLY; on any
    other kind the rejection names the prop and the valid kinds (L4); a
    non-boolean value is rejected naming the prop and the expected type.
    Absent sortDesc is legal (no default is injected — L1).

    The catalog gains ``sortDesc: {type: boolean}`` on Chart (MANIFEST, L8);
    this function carries the kind-interaction rule the schema cannot express.
    """
    if "sortDesc" not in comp:
        return []
    errors = []
    v = comp["sortDesc"]
    if not isinstance(v, bool):
        errors.append(
            "%s: /sortDesc: sortDesc must be a boolean, got %s" % (label, _type_of(v))
        )
    kind = comp.get("kind")
    if kind not in SORT_DESC_KINDS:
        errors.append(
            "%s: /sortDesc: sortDesc is only valid on chart kinds %s, got kind %r "
            "(rule: sortDesc sorts categories, which only bar and histogram have)"
            % (label, list(SORT_DESC_KINDS), kind)
        )
    return errors


def _check_timeline_dates(items, path):
    """E17: Timeline date-hint + status admission (rules the schema can't say).

    ``items`` is the resolved Timeline item list (literal or bound); ``path``
    is the error prefix, e.g. ``"%s: /items" % label`` — each error is
    ``<path>/<j>/<key>: ...``.

    - ``date`` is optional. When present it must be a string: an ISO-8601
      string (``parse_iso8601`` accepts it — the renderer auto-formats) or a
      NON-ISO string, which PASSES THROUGH verbatim (the renderer prints it
      as-is; admission never rewrites it, L1). An empty or whitespace-only
      date is rejected, naming the item index (L4).
    - ``status`` is optional; when present it must be one of
      ``TIMELINE_STATUSES`` (including the new 'failed'). An ABSENT status is
      legal and stays absent — admission never injects a default (the neutral
      rendering is the renderer's job, never an invented 'pending', L1).
    """
    errors = []
    for j, it in enumerate(items):
        if not isinstance(it, dict):
            continue
        if "date" in it and it["date"] is not None:
            d = it["date"]
            where = "%s/%d/date" % (path, j)
            if not isinstance(d, str):
                errors.append(
                    "%s: item %d date must be a string (ISO-8601 or a verbatim "
                    "label), got %s" % (where, j, _type_of(d))
                )
            elif not d.strip():
                errors.append(
                    "%s: item %d has an empty date string; rule: date is "
                    "omitted, an ISO-8601 string (auto-formatted), or a "
                    "non-empty verbatim string" % (where, j)
                )
            # non-ISO, non-empty: passes through verbatim (no rejection)
        if "status" in it and it["status"] is not None:
            st = it["status"]
            if not isinstance(st, str) or st not in TIMELINE_STATUSES:
                where = "%s/%d/status" % (path, j)
                errors.append(
                    "%s: item %d status %r is not one of %s; rule: status is "
                    "omitted (rendered neutral, never invented) or one of the "
                    "enum values" % (where, j, st, list(TIMELINE_STATUSES))
                )
    return errors
```

### 1.2 Call sites — inside `_check_leaf_specifics` (≈ line 607)

**Chart branch.** The current head of the branch is:

```python
    if t == "Chart":
        kind = comp.get("kind")
        shape = catalog["$defs"].get("ChartPoint_%s" % kind)
        series = comp.get("series")
        if not shape or not isinstance(series, list):
            return
```

Replace it with (the two `errors.extend` lines are the E16 additions;
everything below is unchanged existing code):

```python
    if t == "Chart":
        kind = comp.get("kind")
        series = comp.get("series")
        # E16: sortDesc prop rule + cross-series x-type discipline (L4 errors).
        errors.extend(_check_chart_sort_desc(label, comp))
        if isinstance(series, list):
            errors.extend(_check_chart_x_mix(label, kind, series, data_model))
        shape = catalog["$defs"].get("ChartPoint_%s" % kind)
        if not shape or not isinstance(series, list):
            return
```

**Per-kind dispatch.** The existing chain inside the per-series loop ends:

```python
            if kind == "line":
                _check_line_series(label, i, data, errors)
            elif kind == "histogram":
                _check_histogram_series(label, i, data, errors)
```

Append the N9 `range` sibling (uses the `(series, path)` signature — point
indices are appended inside the function, mirroring histogram point errors):

```python
            elif kind == "range":
                errors.extend(_check_range_series(data, "%s: /series/%d/data" % (label, i)))
```

**Timeline branch.** `_check_leaf_specifics` currently ends its `if/elif`
chain with the `DataTable` branch. Add a new sibling branch after it (at the
same indentation as `elif t == "DataTable":`):

```python
    elif t == "Timeline":
        # E17: date-hint + status rules; absent status is never fabricated (L1).
        found, items = _resolve_prop(comp, "items", data_model)
        if found and isinstance(items, list):
            errors.extend(_check_timeline_dates(items, "%s: /items" % label))
```

No other admission.py changes. Note: the x-mix check is safe against hostile
payloads (type-guards everything, resolves bindings only via the existing
`_resolve_prop`), and `bar`/`histogram`/`range` are exempt (categorical axis).
`area` is included in `CONTINUOUS_X_KINDS` so the L2 `area` kind inherits the
discipline with zero extra code.

---

## 2. catalog/hermes-rich-ui.catalog.json (additive only; L8)

### 2.1 `components.Chart.properties.kind.enum` — add `"range"`

```json
"kind": { "type": "string", "enum": ["bar", "line", "histogram", "scatter", "range"] }
```

(L2's manifest adds `"area"` in the same edit; the merged enum is
`["bar", "line", "histogram", "scatter", "area", "range"]`. `"range"` is
L1's delta.)

### 2.2 New `$defs.ChartPoint_range` (sibling of ChartPoint_histogram)

```json
"ChartPoint_range": {
  "type": "object",
  "properties": {
    "label": { "type": "string", "maxLength": 4096 },
    "low":  { "oneOf": [ { "type": "number" }, { "type": "null" } ] },
    "high": { "oneOf": [ { "type": "number" }, { "type": "null" } ] }
  },
  "required": ["label", "low", "high"],
  "additionalProperties": false,
  "description": "range point: {label, low: number|null, high: number|null}; low <= high (equality allowed, RATIFY S3); both null renders 'unavailable' — exactly-one-null is rejected."
}
```

Both keys are required-but-nullable: "absent" is not a legal third state
(keeps L2/L3 closed grammar); the renderer's DataAlt shows both endpoints and
never a midpoint (L1, L2 lane's job). `low <= high`, exactly-one-null, and
non-numeric rules are enforced by `_check_range_series` (the schema cannot
express them); the `number`-type violations also fail the `oneOf` above, so
rejections double-cover, and every admission error names property + rule (L4).
Series caps are inherited (≤4 series, ≤512 points — S's N9 constraint).

### 2.3 `components.Chart.properties.sortDesc` — new boolean prop

Add to `components.Chart.properties` (alongside `caveat`):

```json
"sortDesc": {
  "type": "boolean",
  "description": "Sort bar/histogram categories descending in the renderer (L6 — never hand-sort series). Only valid on kind bar/histogram; other kinds rejected at admission naming the valid kinds."
}
```

No `default` key — absent must stay absent through normalization (L1). The
kind-interaction rule lives in `_check_chart_sort_desc` (JSON Schema cannot
express cross-property rules). The renderer half (label-keyed sort,
chart.mjs:103-123) is the L2 lane's manifest.

### 2.4 Timeline status enum — add `"failed"`

`components.Timeline.properties.items.oneOf[0].items.properties.status.enum`:

```json
"status": { "type": "string", "enum": ["done", "active", "pending", "failed"] }
```

This is the merge that makes `python3 tests/test_synth_admission.py`'s
"current catalog rejects status failed (L8 merge pending)" case obsolete —
after merging, that `rejects(...)` case in the test flips to `admits(...)`;
the module-level check already admits `failed` (pinned). The `date` property
stays `{"type": "string", "maxLength": 4096}`: the schema rejects non-strings
with "expected string"; `_check_timeline_dates` adds the empty/whitespace
rejection naming the item index and the (non-rejecting) ISO pass-through
documentation, and re-checks status for belt-and-braces — duplicate errors
are acceptable; rejection correctness is what matters (L3).

---

## 3. Other seams (for L8's awareness; not owned by this lane)

- **lower.mjs / index.mjs**: no changes — `Chart`/`Timeline` already
  registered; `sortDesc` is a plain flat prop (lower.mjs maps flat props →
  element.props automatically); `range` is a Chart kind value, not a type.
- **surface-all-types.json / compat fixture**: RATIFY E16 row asks L8 for a
  compat fixture proving old malformed saved cards (cross-series x-mix) keep
  the renderer's existing no-data state; admission now rejects such cards
  only at NEW admission time — already-published surfaces are unaffected.
- **tests/test_admission.py**: re-run green (80 assertions, 0 failed) with
  this lane's files present; nothing existing edited.

## 4. Lane tests (this lane owns; ACCEPT)

- `tests/lanes/L1_admission_checks.py` — the four pure check functions +
  constants (identical source to §1.1 minus the module imports).
- `tests/test_synth_admission.py` — 41 checks: `admit()`-level regression
  cases via `tests/helpers/admit.py` (existing types still admit; absent
  Timeline status never fabricated; non-ISO date passes full admit; current
  catalog still rejects `failed` pre-merge) plus direct cases for every rule
  above (x-mix names series indices; consistent x admits; range truth table
  incl. S3 equality + both-null + exactly-one-null + non-numeric; sortDesc
  truth table incl. unknown-kind naming valid kinds; timeline date/status
  truth table). `python3 tests/test_synth_admission.py` exits 0.
