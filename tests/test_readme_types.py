#!/usr/bin/env python3
"""Pin the README type table against the live catalog surface.

The README carries a `## The N types (catalog `hermes-rich-ui/1`)` section whose
heading count and numbered rows are hand-maintained. The skill surface is pinned
by test_skill_docs.py (every catalog component must appear in SKILL.md), but the
README's count and table were free text — when catalog type #27 lands the
README says "26 types" beside a 27-row table until a human notices. This test
makes that drift a RED gate instead:

  1. the heading count == number of catalog components,
  2. the numbered rows are exactly 1..N,
  3. the row names == the catalog component set (one row per type, no extras),
  4. every row has a non-empty purpose cell.

Stdlib only, no network. Run: python3 tests/test_readme_types.py (exit 0 green).
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAILURES = []


def check(name, ok, detail=""):
    print("%s %s %s" % ("PASS" if ok else "FAIL", name, detail))
    if not ok:
        FAILURES.append(name)


catalog = json.loads((ROOT / "catalog" / "hermes-rich-ui.catalog.json").read_text(encoding="utf-8"))
components = sorted(catalog["components"])
readme = (ROOT / "README.md").read_text(encoding="utf-8")

m = re.search(r"(?m)^## The (\d+) types \(catalog `hermes-rich-ui/1`\)\s*$", readme)
check("readme_has_types_section", m is not None, "heading '## The N types (catalog `hermes-rich-ui/1`)'")
if m:
    heading_count = int(m.group(1))
    check("heading_count_matches_catalog", heading_count == len(components),
          "heading=%d catalog=%d" % (heading_count, len(components)))

    tail = readme[m.end():]
    # rows like "| 24 | Sparkline | purpose |" until the section ends (next ## heading)
    section = tail.split("\n## ", 1)[0]
    rows = re.findall(r"(?m)^\| (\d+) \| ([A-Za-z0-9]+) \| (.*?) \|\s*$", section)
    check("table_row_count_matches_catalog", len(rows) == len(components),
          "rows=%d catalog=%d" % (len(rows), len(components)))
    nums = [int(n) for n, _, _ in rows]
    check("table_numbered_1_to_n", nums == list(range(1, len(components) + 1)),
          "first=%s last=%s" % (nums[:1], nums[-1:]) if nums else "empty")
    names = sorted(name for _, name, _ in rows)
    check("table_names_match_catalog_set", names == components,
          "missing=%s extra=%s" % (sorted(set(components) - set(names)), sorted(set(names) - set(components))))
    check("every_row_has_purpose", all(purpose.strip() for _, _, purpose in rows),
          "rows with empty purpose cells fail")

# Prose counts ("(26 component types)", "source of truth for the 18 types") drift
# separately from the heading/table above; pin every one of them to the catalog.
# Lines starting with '<img' are skipped: that alt text describes a fixed capture.
PROSE = [re.compile(r"\b(\d+) (?:read-only )?component types\b")]
stale = []
for fname, extra in (("README.md", []), ("AGENTS.md", [re.compile(r"source of truth for the (\d+) types")])):
    for lineno, line in enumerate((ROOT / fname).read_text(encoding="utf-8").splitlines(), 1):
        if line.lstrip().startswith("<img"):
            continue
        for rx in PROSE + extra:
            stale += ["%s:%d:%s" % (fname, lineno, n) for n in rx.findall(line) if int(n) != len(components)]
check("readme_prose_counts_match_catalog", not stale,
      "catalog=%d stale(file:line:found)=%s" % (len(components), stale))

print("FAILURES:", FAILURES if FAILURES else "none")
raise SystemExit(1 if FAILURES else 0)
