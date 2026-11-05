"""build_record — §1 record-builder invariants (order, envelope, dataset, determinism).
Expectations hand-written per docs/CONTRACTS.md §1 (R6: no source-text reads/snapshots)."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import COMPONENTS_OK, Runner, load  # noqa: E402

tool = load("engine/tool.py", "tool")
CID = "ru-3f9a1c2b7d4e"
NOW = "2026-11-05T00:00:00Z"
SOURCES = [{"id": "s1", "kind": "web", "label": "x", "url": "https://x"}]
DERIVS = [{"id": "d1", "output_path": "/data/n", "input_paths": [], "method": "count"}]


def _rec():
    return tool.build_record(CID, "T", "s", COMPONENTS_OK, {"n": 1}, SOURCES, DERIVS, now=NOW)

def test_key_order():
    record, data_model = _rec()
    assert list(record) == ["envelope", "surface"]
    assert list(record["envelope"]) == ["card_id", "session_id", "profile", "created_at",
                                        "policy", "source", "revision"]
    assert list(data_model) == ["data", "meta"]
    assert list(data_model["meta"]) == ["title", "summary", "authored_at", "dataset",
                                        "sources", "derivations"]

def test_envelope():
    saved = os.environ.get("HERMES_SESSION_ID")
    try:
        for unset, sess in ((True, None), (False, ""), (False, "sess-9")):
            if unset: os.environ.pop("HERMES_SESSION_ID", None)
            else: os.environ["HERMES_SESSION_ID"] = sess
            env = _rec()[0]["envelope"]
            assert env["card_id"] == CID and env["session_id"] == (sess or None)
            assert env["profile"] == tool._profile_name()  # pin the wiring, not a value
            assert env["created_at"] == NOW and env["policy"] == tool.POLICY
            assert env["source"] is None and env["revision"] == 1
    finally:
        if saved is None: os.environ.pop("HERMES_SESSION_ID", None)
        else: os.environ["HERMES_SESSION_ID"] = saved

def test_dataset():
    meta = _rec()[1]["meta"]
    assert meta["authored_at"] == NOW
    assert meta["dataset"] == {"id": "card:" + CID, "revision": 1,
                               "observed_at": None, "published_at": NOW}

def test_determinism():
    assert json.dumps(_rec()) == json.dumps(_rec())  # now= overrides _now_z: byte-equal

if __name__ == "__main__":
    r = Runner()
    for t in (test_key_order, test_envelope, test_dataset, test_determinism):
        r.run(t)
    r.finish()
