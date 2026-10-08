"""dashboard/plugin_api.py + __init__.register — route functions called directly."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import COMPONENTS_OK, Runner, fake_admit_ok, load  # noqa: E402

api = load("dashboard/plugin_api.py", "api")
door = load("__init__.py", "door")
door._tool.admit = fake_admit_ok


def publish():
    out = door.rich_present({"title": "t", "summary": "s", "components": COMPONENTS_OK, "data": {"n": 1}})
    assert out["ok"], out
    return out["card_id"]


def test_health_counts_cards():
    assert api.health_view() == {"ok": True, "cards": 0, "version": "0.1.4"}
    publish(); publish()
    assert api.health_view() == {"ok": True, "cards": 2, "version": "0.1.4"}


def test_get_card_found_and_not_found():
    cid = publish()
    status, body = api.card_view(cid)
    assert status == 200 and body["ok"] is True and body["card"]["envelope"]["card_id"] == cid
    for bad in ("ru-000000000000", "../x", "ru-../x", "", "%2e%2e"):
        status, body = api.card_view(bad)
        assert status == 404 and body == {"ok": False, "error": "not found"}, (bad, status, body)


def test_router_routes_when_fastapi_present():
    if api.router is None:
        print("  (fastapi not importable here — router=None path exercised)")
        return
    paths = sorted(r.path for r in api.router.routes)
    assert paths == ["/cards/{card_id}", "/health", "/views"], paths
    cid = publish()
    resp = asyncio.run(api.get_card(cid))
    assert resp.status_code == 200 and json.loads(resp.body)["card"]["envelope"]["card_id"] == cid
    resp = asyncio.run(api.get_card("../x"))
    assert resp.status_code == 404 and json.loads(resp.body) == {"ok": False, "error": "not found"}
    assert asyncio.run(api.health())["cards"] == 1


def test_register_wires_tool_and_skill():
    calls = {}

    class Ctx:
        def register_tool(self, name, toolset, schema, handler, **kw):
            calls["tool"] = (name, toolset, schema, handler, kw)

        def register_skill(self, name, path, description=""):
            calls["skill"] = (name, path, description)
    door.register(Ctx())
    name, toolset, schema, handler, kw = calls["tool"]
    assert name == "rich_present" and toolset == "rich-ui" and handler is door.handle_present
    assert set(schema) == {"description", "parameters"}
    assert schema["parameters"]["type"] == "object"
    props = schema["parameters"]["properties"]
    assert set(props) == {"title", "summary", "components", "data", "sources", "derivations", "view", "save_view_as"}
    assert all(p.get("description") for p in props.values())
    for c in door.COMPONENTS:
        assert c in schema["description"], c
    assert len(door.COMPONENTS) == 26
    assert '"path": "/data/' in props["components"]["description"]
    assert 'id "root"' in props["components"]["description"]
    assert "hermes-rich-ui/1" in props["components"]["description"]
    assert kw["description"]
    sname, spath, sdesc = calls["skill"]
    assert sname == "rich-ui" and Path(spath).is_file() and sdesc == "Publish rich, evidence-backed answer cards"
    out = json.loads(handler({"summary": "s", "title": "t", "components": COMPONENTS_OK, "data": {}}))
    assert out["ok"] is True


if __name__ == "__main__":
    r = Runner()
    for t in (test_health_counts_cards, test_get_card_found_and_not_found,
              test_router_routes_when_fastapi_present, test_register_wires_tool_and_skill):
        r.run(t)
    r.finish()
