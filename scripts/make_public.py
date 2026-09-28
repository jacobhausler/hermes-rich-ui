#!/usr/bin/env python3
"""Publish-tree exporter with a private-string guard (publish gate).

Copies every publishable file (`git ls-files` PLUS non-ignored untracked files,
so a just-added file is never silently skipped) EXCEPT generated/local dirs:
out*, shots/, tests/.suite-home/, node_modules/, .git/, __pycache__, *.log,
*.pyc — into a clean target tree for the public repo.

Then audits the EXPORTED tree line-by-line with GUARD. Any hit whose file is
not in ALLOWLIST (a {"pattern": "reason"} dict — fnmatch over the repo-relative
path; the reason states why the hit is a guard or intended-public metadata)
prints `rel:LINE: text` and exits 1. Success prints `... (0 scrub hits)` and
exits 0. tests/test_public_strings.py runs this same audit in CI.

Keep|scrub policy for new hits: prefer neutralizing in-tree (replace the estate
particular with a generic word) over adding an allow-list entry. Author
metadata (plugin.yaml/LICENSE/README) and the guard/test files themselves are
the only standing allows — every entry must carry a reason. Stdlib only.
"""
from __future__ import annotations

import argparse
import fnmatch
import re
import shutil
import subprocess
import sys
from pathlib import Path

GIT = "/usr/bin/git"

# Estate particulars + machine-specific paths, word-bounded where required
# (\bhaus\b must not match "exhausted"/"Hausler"; the privacy guards themselves
# are the only allow-listed carriers of these literals).
GUARD = re.compile(
    r"\bhaus\b"                 # estate CLI/tooling word (word-bounded by law)
    r"|callindor|rhuidean|gaidin"   # estate hostnames
    r"|hausler|jacobs-macbook"      # author surname leak + personal machine name
    r"|pf-shots"                    # estate screenshot cache dir
    r"|/home/|/Users/|/opt/hermes"   # machine-specific install paths
    r"|claude-opus"                 # estate seat/model seeds
    r"|192\.168\.",                  # LAN addresses
    re.I,
)

# Allow-list: {"path pattern": "reason"}. The ONLY sanctioned carriers of the
# GUARD patterns. Every entry states why it is a guard or intended-public.
ALLOWLIST = {
    "scripts/make_public.py": "this exporter IS the guard — it carries the forbidden patterns verbatim",
    "tests/test_public_strings.py": "CI mirror of this guard — carries canary strings by necessity",
    "tests/test_skill_docs.py": "the doc-hygiene guard — must name the estate hostnames/paths it forbids",
    "plugin.yaml": "intended public author metadata (author + homepage of the publisher)",
    "LICENSE": "intended public author line (MIT copyright holder)",
    "README.md": "intended public author attribution in the license section",
    "docs/REVIEW-C0.md": "historical review record — estate venv path in a host-specific verify step (prose, no secrets)",
}

EXCLUDE_DIRS = {".git", "__pycache__", "node_modules"}
EXCLUDE_GLOBS = ["out/*", "out-desc/*", "shots/*", "tests/.suite-home/*",
                 "tests/home*", "*.log", "*.pyc"]


def excluded(rel: str) -> bool:
    """True for generated/local paths that never ship."""
    if any(p in EXCLUDE_DIRS for p in Path(rel).parts):
        return True
    return any(fnmatch.fnmatch(rel, pat) for pat in EXCLUDE_GLOBS)


def allow_reason(rel: str):
    """The reason string when this path is allow-listed, else None."""
    for pat, reason in ALLOWLIST.items():
        if fnmatch.fnmatch(rel, pat):
            return reason
    return None


def list_files(repo: Path):
    """Publishable rel-paths: tracked PLUS non-ignored untracked (git-less
    fallback: full walk minus excluded dirs/globs)."""
    def _git(*args):
        return subprocess.run([GIT, "-C", str(repo)] + list(args),
                              capture_output=True, text=True, check=True
                              ).stdout.splitlines()
    try:
        names = _git("ls-files") + _git("ls-files", "--others", "--exclude-standard")
        names = list(dict.fromkeys(names))
    except Exception:
        names = [str(p.relative_to(repo)) for p in sorted(repo.rglob("*"))
                 if p.is_file()]
    return [rel for rel in names if not excluded(rel)]


def scan(repo: Path, names=None):
    """Every GUARD hit: [{file, line, text}] over the given rel-paths."""
    hits = []
    for rel in (names if names is not None else list_files(repo)):
        p = repo / rel
        if not p.is_file():
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except FileNotFoundError:
            continue
        except UnicodeDecodeError:
            print("note: skipping binary file %s" % rel, file=sys.stderr)
            continue
        for i, line in enumerate(text.splitlines(), 1):
            if GUARD.search(line):
                hits.append({"file": rel, "line": i, "text": line.strip()})
    return hits


def violations(repo: Path, names=None):
    """Hits that are NOT allow-listed — these fail the gate."""
    return [h for h in scan(repo, names) if allow_reason(h["file"]) is None]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("target", help="destination directory for the clean publish tree")
    ap.add_argument("--repo", default=str(Path(__file__).resolve().parents[1]))
    args = ap.parse_args()

    repo = Path(args.repo).resolve()
    target = Path(args.target).resolve()
    if target.exists() and any(target.iterdir()):
        print("refusing: target exists and is not empty: %s" % target, file=sys.stderr)
        return 1

    names = list_files(repo)
    bad = violations(repo, names)          # audit BEFORE copying: no partial export on failure
    if bad:
        for h in bad:
            print("FAILED %s:%d: %s" % (h["file"], h["line"], h["text"][:120]), file=sys.stderr)
        print("FAILED: %d un-allow-listed scrub hits — neutralize in-tree or allow-list with a reason"
              % len(bad), file=sys.stderr)
        return 1

    target.mkdir(parents=True, exist_ok=True)
    for rel in names:
        dst = target / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(repo / rel, dst)

    recheck = violations(target, names)   # belt-and-braces: audit the EXPORTED tree
    print("OK: %d files published to %s (%d scrub hits)" % (len(names), target, len(recheck)))
    return 1 if recheck else 0


if __name__ == "__main__":
    sys.exit(main())
