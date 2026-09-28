"""Shared test plumbing for the backend lane: fresh HERMES_HOME per test, path-loaded modules."""
from __future__ import annotations

import hashlib
import importlib.util
import os
import sys
import tempfile
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def fresh_home():
    home = tempfile.mkdtemp(prefix="rich-ui-test-")
    os.environ["HERMES_HOME"] = home
    return Path(home)


def load(relpath, name):
    key = "_rich_ui_test_%s_%s" % (name, hashlib.sha256(str(ROOT / relpath).encode()).hexdigest()[:8])
    if key in sys.modules:
        return sys.modules[key]
    spec = importlib.util.spec_from_file_location(key, ROOT / relpath)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[key] = mod
    spec.loader.exec_module(mod)
    return mod


class Runner:
    def __init__(self):
        self.failed = 0
        self.passed = 0

    def run(self, fn):
        fresh_home()
        try:
            fn()
            self.passed += 1
            print("PASS %s" % fn.__name__)
        except Exception:
            self.failed += 1
            print("FAIL %s\n%s" % (fn.__name__, traceback.format_exc()))

    def finish(self):
        print("%d passed, %d failed" % (self.passed, self.failed))
        sys.exit(1 if self.failed else 0)


COMPONENTS_OK = [
    {"id": "root", "component": "Card", "title": "T", "children": ["m"]},
    {"id": "m", "component": "Metric", "label": "n", "value": {"path": "/data/n"}},
]


def fake_admit_ok(components, data_model):
    return ([], list(components))
