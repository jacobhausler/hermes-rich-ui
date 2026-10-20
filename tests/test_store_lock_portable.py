"""Failing-then-passing tests for the store lock on a host without `fcntl`.

`engine/store.py` imported `fcntl` at module scope and locked with
`fcntl.flock`, so on Windows the entire backend half died at import:
`ModuleNotFoundError: No module named 'fcntl'`. `python tests/test_store.py`
fails on main@8f443ef with that traceback, `plugins list` still shows the
plugin enabled, and nothing in the dashboard reports it.

The lock still has to serialize two writers on Windows, so the regression is
covered from both sides: the module imports where `fcntl` is absent, and a
second process genuinely waits for the holder to drop the lock. The second
test is the only one that exercises the Windows branch on Windows; on the
POSIX lane it keeps the flock semantics pinned.
"""
from __future__ import annotations

import os
import subprocess
import sys
import textwrap
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import ROOT, Runner, fresh_home, load  # noqa: E402

STORE = ROOT / "engine" / "store.py"
store = load("engine/store.py", "store")

# A host without fcntl: `sys.modules["fcntl"] = None` makes `import fcntl`
# raise ImportError, the same shape as Windows.
ABSENT_FCNTL = textwrap.dedent(
    """
    import importlib.util, sys
    sys.modules["fcntl"] = None
    spec = importlib.util.spec_from_file_location("store_absent_fcntl", sys.argv[1])
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    sys.stdout.write("IMPORTED %s\\n" % (mod._lock_exclusive.__name__,))
    """
)

# Holds the lock, says so, then keeps it for N seconds.
HOLDER = textwrap.dedent(
    """
    import importlib.util, os, sys, time
    spec = importlib.util.spec_from_file_location("store_holder", sys.argv[1])
    mod = importlib.util.module_from_spec(spec)
    sys.modules["store_holder"] = mod
    spec.loader.exec_module(mod)
    fd = mod._acquire_store_lock()
    sys.stdout.write("LOCKED\\n")
    sys.stdout.flush()
    time.sleep(float(sys.argv[2]))
    os.close(fd)
    """
)

HOLD_SECONDS = 1.2
WAIT_FLOOR = 0.8


def test_module_imports_where_fcntl_is_absent():
    proc = subprocess.run(
        [sys.executable, "-c", ABSENT_FCNTL, str(STORE)],
        capture_output=True, text=True, timeout=60)
    assert proc.returncode == 0, proc.stderr.strip()
    assert "IMPORTED _lock_exclusive" in proc.stdout, proc.stdout


def test_a_second_process_waits_for_the_lock():
    holder = subprocess.Popen(
        [sys.executable, "-c", HOLDER, str(STORE), str(HOLD_SECONDS)],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        first_line = holder.stdout.readline().strip()
        assert first_line == "LOCKED", (first_line, holder.stderr.read() if holder.poll() is not None else "")

        start = time.monotonic()
        fd = store._acquire_store_lock()
        waited = time.monotonic() - start
        os.close(fd)
        assert waited >= WAIT_FLOOR, "second writer did not wait for the holder: %.2fs" % waited

        holder.wait(timeout=30)

        start = time.monotonic()
        fd = store._acquire_store_lock()
        os.close(fd)
        took = time.monotonic() - start
        assert took < 2.0, "lock still held after the holder exited: %.2fs" % took
    finally:
        if holder.poll() is None:
            holder.kill()
            holder.wait(timeout=10)


if __name__ == "__main__":
    runner = Runner()
    runner.run(test_module_imports_where_fcntl_is_absent)
    runner.run(test_a_second_process_waits_for_the_lock)
    runner.finish()
