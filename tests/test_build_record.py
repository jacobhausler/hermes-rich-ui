"""engine/tool.py:101 build_record — §1 record-builder invariants (est-m49z7):
exact key order (CONTRACTS §1 / docstring), envelope passthrough+constants,
meta.dataset block, deterministic now=. Hand-written literals, no snapshots."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import COMPONENTS_OK, Runner, load  # noqa: E402

tool = load("engine/tool.py", "tool")

NOW = "2026-11-05T00:00:00Z"
ENV_KEYS = ["card_id", "session_id", "profile", "created_at", "policy", "source", "revision"]
META_KEYS = ["title", "summary", "authored_at", "dataset", "sources", "derivations"]
ARGS = dict(card_id="ru-000000000000", title="T", summary="s", components=COMPONENTS_OK,
            data={"n": 3}, sources=[], derivations=[])


def _rec(**over):
    a = dict(ARGS); a.update(over)
    return tool.build_record(**a, now=NOW)


def test_key_order_is_the_contract_order():
    record, dm = _rec()
    assert list(record) == ["envelope", "surface"], list(record)
    assert list(record["envelope"]) == ENV_KEYS
    assert list(dm) == ["data", "meta"]
    assert list(dm["meta"]) == META_KEYS


def test_envelope_passthrough_and_constants():
    os.environ["HERMES_SESSION_ID"] = "sess-9"; os.environ["HERMES_PROFILE"] = "pinned"
    try:
        env = _rec()[0]["envelope"]
        assert env["card_id"] == ARGS["card_id"] and env["session_id"] == "sess-9"
        assert env["profile"] == tool._profile_name() and env["created_at"] == NOW
        assert env["policy"] == tool.POLICY and env["source"] is None and env["revision"] == 1
    finally:
        os.environ.pop("HERMES_SESSION_ID"); os.environ.pop("HERMES_PROFILE")


def test_session_id_empty_or_unset_is_none():
    for v in (None, ""):  # or-None source shape: empty string must not leak through
        os.environ.pop("HERMES_SESSION_ID", None)
        if v is not None:
            os.environ["HERMES_SESSION_ID"] = v
        assert _rec()[0]["envelope"]["session_id"] is None, repr(v)


def test_dataset_block_and_determinism():
    meta = _rec()[1]["meta"]
    assert meta["authored_at"] == NOW
    assert meta["dataset"] == {"id": "card:" + ARGS["card_id"], "revision": 1,
                               "observed_at": None, "published_at": NOW}
    assert meta["title"] == "T" and meta["summary"] == "s"
    assert meta["sources"] == [] and meta["derivations"] == []
    assert json.dumps(_rec()) == json.dumps(_rec())  # now= overrides _now_z: no clock drift


if __name__ == "__main__":
    r = Runner()
    for t in (test_key_order_is_the_contract_order, test_envelope_passthrough_and_constants,
              test_session_id_empty_or_unset_is_none, test_dataset_block_and_determinism):
        r.run(t)
    r.finish()
