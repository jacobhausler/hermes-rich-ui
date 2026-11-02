#!/usr/bin/env python3
"""gitignore covers suite outdir variants (bead est-kvtzo): an in-tree ledger
dir matching out-*/ (the 2026-11-02 nightly ran suite.py into
out-nightly-1102/) stays out of `git ls-files --others --exclude-standard`,
i.e. out of the publishable set scripts/make_public.py scans, so it can never
again relay env-reds into the scrub gate.

Asserts git subprocess exit codes and listing output only — never .gitignore
source text (CONTRIBUTING.md R6). Each probe is created on disk BEFORE
asserting: check-ignore cannot match a directory-only pattern (out-*/) on a
nonexistent path, which also disqualifies a source-grep shortcut. Fixtures
carry public placeholders only. Stdlib only; python 3.9 safe.

Run: python3 tests/test_gitignore_suite_outdir.py   (exit 0 = green)
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GIT = shutil.which("git") or "/usr/bin/git"
FAILURES = []

# (probe dir, expected ignored). First is the nightly shape; the last two are
# negative controls proving the rule is no broader than out-*.
PROBES = [("out-nightly-probe", True), ("out", True), ("out-desc", True),
          ("outx", False), ("notout-probe", False)]


def check(name, ok, detail=""):
    print("%s %s %s" % ("PASS" if ok else "FAIL", name, detail))
    if not ok:
        FAILURES.append(name)


def git_rc(*args):
    return subprocess.run([GIT, "-C", str(ROOT), *args],
                          capture_output=True, text=True, timeout=60).returncode


created = []  # probe dirs this run made (pre-existing ledgers are left alone)
try:
    for name, want in PROBES:
        d = ROOT / name
        if not d.exists():
            d.mkdir()
            created.append(d)
            (d / "exits.json").write_text("[]\n", encoding="utf-8")
        rc = git_rc("check-ignore", "-q", name)
        check("ignore_%s" % name.replace("-", "_"), (rc == 0) == want,
              "dir rc=%d" % rc)

    rc = git_rc("check-ignore", "-q", "out-nightly-probe/exits.json")
    check("ignore_ledger_file", rc == 0, "file rc=%d" % rc)
    listing = subprocess.run(
        [GIT, "-C", str(ROOT), "ls-files", "--others", "--exclude-standard"],
        capture_output=True, text=True, timeout=60).stdout.splitlines()
    leaked = [l for l in listing if l.startswith("out-nightly-probe")]
    check("probe_absent_from_others", not leaked, repr(leaked[:3]))
    shown = [l for l in listing if l.startswith("outx/") or
             l.startswith("notout-probe/")]
    check("controls_visible_in_others", len(shown) == 2, repr(shown))
finally:
    for d in created:
        shutil.rmtree(d, ignore_errors=True)

print("RESULT", "PASS" if not FAILURES else "FAIL",
      "failures=%d" % len(FAILURES))
sys.exit(0 if not FAILURES else 1)
