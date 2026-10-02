"""Failing-then-passing tests for #54 (audit RUI-02): the quota check and the
commit in write_card were not serialized, so two concurrent writers that each
fit under QUOTA_BYTES could both commit and collectively bust the cap. These
tests exercise the critical section with threads AND separate processes; they
must fail on main@98f4a6d (both writers ok) and pass with the flock'd store."""
from __future__ import annotations

import json
import multiprocessing
import os
import sys
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import Runner, fresh_home, load  # noqa: E402

store = load("engine/store.py", "store")

QUOTA_TEST = 1000
# The survivor commits alone after its peer is refused, so it only waits out
# this barrier timeout; keep it short so the serial suite stays fast.
BARRIER_TIMEOUT = 3


def record(cid):
    return {"envelope": {"card_id": cid}, "surface": {"x": 1}}


def padded_record(cid, pad):
    return {"envelope": {"card_id": cid}, "surface": {"x": 1}, "pad": "p" * pad}


def _size(rec):
    return len(json.dumps(rec, ensure_ascii=False, indent=2, sort_keys=False).encode("utf-8"))


def sized_record(cid, target):
    """Record whose serialized bytes straddle `target` exactly (json adds
    escape quotes, so nudge until len is just below target)."""
    pad = 0
    while _size(padded_record(cid, pad + 1)) < target:
        pad += 1
    return padded_record(cid, pad)


def assert_quota_straddle(rec_a, rec_b):
    """Both records individually fit the test cap; together they do not."""
    a, b = _size(rec_a), _size(rec_b)
    assert a <= QUOTA_TEST and b <= QUOTA_TEST, (a, b)
    assert a + b > QUOTA_TEST, (a, b)


def _gated_write(mod, rec, barrier):
    """Call the real write_card with the commit gated on `barrier` so both
    admission checks provably happen before either commit. A writer that is
    correctly refused before the commit never reaches the barrier; the timeout
    keeps the lone survivor from hanging the run."""
    orig = mod._atomic_write

    def gated(path, payload):
        try:
            barrier.wait(timeout=BARRIER_TIMEOUT)
        except threading.BrokenBarrierError:
            pass  # peer was refused before committing; commit alone
        return orig(path, payload)

    mod._atomic_write = gated
    try:
        mod.write_card(rec)
        return "ok"
    except mod.QuotaExceeded:
        return "quota"
    finally:
        mod._atomic_write = orig


def check_quota_outcome(results, label):
    assert sorted(results) == ["ok", "quota"], "%s: %r" % (label, results)
    assert store.dir_bytes(store.cards_dir()) <= QUOTA_TEST, "committed bytes bust the cap"
    assert store.card_count() == 1, store.card_count()
    assert [x for x in store.cards_dir().iterdir() if x.name.endswith(".tmp")] == []


def test_quota_race_threads_barrier():
    fresh_home()
    cid_a, cid_b = store.new_card_id(), store.new_card_id()
    rec_a, rec_b = sized_record(cid_a, QUOTA_TEST - 5), sized_record(cid_b, QUOTA_TEST - 5)
    assert_quota_straddle(rec_a, rec_b)
    orig_quota = store.QUOTA_BYTES
    store.QUOTA_BYTES = QUOTA_TEST
    try:
        barrier = threading.Barrier(2)
        results = []

        def worker(rec):
            try:
                results.append(_gated_write(store, rec, barrier))
            except BaseException as exc:  # keep join() from hanging on an unexpected raise
                results.append("error:%r" % (exc,))

        threads = [threading.Thread(target=worker, args=(rec,)) for rec in (rec_a, rec_b)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=60)
        assert len(results) == 2, results
        check_quota_outcome(results, "threads")
    finally:
        store.QUOTA_BYTES = orig_quota


def _quota_child(rec, barrier, queue):
    """Forked child: fresh path-loaded store module, commit gated on the
    shared multiprocessing barrier."""
    mod = load("engine/store.py", "store")
    mod.QUOTA_BYTES = QUOTA_TEST
    orig = mod._atomic_write

    def gated(path, payload):
        try:
            barrier.wait(timeout=BARRIER_TIMEOUT)
        except threading.BrokenBarrierError:
            pass
        return orig(path, payload)

    mod._atomic_write = gated
    try:
        mod.write_card(rec)
        queue.put("ok")
    except mod.QuotaExceeded:
        queue.put("quota")
    except BaseException as exc:
        queue.put("error:%r" % (exc,))


def test_quota_race_separate_processes():
    fresh_home()
    cid_a, cid_b = store.new_card_id(), store.new_card_id()
    rec_a, rec_b = sized_record(cid_a, QUOTA_TEST - 5), sized_record(cid_b, QUOTA_TEST - 5)
    assert_quota_straddle(rec_a, rec_b)
    barrier = multiprocessing.Barrier(2)
    queue = multiprocessing.Queue()
    procs = [multiprocessing.Process(target=_quota_child, args=(rec, barrier, queue))
             for rec in (rec_a, rec_b)]
    for p in procs:
        p.start()
    results = sorted(queue.get(timeout=60) for _ in procs)
    for p in procs:
        p.join(timeout=30)
    assert [x for x in store.cards_dir().iterdir() if x.name.endswith(".tmp")] == []
    check_quota_outcome(results, "processes")


def test_write_failure_releases_lock():
    # A commit that blows up inside the locked section must not strand the
    # store lock or leave .tmp residue; a later legitimate write must proceed
    # and the untouched card must remain byte-identical.
    fresh_home()
    cid_ok = store.new_card_id()
    store.write_card(record(cid_ok))
    before = (store.cards_dir() / (cid_ok + ".json")).read_bytes()
    orig_replace = os.replace

    def boom(a, b):
        raise OSError("simulated replace failure")

    os.replace = boom
    try:
        try:
            store.write_card(record(store.new_card_id()))
            assert False, "expected OSError"
        except OSError:
            pass
    finally:
        os.replace = orig_replace
    cid_after = store.new_card_id()
    store.write_card(record(cid_after))  # deadlocks forever if the lock was stranded
    assert store.read_card(cid_after) == record(cid_after)
    assert (store.cards_dir() / (cid_ok + ".json")).read_bytes() == before
    assert store.read_card(cid_ok) == record(cid_ok)
    assert [x for x in store.cards_dir().iterdir() if x.name.endswith(".tmp")] == []


if __name__ == "__main__":
    r = Runner()
    for t in (test_quota_race_threads_barrier, test_quota_race_separate_processes,
              test_write_failure_releases_lock):
        r.run(t)
    r.finish()
