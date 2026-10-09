#!/usr/bin/env python3
"""Release gate: version parity over the 9 declared literals + publish scrub.

Usage: python3 scripts/release_check.py [X.Y.Z] [--repo DIR]

Reads the 9 version literals the release lane bumps: plugin.yaml,
package.json, package-lock.json (root + packages[""]), __init__.py VERSION,
dashboard/plugin_api.py VERSION, the skill/debugging and skill/maintaining
frontmatter, and the CHANGELOG.md head. The expected version is X.Y.Z when
given, else plugin.yaml's own version, so a no-arg run is a pure parity check
any PR can run. Every disagreeing or absent literal prints
`MISMATCH <file>: <found|missing> != <expected>`.

Then runs `scripts/make_public.py --repo DIR <fresh temp dir>` (subprocess;
make_public.py stays unchanged) and passes only on rc 0 with `(0 scrub hits)`,
relaying its FAILED lines otherwise. When everything passes it prints exactly
one line, `release_check: OK vX.Y.Z (9 literals, 0 scrub hits)`, and exits 0.
Otherwise it exits 1. Stdlib only; importable under python 3.9.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def _read(repo, rel):
    # type: (Path, str) -> str
    try:
        return (repo / rel).read_text(encoding="utf-8")
    except (FileNotFoundError, NotADirectoryError, UnicodeDecodeError):
        return ""


def _re1(pattern, text):
    # type: (str, str) -> str
    m = re.search(pattern, text)
    return m.group(1).strip().strip("\"'") if m else ""


def _json_key_version(text):
    # type: (str) -> str
    try:
        v = json.loads(text).get("version")
    except Exception:
        return ""
    return v if isinstance(v, str) else ""


def _lock_root_version(text):
    # type: (str) -> str
    try:
        pkgs = json.loads(text).get("packages") or {}
        v = (pkgs.get("") or {}).get("version")
    except Exception:
        return ""
    return v if isinstance(v, str) else ""


def _frontmatter_version(text):
    # type: (str) -> str
    m = re.match(r"\A---\n(.*?)\n---", text, re.S)
    if not m:
        return ""
    return _re1(r"(?m)^version:[ \t]*(.+)$", m.group(1))


def _changelog_head_version(text):
    # type: (str) -> str
    m = re.search(r"(?m)^## +(?:v|V)?([0-9]+\.[0-9]+\.[0-9]+)", text)
    return m.group(1) if m else ""


def declared_literals(repo):
    # type: (Path) -> list
    """The 9 declared version surfaces in order: [(rel_file, found)], '' = missing."""
    lock = _read(repo, "package-lock.json")
    rows = [
        ("plugin.yaml", _re1(r"(?m)^version:[ \t]*(.+)$", _read(repo, "plugin.yaml"))),
        ("package.json", _json_key_version(_read(repo, "package.json"))),
        ("package-lock.json", _json_key_version(lock)),
        ("package-lock.json", _lock_root_version(lock)),
        ("__init__.py", _re1(r"(?m)^VERSION[ \t]*=[ \t]*[\"']([^\"']+)[\"']",
                             _read(repo, "__init__.py"))),
        ("dashboard/plugin_api.py",
         _re1(r"(?m)^VERSION[ \t]*=[ \t]*[\"']([^\"']+)[\"']",
              _read(repo, "dashboard/plugin_api.py"))),
        ("skill/debugging/SKILL.md", _frontmatter_version(_read(repo, "skill/debugging/SKILL.md"))),
        ("skill/maintaining/SKILL.md", _frontmatter_version(_read(repo, "skill/maintaining/SKILL.md"))),
        ("CHANGELOG.md", _changelog_head_version(_read(repo, "CHANGELOG.md"))),
    ]
    return rows


def run_scrub(repo, script_dir):
    # type: (Path, Path) -> tuple
    """make_public.py against a fresh temp target; returns (rc, combined output)."""
    tmp = Path(tempfile.mkdtemp(prefix="ru-release-check-"))
    target = tmp / "publish-tree"
    try:
        r = subprocess.run([sys.executable, str(script_dir / "make_public.py"),
                            str(target), "--repo", str(repo)],
                           capture_output=True, text=True, timeout=120)
        return r.returncode, (r.stdout or "") + (r.stderr or "")
    except Exception as exc:  # a scrub that cannot run is a failed scrub
        return 1, "FAILED scrub could not run: %s\n" % exc
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main(argv=None):
    # type: (list) -> int
    ap = argparse.ArgumentParser(
        description="Version-parity + publish-scrub release gate (issue #43).")
    ap.add_argument("version", nargs="?", default=None,
                    help="expected X.Y.Z; default: plugin.yaml's own version (pure parity check)")
    ap.add_argument("--repo", default=str(Path(__file__).resolve().parents[1]),
                    help="repo root to check (default: this script's repo)")
    args = ap.parse_args(argv)
    repo = Path(args.repo).resolve()

    rows = declared_literals(repo)
    expected = args.version or rows[0][1]  # plugin.yaml is rows[0]
    if not expected:
        print("MISMATCH plugin.yaml: missing != <no version given>")
        return 1

    fails = 0
    for rel, found in rows:
        if found != expected:
            print("MISMATCH %s: %s != %s" % (rel, found if found else "missing", expected))
            fails += 1

    rc, out = run_scrub(repo, Path(__file__).resolve().parent)
    if rc != 0 or "(0 scrub hits)" not in out:
        for line in out.splitlines():
            if line.startswith("FAILED"):
                print(line)
        fails += 1

    if fails:
        return 1
    print("release_check: OK v%s (%d literals, 0 scrub hits)" % (expected, len(rows)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
