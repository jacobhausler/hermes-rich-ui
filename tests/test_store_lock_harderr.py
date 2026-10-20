"""Failing-if-broken pin: a HARD OSError in the msvcrt lock loop must raise, not hang.

PR #166 review finding (adversary probe): `_lock_exclusive` caught `OSError`
broadly inside the `while True` retry, so a hard error — EBADF on a bad fd, a
sharing violation — loops forever where POSIX `flock` raises at once. The only
error worth waiting out is lock CONTENTION (`LK_LOCK` reports it as EDEADLOCK
after its own ~10 s internal wait); every other errno cannot clear by waiting,
so retrying it is an unbounded hang, not a wait. The sole call site passes a
fresh valid fd (`engine/tool.py:223`), so this is unreachable today — the pin
guards the branch itself, not the call site.

The Windows branch cannot run on the POSIX CI lane, so the scenario runs in a
subprocess shaped like a Windows host: `fcntl` forced absent, `msvcrt` replaced
by a fake that raises the chosen errno. A hang is detected by the subprocess
timeout (bounded RED, never a wedged suite). Same scenario mid-loop (contention
first, then the hard error) is the repro from the finding.
"""
from __future__ import annotations

import os
import subprocess
import sys
import textwrap
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import ROOT, Runner, load  # noqa: E402

STORE = ROOT / "engine" / "store.py"
store = load("engine/store.py", "store")

# A subprocess host: fcntl forced absent, msvcrt swapped for a fake raising a
# per-mode errno sequence. Exits 0 + prints the marker only on the EXPECTED
# outcome (hard errno propagated, or acquisition after contention cleared).
CHILD = textwrap.dedent(
    """
    import importlib.util, errno, os, sys, types
    sys.modules["fcntl"] = None
    spec = importlib.util.spec_from_file_location("store_harderr", sys.argv[1])
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    mode = sys.argv[2]
    calls = []

    def locking(fd, kind, nbytes):
        calls.append(kind)
        if mode == "immediate-hard":
            raise OSError(errno.EBADF, "bad file descriptor (simulated)")
        if len(calls) <= 2:
            raise OSError(errno.EDEADLOCK, "region held by another process (simulated)")
        if mode == "content-then-hard":
            raise OSError(errno.EBADF, "bad file descriptor (simulated)")
        return

    fake = types.ModuleType("msvcrt")
    fake.locking = locking
    fake.LK_LOCK = 1
    fake.LK_UNLCK = 0
    sys.modules["msvcrt"] = fake

    fd = os.open(sys.argv[3], os.O_RDWR | os.O_CREAT, 0o644)
    try:
        mod._lock_exclusive(fd)
    except OSError as err:
        if err.errno == errno.EBADF:
            print("RAISED EBADF after %d call(s)" % (len(calls),))
            sys.exit(0)
        print("WRONG-RAISED errno=%r" % (err.errno,))
        sys.exit(1)
    if mode == "content-then-win":
        print("ACQUIRED after %d call(s)" % (len(calls),))
        sys.exit(0)
    print("RETURNED-WITHOUT-RAISE after %d call(s)" % (len(calls),))
    sys.exit(1)
    """
)

CHILD_TIMEOUT = 15  # well under the suite's 90 s wall; a hang is a bounded FAIL


def _run_child(mode: str) -> subprocess.CompletedProcess:
    lock_path = Path(os.environ["HERMES_HOME"]) / "harderr-probe.lock"
    return subprocess.run(
        [sys.executable, "-c", CHILD, str(STORE), mode, str(lock_path)],
        capture_output=True, text=True, timeout=CHILD_TIMEOUT)


def test_hard_oserror_raises_immediately():
    proc = _run_child("immediate-hard")
    assert proc.returncode == 0, (proc.returncode, proc.stdout, proc.stderr)
    assert proc.stdout.startswith("RAISED EBADF"), proc.stdout


def test_hard_oserror_midloop_raises_after_contention():
    # The repro from the finding: contention is waited out, then a hard error
    # arrives mid-loop. Contention must still be retried; the hard error must
    # propagate at once instead of restarting the loop forever.
    proc = _run_child("content-then-hard")
    assert proc.returncode == 0, (proc.returncode, proc.stdout, proc.stderr)
    assert proc.stdout.startswith("RAISED EBADF after 3"), proc.stdout


def test_contention_is_still_waited_out():
    # The fix must not overcorrect: EDEADLOCK contention keeps retrying until
    # the region frees, mirroring what flock does silently on POSIX.
    proc = _run_child("content-then-win")
    assert proc.returncode == 0, (proc.returncode, proc.stdout, proc.stderr)
    assert proc.stdout.startswith("ACQUIRED after 3"), proc.stdout


def test_docstring_drops_the_overpromise():
    # ":114 'on any OS' overpromises" — the tightened docstring must state the
    # hard-error rule instead of the blanket claim.
    doc = store._lock_exclusive.__doc__ or ""
    assert "on any OS" not in doc.lower(), "docstring still claims 'on any OS': %r" % (doc,)
    assert "EBADF" in doc or "hard" in doc.lower(), \
        "docstring does not state the hard-error rule: %r" % (doc,)


if __name__ == "__main__":
    runner = Runner()
    runner.run(test_hard_oserror_raises_immediately)
    runner.run(test_hard_oserror_midloop_raises_after_contention)
    runner.run(test_contention_is_still_waited_out)
    runner.run(test_docstring_drops_the_overpromise)
    runner.finish()
