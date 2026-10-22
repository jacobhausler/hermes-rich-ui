#!/usr/bin/env python3
"""P1 observe generator for tests/registry.json (NEXTGEN-CI (c) registry law, S3b).

The registry keys on BURN TOKENS, not wall: a row exists for every test file
carrying a burn token in its path or header — the scar the test guards. Rules,
kept deliberately dumb and greppable (this file IS the census for observe mode):

  path token    a >=2-digit number in the file name (test_foo_102.py -> #102)
  header token  inside the first HEADER_LINES lines (docstring / comment block):
                  `issue #9`, `PR #166` (keyword form), or a line-leading
                  `#21 registration repro harness ...` (title form)
  origin        the introducing commit via `git log --diff-filter=A --follow`
                (the TIERS burn-origin method, verbatim)

Rows carry `tier`, `after`, `order_group` as null in observe mode: the tier
column is human/census-owned and a tier assignment no census output supports
goes red (falsifier 13) — null is the honest P1 value. `burn` and `origin`
start populated because they are grep/git-derived, free.

Usage: python3 scripts/gen_registry.py [repo-root]   (default: repo root of this file)
Writes tests/registry.json. Deterministic: same tree -> same bytes.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

HEADER_LINES = 15
PATH_TOKEN = re.compile(r"(?:^|_)(\d{2,})(?:\.|_|$)")
HEADER_KEYWORD = re.compile(r"(?:issue|Issue|ISSUE|PR|pr)\s*#(\d{1,4})\b")
HEADER_TITLE = re.compile(r"^#(\d{1,4})(?=[\s(:])")
COMMENT_MARKS = ' \t"\'/*'  # NOT '#': the hash IS the token's first character


def header_text(path: Path) -> str:
    with path.open(encoding="utf-8", errors="replace") as fh:
        return "\n".join(fh.read().splitlines()[:HEADER_LINES])


def burn_token(path: Path) -> str | None:
    for mm in PATH_TOKEN.finditer(path.name):
        return "#" + mm.group(1)
    # Earliest header line that carries a token wins; within one line the
    # title form (`#39 (defaults slice 16): ...` — the file naming its scar)
    # beats a keyword mention (`PR #84 render path` — incidental context).
    for line in header_text(path).splitlines():
        bare = line.strip().lstrip(COMMENT_MARKS)
        mm = HEADER_TITLE.match(bare)
        if mm:
            return "#" + mm.group(1)
        mm = HEADER_KEYWORD.search(line)
        if mm:
            return "#" + mm.group(1)
    return None


def origin_commit(root: Path, rel: str) -> str | None:
    p = subprocess.run(
        ["git", "log", "--diff-filter=A", "--follow", "--format=%H", "--", rel],
        cwd=root, capture_output=True, text=True)
    lines = p.stdout.strip().splitlines() if p.returncode == 0 else []
    return lines[-1] if lines else None


def main() -> int:
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent
    tests = root / "tests"
    cases = sorted(tests.glob("test_*.py")) + sorted(tests.glob("test_*.mjs"))
    rows = []
    for path in cases:
        token = burn_token(path)
        if token is None:
            continue
        rel = path.relative_to(root).as_posix()
        rows.append({"case": rel, "burn": token,
                     "origin": origin_commit(root, rel),
                     "tier": None, "after": None, "order_group": None})
    doc = {"schema": "estate-ci/registry-v0", "mode": "observe",
           "law": "row iff burn token in path or header (S3b); tier/after/order_group census-owned, null until P2 census",
           "generator": "python3 scripts/gen_registry.py",
           "rows": rows}
    out = tests / "registry.json"
    out.write_text(json.dumps(doc, indent=2) + "\n")
    print(f"registry: {len(rows)} burn-token rows of {len(cases)} test files -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
