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


if __name__ == "__main__":
    r = Runner()
    for t in (test_every_catalog_component_type_named, test_chart_kind_enums,
              test_callout_tone_enums, test_badge_tone_enums,
              test_timeline_item_status_enums, test_heading_level_enums):
        r.run(t)
    r.finish()
