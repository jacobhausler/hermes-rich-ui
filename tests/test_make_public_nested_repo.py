#!/usr/bin/env python3
"""Nested repos never enter the publish set (bead est-g0dds).

`git ls-files --others --exclude-standard` collapses a nested repo — a lane
worktree, a vendored checkout — into ONE directory entry. An unfiltered
listing hands that entry to the copy loop and the export dies
IsADirectoryError, which is exactly how the 2026-11-12 nightly rui pass
went local-red on test_release_check.py in a dev tree carrying
`lanes/wt-rel0110`. `git ls-files -uall` is no cure: it does not expand a
nested repo. The shape is listing files only.

Builds a throwaway git repo (so the probe never mutates the checkout),
plants one nested repo and one plain untracked dir, and asserts:
  1. fixture is the reported shape    -> ls-files --others lists the nested
                                         repo as a single directory entry
  2. list_files carries no directory  -> every returned rel-path is a file
  3. plain untracked files still ship -> the new dir's file is listed
  4. the export itself survives       -> exit 0, no traceback
  5. the nested repo is not copied    -> its marker file is absent from out
  6. the untracked file is copied     -> the new file is present in out

Each check fails if the filter is dropped (checks 2, 4, 5 and 6 flip red without the filter, green with it).
Stdlib only; python 3.9 safe (AGENTS.md law 2). Fixtures carry public
placeholders only.

Run: python3 tests/test_make_public_nested_repo.py   (exit 0 = green)
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


def others(repo):
    r = git(repo, "ls-files", "--others", "--exclude-standard")
    assert r.returncode == 0, r.stderr
    return r.stdout.splitlines()


tmp = Path(tempfile.mkdtemp(prefix="rui-nested-"))
try:
    git(tmp, "init", "-q", ".")
    (tmp / "tracked.txt").write_text("tracked\n", encoding="utf-8")
    git(tmp, "add", "tracked.txt")
    git(tmp, "commit", "-qm", "base")

    # The lane-worktree shape: a whole git repo inside the tree, untracked here.
    nested = tmp / "lanes" / "wt-probe"
    nested.mkdir(parents=True)
    git(nested, "init", "-q", ".")
    (nested / "marker.txt").write_text("nested\n", encoding="utf-8")
    git(nested, "add", "marker.txt")
    git(nested, "commit", "-qm", "nested")

    # Control: a plain untracked dir must keep shipping its files.
    (tmp / "newdir").mkdir()
    (tmp / "newdir" / "fresh.txt").write_text("fresh\n", encoding="utf-8")

    listing = others(tmp)
    check("fixture_nested_repo_is_dir_entry",
          any(e.startswith("lanes/") for e in listing), repr(listing[:6]))

    names = mp.list_files(tmp)
    check("listing_has_no_directories",
          all((tmp / rel).is_file() for rel in names),
          repr([rel for rel in names if (tmp / rel).is_dir()]))
    check("listing_keeps_plain_untracked", "newdir/fresh.txt" in names, repr(names[:6]))

    out = tmp / "pub-out"
    r = subprocess.run([sys.executable, str(SCRIPT), str(out), "--repo", str(tmp)],
                       cwd=str(ROOT), env=GITENV, capture_output=True, text=True, timeout=120)
    blob = r.stdout + r.stderr
    check("export_exit_0", r.returncode == 0, blob.strip()[-200:])
    check("export_no_traceback", "Traceback" not in blob, blob.strip()[-200:])
    check("export_skips_nested_repo", not (out / "lanes" / "wt-probe" / "marker.txt").exists())
    check("export_copies_untracked", (out / "newdir" / "fresh.txt").is_file())
    check("export_copies_tracked", (out / "tracked.txt").is_file())
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("RESULT", "PASS" if not FAILURES else "FAIL", "failures=%d" % len(FAILURES))
sys.exit(0 if not FAILURES else 1)
