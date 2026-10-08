"""#29 admission pins — fraction format + KV title must pass the front door.

The PR #84 render path (metric.mjs / keyvaluelist.mjs / barlist.mjs house
faces) speaks format:'fraction' and KeyValueList `title`, but the render
tests call renderComponent directly and never traverse engine/admission.py.
Agent-authored cards die at admit() unless the catalog admits these props.
These pins close the gap the zap re-review caught: one assertion per new
prop, positive AND negative, so the catalog can never silently drift from
the renderer again.

Run: python3 tests/test_admission_fraction_title.py (exit 0 = green).
"""
from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from engine.admission import admit  # noqa: E402

RESULTS = []
NEGATIVE = 0


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond)))
    print("%s %s%s" % ("PASS" if cond else "FAIL", name, (": " + str(detail)) if (detail and not cond) else ""))


def admits(name, components, data_model):
    errors, _norm = admit(components, data_model)
    check(name, errors == [], errors[:5])


def rejects(name, components, data_model, needle):
    """Negative control: must be rejected AND an error must mention `needle`."""
    global NEGATIVE
    NEGATIVE += 1
    errors, _norm = admit(components, data_model)
    hit = any(needle.lower() in e.lower() for e in errors)
    check(name, errors and hit, errors[:3] if errors else "ADMITTED")


def dm():
    return {
        "data": {"n": 0.42},
        "meta": {
            "summary": "synthetic test",
            "authored_at": "2026-10-08T00:00:00Z",
            "dataset": {"id": "t", "revision": 1, "observed_at": None, "published_at": "2026-10-08T00:00:00Z"},
            "sources": [{"id": "s1", "kind": "web", "label": "S1", "url": "https://example.org/x"}],
            "derivations": [],
        },
    }


def card(*children):
    return {"id": "root", "component": "Card", "title": "T", "children": list(children)}


# --------------------------------------------------------------- positives
# The four slices the zap re-review named as unreachable, plus BarList and
# the bound-value paths (the renderer resolves {path}, so admission must too).

admits("#29 Metric format fraction admits",
       [card("m1"), {"id": "m1", "component": "Metric", "label": "Hit rate", "value": 0.42, "format": "fraction"}],
       dm())

admits("#29 Metric format fraction bound admits",
       [card("m1"), {"id": "m1", "component": "Metric", "label": "Hit rate", "value": {"path": "/data/n"}, "format": "fraction"}],
       dm())

admits("#29 KV item format fraction admits",
       [card("k1"), {"id": "k1", "component": "KeyValueList", "items": [{"label": "Rate", "value": 0.42, "format": "fraction"}]}],
       dm())

admits("#29 KV title admits",
       [card("k1"), {"id": "k1", "component": "KeyValueList", "title": "Facts", "items": [{"label": "l", "value": "v"}]}],
       dm())

admits("#29 BarList format fraction admits",
       [card("b1"), {"id": "b1", "component": "BarList", "items": [{"label": "a", "value": 0.5}], "format": "fraction"}],
       dm())

# Control: the pre-#29 faces still admit (the enum widened, it did not move).
admits("#29 control Metric format number admits",
       [card("m1"), {"id": "m1", "component": "Metric", "label": "Count", "value": 3, "format": "number"}],
       dm())

# --------------------------------------------------------------- negatives
# The enum is ['number','currency','percent','fraction'] — not an open string.
rejects("#29 Metric format bogus rejected",
        [card("m1"), {"id": "m1", "component": "Metric", "label": "L", "value": 1, "format": "millicandela"}],
        dm(), "expected one of")

rejects("#29 KV item format bogus rejected",
        [card("k1"), {"id": "k1", "component": "KeyValueList", "items": [{"label": "l", "value": 1, "format": "millicandela"}]}],
        dm(), "expected one of")

rejects("#29 BarList format bogus rejected",
        [card("b1"), {"id": "b1", "component": "BarList", "items": [{"label": "a", "value": 1}], "format": "millicandela"}],
        dm(), "expected one of")

rejects("#29 KV unknown sibling prop still rejected",
        [card("k1"), {"id": "k1", "component": "KeyValueList", "subtitle": "nope", "items": [{"label": "l", "value": "v"}]}],
        dm(), "unknown property")

rejects("#29 KV title must be a string",
        [card("k1"), {"id": "k1", "component": "KeyValueList", "title": 7, "items": [{"label": "l", "value": "v"}]}],
        dm(), "string")

# ------------------------------------------------------------------ summary
failed = [n for n, ok in RESULTS if not ok]
print("---")
print("%d assertions, %d failed, %d negative controls" % (len(RESULTS), len(failed), NEGATIVE))
if failed:
    print("FAILED: " + ", ".join(failed))
    sys.exit(1)
