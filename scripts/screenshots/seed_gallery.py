#!/usr/bin/env python3
"""Seed a throwaway HERMES_HOME with a gallery of rich-ui cards + one demo chat.

Every card goes through the REAL `rich_present` door (engine.tool.rich_present) so a
card that fails admission fails the seed — the gallery never shows hand-written records.
Then one desktop session is created whose assistant turns each carry ONE card directive,
so the transcript is a vertical strip of cards the screenshot driver can walk.

Usage (cwd = the hermes-agent checkout, so `hermes_state` imports):
  HERMES_HOME=<throwaway> RU_PLUGIN=<plugin dir> venv/bin/python seed_gallery.py > gallery.json
Prints {"session_id": ..., "cards": {name: card_id}} for the driver.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

PLUGIN = Path(os.environ["RU_PLUGIN"])
sys.path.insert(0, str(PLUGIN))
sys.path.insert(0, os.getcwd())
from engine.tool import rich_present  # noqa: E402

home = Path(os.environ["HERMES_HOME"])


def load(rel):
    return json.loads((PLUGIN / rel).read_text())


SRC = [
    {"id": "s1", "kind": "web", "label": "Nomad 1.10 release notes", "url": "https://developer.hashicorp.com/nomad/docs/release-notes", "accessed_at": "2026-09-25", "note": "primary"},
    {"id": "s2", "kind": "file", "label": "docs/REVIEW-C0.md @ 7459ec7"},
    {"id": "s3", "kind": "tool", "label": "scripts/suite.py run 2026-09-25 17:02Z"},
    {"id": "s4", "kind": "derived", "label": "sum of per-lane commit counts", "note": "git log master..c0/* | wc -l"},
]


def card(name, title, summary, components, data, sources=SRC, derivations=None):
    return name, {"title": title, "summary": summary, "components": components,
                  "data": data, "sources": sources, "derivations": derivations or []}


GALLERY = []

# 1. the C0 handoff card — the one the owner saw; nits 1-4 live here.
GALLERY.append(card("handoff", "hermes-rich-ui — C0 fix pass", "C0 → C1 handoff: hermes-rich-ui fix pass results",
    [
        {"id": "root", "component": "Card", "title": "hermes-rich-ui — C0 fix pass", "children": ["m", "tbl", "src"]},
        {"id": "m", "component": "Stack", "direction": "horizontal", "children": ["m1", "m2", "m3"]},
        {"id": "m1", "component": "Metric", "label": "Suite checks passing", "value": {"path": "/data/suite"}},
        {"id": "m2", "component": "Metric", "label": "P1 still accepted", "value": {"path": "/data/p1"}},
        {"id": "m3", "component": "Metric", "label": "Bundle KB", "value": {"path": "/data/bundle"}},
        {"id": "tbl", "component": "DataTable", "columns": [
            {"key": "lane", "label": "Lane", "type": "text"}, {"key": "items", "label": "Items", "type": "text"},
            {"key": "commits", "label": "Commits", "type": "number"}], "rows": {"path": "/data/lanes"}},
        {"id": "src", "component": "SourceList", "sourceIds": ["s2"]},
    ],
    {"suite": 505, "p1": 0, "bundle": 233, "lanes": [
        {"lane": "fix-engine", "items": "E1–E14", "commits": 7},
        {"lane": "fix-desktop", "items": "D1–D10", "commits": 8},
        {"lane": "fix-docs", "items": "W1–W5", "commits": 8}]}))

# 2/3. the two shipped examples verbatim.
for ex in ("research", "explanation"):
    a = load(f"examples/{ex}/present-args.json")
    GALLERY.append((ex, a))

# 4. all 18 types from the admission fixture.
fx = load("tests/fixtures/surface-all-types.json")
GALLERY.append(card("all-types", "All 18 component types", fx["dataModel"]["meta"]["summary"],
                    fx["components"], fx["dataModel"]["data"], fx["dataModel"]["meta"]["sources"]))

# 5. metric row stress: long labels, every format, a null.
GALLERY.append(card("metrics", "Metric formats", "Five metrics in one horizontal Stack: currency, percent, unit, precision, null.",
    [
        {"id": "root", "component": "Card", "title": "Q3 network P&L", "subtitle": "42 units, consolidated", "children": ["row"]},
        {"id": "row", "component": "Stack", "direction": "horizontal", "gap": "lg", "children": ["a", "b", "c", "d", "e"]},
        {"id": "a", "component": "Metric", "label": "Same-store sales growth", "value": {"path": "/data/sss"}, "format": "percent", "precision": 1, "sourceIds": ["s3"]},
        {"id": "b", "component": "Metric", "label": "Network revenue", "value": {"path": "/data/rev"}, "format": "currency"},
        {"id": "c", "component": "Metric", "label": "Median ticket", "value": {"path": "/data/ticket"}, "format": "currency", "precision": 2},
        {"id": "d", "component": "Metric", "label": "Labor hours", "value": {"path": "/data/hours"}, "unit": "h", "precision": 0},
        {"id": "e", "component": "Metric", "label": "Royalty leakage", "value": {"path": "/data/leak"}, "format": "percent"},
    ],
    {"sss": 4.35, "rev": 18234500, "ticket": 14.7312, "hours": 128430.2, "leak": None}))

# 6. paged table with every column type + nulls.
tb = load("tests/fixtures/table-basic.json")
cities = ["Austin", "Denver", "Boise", "Tulsa", "Reno", "Omaha", "Boulder", "Fresno", "Tucson", "Spokane", "Madison", "Toledo", "Provo", "Macon"]
rows = []
for i, c in enumerate(cities):
    rows.append({"city": c, "rent": None if i % 5 == 3 else 1400 + i * 37, "vacancy": round(3 + (i * 0.7) % 6, 2),
                 "seen": f"2026-09-{(i % 28) + 1:02d}", "score": round(1 + (i * 0.37) % 4, 2),
                 "src": ["s1"] if i % 3 == 0 else (["s1", "s4"] if i % 3 == 1 else [])})
GALLERY.append(card("table", "DataTable: paging, sort, every column type", "14 rows, pageSize 5, currency/percent/date/number(unit)/sources columns, nulls in rent.",
    [
        {"id": "root", "component": "Card", "title": "Rental market scan", "children": ["t"]},
        {"id": "t", "component": "DataTable", "title": tb["title"], "pageSize": 5, "columns": tb["columns"], "rows": {"path": "/data/rows"}},
    ], {"rows": rows}))

# 7. four charts in a 2-col grid.
charts = {k: load(f"tests/fixtures/chart-{k}.json") for k in ("bar", "line", "scatter", "histogram")}
comps = [{"id": "root", "component": "Card", "title": "Chart kinds", "children": ["g"]},
         {"id": "g", "component": "Grid", "columns": 2, "gap": "lg", "children": list(charts)}]
for k, ch in charts.items():
    comps.append({"id": k, "component": "Chart", **ch})
GALLERY.append(card("charts", "Chart kinds", "bar, line, scatter, histogram — the four uPlot kinds, each with a caveat.", comps, {}))

# 8. timeline / tabs / accordion / kv.
GALLERY.append(card("structure", "Timeline, Tabs, Accordion, KeyValueList", "Structural components with bound data.",
    [
        {"id": "root", "component": "Card", "title": "Nomad 1.10 rollout", "children": ["g"]},
        {"id": "g", "component": "Grid", "columns": 2, "children": ["left", "right"]},
        {"id": "left", "component": "Stack", "direction": "vertical", "children": ["tl", "acc"]},
        {"id": "right", "component": "Stack", "direction": "vertical", "children": ["dv", "tabs"]},
        {"id": "tl", "component": "Timeline", "title": "Rollout", "items": {"path": "/data/events"}},
        {"id": "dv", "component": "Divider", "label": "details"},
        {"id": "tabs", "component": "Tabs", "tabs": [{"title": "Facts", "child": "kv"}, {"title": "Notes", "child": "notes"}]},
        {"id": "kv", "component": "KeyValueList", "items": {"path": "/data/kv"}},
        {"id": "notes", "component": "Text", "text": {"path": "/data/notes"}, "tone": "muted"},
        {"id": "acc", "component": "Accordion", "items": [{"title": "Why drain one at a time", "child": "acc1", "open": True}, {"title": "Rollback", "child": "acc2"}]},
        {"id": "acc1", "component": "Text", "text": "A single drained client keeps the quorum of allocations placed; two at once trips the cluster's placement budget."},
        {"id": "acc2", "component": "Text", "text": "Re-pin the 1.9 binary, restart nomad, wait for the client to re-register — allocations migrate back on their own.", "variant": "caption"},
    ],
    {"events": [
        {"date": "2026-09-20", "label": "1.10 binaries staged on all clients", "status": "done", "sourceIds": ["s1"]},
        {"date": "2026-09-23", "label": "drained + upgraded client-a", "status": "done"},
        {"date": "2026-09-25", "label": "client-b in progress", "status": "pending"},
        {"label": "client-c", "status": "pending"}],
     "kv": [{"label": "Cluster", "value": "demo-cluster"}, {"label": "Version", "value": "1.10.0", "sourceIds": ["s1"]},
            {"label": "Clients", "value": 3}, {"label": "Downtime", "value": None}],
     "notes": "Nothing surprising so far.\nWatch the raft snapshot size on client-b."}))

# 9. sources / callouts / badges / progress.
GALLERY.append(card("sources", "Sources, callouts, badges, progress", "Every source kind, every callout tone, every badge tone, progress with and without total.",
    [
        {"id": "root", "component": "Card", "title": "Evidence surfaces", "children": ["c1", "c2", "c3", "b", "p1", "p2", "sl"]},
        {"id": "c1", "component": "Callout", "tone": "info", "title": "Info", "text": "Numbers are as-of 2026-09-25 17:00Z."},
        {"id": "c2", "component": "Callout", "tone": "caution", "title": "Caution", "text": "Denver rent is null: the listing feed was down."},
        {"id": "c3", "component": "Callout", "tone": "success", "text": "All four lanes merged clean."},
        {"id": "b", "component": "Stack", "direction": "horizontal", "gap": "sm", "children": ["b1", "b2", "b3", "b4"]},
        {"id": "b1", "component": "Badge", "label": "neutral"}, {"id": "b2", "component": "Badge", "label": "info", "tone": "info"},
        {"id": "b3", "component": "Badge", "label": "success", "tone": "success"}, {"id": "b4", "component": "Badge", "label": "caution", "tone": "caution"},
        {"id": "p1", "component": "Progress", "label": "Lanes merged", "current": {"path": "/data/done"}, "total": {"path": "/data/total"}},
        {"id": "p2", "component": "Progress", "label": "Unknown total", "current": {"path": "/data/done"}},
        {"id": "sl", "component": "SourceList", "title": "Sources"},
    ], {"done": 3, "total": 4}))

# 10. empty / null states.
GALLERY.append(card("empty", "Empty and null states", "Null metric, empty table, empty chart, explicit no-sources, unreachable image.",
    [
        {"id": "root", "component": "Card", "title": "Nothing to see", "children": ["m", "t", "ch", "img", "sl"]},
        {"id": "m", "component": "Metric", "label": "Unknown", "value": {"path": "/data/nope"}},
        {"id": "t", "component": "DataTable", "title": "No rows", "columns": [{"key": "a", "label": "A", "type": "text"}], "rows": {"path": "/data/rows"}},
        {"id": "ch", "component": "Chart", "kind": "bar", "title": "No points", "series": [{"label": "none", "data": []}]},
        {"id": "img", "component": "Image", "src": "https://example.com/does-not-exist.png", "alt": "unreachable image", "caption": "src is unreachable on purpose", "maxHeight": 120},
        {"id": "sl", "component": "SourceList", "sourceIds": []},
    ], {"nope": None, "rows": []}))


def main():
    os.environ["HERMES_SESSION_ID"] = "gallery"
    ids = {}
    for name, args in GALLERY:
        r = rich_present(args)
        if not r.get("ok"):
            print(f"ADMISSION FAILED for {name}: {r.get('errors')}", file=sys.stderr)
            sys.exit(1)
        ids[name] = r["card_id"]

    from hermes_state import SessionDB  # noqa: E402
    db = SessionDB(home / "state.db")
    now = time.time()
    sid = time.strftime("%Y%m%d_%H%M%S", time.localtime(now - 600)) + "_richui"
    db.create_session(sid, "desktop", model="demo-model")
    db.set_session_title(sid, "rich-ui gallery " + sid)
    t = now - 600
    for i, (name, args) in enumerate(GALLERY):
        db.append_message(sid, "user", f"show me: {args['title']}", timestamp=t + i * 20)
        db.append_message(sid, "assistant", f"{args['summary']}\n\n::richui{{id=\"{ids[name]}\"}}", timestamp=t + i * 20 + 5)
    db.set_session_pinned(sid, True)
    print(json.dumps({"session_id": sid, "cards": ids}))


if __name__ == "__main__":
    main()
