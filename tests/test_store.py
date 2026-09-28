"""engine/store.py — atomic write, id validation (incl. traversal), quota refusal."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import Runner, load  # noqa: E402

store = load("engine/store.py", "store")


def record(cid):
    return {"envelope": {"card_id": cid}, "surface": {"x": 1}}


def test_new_card_id_shape():
    ids = {store.new_card_id() for _ in range(50)}
    assert len(ids) == 50
    for i in ids:
        assert store.CARD_ID_RE.match(i), i


def test_write_then_read_roundtrip_atomic():
    cid = store.new_card_id()
    p = store.write_card(record(cid))
    assert p == store.cards_dir() / (cid + ".json")
    assert json.loads(p.read_text())["envelope"]["card_id"] == cid
    assert store.read_card(cid) == record(cid)
    # no tmp residue after a successful replace
    assert [x for x in store.cards_dir().iterdir() if x.name.endswith(".tmp")] == []
    assert store.card_count() == 1


def test_atomic_write_failure_leaves_no_partial():
    cid = store.new_card_id()
    store.write_card(record(cid))
    before = (store.cards_dir() / (cid + ".json")).read_bytes()
    orig = os.replace

    def boom(a, b):
        raise OSError("simulated replace failure")
    os.replace = boom
    try:
        try:
            store.write_card({"envelope": {"card_id": cid}, "surface": {"x": 2}})
            assert False, "expected OSError"
        except OSError:
            pass
    finally:
        os.replace = orig
    assert (store.cards_dir() / (cid + ".json")).read_bytes() == before
    assert [x for x in store.cards_dir().iterdir() if x.name.endswith(".tmp")] == []


def test_read_rejects_bad_ids_before_disk():
    store.cards_dir().mkdir(parents=True)
    (store.cards_dir() / "..x.json").write_text("{}")
    for bad in ("../x", "ru-../../etc/passwd", "ru-ABCDEF123456", "ru-abc", "", None, 5,
                "ru-0123456789ab/../x", "ru-0123456789abc",
                "ru-abcdef123456\n", "\nru-abcdef123456"):  # REVIEW-C0 E7: fullmatch, no trailing newline
        assert store.read_card(bad) is None, bad
        assert not store.valid_card_id(bad), bad
    assert store.read_card("ru-0123456789ab") is None  # valid shape, absent


def test_write_rejects_bad_ids():
    for bad in ("../x", "ru-ABCDEF123456", None, "x"):
        try:
            store.write_card(record(bad))
            assert False, bad
        except store.StoreError:
            pass
    assert not store.cards_dir().exists() or store.card_count() == 0


def test_quota_refuses_never_deletes():
    cid1 = store.new_card_id()
    store.write_card(record(cid1))
    used = store.dir_bytes(store.cards_dir())
    assert used > 0
    orig = store.QUOTA_BYTES
    store.QUOTA_BYTES = used + 10  # next record cannot fit
    try:
        try:
            store.write_card(record(store.new_card_id()))
            assert False, "expected QuotaExceeded"
        except store.QuotaExceeded as e:
            assert "quota exceeded" in str(e) and "nothing is deleted" in str(e).lower()
    finally:
        store.QUOTA_BYTES = orig
    assert store.card_count() == 1
    assert store.read_card(cid1) == record(cid1)


def test_views_roundtrip_and_ids():
    comps = [{"id": "root", "component": "Card", "children": []}]
    p = store.save_view("my-view", "Title", comps)
    assert p == store.views_dir() / "my-view.json"
    v = store.load_view("my-view")
    assert v["title"] == "Title" and v["components"] == comps and v["view_id"] == "my-view"
    for bad in ("../x", "My-View", "1abc", "", None, "a" * 65, "a_b", "abc\n", "abc\r"):  # E7
        assert store.load_view(bad) is None, bad
        assert not store.valid_view_id(bad), bad
        try:
            store.save_view(bad, "t", comps)
            assert False, bad
        except store.StoreError:
            pass
    assert store.load_view("absent") is None


if __name__ == "__main__":
    r = Runner()
    for t in (test_new_card_id_shape, test_write_then_read_roundtrip_atomic,
              test_atomic_write_failure_leaves_no_partial, test_read_rejects_bad_ids_before_disk,
              test_write_rejects_bad_ids, test_quota_refuses_never_deletes, test_views_roundtrip_and_ids):
        r.run(t)
    r.finish()
