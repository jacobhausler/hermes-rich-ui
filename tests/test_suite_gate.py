#!/usr/bin/env python3
"""Suite gate is fail-closed (issue #53): zero discovered tests or a bad root
exits nonzero and never prints the TOTAL line, and the previous run's
exits.json is invalidated at invocation start so an interrupted run can never
leave the prior ledger standing as current evidence.

Asserts subprocess exit codes and ledger JSON contents only — never source
text (CONTRIBUTING.md R6). Stdlib only; scratch roots via tempfile.
"""
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SCRIPT = REPO / "scripts" / "suite.py"
PASS_SEED = [{"test": "old_green.py", "exit": 0, "log": "/nonexistent/old.log"}]
FAIL_SEED = [{"test": "old_red.py", "exit": 1, "log": "/nonexistent/old.log"}]


def seed(out_dir, rows):
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "exits.json").write_text(json.dumps(rows, indent=2) + "\n")


def read_ledger(out_dir):
    return json.loads((out_dir / "exits.json").read_text())


def run_suite(root, out_dir):
    return subprocess.run(
        [sys.executable, str(SCRIPT), str(root), str(out_dir)],
        capture_output=True, text=True, timeout=120,
    )


def scratch_root(py_body=None, mjs_body=None):
    p = Path(tempfile.mkdtemp())
    tests = p / "tests"
    tests.mkdir(parents=True, exist_ok=True)
    if py_body is not None:
        (tests / "test_ok.py").write_text(py_body)
    if mjs_body is not None:
        (tests / "test_ok.mjs").write_text(mjs_body)
    return p


def test_missing_root_fails_closed():
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "out"
        seed(out, FAIL_SEED)
        result = run_suite(Path(tmp) / "missing-root", out)
        assert result.returncode != 0, f"exit {result.returncode}; stdout={result.stdout!r}"
        assert "TOTAL" not in result.stdout
        assert read_ledger(out) != FAIL_SEED


def test_missing_tests_dir_fails_closed():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "root"
        root.mkdir()
        out = Path(tmp) / "out"
        seed(out, PASS_SEED)
        result = run_suite(root, out)
        assert result.returncode != 0, f"exit {result.returncode}; stdout={result.stdout!r}"
        assert "TOTAL" not in result.stdout
        assert read_ledger(out) != PASS_SEED


def test_empty_tests_dir_fails_closed():
    with tempfile.TemporaryDirectory() as tmp:
        root = scratch_root()
        out = Path(tmp) / "out"
        seed(out, PASS_SEED)
        result = run_suite(root, out)
        assert result.returncode != 0, f"exit {result.returncode}; stdout={result.stdout!r}"
        assert "TOTAL" not in result.stdout
        assert read_ledger(out) == []


def test_interruption_before_case_one_never_keeps_old_ledger():
    root = scratch_root(py_body="import time; time.sleep(20)\n")
    out = root / "out"
    seed(out, PASS_SEED)
    proc = subprocess.Popen(
        [sys.executable, str(SCRIPT), str(root), str(out)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    log = out / "test_ok.py.log"
    deadline = time.monotonic() + 30
    while not log.exists() and time.monotonic() < deadline:
        time.sleep(0.05)
    assert log.exists(), "case never spawned"
    os.kill(proc.pid, signal.SIGKILL)
    proc.wait(timeout=10)
    ledger_path = out / "exits.json"
    if ledger_path.exists():
        assert json.loads(ledger_path.read_text()) != PASS_SEED, \
            "interrupted run left the previous completed ledger as current evidence"


def test_one_passing_case_exits_zero_with_exact_ledger():
    root = scratch_root(py_body="print('ok')\n")
    out = root / "out"
    result = run_suite(root, out)
    assert result.returncode == 0, f"exit {result.returncode}; stdout={result.stdout!r}"
    rows = read_ledger(out)
    assert len(rows) == 1
    assert rows[0]["test"] == "test_ok.py"
    assert rows[0]["exit"] == 0
    assert Path(rows[0]["log"]).is_file()


def test_one_failing_case_exits_one_with_exit_code():
    root = scratch_root(py_body="import sys; sys.exit(3)\n")
    out = root / "out"
    result = run_suite(root, out)
    assert result.returncode == 1, f"exit {result.returncode}; stdout={result.stdout!r}"
    rows = read_ledger(out)
    assert len(rows) == 1
    assert rows[0]["test"] == "test_ok.py"
    assert rows[0]["exit"] == 3


def test_suite_timeout_marker_replaces_the_default_wall():
    # A test declares its own wall with '# suite-timeout: N' in the first five
    # lines (est-fj5os: test_release_check.py measures ~65 s idle against the
    # fixed 90 s wall and timed out rc=124 on loaded nightly hosts).
    # Clamped to [1, 600]; N below the sleep must kill the case at the marker.
    slow = scratch_root(py_body=(
        "#!/usr/bin/env python3\n# suite-timeout: 2\n"
        "import time\ntime.sleep(8)\nprint('ok')\n"))
    out = slow / "out"
    result = run_suite(slow, out)
    rows = read_ledger(out)
    assert len(rows) == 1 and rows[0]["exit"] == 124, \
        f"marker 2 s must kill an 8 s sleep: {rows}"
    assert result.returncode == 1, f"timed-out case must fail the suite: {result.returncode}"

    # The same test under a generous marker passes — the marker never inverts
    # the verdict, it only sizes the wall.
    ok = scratch_root(py_body=(
        "#!/usr/bin/env python3\n# suite-timeout: 60\n"
        "import time\ntime.sleep(1)\nprint('ok')\n"))
    out2 = ok / "out"
    result2 = run_suite(ok, out2)
    rows2 = read_ledger(out2)
    assert result2.returncode == 0 and rows2[0]["exit"] == 0, \
        f"generous marker must pass: {rows2}"


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"{name}: ok")
            except Exception as exc:
                failures += 1
                print(f"{name}: FAIL {type(exc).__name__}: {exc}")
    raise SystemExit(1 if failures else 0)
