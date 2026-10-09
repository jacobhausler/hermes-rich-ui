#!/usr/bin/env python3
"""release_check gate (issue #43): version parity across the 9 declared
literals + publish-scrub relay.

Proves scripts/release_check.py:
  1. real repo, no arg            -> rc 0, one `release_check: OK v<ver>` line
  2. real repo, arg 9.9.9         -> rc 1, exactly 9 MISMATCH lines
  3. copy, package-lock skew      -> rc 1, only `MISMATCH package-lock.json`
  4. copy, CHANGELOG head skew    -> rc 1, `MISMATCH CHANGELOG.md`
  5. copy, planted LAN line       -> rc 1, make_public FAILED lines relayed

Mutation cases work on a copy of the publishable tree (make_public.list_files)
in a temp dir — never on the checkout. The copy gets `git init -q` so the
exporter's file listing is the same whether or not the temp dir sits inside
another repo. Stdlib only; python 3.9 safe (AGENTS.md law 2).

Run: python3 tests/test_release_check.py   (exit 0 = green)
"""
from __future__ import annotations

import importlib.util
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "release_check.py"
FAILURES = []


def check(name, ok, detail=""):
    print("%s %s %s" % ("PASS" if ok else "FAIL", name, detail))
    if not ok:
        FAILURES.append(name)


_spec = importlib.util.spec_from_file_location("make_public", ROOT / "scripts" / "make_public.py")
mp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mp)

GIT = shutil.which("git") or "/usr/bin/git"


def run_check(repo, *args):
    r = subprocess.run([sys.executable, str(SCRIPT), *args, "--repo", str(repo)],
                       cwd=str(ROOT), capture_output=True, text=True, timeout=120)
    return r.returncode, r.stdout + r.stderr


def mismatch_lines(out):
    return [l for l in out.splitlines() if l.startswith("MISMATCH ")]


def repo_version():
    text = (ROOT / "plugin.yaml").read_text(encoding="utf-8")
    m = re.search(r"(?m)^version:[ \t]*(\S+)", text)
    assert m, "plugin.yaml has no top-level version:"
    return m.group(1)


def make_copy(tmp):
    """Copy of the publishable tree + git init -q (same listing semantics)."""
    dst = tmp / "tree"
    dst.mkdir(parents=True)
    for rel in mp.list_files(ROOT):
        src = ROOT / rel
        if src.is_file():
            d = dst / rel
            d.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, d)
    subprocess.run([GIT, "-C", str(dst), "init", "-q"], check=True,
                   capture_output=True, timeout=60)
    return dst


VER = repo_version()

# --- 1. real repo, no arg: pure parity check ---------------------------------
rc, out = run_check(ROOT)
check("noarg_exit_0", rc == 0, out.strip()[-200:])
check("noarg_single_ok_line",
      out.strip().splitlines() == ["release_check: OK v%s (9 literals, 0 scrub hits)" % VER],
      repr(out.strip()[:200]))

# --- 2. real repo, arg 9.9.9: every declared literal disagrees ----------------
rc, out = run_check(ROOT, "9.9.9")
ml = mismatch_lines(out)
check("skewarg_exit_1", rc == 1)
check("skewarg_nine_mismatches", len(ml) == 9, "got %d\n%s" % (len(ml), out[:400]))
named = {l.split(" ")[1].rstrip(":") for l in ml}
check("skewarg_names_lock_and_changelog",
      {"package-lock.json", "CHANGELOG.md"} <= named, ", ".join(sorted(named)))

# --- 3. planted package-lock skew (the literal the hand greps never covered) --
tmp = Path(tempfile.mkdtemp(prefix="ru-release-check-"))
try:
    copy = make_copy(tmp)
    lock = copy / "package-lock.json"
    data = __import__("json").loads(lock.read_text(encoding="utf-8"))
    data["packages"][""]["version"] = "9.9.9"
    lock.write_text(__import__("json").dumps(data, indent=2) + "\n", encoding="utf-8")
    rc, out = run_check(copy)
    ml = mismatch_lines(out)
    check("lock_skew_exit_1", rc == 1, out.strip()[-200:])
    check("lock_skew_only_lock_named",
          len(ml) == 1 and ml[0].startswith("MISMATCH package-lock.json:"),
          repr(ml))

    # --- 4. planted CHANGELOG head skew ----------------------------------------
    copy2 = make_copy(tmp / "c2")
    cl = copy2 / "CHANGELOG.md"
    head = cl.read_text(encoding="utf-8")
    head = re.sub(r"(?m)^## v\S+", "## v9.9.9 -", head, count=1)
    cl.write_text(head, encoding="utf-8")
    rc, out = run_check(copy2)
    ml = mismatch_lines(out)
    check("changelog_skew_exit_1", rc == 1, out.strip()[-200:])
    check("changelog_skew_names_changelog",
          any(l.startswith("MISMATCH CHANGELOG.md:") for l in ml), repr(ml))

    # --- 5. planted LAN-address line: scrub failure relayed --------------------
    copy3 = make_copy(tmp / "c3")
    # Assembled at runtime so this committed file carries no guard literal and
    # needs no scrub allow-list entry; the planted file stays untracked, and
    # make_public's git-less fallback walk still scans it.
    (copy3 / "planted.md").write_text(
        "probe host " + ".".join(("192", "168", "7", "7")) + "\n",
        encoding="utf-8")
    rc, out = run_check(copy3)
    check("scrub_plant_exit_1", rc == 1, out.strip()[-200:])
    check("scrub_plant_relays_failed",
          "FAILED" in out and "planted.md" in out, out.strip()[-200:])
finally:
    shutil.rmtree(tmp, ignore_errors=True)

print("RESULT", "PASS" if not FAILURES else "FAIL", "failures=%d" % len(FAILURES))
sys.exit(0 if not FAILURES else 1)
