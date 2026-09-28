"""Admission tests — catalog lane. Run: python3 tests/test_admission.py (exit 0 = green)."""
from __future__ import annotations

import copy
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from engine.admission import admit, load_catalog, resolve_pointer, check_url, CATALOG_ID  # noqa: E402

RESULTS = []
NEGATIVE = 0


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond)))
    print("%s %s%s" % ("PASS" if cond else "FAIL", name, (" -- " + str(detail)) if (detail and not cond) else ""))


def rejects(name, components, data_model, needle):
    """Negative control: must be rejected AND an error must mention `needle`."""
    global NEGATIVE
    NEGATIVE += 1
    before = json.dumps([components, data_model], sort_keys=True, default=str)
    errors, _norm = admit(components, data_model)
    after = json.dumps([components, data_model], sort_keys=True, default=str)
    hit = any(needle.lower() in e.lower() for e in errors)
    check(name, errors and hit and before == after, errors[:3] if errors else "ADMITTED")


def admits(name, components, data_model):
    errors, norm = admit(components, data_model)
    check(name, errors == [], errors[:5])
    return norm


def load_surface(example):
    with open(os.path.join(ROOT, "examples", example, "surface.json"), encoding="utf-8") as fh:
        return json.load(fh)["createSurface"]


def dm(data=None, sources=None, derivations=None):
    return {
        "data": data if data is not None else {},
        "meta": {
            "summary": "synthetic test",
            "authored_at": "2026-09-25T00:00:00Z",
            "dataset": {"id": "t", "revision": 1, "observed_at": None, "published_at": "2026-09-25T00:00:00Z"},
            "sources": sources if sources is not None else [{"id": "s1", "kind": "web", "label": "S1", "url": "https://example.org/x"}],
            "derivations": derivations if derivations is not None else [],
        },
    }


def card(*children, **extra):
    c = {"id": "root", "component": "Card", "title": "T", "children": list(children)}
    c.update(extra)
    return c


def text(cid, t="hello"):
    return {"id": cid, "component": "Text", "text": t}


# ------------------------------------------------------------------ catalog
cat = load_catalog()
check("catalog id", cat["catalogId"] == CATALOG_ID == "hermes-rich-ui/1")
check("catalog $id", cat["$id"] == "https://hermes.local/a2ui/hermes-rich-ui/1/catalog.json")
check("catalog protocolVersion", cat["protocolVersion"] == "1.0")
check("catalog has 18 components", len(cat["components"]) == 18, len(cat["components"]))
check("catalog functions empty", cat["functions"] == {})
check("catalog anyFunction false", cat["$defs"]["anyFunction"] is False)
check("catalog anyComponent covers all", sorted(r["$ref"].rsplit("/", 1)[-1] for r in cat["$defs"]["anyComponent"]["oneOf"]) == sorted(cat["components"]))
check("catalog instructions <= 1200", len(cat["instructions"]) <= 1200, len(cat["instructions"]))
check("every component closed + common props", all(
    s.get("additionalProperties") is False and {"id", "component", "accessibility", "sourceIds"} <= set(s["properties"])
    and "id" in s["required"] and "component" in s["required"] for s in cat["components"].values()))
expected = ["Card", "Stack", "Grid", "Divider", "Tabs", "Accordion", "Heading", "Text", "Callout", "Badge", "Metric",
            "Progress", "KeyValueList", "Image", "DataTable", "Chart", "Timeline", "SourceList"]
check("catalog component names per CONTRACTS §2", sorted(cat["components"]) == sorted(expected))

# ------------------------------------------------------------------ helpers
check("pointer ~0 ~1 decoding", resolve_pointer({"a/b": {"c~d": 5}}, "/a~1b/c~0d") == (True, 5))
check("pointer array index", resolve_pointer({"x": [1, 2]}, "/x/1") == (True, 2))
check("pointer bad index", resolve_pointer({"x": [1, 2]}, "/x/01")[0] is False)
check("pointer missing", resolve_pointer({"x": 1}, "/y")[0] is False)
check("url https ok", check_url("https://example.org/a?b=1") is None)
check("url http rejected", check_url("http://example.org") is not None)
check("url userinfo rejected", check_url("https://user:pw@example.org") is not None)
check("url control char rejected", check_url("https://example.org/\x01") is not None)

# ------------------------------------------------------------------ positives
research = load_surface("research")
explanation = load_surface("explanation")
norm_r = admits("examples/research admits", research["components"], research["dataModel"])
norm_e = admits("examples/explanation admits", explanation["components"], explanation["dataModel"])
check("research surface catalogId", research["catalogId"] == CATALOG_ID)
check("normalized applies Metric.format default", any(c["id"] == "count" and c.get("format") == "number" for c in norm_r))
check("normalized applies Text defaults", any(c["id"] == "intro" and c.get("tone") == "default" and c.get("variant") == "body" for c in norm_e))
check("normalized never mutates input", all("format" not in c for c in research["components"] if c["id"] == "count"))
check("normalized is a distinct list", norm_r is not research["components"])

# richer positive: every container kind, bound + literal values, nested Tabs/Accordion
full = [
    card("stack", "tabs", "acc", "kv", "img", "prog", "badge", "h", "div", "chart_line", "chart_scatter", "src"),
    {"id": "stack", "component": "Stack", "direction": "horizontal", "gap": "sm", "children": ["m1", "m2"]},
    {"id": "m1", "component": "Metric", "label": "bound", "value": {"path": "/data/n"}, "unit": "USD"},
    {"id": "m2", "component": "Metric", "label": "null ok", "value": None},
    {"id": "tabs", "component": "Tabs", "tabs": [{"title": "A", "child": "ta"}, {"title": {"path": "/meta/summary"}, "child": "tb"}]},
    text("ta"), text("tb", "line1\nline2"),
    {"id": "acc", "component": "Accordion", "items": [{"title": "Open", "child": "ac1", "open": True}]},
    {"id": "ac1", "component": "Grid", "columns": 2, "children": ["g1", "g2"]},
    text("g1"), {"id": "g2", "component": "Callout", "text": "c", "tone": "success", "sourceIds": ["s1"]},
    {"id": "kv", "component": "KeyValueList", "items": [{"label": "a", "value": 1}, {"label": "b", "value": None, "sourceIds": ["s1"]}]},
    {"id": "img", "component": "Image", "src": "https://example.org/i.png", "alt": "an image", "maxHeight": 200},
    {"id": "prog", "component": "Progress", "current": {"path": "/data/n"}, "total": 100},
    {"id": "badge", "component": "Badge", "label": "ok", "tone": "success"},
    {"id": "h", "component": "Heading", "text": "H", "level": 3, "accessibility": {"label": "heading"}},
    {"id": "div", "component": "Divider", "label": "—"},
    {"id": "chart_line", "component": "Chart", "kind": "line", "series": [{"label": "l", "data": [{"x": "2026-01-01", "y": 1}, {"x": "2026-01-02", "y": None}]}]},
    {"id": "chart_scatter", "component": "Chart", "kind": "scatter", "series": [{"label": "s", "data": {"path": "/data/pts"}}]},
    {"id": "src", "component": "SourceList"},
]
full_dm = dm(data={"n": 42, "pts": [{"x": 1, "y": 2, "label": "p"}]})
admits("full-coverage surface admits", full, full_dm)
admits("sourceIds inside bound table rows resolve", [
    card("t"),
    {"id": "t", "component": "DataTable", "columns": [{"key": "a", "label": "A", "type": "text"}, {"key": "sourceIds", "label": "E", "type": "sources"}],
     "rows": {"path": "/data/rows"}},
], dm(data={"rows": [{"a": "x", "sourceIds": ["s1"]}]}))
admits("derivation with ~1 escaped path resolves", [card("x"), text("x")],
       dm(data={"a/b": 1}, derivations=[{"id": "d", "output_path": "/data/a~1b", "input_paths": [], "method": "m"}]))
admits("meta binding allowed", [card("x"), {"id": "x", "component": "Text", "text": {"path": "/meta/summary"}}], dm())

# ------------------------------------------------------------------ negative controls
rejects("missing root", [text("a")], dm(), "root")
rejects("cycle", [card("a"), {"id": "a", "component": "Stack", "children": ["b"]}, {"id": "b", "component": "Stack", "children": ["a"]}], dm(), "cycle")
rejects("shared child", [card("a", "b"), {"id": "a", "component": "Stack", "children": ["c"]}, {"id": "b", "component": "Stack", "children": ["c"]}, text("c")], dm(), "shared child")
rejects("unreachable component", [card("a"), text("a"), text("orphan")], dm(), "unreachable")
rejects("dangling child ref", [card("nope")], dm(), "does not resolve")
rejects("unknown component type", [card("a"), {"id": "a", "component": "Button", "label": "x"}], dm(), "unknown component type")
rejects("unknown prop", [card("a"), {"id": "a", "component": "Text", "text": "x", "color": "red"}], dm(), "unknown property 'color'")
rejects("action field", [card("a"), {"id": "a", "component": "Badge", "label": "x", "action": {"event": {"name": "go"}}}], dm(), "unknown property 'action'")
rejects("function call as value", [card("a"), {"id": "a", "component": "Text", "text": {"call": "formatString", "args": {"value": "x"}}}], dm(), "unknown property 'call'")
rejects("catalogId override on component", [card("a"), {"id": "a", "component": "Text", "text": "x", "catalogId": "other"}], dm(), "unknown property 'catalogid'")
rejects("__proto__ key (components)", [card("a"), {"id": "a", "component": "Text", "text": "x", "__proto__": {"polluted": 1}}], dm(), "forbidden key '__proto__'")
rejects("constructor key (data, deep)", [card("a"), text("a")], dm(data={"x": [{"constructor": 1}]}), "forbidden key 'constructor'")
rejects("http:// image", [card("a"), {"id": "a", "component": "Image", "src": "http://example.org/i.png", "alt": "x"}], dm(), "https")
rejects("url with userinfo", [card("a"), {"id": "a", "component": "Image", "src": "https://u:p@example.org/i.png", "alt": "x"}], dm(), "credentials")
rejects("source url http in meta", [card("a"), text("a")], dm(sources=[{"id": "s1", "kind": "web", "label": "S", "url": "http://example.org"}]), "https")
rejects("dangling sourceId", [card("a"), {"id": "a", "component": "Text", "text": "x", "sourceIds": ["nope"]}], dm(), "sourceid 'nope' does not resolve")
rejects("dangling derivation output_path", [card("a"), text("a")],
        dm(derivations=[{"id": "d", "output_path": "/data/missing", "input_paths": [], "method": "m"}]), "derivation path '/data/missing' does not resolve")
rejects("dangling derivation input_path", [card("a"), text("a")],
        dm(data={"y": 1}, derivations=[{"id": "d", "output_path": "/data/y", "input_paths": ["/data/x"], "method": "m"}]), "derivation path '/data/x' does not resolve")
rejects("DataBinding outside /data|/meta", [card("a"), {"id": "a", "component": "Text", "text": {"path": "/other/x"}}], {"data": {}, "meta": dm()["meta"], }, "pattern")
rejects("DataBinding to /meta root not allowed", [card("a"), {"id": "a", "component": "Text", "text": {"path": "/meta"}}], dm(), "pattern")
rejects("DataBinding unresolved", [card("a"), {"id": "a", "component": "Text", "text": {"path": "/data/nope"}}], dm(), "does not resolve")
rejects("DataBinding wrong resolved type", [card("a"), {"id": "a", "component": "Metric", "label": "x", "value": {"path": "/data/s"}}], dm(data={"s": "str"}), "resolved /data/s")
rejects("65 components", [card(*["c%d" % i for i in range(64)])] + [text("c%d" % i) for i in range(64)], dm(), "65 components exceeds 64")
deep = [card("d1")] + [{"id": "d%d" % i, "component": "Stack", "children": ["d%d" % (i + 1)]} for i in range(1, 8)] + [text("d8")]
rejects("depth 9", deep, dm(), "depth 9 exceeds 8")
deep_ok = [card("d1")] + [{"id": "d%d" % i, "component": "Stack", "children": ["d%d" % (i + 1)]} for i in range(1, 7)] + [text("d7")]
admits("depth 8 admits", deep_ok, dm())
table = [card("t"), {"id": "t", "component": "DataTable", "columns": [{"key": "a", "label": "A", "type": "number"}], "rows": {"path": "/data/rows"}}]
rejects("101 table rows", table, dm(data={"rows": [{"a": i} for i in range(101)]}), "101 items exceeds maximum 100")
admits("100 table rows admit", table, dm(data={"rows": [{"a": i} for i in range(100)]}))
rejects("undeclared column key in row", table, dm(data={"rows": [{"a": 1, "zz": 2}]}), "undeclared column key 'zz'")
rejects("13 columns", [card("t"), {"id": "t", "component": "DataTable", "columns": [{"key": "k%d" % i, "label": "L", "type": "text"} for i in range(13)], "rows": []}], dm(), "13 items exceeds maximum 12")
chart = [card("c"), {"id": "c", "component": "Chart", "kind": "bar", "series": [{"label": "s", "data": {"path": "/data/pts"}}]}]
rejects("513 points", chart, dm(data={"pts": [{"label": str(i), "value": i} for i in range(513)]}), "513 items exceeds maximum 512")
rejects("5 series", [card("c"), {"id": "c", "component": "Chart", "kind": "bar", "series": [{"label": "s", "data": []} for _ in range(5)]}], dm(), "5 items exceeds maximum 4")
rejects("bar point wrong shape", chart, dm(data={"pts": [{"x": 1, "y": 2}]}), "missing required property 'label'")
rejects("histogram bin count non-integer", [card("c"), {"id": "c", "component": "Chart", "kind": "histogram", "series": [{"label": "s", "data": [{"low": 0, "high": 1, "count": 1.5}]}]}], dm(), "expected integer")
rejects("NaN in data", [card("a"), text("a")], dm(data={"x": float("nan")}), "finite")
rejects("Infinity in component", [card("a"), {"id": "a", "component": "Metric", "label": "x", "value": float("inf")}], dm(), "finite")
rejects("string 4097 chars", [card("a"), text("a", "x" * 4097)], dm(), "4096")
rejects("string 4097 chars in data", [card("a"), text("a")], dm(data={"s": "y" * 4097}), "4096")
rejects("timeline 31 items", [card("t"), {"id": "t", "component": "Timeline", "items": [{"label": "i"} for _ in range(31)]}], dm(), "31 items exceeds maximum 30")
rejects("kv 33 items (bound)", [card("k"), {"id": "k", "component": "KeyValueList", "items": {"path": "/data/kv"}}], dm(data={"kv": [{"label": "l", "value": 1}] * 33}), "33 items exceeds maximum 32")
rejects("33 sources", [card("a"), text("a")], dm(sources=[{"id": "s%d" % i, "kind": "web", "label": "x"} for i in range(33)]), "33 sources exceeds 32")
rejects("leaf with children", [card("a"), {"id": "a", "component": "Text", "text": "x", "children": []}], dm(), "leaf type")
rejects("Card with 0 children", [card()], dm(), "fewer than 1")
rejects("Grid columns 5", [card("g"), {"id": "g", "component": "Grid", "columns": 5, "children": ["a"]}, text("a")], dm(), "above maximum 4")
rejects("enum violation (Callout tone)", [card("a"), {"id": "a", "component": "Callout", "text": "x", "tone": "danger"}], dm(), "expected one of")
rejects("missing required (Callout tone)", [card("a"), {"id": "a", "component": "Callout", "text": "x"}], dm(), "missing required property 'tone'")
rejects("dataModel extra top-level key", [card("a"), text("a")], dict(dm(), extra=1), "exactly the keys")
rejects("data nesting depth 13", [card("a"), text("a")], dm(data=json.loads("[" * 13 + "1" + "]" * 13)), "nesting deeper than 12")
rejects("duplicate component id", [card("a"), text("a"), text("a")], dm(), "duplicate component id")
rejects("root as a child", [card("a"), {"id": "a", "component": "Stack", "children": ["root"]}], dm(), "'root' cannot be a child")
big = [card(*["b%d" % i for i in range(20)])] + [text("b%d" % i, "z" * 4000) for i in range(20)]
rejects("components JSON > 64 KiB", big, dm(), "bytes exceeds 65536")
rejects("dataModel > 128 KiB", [card("a"), text("a")], dm(data={"k%d" % i: "z" * 4000 for i in range(40)}), "bytes exceeds 131072")

# ------------------------------------------------------------------ summary
failed = [n for n, ok in RESULTS if not ok]
print("---")
print("%d assertions, %d failed, %d negative controls" % (len(RESULTS), len(failed), NEGATIVE))
if failed:
    print("FAILED: " + ", ".join(failed))
    sys.exit(1)
