"""#38 door-only slice: actionable field errors + one admission reply; no defaults."""
from __future__ import annotations

import copy
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import COMPONENTS_OK, Runner, fake_admit_ok, load  # noqa: E402

tool = load("engine/tool.py", "error_fixes")
REAL_ADMIT = tool.admit
ARGS = {"title": "Offers", "summary": "n is 3", "components": COMPONENTS_OK,
        "data": {"n": 3}}
FIXTURES = json.loads((Path(__file__).parent / "fixtures/mistakes/door.json").read_text())


def test_door_error_corpus_names_exact_fix():
    tool.admit = fake_admit_ok
    try:
        for case in FIXTURES:
            args = copy.deepcopy(ARGS)
            if "remove" in case:
                args.pop(case["remove"])
            args.update(case.get("set", {}))
            original = copy.deepcopy(args)
            out = tool.rich_present(args)
            assert out["ok"] is False, (case["name"], out)
            lines = [e for e in out["errors"] if e.startswith(case["prefix"])]
            assert len(lines) == 1, (case["name"], out)
            assert lines[0].endswith(" — " + case["fix"]), lines
            assert re.fullmatch(r"[^:]+: .+ — .+", lines[0]), lines
            assert args == original, case["name"]
            assert tool.store.card_count() == 0
            assert not tool.store.views_dir().exists()
    finally:
        tool.admit = REAL_ADMIT


def test_missing_title_and_bad_component_return_together():
    args = copy.deepcopy(ARGS)
    args.pop("title")
    args.pop("summary")
    args["components"][1]["value"] = "12"
    before = copy.deepcopy(args)
    out = tool.rich_present(args)
    assert out["ok"] is False, out
    assert any(e.startswith("title:") and " — " in e for e in out["errors"]), out
    assert any(e.startswith("summary:") and " — " in e for e in out["errors"]), out
    assert any("/value:" in e and "number" in e.lower() for e in out["errors"]), out
    assert args == before, "do not coerce the numeric string or supply defaults"
    assert tool.store.card_count() == 0
    assert not tool.store.views_dir().exists()


def test_all_door_errors_and_admission_errors_write_nothing():
    calls = []
    component_error = "m: /value: expected number — use a number"

    def spy(components, data_model):
        calls.append((copy.deepcopy(components), copy.deepcopy(data_model)))
        return ([component_error], components)

    args = dict(ARGS, title=12, summary="", data=[], sources={}, derivations={},
                save_view_as="Bad Id")
    before = copy.deepcopy(args)
    tool.admit = spy
    try:
        out = tool.rich_present(args)
    finally:
        tool.admit = REAL_ADMIT
    assert len(calls) == 1, calls
    assert len(out["errors"]) == 7, out
    assert out["errors"][-1] == component_error, out
    assert all(" — " in line for line in out["errors"]), out
    assert calls[0][0] == args["components"]
    dm = calls[0][1]
    assert dm["data"] == [] and dm["meta"]["title"] == 12
    assert dm["meta"]["summary"] == "" and dm["meta"]["sources"] == {}
    assert dm["meta"]["derivations"] == {}
    assert args == before
    assert tool.store.card_count() == 0
    assert not tool.store.views_dir().exists()


def test_non_list_components_never_reach_admission():
    def forbidden(components, data_model):
        raise AssertionError("non-list components reached admission")

    tool.admit = forbidden
    try:
        for value in (None, {}, "root", 12):
            out = tool.rich_present(dict(ARGS, components=value))
            assert out["ok"] is False, out
            assert any(e.startswith("components:") and " — " in e for e in out["errors"]), out
            assert "internal" not in str(out), out
    finally:
        tool.admit = REAL_ADMIT
    assert tool.store.card_count() == 0


def test_unexpected_admission_shape_keeps_door_errors():
    tool.admit = lambda components, data_model: None
    try:
        out = tool.rich_present(dict(ARGS, title=None))
    finally:
        tool.admit = REAL_ADMIT
    assert out["ok"] is False, out
    assert any(e.startswith("title:") for e in out["errors"]), out
    assert any(e.startswith("admission: returned an unexpected shape") for e in out["errors"]), out
    assert tool.store.card_count() == 0


if __name__ == "__main__":
    runner = Runner()
    for test in (test_door_error_corpus_names_exact_fix,
                 test_missing_title_and_bad_component_return_together,
                 test_all_door_errors_and_admission_errors_write_nothing,
                 test_non_list_components_never_reach_admission,
                 test_unexpected_admission_shape_keeps_door_errors):
        runner.run(test)
    runner.finish()
