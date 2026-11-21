#!/usr/bin/env python3
"""Scratch exports can never foul the publishable-file scan (bead est-v3phb).

The nightly cadence `python3 scripts/make_public.py scratch/` leaves exported
copies (scratch/scripts/make_public.py ...) in the tree; without `/scratch/` in
.gitignore the next `git ls-files --others --exclude-standard` leg of
make_public.list_files() re-lists them, and the fnmatch allow-list pattern
`scripts/make_public.py` no longer matches at the scratch/ prefix — every
export after the first fails the scrub gate.

Throwaway-repo fixture (sibling of test_make_public_nested_repo.py) so the
probe never depends on host residue:
  1. with the REAL .gitignore: export into scratch/, re-export to a second
     target -> rc 0, listing identical to pre-export, no scratch/ entries
     (check scratch_export_invisible_to_scan)
  2. positive control (R6): fixture .gitignore minus the /scratch/ line,
     same cadence -> second export exits 1 with un-allow-listed rows under
     scratch/ (check unignored_scratch_fouls_scan)

Stdlib only; python 3.9 safe. Fixtures carry public placeholders only.

Run: python3 tests/test_scratch_export_guard.py   (exit 0 = green)
"""
from __future__ import annotations

import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "make_public.py"
GITIGNORE = (ROOT / ".gitignore").read_text(encoding="utf-8")
FAILURES = []

_spec = importlib.util.spec_from_file_location("make_public", SCRIPT)
mp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mp)

GIT = shutil.which("git") or "/usr/bin/git"
GITENV = dict(os.environ, GIT_AUTHOR_NAME="probe", GIT_AUTHOR_EMAIL="probe@example.invalid",
              GIT_COMMITTER_NAME="probe", GIT_COMMITTER_EMAIL="probe@example.invalid")


def check(name, ok, detail=""):
    print("%s %s %s" % ("PASS" if ok else "FAIL", name, detail))
    if not ok:
        FAILURES.append(name)


def git(cwd, *args):
    return subprocess.run([GIT, *args], cwd=str(cwd), env=GITENV,
                          capture_output=True, text=True, timeout=60)


def fixture(ignore_text):
    tmp = Path(tempfile.mkdtemp(prefix="rui-scratch-"))
    git(tmp, "init", "-q", ".")
    (tmp / ".gitignore").write_text(ignore_text, encoding="utf-8")
    (tmp / "scripts").mkdir()
    shutil.copy2(SCRIPT, tmp / "scripts" / "make_public.py")
    (tmp / "README.md").write_text("placeholder\n", encoding="utf-8")
    git(tmp, "add", ".")
    git(tmp, "commit", "-qm", "base")
    return tmp


def export(tmp, rel_target):
    return subprocess.run([sys.executable, str(SCRIPT), rel_target, "--repo", str(tmp)],
                          cwd=str(ROOT), env=GITENV, capture_output=True, text=True,
                          timeout=120)


def two_export_cadence(tmp):
    """Nightly shape: export into scratch/, then re-export to a second target
    (out/ — gitignored on both sides, so it cannot skew the listing either way)."""
    first = export(tmp, str(tmp / "scratch"))
    pre = set(mp.list_files(tmp))
    second = export(tmp, str(tmp / "out"))
    return first, second, pre


stripped = "\n".join(ln for ln in GITIGNORE.splitlines() if ln.strip() != "/scratch/")

tmp_ok = tmp_bad = None
try:
    # (a) real .gitignore: scratch/ invisible to the scan; re-export stays green.
    tmp_ok = fixture(GITIGNORE)
    first, second, pre = two_export_cadence(tmp_ok)
    post = set(mp.list_files(tmp_ok))
    check("scratch_export_invisible_to_scan",
          first.returncode == 0 and second.returncode == 0 and post == pre
          and not any(n.startswith("scratch/") for n in post),
          "rc=%d/%d listing_delta=%s" % (first.returncode, second.returncode,
                                         sorted(post ^ pre)[:6]))

    # (b) control: without the /scratch/ line the second export must fail.
    tmp_bad = fixture(stripped)
    first_b, second_b, _ = two_export_cadence(tmp_bad)
    blob_b = second_b.stdout + second_b.stderr
    check("unignored_scratch_fouls_scan",
          first_b.returncode == 0 and second_b.returncode == 1
          and "un-allow-listed scrub hits" in blob_b
          and "scratch/" in blob_b,
          "rc=%d/%d %s" % (first_b.returncode, second_b.returncode, blob_b.strip()[-160:]))
finally:
    for d in (tmp_ok, tmp_bad):
        if d is not None:
            shutil.rmtree(d, ignore_errors=True)

print("RESULT", "PASS" if not FAILURES else "FAIL", "failures=%d" % len(FAILURES))
sys.exit(0 if not FAILURES else 1)
