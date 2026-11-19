"""Route-surface drift gate (est-d3wra): every router path registered in
dashboard/plugin_api.py must appear in the docs/CONTRACTS.md §5 route table, and
vice versa — rows annotated (C2...) are pending contract, not live surface.
Source-parsed with ast; no fastapi dependency. README/INSTALL verification curls
for the same surface are substring-pinned.
"""
import ast
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import Runner  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def registered():
    tree = ast.parse((ROOT / "dashboard" / "plugin_api.py").read_text(encoding="utf-8"))
    out = set()
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for d in node.decorator_list:
            if (isinstance(d, ast.Call) and isinstance(d.func, ast.Attribute)
                    and isinstance(d.func.value, ast.Name) and d.func.value.id == "router"
                    and d.func.attr in ("get", "post", "put", "delete", "patch")
                    and d.args and isinstance(d.args[0], ast.Constant)):
                out.add((d.func.attr.upper(), d.args[0].value))
    return out


def documented_live():
    text = (ROOT / "docs" / "CONTRACTS.md").read_text(encoding="utf-8")
    m = re.search(r"(?ms)^## 5\. REST.*?(?=^## |\Z)", text)
    assert m, "CONTRACTS.md lost its §5 route table"
    out = set()
    for line in m.group(0).splitlines():
        row = re.match(r"\|\s*`(GET|POST|PUT|DELETE|PATCH) ([^`]+)`([^|]*)\|", line)
        if row and "C2" not in row.group(3):
            out.add((row.group(1), row.group(2).split("?")[0].strip()))
    return out


def test_surface_equals_docs():
    assert documented_live() == registered()


def test_views_in_verification_blocks():
    for doc in ("README.md", "INSTALL.md"):
        text = (ROOT / doc).read_text(encoding="utf-8")
        assert "/api/plugins/hermes-rich-ui/views" in text, doc


if __name__ == "__main__":
    r = Runner()
    r.run(test_surface_equals_docs)
    r.run(test_views_in_verification_blocks)
    r.finish()
