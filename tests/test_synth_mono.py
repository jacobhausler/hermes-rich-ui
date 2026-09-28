"""Lane L5 (mono) ACCEPT: CodeBlock admission truth-table.

The catalog entry and the admission hook below are MANIFEST deliverables the
integrator (L8) merges; until then CodeBlock is not in the frozen catalog, so
this file tests:
  (a) the REAL generic machinery for every CodeBlock shape that does not need
      the type registered (binding resolution, unknown-prop, forbidden key);
  (b) the pure cap helper check_code_cap() verbatim as MANIFESTed;
  (c) the FULL hook _check_codeblock via a shimmed catalog (the shim injects
      the MANIFEST catalog entry and monkeypatches _check_leaf_specifics to
      route CodeBlock to the hook — the exact call the integrator merges).

Run from the worktree root: python3 tests/test_synth_mono.py   (exit 0 = green)
"""
from __future__ import annotations

import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "tests"))

from helpers.admit import check, rejects, admits, finish  # noqa: E402
import engine.admission as adm  # noqa: E402

MAX_CODE = 4096

# ---------------------------------------------------------------- the MANIFESTed pure check
def check_code_cap(comp, data_model, errors):
    """Append an error when CodeBlock `code` (literal or bound) exceeds 4 KiB.

    The generic string scan caps every literal string at MAX_STRING (4096) but
    never reaches inside dataModel, so a bound `code` could smuggle an
    unbounded string; this closes the gap and names the cap (L4).
    """
    found, val = _resolve_prop(comp, "code", data_model)
    if found and isinstance(val, str) and len(val.encode("utf-8")) > MAX_CODE:
        errors.append("%s: /code: code exceeds %d KiB cap (%d bytes)"
                      % (comp.get("id"), MAX_CODE // 1024, len(val.encode("utf-8"))))


_resolve_prop = adm._resolve_prop

# The MANIFESTed catalog entry (identical JSON to MANIFEST.md).
CODEBLOCK_ENTRY = {
    "type": "object",
    "description": ("Monospace code/config/shell block, literal text only. No markdown, no HTML, "
                    "no syntax highlighting. 'language' is a LABEL ONLY, never parsed. 'code' is "
                    "capped at 4 KiB (UTF-8); over-cap input is rejected at admission, never "
                    "truncated. 'showLines' renders per-line numbers in the renderer; the agent "
                    "never numbers lines itself."),
    "properties": {
        "id": {"$ref": "#/$defs/ComponentId"},
        "component": {"const": "CodeBlock"},
        "accessibility": {"$ref": "#/$defs/Accessibility"},
        "sourceIds": {"type": "array", "items": {"type": "string", "maxLength": 4096},
                      "maxItems": 32,
                      "description": "Evidence links; every id must resolve in /meta/sources."},
        "code": {"$ref": "#/$defs/DynamicString"},
        "caption": {"type": "string", "maxLength": 4096},
        "language": {"type": "string", "maxLength": 64},
        "showLines": {"type": "boolean", "default": False},
    },
    "required": ["id", "component", "code"],
    "additionalProperties": False,
}


def cb(comp_id, **props):
    out = {"id": comp_id, "component": "CodeBlock"}
    out.update(props)
    return out


def card(children):
    return {"id": "root", "component": "Card", "children": children}


def dm(data=None):
    base = {"data": data or {}, "meta": {"sources": [{"id": "s1", "kind": "web",
            "label": "Example runbook", "url": "https://example.com/runbook",
            "accessed_at": "2026-09-27T10:00:00Z"}]}}
    return base


# ------------------------------------------------- (b) pure cap helper: truth table
ok, _ = adm.resolve_pointer({}, "/nope")
check("helper: resolve_pointer sanity", ok is False)

errs = []
check_code_cap(cb("cb1", code="print('ok')" * 100), {}, errs)
check("cap: literal under cap passes", errs == [], errs)

errs = []
check_code_cap(cb("cb2", code="x" * 4096), {}, errs)
check("cap: literal exactly 4096 passes (never truncates, boundary inclusive)", errs == [], errs)

errs = []
check_code_cap(cb("cb3", code="x" * 4097), {}, errs)
check("cap: literal over cap errors naming 'code exceeds 4 KiB cap'",
      any("code exceeds 4 KiB cap" in e and "/code" in e and "cb3" in e for e in errs), errs)

errs = []
check_code_cap(cb("cb4", code={"path": "/data/big"}),
               {"data": {"big": "é" * 4097}}, errs)
check("cap: bound code measured in UTF-8 BYTES (é = 2 bytes)",
      any("code exceeds 4 KiB cap" in e for e in errs), errs)

errs = []
check_code_cap(cb("cb5", code={"path": "/data/big"}),
               {"data": {"big": "x" * 4096}}, errs)
check("cap: bound code exactly at cap passes", errs == [], errs)

errs = []
check_code_cap(cb("cb6", code={"path": "/data/missing"}), {"data": {}}, errs)
check("cap: unresolvable binding adds no cap error (schema reports it)", errs == [], errs)

errs = []
check_code_cap({"id": "kv", "component": "KeyValueList"}, {}, errs)
check("cap: non-CodeBlock components untouched", errs == [], errs)

# ------------------------------------------------- (a) real generic machinery (no catalog entry needed)
# `code` over cap as a LITERAL: caught today by the generic MAX_STRING scan —
# error must name the cap too ("4096" chars). Byte-stable inputs (helpers/admit).
rejects("generic: literal code over cap rejected by the string-cap machinery",
        [card(["cb"]), cb("cb", code="x" * 5000)], dm(), "longer than 4096")

rejects("__proto__ own-key rejected (forbidden keys)",
        [card(["cb"]), cb("cb", code="ls", **{"__proto__": {"x": 1}})], dm(), "forbidden key '__proto__'")

admits("CodeBlock is a real component type post-merge (v0.1.1)",
       [card(["cb"]), {"id": "cb", "component": "CodeBlock", "code": "ls -la"}], dm())
rejects("unknown component type still rejected (post-merge)",
        [card(["cb"]), {"id": "cb", "component": "Codeblok"}], dm(), "unknown component type")

# ------------------------------------------------- (c) full hook via shimmed catalog
_real_admit = adm.admit
_real_leaf = adm._check_leaf_specifics


def admit_with_codeblock(components, data_model):
    """Simulate the post-merge state: catalog entry present + hook routed from
    _check_leaf_specifics (the exact call MANIFESTed for L8)."""
    def patched(comp, catalog, data_model_, errors):
        if comp.get("component") == "CodeBlock":
            _check_codeblock(comp, data_model_, errors)
            return
        return _real_leaf(comp, catalog, data_model_, errors)

    real_comps = adm.load_catalog()["components"]

    def patched_catalog():
        cat = real_load()
        cat["components"] = dict(cat["components"], CodeBlock=CODEBLOCK_ENTRY)
        return cat

    real_load = adm.load_catalog
    adm.load_catalog = patched_catalog
    adm._check_leaf_specifics = patched
    try:
        return _real_admit(components, data_model)
    finally:
        adm.load_catalog = real_load
        adm._check_leaf_specifics = _real_leaf
        adm.load_catalog()["components"] = real_comps  # restore the cached global


def _check_codeblock(comp, data_model, errors):
    """The MANIFESTed admission hook body."""
    if comp.get("component") != "CodeBlock":
        return
    check_code_cap(comp, data_model, errors)


def checked(name, components, data_model, needle):
    before = str([components, data_model])
    errors, _ = admit_with_codeblock(components, data_model)
    hit = any(needle.lower() in e.lower() for e in errors)
    check(name, bool(errors) and hit and before == str([components, data_model]), errors[:3] if errors else "ADMITTED")


def passed(name, components, data_model):
    errors, _ = admit_with_codeblock(components, data_model)
    check(name, errors == [], errors[:5])


passed("merged: well-formed CodeBlock admits (all props)",
       [card(["cb"]), cb("cb", code="kubectl get pods", caption="fleet snapshot",
                         language="yaml", showLines=True, sourceIds=["s1"])], dm())

passed("merged: bound code under cap admits",
       [card(["cb"]), cb("cb", code={"path": "/data/script"})],
       dm({"script": "set -euo pipefail\nexit 0"}))

checked("merged: bound code over cap REJECTED naming the 4 KiB cap (L4) — byte cap, UTF-8",
        [card(["cb"]), cb("cb", code={"path": "/data/script"})],
        dm({"script": "é" * 3000}), "code exceeds 4 KiB cap")

checked("merged: bound code over char cap also caught by the generic dataModel string scan",
        [card(["cb"]), cb("cb", code={"path": "/data/script"})],
        dm({"script": "y" * 5000}), "longer than 4096")

checked("merged: missing required code rejected naming the property",
        [card(["cb"]), {"id": "cb", "component": "CodeBlock"}], dm(), "missing required property 'code'")

checked("merged: unresolvable code binding rejected",
        [card(["cb"]), cb("cb", code={"path": "/data/nope"})], dm(), "/code")

checked("merged: non-string bound code rejected",
        [card(["cb"]), cb("cb", code={"path": "/data/n"})], dm({"n": 42}), "string")

checked("merged: language label over 64 chars rejected naming the property",
        [card(["cb"]), cb("cb", code="ls", language="z" * 65)], dm(), "language")

checked("merged: unknown prop highlight rejected (no highlighting, L2)",
        [card(["cb"]), cb("cb", code="ls", highlight="ansi")], dm(), "unknown property 'highlight'")

checked("merged: children rejected on the leaf",
        [card(["cb"]), dict(cb("cb", code="ls"), children=[])], dm(), "leaf type")

checked("merged: unresolved sourceId rejected",
        [card(["cb"]), cb("cb", code="ls", sourceIds=["nope"])], dm(), "does not resolve")

finish()
