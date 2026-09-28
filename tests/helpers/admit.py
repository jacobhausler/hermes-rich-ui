"""Shared admission-test harness for lane-local tests (expansion cycle 0927).
Usage:  from helpers.admit import check, rejects, admits, finish
Same semantics as tests/test_admission.py's helpers (errors must exist AND name
`needle`; inputs byte-stable through admit). Run: python3 tests/test_synth_*.py
"""
from __future__ import annotations

import json
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from engine.admission import admit, load_catalog, resolve_pointer, check_url, CATALOG_ID  # noqa: E402, F401

RESULTS = []


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond)))
    print("%s %s%s" % ("PASS" if cond else "FAIL", name, (" -- " + str(detail)) if (detail and not cond) else ""))


def rejects(name, components, data_model, needle):
    before = json.dumps([components, data_model], sort_keys=True, default=str)
    errors, _norm = admit(components, data_model)
    after = json.dumps([components, data_model], sort_keys=True, default=str)
    hit = any(needle.lower() in e.lower() for e in errors)
    check(name, bool(errors) and hit and before == after, errors[:3] if errors else "ADMITTED")


def admits(name, components, data_model):
    errors, norm = admit(components, data_model)
    check(name, errors == [], errors[:5])
    return norm


def finish():
    bad = [n for n, ok in RESULTS if not ok]
    print("%d checks, %d FAIL" % (len(RESULTS), len(bad)))
    sys.exit(1 if bad else 0)
