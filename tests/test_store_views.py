"""engine/store.py view layer — direct unit tests (nightly slice est-xnlin).

Covers list_views (stable order, malformed skip, never-mkdir), save_view
validation rejects, and hermes_home HERMES_HOME override. Store-only, stdlib.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import Runner, load  # noqa: E402

store = load("engine/store.py", "store_views_test_store")

COMPS = [{"id": "root", "component": "Card", "children": []}]


class home:
    """Point HERMES_HOME at a throwaway dir for the duration of a test."""

    def __init__(self):
        self._td = None

    def __enter__(self):
        self._td = tempfile.TemporaryDirectory(prefix="rui-store-views-")
        self.patch = mock.patch.dict(os.environ, {"HERMES_HOME": self._td.name})
        self.patch.__enter__()
        self.root = Path(self._td.name) / "rich-ui"
        return self.root

    def __exit__(self, *exc):
        self.patch.__exit__(None, None, None)
        self._td.cleanup()
        return False


def test_hermes_home_honors_env_and_falls_back():
    with mock.patch.dict(os.environ, {"HERMES_HOME": "/tmp/rui-throwaway-home"}):
        assert store.hermes_home() == Path("/tmp/rui-throwaway-home")
    with mock.patch.dict(os.environ, {"HERMES_HOME": ""}):  # empty means unset
        assert store.hermes_home() == Path.home() / ".hermes"
    with mock.patch.dict(os.environ, clear=False):
        os.environ.pop("HERMES_HOME", None)
        assert store.hermes_home() == Path.home() / ".hermes"


def test_list_views_absent_store_is_empty_and_never_mkdirs():
    with home() as root:
        assert store.list_views() == []
        assert not root.exists(), "list_views must not create the store"


def test_list_views_stable_sorted_order():
    with home():
        for vid in ("z-last", "m-mid", "a-first"):
            store.save_view(vid, vid.title(), COMPS)
        assert [v["view_id"] for v in store.list_views()] == ["a-first", "m-mid", "z-last"]


def test_list_views_skips_malformed_and_surfaces_json_safe_titles():
    with home() as root:
        store.save_view("good", "Good", COMPS)
        views = root / "views"
        (views / "notes.txt").write_text("no")                    # wrong suffix
        (views / "Bad-Name.json").write_text("{}")                # invalid id stem
        (views / "broken.json").write_text("{not json")           # unparseable
        (views / "ghost.json").write_text(json.dumps(             # id mismatch
            {"view_id": "elsewhere", "title": "T", "components": []}))
        (views / "nolist.json").write_text(json.dumps(            # components not a list
            {"view_id": "nolist", "title": "T", "components": "x"}))
        (views / "notdict.json").write_text("[]")                 # record not an object
        (views / "dir.json").mkdir()                              # directory named .json
        (views / "link.json").symlink_to(views / "good.json")     # symlink refused
        (views / "odd.json").write_text(json.dumps(               # non-str title -> None
            {"view_id": "odd", "title": 7, "components": []}))
        assert store.list_views() == [{"view_id": "good", "title": "Good"},
                                      {"view_id": "odd", "title": None}]


def test_save_view_rejects_bad_id_non_list_components_non_str_title():
    with home() as root:
        for call in (lambda: store.save_view("Bad Id", "t", COMPS),
                     lambda: store.save_view("../x", "t", COMPS),
                     lambda: store.save_view("a" * 65, "t", COMPS),
                     lambda: store.save_view("ok-view", "t", {"not": "a list"}),
                     lambda: store.save_view("ok-view", "t", "components"),
                     lambda: store.save_view("ok-view", None, COMPS),
                     lambda: store.save_view("ok-view", 7, COMPS)):
            try:
                call()
                assert False, "expected StoreError"
            except store.StoreError:
                pass
        assert not (root / "views" / "ok-view.json").exists(), "refusal must write nothing"


if __name__ == "__main__":
    r = Runner()
    for t in (test_hermes_home_honors_env_and_falls_back,
              test_list_views_absent_store_is_empty_and_never_mkdirs,
              test_list_views_stable_sorted_order,
              test_list_views_skips_malformed_and_surfaces_json_safe_titles,
              test_save_view_rejects_bad_id_non_list_components_non_str_title):
        r.run(t)
    r.finish()
