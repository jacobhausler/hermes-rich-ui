"""engine/tool.py — rich_present: §1 record shape, source-field rejection, no write on
admission errors, view save+reuse, handler never raises. admit is monkeypatched."""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import COMPONENTS_OK, Runner, fake_admit_ok, load  # noqa: E402

tool = load("engine/tool.py", "tool")
store = tool.store
tool.admit = fake_admit_ok

ARGS = {"title": "Offers", "summary": "n is 3", "components": COMPONENTS_OK, "data": {"n": 3},
        "sources": [{"id": "s1", "kind": "web", "label": "x", "url": "https://x"}],
        "derivations": [{"id": "d1", "output_path": "/data/n", "input_paths": [], "method": "count"}]}


def test_happy_path_record_shape():
    os.environ["HERMES_SESSION_ID"] = "sess-1"
    os.environ["HERMES_PROFILE"] = "default"
    try:
        out = tool.rich_present(dict(ARGS))
    finally:
        os.environ.pop("HERMES_SESSION_ID"); os.environ.pop("HERMES_PROFILE")
    assert out["ok"] is True, out
    cid = out["card_id"]
    assert store.CARD_ID_RE.match(cid)
    assert out["directive"] == '::richui{id="%s"}' % cid
    assert out["summary"] == "n is 3" and out["warnings"] == []
    assert set(out) == {"ok", "card_id", "directive", "summary", "warnings"}
    rec = store.read_card(cid)
    assert set(rec) == {"envelope", "surface"}
    env = rec["envelope"]
    assert list(env) == ["card_id", "session_id", "profile", "created_at", "policy", "source", "revision"]
    assert env["card_id"] == cid and env["session_id"] == "sess-1" and env["profile"] == "default"
    assert re.match(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$", env["created_at"]), env["created_at"]
    assert env["policy"] == "embedded" and env["source"] is None and env["revision"] == 1
    assert set(rec["surface"]) == {"version", "createSurface"} and rec["surface"]["version"] == "v1.0"
    cs = rec["surface"]["createSurface"]
    assert list(cs) == ["surfaceId", "catalogId", "components", "dataModel", "metadata"]
    assert cs["surfaceId"] == cid and cs["catalogId"] == "hermes-rich-ui/1"
    assert cs["components"] == COMPONENTS_OK
    assert cs["metadata"] == {"extensions": {"hermes_policy": "embedded"}}
    dm = cs["dataModel"]
    assert set(dm) == {"data", "meta"}
    assert dm["data"] == {"n": 3}
    meta = dm["meta"]
    assert set(meta) == {"title", "summary", "authored_at", "dataset", "sources", "derivations"}
    assert meta["title"] == ARGS["title"]
    assert meta["summary"] == "n is 3" and meta["authored_at"] == env["created_at"]
    assert meta["dataset"] == {"id": "card:" + cid, "revision": 1, "observed_at": None,
                               "published_at": env["created_at"]}
    assert meta["sources"] == ARGS["sources"] and meta["derivations"] == ARGS["derivations"]


def test_session_env_absent_is_null():
    os.environ.pop("HERMES_SESSION_ID", None); os.environ.pop("HERMES_PROFILE", None)
    out = tool.rich_present(dict(ARGS))
    env = store.read_card(out["card_id"])["envelope"]
    assert env["session_id"] is None and env["profile"] is None


def test_rejects_source_fields_before_admit():
    calls = []

    def spy(c, d):
        calls.append(1)
        return ([], list(c))
    tool.admit = spy
    try:
        for k in ("source_id", "mode", "poll_ms", "update_until"):
            out = tool.rich_present(dict(ARGS, **{k: "x"}))
            assert out["ok"] is False and len(out["errors"]) == 1, out
            assert k in out["errors"][0] and "rich_present_source" in out["errors"][0], out
    finally:
        tool.admit = fake_admit_ok
    assert calls == []
    assert store.card_count() == 0


def test_admit_errors_write_nothing():
    tool.admit = lambda c, d: (["m: value must be DynamicNumber", "/data/x: unbound"], c)
    try:
        out = tool.rich_present(dict(ARGS))
    finally:
        tool.admit = fake_admit_ok
    assert out == {"ok": False, "errors": ["m: value must be DynamicNumber", "/data/x: unbound"]}
    assert not store.cards_dir().exists() or store.card_count() == 0


def test_admit_receives_data_model_and_normalized_is_stored():
    seen = {}

    def spy(c, d):
        seen["c"], seen["d"] = c, d
        return ([], [dict(x, normalized=True) for x in c])
    tool.admit = spy
    try:
        out = tool.rich_present(dict(ARGS))
    finally:
        tool.admit = fake_admit_ok
    assert seen["c"] == COMPONENTS_OK and set(seen["d"]) == {"data", "meta"}
    comps = store.read_card(out["card_id"])["surface"]["createSurface"]["components"]
    assert all(x.get("normalized") for x in comps)


def test_missing_required_fields():
    out = tool.rich_present({"summary": "x"})
    assert out["ok"] is False
    assert any(e.startswith("title:") for e in out["errors"])
    assert any(e.startswith("components:") for e in out["errors"])
    out = tool.rich_present(dict(ARGS, data=[1]))
    assert out["ok"] is False and any(e.startswith("data:") for e in out["errors"])
    assert store.card_count() == 0


def test_view_save_and_reuse():
    out = tool.rich_present(dict(ARGS, save_view_as="offers-v1"))
    assert out["ok"] is True and out["warnings"] == [], out
    v = store.load_view("offers-v1")
    assert v["title"] == "Offers" and v["components"] == COMPONENTS_OK
    out2 = tool.rich_present({"view": "offers-v1", "summary": "reuse", "data": {"n": 9}})
    assert out2["ok"] is True, out2
    cs = store.read_card(out2["card_id"])["surface"]["createSurface"]
    assert cs["components"] == COMPONENTS_OK and cs["dataModel"]["data"] == {"n": 9}
    out3 = tool.rich_present({"view": "absent", "summary": "x"})
    assert out3["ok"] is False and out3["errors"][0].startswith("view:")
    out4 = tool.rich_present({"view": "../etc", "summary": "x"})
    assert out4["ok"] is False and "invalid" in out4["errors"][0]
    out5 = tool.rich_present(dict(ARGS, save_view_as="Bad Id"))
    assert out5["ok"] is False and out5["errors"][0].startswith("save_view_as:")
    assert store.card_count() == 2
    # REVIEW-C0 E10: view + components together is refused; overwriting a view warns.
    out6 = tool.rich_present(dict(ARGS, view="offers-v1"))
    assert out6["ok"] is False and out6["errors"] == ["/: give view OR components, not both"], out6
    out7 = tool.rich_present(dict(ARGS, save_view_as="offers-v1"))
    assert out7["ok"] is True and out7["warnings"] == ["view 'offers-v1' overwritten"], out7
    out8 = tool.rich_present(dict(ARGS, save_view_as="offers-v2"))
    assert out8["ok"] is True and out8["warnings"] == [], out8
    # E7: a trailing newline in save_view_as is invalid (fullmatch), nothing written
    out9 = tool.rich_present(dict(ARGS, save_view_as="viewnl\n"))
    assert out9["ok"] is False and out9["errors"][0].startswith("save_view_as:"), out9
    assert not any("viewnl" in p.name for p in store.views_dir().iterdir())


def test_quota_error_surfaces_no_raise():
    orig = store.QUOTA_BYTES
    store.QUOTA_BYTES = 1
    try:
        out = tool.rich_present(dict(ARGS))
    finally:
        store.QUOTA_BYTES = orig
    assert out["ok"] is False and "quota" in out["errors"][0]


def test_handler_never_raises():
    # REVIEW-C0 E2: an internal exception is logged, never leaked (no trace key,
    # no exception text) — the error string is exactly "/: admission failed (internal)".
    import logging
    captured = []

    class _H(logging.Handler):
        def emit(self, rec):
            captured.append(rec)
    h = _H()
    logging.getLogger("hermes_rich_ui").addHandler(h)
    tool.admit = lambda c, d: 1 / 0
    try:
        s = tool.handle_present(dict(ARGS))
        out_direct = tool.rich_present(dict(ARGS))
    finally:
        tool.admit = fake_admit_ok
        logging.getLogger("hermes_rich_ui").removeHandler(h)
    out = json.loads(s)
    assert out["ok"] is False and out["errors"] == ["/: admission failed (internal)"], out
    assert "trace" not in out and "ZeroDivisionError" not in s
    assert out_direct == {"ok": False, "errors": ["/: admission failed (internal)"]}, out_direct
    assert captured and any(r.exc_info and r.exc_info[0] is ZeroDivisionError for r in captured), "exception must be logged"
    for bad in (None, "not json", "[1]", 7):
        out = json.loads(tool.handle_present(bad))
        assert out["ok"] is False and out["errors"], (bad, out)
    out = json.loads(tool.handle_present(json.dumps(ARGS)))
    assert out["ok"] is True


if __name__ == "__main__":
    r = Runner()
    for t in (test_happy_path_record_shape, test_session_env_absent_is_null,
              test_rejects_source_fields_before_admit, test_admit_errors_write_nothing,
              test_admit_receives_data_model_and_normalized_is_stored, test_missing_required_fields,
              test_view_save_and_reuse, test_quota_error_surfaces_no_raise, test_handler_never_raises):
        r.run(t)
    r.finish()
