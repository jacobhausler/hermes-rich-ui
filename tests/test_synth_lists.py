#!/usr/bin/env python3
"""Lane L4 (lists) admission ACCEPT — Checklist (N3) + ChipSet (N4).

The catalog is a shared seam this lane may NOT edit, so this test injects the
EXACT MANIFEST.md catalog entries into an in-memory deepcopy of the loaded
catalog and swaps in the EXACT patched engine.admission._collect_source_ids.
Green here means the JSON + code the integrator pastes actually admits/rejects
as ratified (briefing: lane-local admission tests test the admission LOGIC the
integrator will merge via documented patterns).

Run: python3 tests/test_synth_lists.py   (exit 0 = green)
"""
from __future__ import annotations

import copy
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in (ROOT, os.path.join(ROOT, "tests")):
    if p not in sys.path:
        sys.path.insert(0, p)

import engine.admission as A  # noqa: E402
from helpers.admit import check, rejects, admits, finish  # noqa: E402

_SRC = {"type": "array", "items": {"type": "string", "maxLength": 4096}, "maxItems": 32,
        "description": "Evidence links; every id must resolve in /meta/sources."}

# ---- VERBATIM MANIFEST entries (keep in lockstep with MANIFEST.md) ----------
CHECKLIST_ENTRY = {
    "type": "object",
    "description": "Undated checklist of booleans (Checklist = undated booleans; Timeline = dated). The renderer computes the done tally; null/absent done renders UNKNOWN, never guessed.",
    "properties": {
        "id": {"$ref": "#/$defs/ComponentId"},
        "component": {"const": "Checklist"},
        "accessibility": {"$ref": "#/$defs/Accessibility"},
        "sourceIds": dict(_SRC),
        "title": {"$ref": "#/$defs/DynamicString"},
        "items": {
            "description": "Up to 32 check items (literal or bound): {label, done? true|false|null, sourceIds?}.",
            "oneOf": [
                {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": {"type": "string", "maxLength": 4096},
                            "done": {"oneOf": [{"type": "boolean"}, {"type": "null"}]},
                            "sourceIds": dict(_SRC),
                        },
                        "required": ["label"],
                        "additionalProperties": False,
                    },
                    "maxItems": 32,
                },
                {"$ref": "#/$defs/DataBinding"},
            ],
        },
        "showTally": {"type": "boolean", "default": True},
    },
    "required": ["id", "component", "items"],
    "additionalProperties": False,
}

CHIPSET_ENTRY = {
    "type": "object",
    "description": "One flex-wrap row of chip labels rendered as badges (replaces N separate Badge components). Labels are data, not keys: duplicates allowed. tone is Badge's existing four exactly.",
    "properties": {
        "id": {"$ref": "#/$defs/ComponentId"},
        "component": {"const": "ChipSet"},
        "accessibility": {"$ref": "#/$defs/Accessibility"},
        "sourceIds": dict(_SRC),
        "labels": {
            "description": "Up to 24 chip labels (literal or bound); duplicates allowed.",
            "oneOf": [
                {"type": "array", "items": {"type": "string", "maxLength": 4096}, "maxItems": 24},
                {"$ref": "#/$defs/DataBinding"},
            ],
        },
        "tone": {"type": "string", "enum": ["neutral", "info", "success", "caution"], "default": "neutral"},
        "wrap": {"type": "boolean", "default": True},
    },
    "required": ["id", "component", "labels"],
    "additionalProperties": False,
}

# ---- VERBATIM patched _collect_source_ids (MANIFEST: add "Checklist" to the
# KeyValueList/Timeline tuple at engine/admission.py ~676) --------------------
def _collect_source_ids_merged(comp, data_model, out):
    """(pointer-ish label, id) for every sourceIds entry on a component, incl. bound rows/items."""
    label = comp.get("id")
    if isinstance(comp.get("sourceIds"), list):
        for i, sid in enumerate(comp["sourceIds"]):
            out.append(("%s: /sourceIds/%d" % (label, i), sid))
    t = comp.get("component")
    if t in ("KeyValueList", "Timeline", "Checklist"):
        found, items = A._resolve_prop(comp, "items", data_model)
        if found and isinstance(items, list):
            for i, it in enumerate(items):
                if isinstance(it, dict) and isinstance(it.get("sourceIds"), list):
                    for j, sid in enumerate(it["sourceIds"]):
                        out.append(("%s: /items/%d/sourceIds/%d" % (label, i, j), sid))
    elif t == "DataTable":
        cols = comp.get("columns") if isinstance(comp.get("columns"), list) else []
        src_keys = [c.get("key") for c in cols
                    if isinstance(c, dict) and c.get("type") == "sources" and isinstance(c.get("key"), str)]
        if not src_keys:
            return
        found, rows = A._resolve_prop(comp, "rows", data_model)
        if found and isinstance(rows, list):
            for i, row in enumerate(rows):
                if not isinstance(row, dict):
                    continue
                for k in src_keys:
                    if isinstance(row.get(k), list):
                        for j, sid in enumerate(row[k]):
                            out.append(("%s: /rows/%d/%s/%d" % (label, i, A._escape_token(k), j), sid))


def install():
    cat = copy.deepcopy(A.load_catalog())
    cat["components"]["Checklist"] = copy.deepcopy(CHECKLIST_ENTRY)
    cat["components"]["ChipSet"] = copy.deepcopy(CHIPSET_ENTRY)
    for arm in cat["$defs"]["anyComponent"]["oneOf"]:
        if isinstance(arm, dict) and arm.get("$ref") == "#/components/KeyValueList":
            i = cat["$defs"]["anyComponent"]["oneOf"].index(arm)
            cat["$defs"]["anyComponent"]["oneOf"][i:i + 1] = [
                {"$ref": "#/components/KeyValueList"},
                {"$ref": "#/components/Checklist"},
                {"$ref": "#/components/ChipSet"},
            ]
            break
    else:
        raise AssertionError("KeyValueList discriminator arm not found — check the splice point")
    A._CATALOG = cat          # load_catalog() is cache-first; admit() now sees the merged catalog
    A._collect_source_ids = _collect_source_ids_merged


def dm(data=None, sources=None):
    return {
        "data": data if data is not None else {},
        "meta": {
            "summary": "synthetic test",
            "authored_at": "2026-09-27T00:00:00Z",
            "dataset": {"id": "t", "revision": 1, "observed_at": None, "published_at": "2026-09-27T00:00:00Z"},
            "sources": sources if sources is not None else [{"id": "s1", "kind": "web", "label": "S1", "url": "https://example.org/x"}],
            "derivations": [],
        },
    }


def card(*children):
    return {"id": "root", "component": "Card", "title": "T", "children": list(children)}


install()

# ------------------------------------------------------------- Checklist
admits("Checklist admits (tri-state done, per-item sourceIds)", [
    card("ck"),
    {"id": "ck", "component": "Checklist", "title": "Launch readiness",
     "items": [{"label": "Collect samples", "done": True},
               {"label": "Review outliers", "done": False},
               {"label": "Verify citations", "done": None},
               {"label": "Publish card"},
               {"label": "Cross-check totals", "done": True, "sourceIds": ["s1"]}]},
], dm())
admits("Checklist bound items admit", [
    card("ck"),
    {"id": "ck", "component": "Checklist", "items": {"path": "/data/steps"}},
], dm(data={"steps": [{"label": "a", "done": True}, {"label": "b"}]}))
norm = admits("Checklist absent showTally admits (J9: house renders the tally)", [
    card("ck"),
    {"id": "ck", "component": "Checklist", "items": [{"label": "a", "done": True}]},
], dm())
# J9 (#27): the catalog `default: true` is documentation; the door persists it ABSENT and
# the renderer takes HOUSE.CHECKLIST_SHOW_TALLY (tests/test_house_defaults.mjs pins equality).
check("J9: absent showTally persists ABSENT (was: normalized adds showTally true)",
      all("showTally" not in c for c in norm if c.get("id") == "ck"))

rejects("Checklist 33 items rejected, error names the ≤32 cap", [
    card("ck"),
    {"id": "ck", "component": "Checklist", "items": [{"label": "i"} for _ in range(33)]},
], dm(), "33 items exceeds maximum 32")
rejects("Checklist 33 bound items rejected", [
    card("ck"),
    {"id": "ck", "component": "Checklist", "items": {"path": "/data/steps"}},
], dm(data={"steps": [{"label": "i"} for _ in range(33)]}), "33 items exceeds maximum 32")
rejects("Checklist item unknown property rejected", [
    card("ck"),
    {"id": "ck", "component": "Checklist", "items": [{"label": "a", "checked": True}]},
], dm(), "unknown property 'checked'")
rejects("Checklist done must be true|false|null (string rejected)", [
    card("ck"),
    {"id": "ck", "component": "Checklist", "items": [{"label": "a", "done": "yes"}]},
], dm(), "/items/0/done")
rejects("Checklist missing label rejected", [
    card("ck"),
    {"id": "ck", "component": "Checklist", "items": [{"done": True}]},
], dm(), "missing required property 'label'")
rejects("Checklist per-item sourceIds unresolvable rejected (merged branch fires)", [
    card("ck"),
    {"id": "ck", "component": "Checklist", "items": [{"label": "a", "sourceIds": ["nope"]}]},
], dm(), "/items/0/sourceIds/0")
rejects("Checklist bound per-item sourceIds unresolvable rejected", [
    card("ck"),
    {"id": "ck", "component": "Checklist", "items": {"path": "/data/steps"}},
], dm(data={"steps": [{"label": "a", "sourceIds": ["ghost"]}]}), "does not resolve")

# ------------------------------------------------------------- ChipSet
admits("ChipSet admits (duplicates allowed — labels are data, not keys)", [
    card("cs"),
    {"id": "cs", "component": "ChipSet", "labels": ["alpha", "beta", "alpha"], "tone": "success"},
], dm())
admits("ChipSet bound labels admit", [
    card("cs"),
    {"id": "cs", "component": "ChipSet", "labels": {"path": "/data/tags"}},
], dm(data={"tags": ["one", "two"]}))
rejects("ChipSet 25 labels rejected, error names the ≤24 cap", [
    card("cs"),
    {"id": "cs", "component": "ChipSet", "labels": ["l%d" % i for i in range(25)]},
], dm(), "25 items exceeds maximum 24")
rejects("ChipSet tone outside Badge's four rejected", [
    card("cs"),
    {"id": "cs", "component": "ChipSet", "labels": ["a"], "tone": "danger"},
], dm(), "danger")
rejects("ChipSet non-string label rejected", [
    card("cs"),
    {"id": "cs", "component": "ChipSet", "labels": ["a", 7]},
], dm(), "/labels/1")
rejects("ChipSet unknown property rejected", [
    card("cs"),
    {"id": "cs", "component": "ChipSet", "labels": ["a"], "size": "lg"},
], dm(), "unknown property 'size'")

finish()
