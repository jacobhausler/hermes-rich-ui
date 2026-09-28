"""L3 microviz lane-local admission checks (N12/N14) — the EXACT code MANIFEST.md
asks L8 to merge into engine/admission.py. Kept here (lane-owned file, shared seams
are banned) so the truth-table pins run directly in tests/test_synth_microviz_admission.py.

Merge targets:
  - _check_heatmap_matrix + _check_sparkline_values: new module-level functions;
    call them from _check_leaf_specifics (admission.py ~607, next to the Chart /
    DataTable branches, table-column-keys pattern admission.py:633).
  - No caps constants: the single reachable heatmap cap is the catalog
    maxItems=144 (S4 — no python MAX_HEATMAP_CELLS).
"""
from __future__ import annotations


def _check_heatmap_matrix(label, rows, cols, cells, errors):
    """N14 (S9): cells are a closed matrix over the declared row/col labels.
    refs must be declared labels (refs subset of rows/cols) and one cell per
    (row, col) pair — duplicates reject (L4: every error names the property)."""
    if not (isinstance(rows, list) and isinstance(cols, list) and isinstance(cells, list)):
        return
    row_labels = [r.get("label") for r in rows if isinstance(r, dict)]
    col_labels = [c.get("label") for c in cols if isinstance(c, dict)]
    if len(set(row_labels)) != len(row_labels):
        errors.append("%s: /rows: duplicate row label" % label)
    if len(set(col_labels)) != len(col_labels):
        errors.append("%s: /cols: duplicate column label" % label)
    seen = set()
    for i, cell in enumerate(cells):
        if not isinstance(cell, dict):
            continue
        where = "%s: /cells/%d" % (label, i)
        r, c = cell.get("row"), cell.get("col")
        if r not in row_labels:
            errors.append("%s/row: %r is not a declared row label (cells must reference /rows)" % (where, r))
        if c not in col_labels:
            errors.append("%s/col: %r is not a declared column label (cells must reference /cols)" % (where, c))
        key = (r, c)
        if key in seen:
            errors.append("%s: duplicate cell for (row %r, col %r) — one cell per (row, col) pair" % (where, r, c))
        seen.add(key)


def _check_sparkline_values(label, values, series, errors):
    """N12: at least one of values/series must be a (literal or bound) array.
    The renderer reads values first, then series; item shapes/caps are catalog's
    (oneOf number|null, maxItems 512)."""
    if not isinstance(values, list) and not isinstance(series, list):
        errors.append("%s: /values: Sparkline requires a 'values' (or 'series') array of number|null" % label)
