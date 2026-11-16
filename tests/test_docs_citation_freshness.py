#!/usr/bin/env python3
"""Docs citation freshness gate — every path:line cite in docs/*.md and in the
tracked root docs (README.md, AGENTS.md, INSTALL.md, CONTRIBUTING.md,
MANIFEST-L*.md; CHANGELOG.md excluded — its historical sections cite the
release-time tree) must land inside the cited file's bounds at HEAD. The root
leg derives from git ls-files, so an untracked draft (e.g. MANIFEST-L8-*.md)
cannot redden the gate.

ARCHITECTURE.md opens with the promise that "when this doc and the code
disagree, the code wins and this doc is a bug" — but nothing enforced it, and
the thin-door rewrite drifted three __init__.py anchors (126-129, 112-123,
126) past a 109-line file unnoticed until the nightly sweep measured it.
This test is the gate that makes the promise structural.

Resolution law (mirrors how the docs actually cite):
  - a cited path may be repo-root-relative (`engine/tool.py`), directory
    suffix (`components/_shared.mjs`), or bare basename (`store.py`);
  - candidates are tracked files (git ls-files) whose path equals the cited
    path or ends with "/" + the cited path;
  - a cite is fresh when at least ONE candidate contains every cited line or
    span. The any-candidate leniency is deliberate: bare names like
    `card.mjs` exist twice (desktop/src, desktop/src/components) and the docs
    mean one specific file by context, which no regex can read; the gate
    detects DRIFT (file shrank, lines moved past bounds, file deleted),
    intent stays the reviewer's.

The gate fails closed on itself: zero candidates is red, an unparseable span
is red, and CITATION_FLOOR asserts the scan is not vacuously green — if the
scanned doc set shrinks below the floor, lower the constant deliberately in
review.

Run: python3 tests/test_docs_citation_freshness.py (exit 0 = green).
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
CITATION_FLOOR = 60  # measured 64 at root-set extension; floor guards the regex, not the docs

PATH = r"[A-Za-z0-9_./-]+\.(?:py|mjs|js|json)"
SPAN = r"\d+(?:-\d+)?"
CITE = re.compile(rf"({PATH})[:#]((?:{SPAN})(?:\s*,\s*{SPAN})*)")
LINE_EXT = {".py": 0, ".mjs": 0, ".js": 0, ".json": 0}


def check(name, cond, detail=""):
    print("%s %s%s" % ("PASS" if cond else "FAIL", name, (": " + str(detail)) if (detail and not cond) else ""))
    return bool(cond)


def tracked_paths():
    proc = subprocess.run(["git", "-C", str(ROOT), "ls-files", "-z"],
                          capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"git ls-files failed: {proc.stderr.strip()}")
    return [p for p in proc.stdout.split("\0") if p]


def tracked_sources():
    return [p for p in tracked_paths() if Path(p).suffix in LINE_EXT]


# Historical sections cite the release-time tree, so CHANGELOG stays out.
ROOT_DOC_EXCLUDE = {"CHANGELOG.md"}


def scan_docs():
    # docs/ keeps its direct-glob semantics; the root leg is tracked-only
    # (git ls-files), so an untracked draft cannot redden the gate.
    docs = sorted(DOCS.glob("*.md"))
    root = sorted(ROOT / p for p in tracked_paths()
                  if "/" not in p and p.endswith(".md")
                  and p not in ROOT_DOC_EXCLUDE)
    return docs + root


def parse_spans(linespec):
    spans = []
    for part in linespec.replace(" ", "").split(","):
        start, _, end = part.partition("-")
        spans.append((int(start), int(end or start)))
    return spans


def fresh(rel_lines, spans):
    try:
        bounds = len(rel_lines.read_text(encoding="utf-8", errors="replace").splitlines())
    except OSError:
        return False
    return all(1 <= start <= end <= bounds for start, end in spans)


def main():
    sources = tracked_sources()
    lines_cache = {}

    def lines_of(rel):
        if rel not in lines_cache:
            lines_cache[rel] = (ROOT / rel).read_text(encoding="utf-8", errors="replace").splitlines()
        return lines_cache[rel]

    total = 0
    failures = []
    for doc in scan_docs():
        for lineno, line in enumerate(doc.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            for m in CITE.finditer(line):
                total += 1
                path, linespec = m.group(1), m.group(2)
                loc = f"{doc.relative_to(ROOT)}:{lineno} {m.group(0)}"
                try:
                    spans = parse_spans(linespec)
                except ValueError as exc:  # regex keeps this unreachable; guard anyway
                    failures.append((loc, f"unparseable span ({exc})"))
                    continue
                cands = [s for s in sources if s == path or s.endswith("/" + path)]
                if not cands:
                    failures.append((loc, "no tracked file matches this path"))
                    continue
                cands.sort(key=lambda s: (s != path, len(s), s))  # exact path first, then shortest
                ok = any(fresh(Path(c), spans) for c in cands)
                if not ok:
                    detail = ", ".join(f"{c}[{len(lines_of(c))} lines]" for c in cands)
                    failures.append((loc, f"span {linespec} out of bounds (candidates: {detail})"))

    # fail-closed self-guard: a silent regex/doc drift must not leave this green
    if total < CITATION_FLOOR:
        failures.append(("scanned doc set", f"only {total} citations found, floor is {CITATION_FLOOR} — gate went blind"))

    for loc, why in failures:
        check(loc, False, why)
    check(f"docs citation freshness ({total} citations, {len(failures)} stale)", not failures)
    print(f"TOTAL {total} STALE {len(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
