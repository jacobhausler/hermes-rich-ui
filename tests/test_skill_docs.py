#!/usr/bin/env python3
"""Doc-lane gate for hermes-rich-ui.

Asserts SKILL.md shape, frontmatter, component coverage against the frozen
CONTRACTS.md section 2, recipe JSON validity (root present), and doc hygiene
(no absolute home paths, no hostnames outside the author lines).

Run: python3 tests/test_skill_docs.py   (exit 0 = green)
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


def read(p):
    # type: (str) -> str
    return (ROOT / p).read_text(encoding="utf-8")


def components_from_contracts():
    """Parse the 18 component names from the CONTRACTS.md section-2 table."""
    text = read("docs/CONTRACTS.md")
    m = re.search(r"^## 2\..*?$(.*?)(?=^## |\Z)", text, re.M | re.S)
    if not m:
        return []
    names = []
    for row in re.findall(r"^\|\s*\d+\s*\|\s*`([A-Za-z]+)`\s*\|", m.group(1), re.M):
        names.append(row)
    return names


# --- SKILL.md shape ---------------------------------------------------------
skill_text = read("skill/SKILL.md")
lines = skill_text.splitlines()
check("skill_exists_under_110_lines", len(lines) < 110, "lines=%d" % len(lines))

fm = re.match(r"^---\n(.*?)\n---\n", skill_text, re.S)
check("skill_frontmatter_present", fm is not None)
if fm:
    body = fm.group(1)
    check("skill_frontmatter_name", re.search(r"^name:\s*rich-ui\s*$", body, re.M) is not None)
    dm = re.search(r'^description:\s*(.*)$', body, re.M)
    desc_ok = dm is not None and re.match(r'^"[^"]*rich_present[^"]*"$', dm.group(1).strip()) is not None
    check("skill_description_double_quoted_mentions_rich_present", desc_ok,
          "" if dm is None else dm.group(1)[:60])

comps = components_from_contracts()
check("contracts_section2_has_18_components", len(comps) == 18, "found=%d" % len(comps))

# Single source of truth for the LIVE component surface is the catalog JSON;
# CONTRACTS.md §2 is the frozen v0.1.0 baseline (18) and must stay a subset
# (v0.1.1 added 8 additive types pending the owner-gated CONTRACTS rev).
_catalog = json.loads(read("catalog/hermes-rich-ui.catalog.json"))
live_comps = sorted(_catalog["components"])
check("contracts_subset_of_catalog", set(comps) <= set(live_comps))
for c in live_comps:
    check("skill_mentions_component_%s" % c, re.search(r"\b%s\b" % c, skill_text) is not None)

# --- recipes.md validity ----------------------------------------------------
rec_text = read("skill/references/recipes.md")
blocks = re.findall(r"```json\n(.*?)```", rec_text, re.S)
check("recipes_has_10_examples", len(blocks) == 10, "found=%d" % len(blocks))
for i, block in enumerate(blocks):
    try:
        obj = json.loads(block)
    except ValueError as exc:
        check("recipe_%d_parses_as_json" % i, False, str(exc))
        continue
    check("recipe_%d_parses_as_json" % i, True)
    comps_i = obj.get("components", [])
    ids = [c.get("id") for c in comps_i if isinstance(c, dict)]
    check("recipe_%d_has_root_component" % i, "root" in ids, "n=%d" % len(comps_i))
    types_i = {c.get("component") for c in comps_i if isinstance(c, dict)}
    check("recipe_%d_types_are_catalog_types" % i, bool(types_i) and types_i.issubset(set(live_comps)),
          ",".join(sorted(t for t in types_i if t)))
    for c in comps_i:
        if isinstance(c, dict) and c.get("id") == "root" and comps:
            check("recipe_%d_root_is_card" % i, c.get("component") == "Card")

    # --- REVIEW-C0 W3: every recipe must ADMIT (sem F1/F2) --------------------
    sources_i = obj.get("sources", [])
    derivs_i = obj.get("derivations", [])
    source_ids = {s.get("id") for s in sources_i if isinstance(s, dict)}
    deriv_ids = {d.get("id") for d in derivs_i if isinstance(d, dict)}
    # E14: sourceIds cite sources only, never a derivation id (Distribution once cited "d1").
    cited = []
    for c in comps_i:
        if isinstance(c, dict):
            cited.extend(c.get("sourceIds") or [])
    check("recipe_%d_sourceIds_cite_sources_only" % i,
          all(s in source_ids and s not in deriv_ids for s in cited), ",".join(map(str, cited)))
    # E5/E6 (CONTRACTS rev 2026-09-25c d): closed source / derivation shapes.
    SOURCE_KEYS = {"id", "kind", "label", "url", "accessed_at", "note"}
    SOURCE_KINDS = {"web", "file", "tool", "derived"}
    DERIV_KEYS = {"id", "method", "input_paths", "output_path", "note"}
    check("recipe_%d_sources_closed_shape" % i,
          all(isinstance(s, dict) and set(s) <= SOURCE_KEYS and s.get("kind") in SOURCE_KINDS
              and isinstance(s.get("label"), str) and 1 <= len(s["label"]) <= 256 for s in sources_i))
    check("recipe_%d_derivations_closed_shape" % i,
          all(isinstance(d, dict) and set(d) <= DERIV_KEYS and {"id", "method", "input_paths", "output_path"} <= set(d)
              for d in derivs_i))
    # E11: a DataTable cites per row ONLY through a declared {type: "sources"} column; the row
    # cell under that column key is a list of ids that resolve in sources; no stray sourceIds keys.
    data_i = obj.get("data", {})
    e11_ok = True
    for c in comps_i:
        if not (isinstance(c, dict) and c.get("component") == "DataTable"):
            continue
        cols = c.get("columns") or []
        src_keys = {col.get("key") for col in cols if isinstance(col, dict) and col.get("type") == "sources"}
        declared = {col.get("key") for col in cols if isinstance(col, dict)}
        rows = c.get("rows")
        if isinstance(rows, dict) and isinstance(rows.get("path"), str) and rows["path"].startswith("/data/"):
            rows = data_i.get(rows["path"][len("/data/"):])
        for row in rows or []:
            if not isinstance(row, dict) or not set(row) <= declared:
                e11_ok = False
            for k in src_keys:
                cell = row.get(k) if isinstance(row, dict) else None
                if not (isinstance(cell, list) and all(s in source_ids for s in cell)):
                    e11_ok = False
    check("recipe_%d_datatable_sources_column_rule_E11" % i, e11_ok)
    # The engine gate itself (sem admit_recipes.py, now permanent). NOTE: the pre-E11 engine
    # admits a declared sources column without resolving its ids; the E11 hand-check above
    # is what proves resolution until fix-engine lands.
    try:
        sys.path.insert(0, str(ROOT))
        from engine.admission import admit  # noqa: E402
        from engine.tool import build_record  # noqa: E402
        _rec, dm = build_record("ru-000000000000", obj.get("title"), obj.get("summary"), comps_i,
                                data_i, sources_i, derivs_i)
        errs, _norm = admit(comps_i, dm)
        check("recipe_%d_admits" % i, not errs, "; ".join(errs)[:200])
    except Exception as exc:  # engine import/signature drift is a FAIL, not a skip
        check("recipe_%d_admits" % i, False, "engine call failed: %r" % (exc,))

# --- REVIEW-C0 W2/W4: CONTRACTS revision line 2026-09-25c, every letter present -------
contracts = read("docs/CONTRACTS.md")
check("contracts_rev_2026-09-25c_present", "Revision line 2026-09-25c" in contracts)
for letter, needle in [
    ("a", "^[A-Za-z0-9_.:-]{1,128}$"),
    ("b", "Cc, Cf, Zs, Zl or Zp"),
    ("c", 'json.dumps(separators=(",", ":"), ensure_ascii=False)'),
    ("d", "kind: web|file|tool|derived"),
    ("e", '{key, label, type: "sources"}'),
    ("f", "datetime.fromisoformat"),
    ("g", "`/data` object is depth 1"),
    ("h", "give view OR components, not both"),
    ("W4", '[data-richui="chart-canvas"]'),
]:
    check("contracts_rev_c_%s" % letter, needle in contracts, needle)
# History is never deleted: the earlier revision line and the frozen header survive.
check("contracts_rev_2026-09-25b_kept", "Revision line 2026-09-25b" in contracts)
check("contracts_frozen_header_kept", "Status: FROZEN 2026-09-25 for C0–C3" in contracts)
# SKILL.md agrees with (d)/(e): closed source kinds and the sources-column rule are taught.
check("skill_teaches_source_kinds", "web|file|tool|derived" in skill_text)
check("skill_teaches_sources_column", 'type: "sources"' in skill_text)
check("skill_teaches_derivation_not_citation", re.search(r"derivation id is NOT a\s+citation", skill_text) is not None)

# --- REVIEW-C0 W1: CHANGELOG carries the review entry ----------------------------
changelog = read("CHANGELOG.md")
check("changelog_c0_review_entry",
      "C0 review: 0 P0 / 15 P1 / 17 P2" in changelog and "all P1 fixed, P2 fixed or deferred" in changelog)
check("changelog_c0_review_lists_deferred", "Deferred (C1+)" in changelog)
# W5: no placeholder images until C2 captures a real screenshot.
check("readme_no_placeholder_image", re.search(r"!\[[^\]]*\]\([^)]*\.(png|jpe?g|gif|svg)\)", read("README.md")) is None)

# --- hygiene: shipped docs ---------------------------------------------------
DOC_GLOBS = ["README.md", "AGENTS.md", "INSTALL.md", "CHANGELOG.md",
             "skill/SKILL.md", "skill/references/recipes.md",
             "skill/maintaining/SKILL.md", "skill/debugging/SKILL.md",
             "docs/ARCHITECTURE.md", "CONTRIBUTING.md"]
HOSTNAME_RE = re.compile(r"\b(haus|callindor|rhuidean|gaidin|hausler\.cc)\b")
for rel in DOC_GLOBS:
    text = read(rel)
    check("no_home_paths_in_%s" % rel, ("/home/" not in text and "/Users/" not in text))
    hits = HOSTNAME_RE.findall(text)
    check("no_hostnames_in_%s" % rel, not hits, ",".join(sorted(set(hits))))

# LICENSE holds the author line and README its author attribution: allowed there.
for rel in ["LICENSE", "README.md"]:
    text = read(rel)
    for h in HOSTNAME_RE.findall(text):
        line_ok = re.search(r"(?i)(jacob\s+hausler|author)", text) is not None
        check("hostname_in_%s_is_author_line(%s)" % (rel, h), line_ok)

# --- CI shape ----------------------------------------------------------------
ci = read(".github/workflows/ci.yml")
for needle in ["node-version", "python-version", "npm ci", "scripts/build.mjs",
               "scripts/suite.py", "git diff --exit-code desktop/plugin.js"]:
    check("ci_contains_%s" % needle.replace(" ", "-").replace("/", "_"), needle in ci)

print("RESULT", "PASS" if not FAILURES else "FAIL", "failures=%d" % len(FAILURES))
sys.exit(0 if not FAILURES else 1)
