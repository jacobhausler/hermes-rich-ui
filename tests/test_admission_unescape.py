"""Boundary tests for unescape_token (RFC 6901 strict decode).
Run: python3 tests/test_admission_unescape.py (exit 0 = green).
Pins: bad escapes -> None, tilde-order decode, and the ''->'' invariant
resolve_pointer's empty-pointer short-circuit (engine/admission.py:134) relies on.
"""
from __future__ import annotations

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from engine.admission import unescape_token  # noqa: E402

RESULTS = []


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond)))
    print("%s %s%s" % ("PASS" if cond else "FAIL", name, (" -- " + str(detail)) if (detail and not cond) else ""))


def decodes(name, tok, want):
    got = unescape_token(tok)
    check(name, got == want, "unescape_token(%r) -> %r, want %r" % (tok, got, want))


def rejects(name, tok):
    got = unescape_token(tok)
    check(name, got is None, "unescape_token(%r) -> %r, want None" % (tok, got))


# bad escapes: '~' not followed by 0/1 -> None
rejects("bad escape 'a~b'", "a~b")
rejects("bad escape '~'", "~")
rejects("bad escape '~2'", "~2")
rejects("trailing tilde 'a~'", "a~")

# decode order ~1 -> '/' first, then ~0 -> '~' (tilde-slash hazard rows)
decodes("tilde-order '~01'", "~01", "~1")
decodes("tilde-order '~00'", "~00", "~0")
decodes("tilde-order '~0~1'", "~0~1", "~/")
decodes("tilde-order '~10'", "~10", "/0")

decodes("decode '~0'", "~0", "~")
decodes("decode '~1'", "~1", "/")
decodes("decode 'a~1b'", "a~1b", "a/b")
decodes("decode 'c~0d'", "c~0d", "c~d")
decodes("plain 'abc'", "abc", "abc")
_empty = unescape_token("")
check("empty-token is '' not None", _empty == "" and _empty is not None, repr(_empty))

# ------------------------------------------------------------------ summary
failed = [n for n, ok in RESULTS if not ok]
print("---")
print("%d assertions, %d failed" % (len(RESULTS), len(failed)))
if failed:
    print("FAILED: " + ", ".join(failed))
    sys.exit(1)
