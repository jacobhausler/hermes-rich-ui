"""est-phtc7: direct pins for the two dynamic prop types of CONTRACTS §2 — DynamicArray
(array | DataBinding), NullableDynamicNumber (number | null | DataBinding): $defs shape,
use-sites, admit() on literal/binding/resolved-null/unresolvable/malformed; rejects name
the pointer and leave inputs byte-stable; the binding survives norm (admission validates,
never bakes). Hand-written literals, no snapshots (R6). Run: python3 tests/test_dynamic_props.py"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import Runner, load  # noqa: E402

adm = load("engine/admission.py", "admission"); CAT = adm.load_catalog()
DB, ITEMS = {"$ref": "#/$defs/DataBinding"}, [{"label": "a", "value": "b"}]

def dm(data):
    return {"data": data or {}, "meta": {"summary": "t", "authored_at": "2026-09-25T00:00:00Z", "dataset": {"id": "t", "revision": 1, "observed_at": None, "published_at": "2026-09-25T00:00:00Z"}, "sources": [{"id": "s1", "kind": "web", "label": "S1", "url": "https://example.org/x"}], "derivations": []}}

def comps(kv: object = ITEMS, mv: object = 3):
    c = [{"id": "root", "component": "Card", "title": "T", "children": (["kv", "m"] if kv is not None else ["m"])}, {"id": "m", "component": "Metric", "label": "n", "value": mv}]
    if kv is not None:
        c.insert(1, {"id": "kv", "component": "KeyValueList", "items": kv})
    return c

def errs(components, data=None):
    return adm.admit(components, dm(data or {}))[0]

def test_defs_are_documented_unions_and_ndn_use_sites_exact():
    assert CAT["$defs"]["DynamicArray"] == {"oneOf": [{"type": "array"}, DB]} and CAT["$defs"]["NullableDynamicNumber"] == {"oneOf": [{"type": "number"}, {"type": "null"}, DB]}
    ndn = sorted(c + "." + p for c, s in CAT["components"].items() for p, sc in s["properties"].items() if sc.get("$ref") == "#/$defs/NullableDynamicNumber")
    assert ndn == ["Metric.previous", "Metric.value", "Progress.current", "Progress.target", "Progress.total"], ndn

def test_dynamic_array_use_sites_are_array_then_binding():
    for c, prop, cap in [("KeyValueList", "items", 32), ("DataTable", "rows", 100), ("Timeline", "items", 30)]:
        b = CAT["components"][c]["properties"][prop]["oneOf"]
        assert b[0]["type"] == "array" and b[0]["maxItems"] == cap and b[1] == DB, c
    assert (lambda d: d[0]["type"] == "array" and d[0]["maxItems"] == 512 and d[1] == DB)(CAT["components"]["Chart"]["properties"]["series"]["items"]["properties"]["data"]["oneOf"])

def test_admit_accepts_literal_and_binding_and_norm_keeps_binding():
    assert errs(comps()) == []
    errors, norm = adm.admit(comps({"path": "/data/items"}), dm({"items": ITEMS})); assert errors == [] and norm[1]["items"] == {"path": "/data/items"}

def test_binding_rejects_name_resolution_pattern_and_inputs_stay_stable():
    payload, model = comps({"path": "/data/o"}), dm({"o": {"k": 1}}); before = repr([payload, model])
    assert any("(resolved /data/o)" in x and "expected array, got object" in x for x in adm.admit(payload, model)[0])
    assert before == repr([payload, model])
    assert any("does not resolve" in x for x in errs(comps({"path": "/data/gone"})))
    assert any("unknown property 'x'" in x for x in errs(comps({"path": "/data/items", "x": 1}), {"items": ITEMS}))
    assert any("does not match pattern" in x for x in errs(comps({"path": "items"})))

def test_nullable_number_admits_literal_and_resolved_null_rejects_wrong_types():
    assert errs(comps(kv=None, mv=None)) == [] and errs(comps(mv={"path": "/data/v"}), {"v": None}) == []
    e = errs(comps(mv={"path": "/data/v"}), {"v": "x"})
    assert any("(resolved /data/v)" in x and "expected number | null, got string" in x for x in e), e
    assert any("number | null | DataBinding, got string" in x for x in errs(comps(kv=None, mv="x")))

if __name__ == "__main__":
    r = Runner()
    for t in (test_defs_are_documented_unions_and_ndn_use_sites_exact, test_dynamic_array_use_sites_are_array_then_binding,
              test_admit_accepts_literal_and_binding_and_norm_keeps_binding, test_binding_rejects_name_resolution_pattern_and_inputs_stay_stable, test_nullable_number_admits_literal_and_resolved_null_rejects_wrong_types):
        r.run(t)
    r.finish()
