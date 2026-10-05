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
    errors, _norm = admit(comps, {
        "data": {"s": [{"label": "s", "data": [{"label": "a", "value": 1}]}]}, "meta": {},
    })
    assert errors, "bound series was ADMITTED — engine widened past the frozen catalog?"
    assert any("/series" in e for e in errors), errors


# ---------------------------------------------------------------------------
# #27 (J12/J13/J16 + AD-10): the tool description is GENERATED from the catalog —
# one signature line per type (all 26), every enum on its own type's line, '?' for
# optional, the one defaults sentence, Sparkline's admitted-only aliases
# (info/error) absent from the signature; the sentences spec §4.3 deletes are gone.
# Everything expected is derived from the catalog JSON at assert time — a
# hand-written (hard-coded) signature line fails the per-type property-set check.

import re  # noqa: E402

COMMON_PROPS = {"id", "component", "accessibility", "sourceIds"}
COMPONENTS_DESC = door.TOOL_SCHEMA["parameters"]["properties"]["components"]["description"]
DELETED_SENTENCES = (  # spec §4.3: deleted because a default now covers it
    "EXACTLY ONE",                              # J5
    "props` wrapper",                           # J6
    "required non-empty string",                # J3
    "required per column",                      # J8
    "(not 'title')",                            # J1
    "never inline arrays",                      # J16 (replaced, see below)
)


def _sig_lines():
    out = {}
    for line in COMPONENTS_DESC.splitlines():
        head = line.split(" ", 1)[0]
        if head in COMPS:
            assert head not in out, "duplicate signature line for %s" % head
            out[head] = line
    return out


def _expected_props(name):
    schema = COMPS[name]
    req = [r for r in schema.get("required", []) if r not in COMMON_PROPS]
    props = list(schema.get("properties", {}))
    return ([p for p in props if p in req], [p for p in props if p not in req and p not in COMMON_PROPS])


def _collect_enums(node, seen):
    if isinstance(node, dict):
        for v in node.get("enum", []):
            seen.append(str(v))
        for sub in node.values():
            _collect_enums(sub, seen)
    elif isinstance(node, list):
        for sub in node:
            _collect_enums(sub, seen)
    return seen


def _line_tokens(line, name):
    """Top-level comma-separated tokens of a generated signature line."""
    body = line[len(name):].strip()
    tokens, depth, cur = [], 0, ""
    for ch in body:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        if ch == "," and depth == 0:
            tokens.append(cur)
            cur = ""
        else:
            cur += ch
    tokens.append(cur)
    out = []
    for tok in tokens:
        tok = tok.strip()
        m = re.match(r"^([A-Za-z][A-Za-z0-9_]*)\??", tok)
        if m:
            # Helper fix (#27, commit 5): a required token per spec §4.2 is the BARE
            # name (`text, level?`) — tok can end exactly at the identifier, so index
            # the '?' only when something follows. Contract unchanged: '?' marks optional.
            rest = tok[len(m.group(1)):]
            out.append((m.group(1), rest.startswith("?")))
    return out


def test_description_length_at_most_5000():
    assert len(DESCRIPTION) <= 5000, "agent-visible tool description is %d chars" % len(DESCRIPTION)


def test_one_generated_signature_line_per_catalog_type():
    lines = _sig_lines()
    assert set(lines) == set(COMPS), "signature lines must cover all %d catalog types exactly once" % len(COMPS)


def test_signature_line_property_sets_are_generated_from_the_catalog():
    lines = _sig_lines()
    for name in COMPS:
        req, opt = _expected_props(name)
        toks = _line_tokens(lines[name], name)
        got = {t for t, _q in toks}
        assert got == set(req) | set(opt), "%s: line props %s != catalog props %s" % (name, sorted(got), sorted(set(req) | set(opt)))
        for t, q in toks:
            assert q == (t in opt), "%s.%s: '?' must mark optional (catalog says optional=%s)" % (name, t, t in opt)


def test_every_catalog_enum_value_is_on_its_type_signature_line():
    lines = _sig_lines()
    for name in COMPS:
        for value in _collect_enums(COMPS[name], []):
            assert value in lines[name], "%s: enum value %r missing from its signature line" % (name, value)


def test_every_type_that_takes_title_says_title_on_its_line():
    # Closes the #19 description half. Derived from the catalog: whatever type
    # gains a (catalog-annotated) `title` — incl. BarList/KeyValueList/HeatMap/
    # ChipSet once their slices land — must carry `title?` on its line.
    lines = _sig_lines()
    holders = [n for n in COMPS if "title" in (COMPS[n].get("properties") or {})]
    assert holders, "the catalog must carry title-holding types (sanity)"
    for name in holders:
        assert "title?" in lines[name], "%s takes title but its line does not say `title?`" % name


def test_deleted_spec_4_3_sentences_absent():
    for phrase in DELETED_SENTENCES:
        assert phrase not in DESCRIPTION, "spec §4.3 deleted sentence still present: %r" % phrase


def test_one_defaults_sentence():
    assert DESCRIPTION.count("Omit anything cosmetic:") == 1, "exactly one defaults sentence"
    assert "3 significant figures" in DESCRIPTION and "k/M/B/T" in DESCRIPTION
    assert "invertTone" in DESCRIPTION and "lower is better" in DESCRIPTION


def test_sparkline_tone_signature_lists_default_success_danger_only():
    # AD-10: info/error are old-form admission aliases; the generated signature
    # shows the catalog's three. Asserted against the catalog enum, not a literal.
    enum = COMPS["Sparkline"]["properties"]["tone"]["enum"]
    assert enum == ["default", "success", "danger"], enum
    line = _sig_lines()["Sparkline"]
    assert "default|success|danger" in line
    assert "|error" not in line and "error" not in line, "alias leaked into the signature"
    assert "|info" not in line and " info" not in line, "alias leaked into the signature"


def test_j16_literal_only_rule_replaces_the_inline_array_rule():
    assert "never inline arrays" not in COMPONENTS_DESC
    assert "literal-only" in COMPONENTS_DESC
    assert "Chart.series" in COMPONENTS_DESC and "DataTable.columns" in COMPONENTS_DESC


def test_generated_description_keeps_the_grammar_pins():
    # test_api.py pins these on the same string; the generator must keep them.
    assert '"path": "/data/' in COMPONENTS_DESC
    assert 'id "root"' in COMPONENTS_DESC
    assert "hermes-rich-ui/1" in COMPONENTS_DESC


# ---------------------------------------------------------------------------
# est-2ek.1.173 (spool key b3aa31795d3a19fe, 2026-09-26): the signature lines
# printed prop NAMES + enums only — the item-level required keys (Chart series
# {label,data}, Timeline item {label}) and numeric caps (Grid columns 1..4)
# lived only in skill/SKILL.md, so an agent writing from the tool description
# burned publishes on "missing required property 'label'" / "above maximum 4".
# Fix is generated from the catalog (J12): item shapes render as
# `prop [{req1,req2,...}]` and integer props with min/max as `prop? 1..4`.
# Derived from the catalog at assert time — never a hard-coded snapshot.


def _array_item(node):
    """The literal-array items schema of a prop, or None."""
    for cand in [node] + list(node.get("oneOf", []) or []):
        if isinstance(cand, dict) and cand.get("type") == "array":
            it = cand.get("items")
            if isinstance(it, dict) and it.get("type") == "object" and it.get("properties"):
                return it
    return None


def test_nested_item_required_keys_are_on_the_signature_line():
    lines = _sig_lines()
    for name, schema in COMPS.items():
        for prop, sub in schema.get("properties", {}).items():
            it = _array_item(sub)
            if it is None:
                continue
            req = it.get("required", [])
            if not req:
                continue
            for key in req:
                assert key in lines[name], (
                    "%s.%s: item-required key %r missing from the signature line"
                    % (name, prop, key)
                )


def test_chart_series_and_timeline_label_are_stated():
    # The exact agent-failure keys from the row: series carries label+data,
    # Timeline items carry label FIRST (NOT title — title is the component prop).
    lines = _sig_lines()
    assert re.search(r"series\s*\[\{label,data\}\]", lines["Chart"]), lines["Chart"]
    assert re.search(r"items\s*\[\{label(,|\})", lines["Timeline"]), lines["Timeline"]


def test_bounded_integer_props_state_their_range():
    lines = _sig_lines()
    for name, schema in COMPS.items():
        for prop, sub in schema.get("properties", {}).items():
            if not isinstance(sub, dict):
                continue
            if sub.get("type") == "integer" and "minimum" in sub and "maximum" in sub \
                    and "enum" not in sub:
                want = "%s..%s" % (sub["minimum"], sub["maximum"])
                assert want in lines[name], (
                    "%s.%s: numeric range %s missing from the signature line"
                    % (name, prop, want)
                )


def test_grid_columns_cap_is_stated():
    assert "columns 1..4" in _sig_lines()["Grid"]


def test_validator_shapes_the_description_states_admit_cleanly():
    # The whole point: text written exactly as the new description states must
    # pass the real validator, not just look similar.
    lines = _sig_lines()
    m = re.search(r"series\s*\[\{([^}]+)\}\]", lines["Chart"])
    keys = [k.strip() for k in m.group(1).split(",")]
    assert keys == ["label", "data"], keys
    # Build the payload from the keys the DESCRIPTION states — if the line ever
    # drifts back to {data}-only or gains an unknown key, admit() fails here.
    series_item = {}
    for k in keys:
        series_item[k] = "s" if k == "label" else [{"label": "a", "value": 1}]
    comps = _root(["c"]) + [{"id": "c", "component": "Chart", "kind": "bar",
                             "series": [series_item]}]
    errors, _norm = admit(comps, {"data": {}, "meta": {}})
    assert errors == [], errors

    m = re.search(r"items\s*\[\{([^}]+)\}\]", lines["Timeline"])
    tkeys = [k.strip().rstrip("?") for k in m.group(1).split(",")]
    assert "label" in tkeys, tkeys
    item = {"label": "step"}
    if "status" in tkeys:
        item["status"] = "done"
    comps = _root(["t"]) + [{"id": "t", "component": "Timeline", "items": [item]}]
    errors, _norm = admit(comps, {"data": {}, "meta": {}})
    assert errors == [], errors


if __name__ == "__main__":
    r = Runner()
    for t in (test_every_catalog_component_type_named, test_chart_kind_enums,
              test_callout_tone_enums, test_badge_tone_enums,
              test_timeline_item_status_enums, test_heading_level_enums,
              test_admit_heatmap_label_refs, test_admit_chart_bound_series_data,
              test_reject_chart_bound_series,
              test_description_length_at_most_5000,
              test_one_generated_signature_line_per_catalog_type,
              test_signature_line_property_sets_are_generated_from_the_catalog,
              test_every_catalog_enum_value_is_on_its_type_signature_line,
              test_every_type_that_takes_title_says_title_on_its_line,
              test_deleted_spec_4_3_sentences_absent,
              test_one_defaults_sentence,
              test_sparkline_tone_signature_lists_default_success_danger_only,
              test_j16_literal_only_rule_replaces_the_inline_array_rule,
              test_generated_description_keeps_the_grammar_pins,
              test_nested_item_required_keys_are_on_the_signature_line,
              test_chart_series_and_timeline_label_are_stated,
              test_bounded_integer_props_state_their_range,
              test_grid_columns_cap_is_stated,
              test_validator_shapes_the_description_states_admit_cleanly):
        r.run(t)
    r.finish()
