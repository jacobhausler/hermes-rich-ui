"""L1 admission lane — additive checks for E16 (Chart) and E17 (Timeline), v0.1.1.

Self-contained PURE functions (they return lists of error strings; they never
mutate their inputs), written to match the idiom of ``_check_histogram_series``
in ``engine/admission.py``. ``engine/admission.py`` is a shared seam this lane
may not edit: the integrator (L8) pastes these functions verbatim per
``MANIFEST.md`` (worktree root), which gives the exact call sites inside
``_check_leaf_specifics`` and the catalog JSON deltas.

House laws honoured here:
- L1: nulls stay null — a range row with both endpoints null is an
  "unavailable" row and is admitted; an absent Timeline status is never
  invented. No value is fabricated or defaulted.
- L3: admission never trusts the payload; every rejection is at admission time,
  not render time.
- L4: every error names the offending property (JSON pointer + key) and the
  rule it breaks.
"""
from __future__ import annotations

import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from engine.admission import _is_number, _resolve_prop, _type_of, parse_iso8601  # noqa: E402

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
