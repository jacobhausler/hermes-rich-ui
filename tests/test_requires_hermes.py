#!/usr/bin/env python3
"""Gate the plugin.yaml requires_hermes spec against core's real comparator.

Core (hermes_cli/plugins_manifest.py: version_satisfies / requires_hermes_error)
compares SEMVER base versions, not release date tags: it strips a leading "v",
splits on ".", and tuple-compares the first three numeric segments. A spec
written as a date tag (">=v2026.9.24") therefore demands base >= (2026,9,24),
which the actual 0.21.5 release (tagged v2026.9.24) can never satisfy — the
gate then blocks every install. This test pins requires_hermes to the semver
release so the shipped gate admits exactly the releases that support the
plugin.

Prefers the REAL core comparator (CI pip-installs the pinned hermes-agent so a
plain import works; dev boxes discover the core checkout via HERMES_CORE or the
`hermes` launcher on PATH); falls back to a local reimplementation of the same
tuple compare when hermes_cli is not importable anywhere.

Run: python3 tests/test_requires_hermes.py   (exit 0 = green)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAILURES = []


def check(name, ok, detail=""):
    print("%s %s %s" % ("PASS" if ok else "FAIL", name, detail))
    if not ok:
        FAILURES.append(name)


# --- minimal line parse of plugin.yaml (repo has no yaml dependency) --------
def read_requires_hermes():
    text = (ROOT / "plugin.yaml").read_text(encoding="utf-8")
    m = re.search(r"(?m)^requires_hermes:\s*(.*?)\s*$", text)
    if not m:
        return None
    raw = m.group(1)
    # strip an inline comment (same rule as YAML: # opens a comment only after
    # whitespace or at start of the value) and surrounding quotes
    raw = re.split(r"(?<=\s)#", raw, maxsplit=1)[0].strip()
    return raw.strip("\"'")


# --- comparator: real core if importable, else a local mirror of it ---------
def _local_version_tuple(v):
    # Mirror of hermes_cli.plugins_manifest._version_tuple: strip leading "v",
    # cut at first "-"/"+", split on ".", require digits in each of 3 segments.
    head = re.split(r"[-+]", str(v).strip().lstrip("v"), maxsplit=1)[0].split(".")
    head += ["0"] * (3 - len(head))
    out = []
    for x in head[:3]:
        m = re.match(r"^\d+", x.strip())
        if m is None:
            return None
        out.append(int(m.group(0)))
    return tuple(out)


def _local_version_satisfies(spec, current):
    cur = _local_version_tuple(current)
    if cur is None:
        return True
    ops = {">=": cur.__ge__, "<=": cur.__le__, "==": cur.__eq__,
           "!=": cur.__ne__, ">": cur.__gt__, "<": cur.__lt__}
    for clause in filter(None, (c.strip() for c in spec.split(","))):
        m = re.match(r"^\s*(>=|<=|==|!=|>|<)\s*(.+?)\s*$", clause)
        op, target = (m.group(1), m.group(2)) if m else (">=", clause)
        tgt = _local_version_tuple(target)
        if tgt is not None and not ops[op](tgt):
            return False
    return True


version_satisfies = _local_version_satisfies
core_source = "local fallback"
try:
    from hermes_cli.plugins_manifest import version_satisfies  # noqa: E402,F811
    core_source = "hermes_cli.plugins_manifest"
except Exception:
    pass
if core_source == "local fallback":
    # Dev boxes keep a core checkout reachable via HERMES_CORE or next to the
    # `hermes` launcher (e.g. <checkout>/.venv/bin/hermes); CI pip-installs the
    # pinned hermes-agent so the import above already succeeded.
    import os
    import shutil
    from pathlib import Path as _P
    _cands = []
    if os.environ.get("HERMES_CORE"):
        _cands.append(_P(os.environ["HERMES_CORE"]))
    _launcher = shutil.which("hermes")
    if _launcher:
        _cands.extend([_P(_launcher).resolve().parents[2],
                       _P(_launcher).resolve().parents[3]])
    for _c in _cands:
        if (_c / "hermes_cli" / "plugins_manifest.py").is_file():
            sys.path.insert(0, str(_c))
            try:
                from hermes_cli.plugins_manifest import version_satisfies  # noqa: E402,F811
                core_source = "%s/hermes_cli.plugins_manifest" % _c
            except Exception:
                pass
            break

# --- the gate ---------------------------------------------------------------
spec = read_requires_hermes()
check("manifest_has_requires_hermes", bool(spec), "spec=%r" % (spec,))

if spec:
    check("comparator_source", True, "via %s" % core_source)
    # The shipped release v2026.9.24 is semver 0.21.5: the gate must admit it.
    check("admits_0_21_5", version_satisfies(spec, "0.21.5") is True,
          "version_satisfies(%r, '0.21.5') must be True" % spec)
    # The previous release (v2026.9.21 = 0.21.4) must stay below the floor.
    check("rejects_0_21_4", version_satisfies(spec, "0.21.4") is False,
          "version_satisfies(%r, '0.21.4') must be False" % spec)
    # Regression pin: a date-tag spec compares as (2026,9,24) and blocks all
    # real releases; forbid the date form outright.
    check("spec_is_not_date_tag",
          re.search(r"(?<![0-9.])v?20\d\d\.\d", spec) is None,
          "requires_hermes=%r looks like a release date tag; core compares "
          "semver base versions" % spec)

print("FAILURES:", FAILURES if FAILURES else "none")
raise SystemExit(1 if FAILURES else 0)
