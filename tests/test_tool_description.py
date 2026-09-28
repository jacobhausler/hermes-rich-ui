"""R6: the rich_present tool description must admit every catalog component type.

Guards issue #9: the description string lagged the v0.1.1 catalog (8 types and
several enum values missing). The test imports TOOL_SCHEMA from the package and
derives the expected names/values from the catalog JSON — never from source
text, never a hardcoded snapshot.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import ROOT, Runner, load  # noqa: E402
sys.path.insert(0, str(ROOT))
from engine.admission import admit  # noqa: E402

door = load("__init__.py", "door")

CATALOG = json.loads(
    (ROOT / "catalog" / "hermes-rich-ui.catalog.json").read_text(encoding="utf-8")
)
COMPS = CATALOG["components"]

# The agent-visible text is the tool description plus the `components` param
# description (where the per-type clauses live); check the union.
DESCRIPTION = (
    door.TOOL_SCHEMA["description"]
    + "\n"
    + door.TOOL_SCHEMA["parameters"]["properties"]["components"]["description"]
)


def _enum(component, *path):
    node = COMPS[component]["properties"]
    for key in path:
        node = node[key]
    return node["enum"]


def test_every_catalog_component_type_named():
    for name in COMPS:
        assert name in DESCRIPTION, "component type missing from description: %s" % name


def test_chart_kind_enums():
    for v in _enum("Chart", "kind"):
        assert v in DESCRIPTION, "Chart.kind value missing: %s" % v


def test_callout_tone_enums():
    for v in _enum("Callout", "tone"):
        assert v in DESCRIPTION, "Callout.tone value missing: %s" % v


def test_badge_tone_enums():
    for v in _enum("Badge", "tone"):
        assert v in DESCRIPTION, "Badge.tone value missing: %s" % v


def test_timeline_item_status_enums():
    status = COMPS["Timeline"]["properties"]["items"]["oneOf"][0]["items"]["properties"]["status"]
    for v in status["enum"]:
        assert v in DESCRIPTION, "Timeline status value missing: %s" % v


def test_heading_level_enums():
    for v in _enum("Heading", "level"):
        assert str(v) in DESCRIPTION, "Heading.level value missing: %s" % v


# Admission-level checks (issue #9 review): the minimal examples the description
# implies must actually admit/reject through engine.admission.admit, so the
# description can never drift from the engine again.

def _root(children_ids):
    return [{"id": "root", "component": "Card", "title": "T", "children": list(children_ids)}]


def test_admit_heatmap_label_refs():
    # The description says cells carry the DECLARED row/col label strings.
    comps = _root(["h"]) + [{
        "id": "h", "component": "HeatMap",
        "rows": [{"label": "r"}], "cols": [{"label": "c"}],
        "cells": [{"row": "r", "col": "c", "value": 1}],
    }]
    errors, _norm = admit(comps, {"data": {}, "meta": {}})
    assert errors == [], errors


def test_admit_chart_bound_series_data():
    # The description says to bind, bind each series' data (never `series` itself).
    comps = _root(["c"]) + [{
        "id": "c", "component": "Chart", "kind": "bar",
        "series": [{"label": "s", "data": {"path": "/data/p"}}],
    }]
    errors, _norm = admit(comps, {"data": {"p": [{"label": "a", "value": 1}]}, "meta": {}})
    assert errors == [], errors


def test_reject_chart_bound_series():
    # `series` itself is literal-only: a binding is rejected naming /series.
    comps = _root(["c"]) + [{
        "id": "c", "component": "Chart", "kind": "bar",
        "series": {"path": "/data/s"},
    }]
    errors, _norm = admit(comps, {"data": {"s": [{"label": "s", "data": [{"label": "a", "value": 1}]}]}, "meta": {}})
    assert errors, "bound series was ADMITTED — engine widened past the frozen catalog?"
    assert any("/series" in e for e in errors), errors


if __name__ == "__main__":
    r = Runner()
    for t in (test_every_catalog_component_type_named, test_chart_kind_enums,
              test_callout_tone_enums, test_badge_tone_enums,
              test_timeline_item_status_enums, test_heading_level_enums,
              test_admit_heatmap_label_refs, test_admit_chart_bound_series_data,
              test_reject_chart_bound_series):
        r.run(t)
    r.finish()
