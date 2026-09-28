#!/usr/bin/env python3
"""End-to-end (python half): load the plugin door exactly as the host would (importlib on
__init__.py), register into a fake ctx, call the registered `rich_present` handler with
examples/research/present-args.json under a throwaway HERMES_HOME, assert ok:true, then
prove the record on disk admits again through engine.admission.admit.

Usage: python3 tests/e2e_present.py [<out-record.json>]
Prints PASS/FAIL lines; exit 0 = green. The written record is consumed by
tests/test_e2e_record.mjs (which spawns this script).
"""
from __future__ import annotations

import importlib.util
import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
fails = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        fails.append(msg)


def main():
    out_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    home = Path(tempfile.mkdtemp(prefix="richui-e2e-", dir=os.environ.get("TMPDIR")))
    os.environ["HERMES_HOME"] = str(home)

    spec = importlib.util.spec_from_file_location("hermes_rich_ui_e2e", ROOT / "__init__.py")
    door = importlib.util.module_from_spec(spec)
    sys.modules["hermes_rich_ui_e2e"] = door
    spec.loader.exec_module(door)

    reg = {}

    class Ctx:
        def register_tool(self, name, toolset, schema, handler, **kw):
            reg[name] = handler

        def register_skill(self, *a, **kw):
            reg["skill"] = a

    door.register(Ctx())
    check("rich_present" in reg, "register(ctx) registered rich_present")
    handler = reg["rich_present"]

    args = json.loads((ROOT / "examples" / "research" / "present-args.json").read_text("utf-8"))
    raw = handler(json.dumps(args))
    out = json.loads(raw)
    check(out.get("ok") is True, "handler returned ok:true (%s)" % (out.get("errors") if not out.get("ok") else out.get("card_id")))
    if out.get("ok") is not True:
        return finish()
    card_id = out["card_id"]
    check(out["directive"] == '::richui{id="%s"}' % card_id, "directive matches card_id")

    rec_path = home / "rich-ui" / "cards" / (card_id + ".json")
    check(rec_path.is_file(), "record written under HERMES_HOME: %s" % rec_path.relative_to(home))
    record = json.loads(rec_path.read_text("utf-8"))
    cs = record["surface"]["createSurface"]
    check(cs["dataModel"]["meta"].get("title") == args["title"], "meta.title == title arg (rev 2026-09-25b)")
    check(cs["dataModel"]["meta"].get("summary") == args["summary"], "meta.summary == summary arg")

    adm_spec = importlib.util.spec_from_file_location("hermes_rich_ui_e2e_admission", ROOT / "engine" / "admission.py")
    adm = importlib.util.module_from_spec(adm_spec)
    adm_spec.loader.exec_module(adm)
    errors, normalized = adm.admit(cs["components"], cs["dataModel"])
    check(errors == [], "record on disk re-admits with 0 errors (%s)" % errors[:3])
    check(len(normalized) == len(cs["components"]), "admit returned one normalized component per input")

    if out_path:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(record, indent=2) + "\n", "utf-8")
        print("record: %s" % out_path)
    return finish()


def finish():
    print("RESULT %s (%d failed)" % ("FAIL" if fails else "PASS", len(fails)))
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
