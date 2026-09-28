"""L3 microviz lane-local NEGATIVE admission tests (S9 pins).

The new types are not in the catalog yet (shared seam — L8 owns the merge), so
admit() cannot be pointed at them. Per LANES-BRIEFING, the MANIFEST'd admission
check CODE is exercised directly: it lives verbatim in tests/helpers/microviz_checks.py
and the integrator pastes the same bodies into engine/admission.py. Purity (no
mutation of inputs) is pinned too, matching admit()'s contract.

Run: python3 tests/test_synth_microviz_admission.py   (exit 0 = green)
"""
from __future__ import annotations

import json
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
_TESTS = os.path.join(_ROOT, "tests")
if _TESTS not in sys.path:
    sys.path.insert(0, _TESTS)

from helpers.admit import check, finish  # noqa: E402
from helpers.microviz_checks import _check_heatmap_matrix, _check_sparkline_values  # noqa: E402


def heat(name, rows, cols, cells, needle):
    payload = [rows, cols, cells]
    before = json.dumps(payload, sort_keys=True, default=str)
    errors = []
    _check_heatmap_matrix("h1", rows, cols, cells, errors)
    after = json.dumps(payload, sort_keys=True, default=str)
    hit = any(needle.lower() in e.lower() for e in errors)
    check(name, bool(errors) and hit and before == after, errors[:3] if errors else "NO ERROR")


def heat_ok(name, rows, cols, cells):
    errors = []
    _check_heatmap_matrix("h1", rows, cols, cells, errors)
    check(name, errors == [], errors[:5])


R = [{"label": "mon"}, {"label": "tue"}]
C = [{"label": "a"}, {"label": "b"}]

# positive: a well-formed matrix admits
heat_ok("heatmap_clean_matrix_admits", R, C,
        [{"row": "mon", "col": "a", "value": 1}, {"row": "tue", "col": "b", "value": None}])
# positive: all-null values are admission-legal (the renderer hatches them; S9)
heat_ok("heatmap_all_null_values_admit", R, C, [{"row": "mon", "col": "a", "value": None}])

# S9 pin: duplicate (row, col) rejected, error names the property + the rule
heat("heatmap_duplicate_cell_rejected", R, C,
     [{"row": "mon", "col": "a", "value": 1}, {"row": "mon", "col": "a", "value": 2}],
     "duplicate cell")
# refs subset of rows/cols (table-column-keys pattern, admission.py:633)
heat("heatmap_unknown_row_ref_rejected", R, C, [{"row": "wed", "col": "a", "value": 1}], "row")
heat("heatmap_unknown_col_ref_rejected", R, C, [{"row": "mon", "col": "z", "value": 1}], "col")
heat("heatmap_unknown_row_error_names_row", R, C, [{"row": "wed", "col": "a", "value": 1}], "/row:")
heat("heatmap_duplicate_row_label_rejected", [{"label": "mon"}, {"label": "mon"}], C,
     [{"row": "mon", "col": "a", "value": 1}], "duplicate row label")


def spark(name, values, series, expect_error, needle="values"):
    payload = [values, series]
    before = json.dumps(payload, sort_keys=True, default=str)
    errors = []
    _check_sparkline_values("s1", values, series, errors)
    after = json.dumps(payload, sort_keys=True, default=str)
    if expect_error:
        hit = any(needle.lower() in e.lower() for e in errors)
        check(name, bool(errors) and hit and before == after, errors[:3] if errors else "NO ERROR")
    else:
        check(name, errors == [] and before == after, errors[:5])


# positive: either array admits
spark("sparkline_values_admits", [1, None, 3], None, False)
spark("sparkline_series_admits", None, [1, 2], False)
# negative: neither present -> error names /values and the rule
spark("sparkline_no_series_rejected", None, None, True)
# an empty array ADMITS: the renderer renders an honest 'unavailable' (L1), no rejection rule invented
spark("sparkline_empty_admits", [], None, False)

finish()
