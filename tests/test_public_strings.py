#!/usr/bin/env python3
"""CI gate: the publish scrub must be clean.

Runs the same private-string guard scripts/make_public.py uses (imported, so
there is exactly one pattern list) over EVERY publishable text file in the repo
(tracked + non-ignored untracked) and asserts 0 un-allow-listed hits. Also
proves the guard actually bites (canary scan — the hits a scrub missed must
fail the gate) and smoke-exports the tree to a throwaway dir.

This file carries canary estate strings ON PURPOSE and is allow-listed in
scripts/make_public.py for exactly that reason.

Run: python3 tests/test_public_strings.py   (exit 0 = green)
"""
from __future__ import annotations

import importlib.util
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAILURES = []


def check(name, ok, detail=""):
    print("%s %s %s" % ("PASS" if ok else "FAIL", name, detail))
    if not ok:
        FAILURES.append(name)


_spec = importlib.util.spec_from_file_location("make_public", ROOT / "scripts" / "make_public.py")
mp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mp)

# --- guard sanity: canaries prove every pattern family bites -----------------
CANARIES = {
    "canary-a.md": "haus hop jacobs-macbook-air -- 'cd ~/.hermes/cache/pf-shots'",
    "canary-b.md": "run /home/someone/tool and /opt/hermes/.venv/bin/x under /Users/x on 192.168.4.21",
    "canary-c.md": "author Jacob Hausler seeded claude-opus-4 on callindor/rhuidean/gaidin",
    "clean.md": "The token budget was exhausted; the exhausting demo ships normally — see out/ and shots/ for the generated dirs.",
}
CANARY_NEEDS = ["canary-a.md", "canary-a.md", "canary-a.md", "canary-b.md", "canary-b.md",
                "canary-b.md", "canary-b.md", "canary-c.md", "canary-c.md", "canary-c.md"]

tmp = Path(tempfile.mkdtemp(prefix="ru-guard-canary-"))
try:
    for name, text in CANARIES.items():
        (tmp / name).write_text(text, encoding="utf-8")
    canary_hits = mp.scan(tmp, sorted(CANARIES))
    hit_files = [h["file"] for h in canary_hits]
    for need in sorted(set(CANARY_NEEDS)):
        check("guard_bites_on_%s" % need, need in hit_files)
    check("guard_no_false_positive_on_clean_text", "clean.md" not in hit_files,
          "exhausted/Haus-style must not trip \\bhaus\\b")
    canary_viol = mp.violations(tmp, sorted(CANARIES))
    check("canary_hits_are_violations", len(canary_viol) == len(canary_hits),
          "expected %d" % len(canary_hits))
finally:
    shutil.rmtree(tmp, ignore_errors=True)

# --- the real gate: 0 un-allow-listed hits over the whole repo ---------------
names = mp.list_files(ROOT)
check("publishable_files_found", len(names) > 50, "n=%d" % len(names))
hits = mp.scan(ROOT, names)
bad = mp.violations(ROOT, names)
for h in bad:
    print("  UN-ALLOW-LISTED %s:%d: %s" % (h["file"], h["line"], h["text"][:120]))
check("zero_un_allowlisted_hits", not bad, "%d hits, %d violations" % (len(hits), len(bad)))
check("allowlist_is_actually_used", len(hits) > len(bad),
      "%d allow-listed guard carries" % (len(hits) - len(bad)))
check("allowlist_entries_have_reasons", all(isinstance(r, str) and len(r) > 10
                                            for r in mp.ALLOWLIST.values()))

# --- exporter smoke: real run against the repo, throwaway target -------------
out = Path(tempfile.mkdtemp(prefix="ru-make-public-")) / "pub-tree"
try:
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "make_public.py"), str(out)],
                       cwd=str(ROOT), capture_output=True, text=True, timeout=60)
    check("exporter_exit_0", r.returncode == 0, (r.stdout + r.stderr).strip()[-160:])
    check("exporter_prints_zero_scrub_hits", "0 scrub hits" in r.stdout, r.stdout.strip()[-120:])
    check("exporter_shipped_guard", (out / "scripts" / "make_public.py").is_file())
    check("exporter_shipped_skill", (out / "skill" / "SKILL.md").is_file())
finally:
    shutil.rmtree(out.parent, ignore_errors=True)

print("RESULT", "PASS" if not FAILURES else "FAIL", "failures=%d" % len(FAILURES))
sys.exit(0 if not FAILURES else 1)
