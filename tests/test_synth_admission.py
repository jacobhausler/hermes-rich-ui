"""L1 admission lane — synth tests for E16 (Chart) + E17 (Timeline).

Run from the worktree root:  python3 tests/test_synth_admission.py  (exit 0 = green)

Two layers:
  * admit()-level cases via tests/helpers/admit.py (existing catalog types
    still admit through the real admission pipeline, byte-stable inputs);
  * module-level cases calling the pure check functions in
    tests/lanes/L1_admission_checks.py — the paste-ready code L8 merges into
    engine/admission.py (shared seam; not edited by this lane). The Timeline
    'failed' status lives in the catalog enum (also an L8 merge), so its
    admission logic is proven at module level, per the lane rules.
"""
from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "tests"))

from helpers.admit import check, admits, rejects, finish  # noqa: E402
from lanes.L1_admission_checks import (  # noqa: E402
    _check_chart_sort_desc,
    _check_chart_x_mix,
    _check_range_series,
    _check_timeline_dates,
)


def dm(data=None, sources=None):
    return {
        "data": data if data is not None else {},
        "meta": {
            "summary": "synthetic test",
            "authored_at": "2026-09-27T00:00:00Z",
            "sources": sources if sources is not None else [
                {"id": "s1", "kind": "web", "label": "S1", "url": "https://example.org/x"}
            ],
            "derivations": [],
        },
    }


def chart(**extra):
    c = {"id": "root", "component": "Chart", "kind": "bar",
         "series": [{"label": "a", "data": [{"label": "x", "value": 1}]}]}
    c.update(extra)
    return [c]


def timeline(items, cid="tl"):
    return [
        {"id": "root", "component": "Card", "title": "T", "children": [cid]},
        {"id": cid, "component": "Timeline", "items": items},
    ]


# ------------------------------------------------------ admit()-level: no regressions
admits("existing bar chart admits", chart(), dm())
admits("existing line chart admits",
       chart(kind="line", series=[{"label": "a", "data": [
           {"x": "2026-01-01T00:00:00Z", "y": 1.0},
           {"x": "2026-01-02T00:00:00Z", "y": 2.0}]}]), dm())
admits("existing timeline admits (status pending, ISO date)",
       timeline([{"date": "2026-01-01T00:00:00Z", "label": "L", "status": "pending"}]), dm())
admits("timeline non-ISO date passes full admit",
       timeline([{"date": "last tuesday", "label": "L"}]), dm())

# absent status stays absent through admission — never fabricated (L1)
_norm = admits("timeline absent status admits", timeline([{"label": "L"}]), dm())
_tl = next(c for c in _norm if c.get("component") == "Timeline")
check("admission never fabricates status",
      all("status" not in it for it in _tl["items"]), _tl["items"])

# catalog enum += 'failed' merged in v0.1.1 (L8): the merged state ADMITS it.
admits("catalog admits status failed (v0.1.1)",
       timeline([{"label": "L", "status": "failed"}]), dm())

# --------------------------------------------- module-level: E16 cross-series x-mix
_mix = [
    {"label": "a", "data": [{"x": "2026-01-01T00:00:00Z", "y": 1.0}]},
    {"label": "b", "data": [{"x": 1735689600, "y": 2.0}]},
]
errs = _check_chart_x_mix("c1", "line", _mix, dm())
check("x-mix rejected", len(errs) == 1, errs)
check("x-mix error names property", errs and "x" in errs[0].lower(), errs)
check("x-mix error names both series indices", errs and "/series" in errs[0]
      and "series [0]" in errs[0] and "series [1]" in errs[0], errs)

errs2 = _check_chart_x_mix("c2", "line", [
    {"label": "a", "data": [{"x": 1.0, "y": 1.0}]},
    {"label": "b", "data": [{"x": 2.0, "y": 2.0}]},
], dm())
check("consistent numeric x admits", errs2 == [], errs2)

errs3 = _check_chart_x_mix("c3", "line", [
    {"label": "a", "data": [{"x": "2026-01-01", "y": 1.0}]},
    {"label": "b", "data": [{"x": "yesterday", "y": 2.0}]},
], dm())
check("plain-string x across series rejected naming rule",
      len(errs3) == 1 and "string" in errs3[0] and "rule" in errs3[0], errs3)

errs4 = _check_chart_x_mix("c4", "line", [
    {"label": "a", "data": [{"x": 1.0, "y": 1.0}]},
    {"label": "b", "data": [{"x": "nope", "y": 2.0}]},
    {"label": "c", "data": [{"x": "2026-01-01T00:00:00Z", "y": 3.0}]},
], dm())
check("three-way x mix names all offending series",
      len(errs4) == 1 and "series [0]" in errs4[0] and "series [1]" in errs4[0]
      and "series [2]" in errs4[0], errs4)

# categorical kinds are exempt (bar/histogram/range use labels, not x)
check("bar kind exempt from x-mix check",
      _check_chart_x_mix("c5", "bar", _mix, dm()) == [])

# bound data resolves through the same path
_bound = dm({"pts": [{"x": "2026-01-01T00:00:00Z", "y": 1.0}]})
errs5 = _check_chart_x_mix("c6", "line", [
    {"label": "a", "data": {"path": "/data/pts"}},
    {"label": "b", "data": [{"x": 5.0, "y": 2.0}]},
], _bound)
check("x-mix check resolves DataBinding series",
      len(errs5) == 1 and "series [0]" in errs5[0] and "series [1]" in errs5[0], errs5)

# ------------------------------------------------- module-level: N9 range series
def rng(*pts):
    return _check_range_series(list(pts), "c: /series/0/data")

check("range low<high admits", rng({"label": "a", "low": 1.0, "high": 2.0}) == [])
check("range low==high admits (S3 equality ruling)",
      rng({"label": "a", "low": 5.0, "high": 5.0}) == [])
e = rng({"label": "a", "low": 3.0, "high": 1.0})
check("range low>high rejected", len(e) == 1, e)
check("range low>high error names rule + shape",
      e and "low <= high" in e[0] and "label, low: number|null, high: number|null" in e[0], e)
check("range low>high error names property pointer",
      e and "/series/0/data/0" in e[0] and "low" in e[0], e)
e = rng({"label": "a", "low": None, "high": None})
check("range both-null admits (unavailable row, L1)", e == [], e)
e = rng({"label": "a", "low": 1.0, "high": None})
check("range exactly-one-null rejected (high null)",
      len(e) == 1 and "low and high" in e[0] and "together" in e[0], e)
e = rng({"label": "a", "low": None, "high": 2.0})
check("range exactly-one-null rejected (low null) names pair rule",
      len(e) == 1 and "low and high" in e[0] and "must be provided together" in e[0], e)
check("range exactly-one-null error names offending point",
      bool(e) and "/series/0/data/0" in e[0], e)
e = rng({"label": "a", "low": "3", "high": 4.0})
check("range non-numeric low rejected naming shape",
      len(e) == 1 and "low" in e[0] and "number|null, high" in e[0], e)
e = rng({"label": "a", "low": True, "high": 4.0})
check("range bool low rejected (bool is not number)",
      len(e) == 1 and "low" in e[0], e)
e = rng({"label": "a", "low": 1.0, "high": 2.0}, {"label": "b", "low": 9.0, "high": 3.0})
check("range error pins the offending point index",
      len(e) == 1 and "/series/0/data/1" in e[0], e)

# ---------------------------------------------- module-level: E16 sortDesc plumbing
check("sortDesc absent is legal", _check_chart_sort_desc("c", {"kind": "line"}) == [])
check("sortDesc bool on bar admits",
      _check_chart_sort_desc("c", {"kind": "bar", "sortDesc": True}) == [])
check("sortDesc bool on histogram admits",
      _check_chart_sort_desc("c", {"kind": "histogram", "sortDesc": False}) == [])
e = _check_chart_sort_desc("c", {"kind": "bar", "sortDesc": "yes"})
check("sortDesc non-bool rejected naming prop + type",
      len(e) == 1 and "sortDesc" in e[0] and "boolean" in e[0] and "string" in e[0], e)
e = _check_chart_sort_desc("c", {"kind": "line", "sortDesc": True})
check("sortDesc on line rejected naming valid kinds",
      len(e) == 1 and "sortDesc" in e[0] and "bar" in e[0] and "histogram" in e[0]
      and "line" in e[0], e)
e = _check_chart_sort_desc("c", {"kind": "scatter", "sortDesc": 1})
check("sortDesc unknown-kind + non-bool names both rules",
      len(e) == 2 and any("boolean" in x for x in e)
      and any("scatter" in x and "histogram" in x for x in e), e)

# ------------------------------------------------- module-level: E17 timeline
e = _check_timeline_dates([{"label": "L", "status": "failed"}], "tl: /items")
check("timeline status failed admits at check level (L8 enum merge)", e == [], e)
e = _check_timeline_dates([{"label": "L", "status": "done"},
                           {"label": "M", "status": "active"},
                           {"label": "N", "status": "pending"},
                           {"label": "O"}], "tl: /items")
check("timeline existing statuses + absent status admit (no fabrication)", e == [], e)
e = _check_timeline_dates([{"label": "L", "status": "blocked"}], "tl: /items")
check("timeline unknown status rejected naming item index + enum",
      len(e) == 1 and "/items/0/status" in e[0] and "failed" in e[0]
      and "item 0" in e[0], e)
e = _check_timeline_dates([{"label": "L", "date": "2026-01-01T00:00:00Z"}], "tl: /items")
check("timeline ISO date admits", e == [], e)
e = _check_timeline_dates([{"label": "L", "date": "last tuesday"}], "tl: /items")
check("timeline non-ISO date passes through verbatim (no rejection)", e == [], e)
e = _check_timeline_dates([{"label": "L"}, {"label": "M", "date": "   "}], "tl: /items")
check("timeline whitespace date rejected naming item index",
      len(e) == 1 and "/items/1/date" in e[0] and "item 1" in e[0]
      and "empty date" in e[0], e)
e = _check_timeline_dates([{"label": "L", "date": ""}], "tl: /items")
check("timeline empty date rejected naming item index",
      len(e) == 1 and "/items/0/date" in e[0] and "item 0" in e[0], e)
e = _check_timeline_dates([{"label": "L", "date": 1735689600}], "tl: /items")
check("timeline non-string date rejected naming type",
      len(e) == 1 and "/items/0/date" in e[0] and "integer" in e[0], e)

finish()
