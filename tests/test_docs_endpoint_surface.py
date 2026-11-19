#!/usr/bin/env python3
"""Route-surface drift gate (est-d3wra): every GET route registered in
dashboard/plugin_api.py must be documented — its path verbatim in README.md or
INSTALL.md, and as a `GET` row in the docs/CONTRACTS.md §5 route table.
Source-parsed like the merged docs-citation gate; no fastapi import, because
the runtime router check in tests/test_api.py skips vacuously on lanes
without fastapi. FLOOR fails the gate closed: if the decorator regex ever
stops matching, the parsed set cannot shrink into a vacuous green.
Run: python3 tests/test_docs_endpoint_surface.py (exit 0 = green).
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FLOOR = {"/health", "/cards/{card_id}", "/views"}  # HEAD surface; amend in review.


def check(name, cond, detail=""):
    print("%s %s%s" % ("PASS" if cond else "FAIL", name,
                       (": " + str(detail)) if (detail and not cond) else ""))
    return bool(cond)


def registered():
    src = (ROOT / "dashboard" / "plugin_api.py").read_text(encoding="utf-8")
    return set(re.findall(r'@router\.get\("([^"]+)"\)', src))


def section5():
    text = (ROOT / "docs" / "CONTRACTS.md").read_text(encoding="utf-8")
    m = re.search(r"(?ms)^## 5\..*?(?=^## |\Z)", text)
    assert m, "CONTRACTS.md lost its section 5 heading"
    return m.group(0)


def documented(path, prose, sec5):
    in_prose = path in prose["README.md"] or path in prose["INSTALL.md"]
    in_table = bool(re.search(r"^\|\s*`GET %s`" % re.escape(path), sec5, re.M))
    return in_prose and in_table


def main():
    ok = check("floor: parsed @router.get set == %s" % sorted(FLOOR),
               registered() == FLOOR, str(sorted(registered())))
    if not ok:
        sys.exit(1)  # a parser break must redden, never vacuously pass
    prose = {d: (ROOT / d).read_text(encoding="utf-8")
             for d in ("README.md", "INSTALL.md")}
    sec5 = section5()
    for path in sorted(FLOOR):
        bad = "" if documented(path, prose, sec5) else "needs verbatim path in README/INSTALL and a §5 GET row"
        ok &= check("documented: GET %s" % path, not bad, bad)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
