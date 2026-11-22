#!/usr/bin/env python3
"""Burn-token census laws for scripts/gen_registry.py, pinned verbatim.
Pure-filesystem (fake names, temp dirs, no git): a two-plus digit token in
the file name wins outright; a one-digit name token falls through to the
header scan; the scan reads fifteen lines only, earliest line wins; title
form beats keyword mention on one line; comment marks strip before the
title match (markdown double-hash does not); keyword form takes one to
four digits; no token anywhere yields None."""
from __future__ import annotations

import importlib.util
import tempfile
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "gen_registry", Path(__file__).resolve().parents[1] / "scripts" / "gen_registry.py")
gr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gr)

FAILURES = []


def check(name, ok, detail=""):
    print("%s %s %s" % ("PASS" if ok else "FAIL", name, detail))
    if not ok:
        FAILURES.append(name)


def probe(tmp, name, header):
    path = Path(tmp) / name
    path.write_text(header, encoding="utf-8")
    return gr.burn_token(path)


with tempfile.TemporaryDirectory() as tmp:
    check("name_token_wins_over_any_header_token",
          probe(tmp, "test_foo_102.py", "#7 scar\n#99 later\n") == "#102")
    check("one_digit_name_token_falls_through_to_header",
          probe(tmp, "test_bar_7.py", "issue #9 traced here\n") == "#9")
    check("header_line_fifteen_is_in_window",
          probe(tmp, "t_win.py", "\n" * 14 + "#21 line fifteen\n") == "#21")
    check("header_line_sixteen_is_out_of_window",
          probe(tmp, "t_late.py", "\n" * 15 + "#21 line sixteen\n") is None)
    check("earliest_header_line_wins",
          probe(tmp, "t_e1.py", "plain\nissue #7 line two\n#5 line three\n") == "#7"
          and probe(tmp, "t_e2.py", "plain\n#5 line two\n#9 line three\n") == "#5")
    check("title_form_beats_keyword_on_one_line",
          probe(tmp, "t_mix.py", "#21 rest of title and PR #84 mention\n") == "#21")
    check("comment_marks_are_stripped_before_title",
          probe(tmp, "t_sl.py", "// #21 repro\n") == "#21"
          and probe(tmp, "t_mk.py", "\t/*\"' #21 x\n") == "#21")
    check("markdown_double_hash_is_not_a_token",
          probe(tmp, "t_md.py", "##21 heading\n") is None)
    check("keyword_form_takes_one_to_four_digits",
          probe(tmp, "t_k1.py", "issue #9 low\n") == "#9"
          and probe(tmp, "t_k4.py", "PR #166 high\n") == "#166")
    check("no_token_anywhere_yields_none",
          probe(tmp, "t_none.py", "no census scar here\nsecond line\n") is None)

print("burn_token laws: %d checks, %d failures" % (10, len(FAILURES))); raise SystemExit(1 if FAILURES else 0)
