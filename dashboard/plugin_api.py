"""Dashboard backend for hermes-rich-ui — read-only projection of the card store.

Endpoints land under /api/plugins/hermes-rich-ui (CONTRACTS §5). The route bodies
are plain functions (health_view / card_view) so they are testable without FastAPI;
the router wraps them when FastAPI is importable.
"""
from __future__ import annotations

import hashlib
import importlib.util
import sys
from pathlib import Path

_PLUGIN_ROOT = Path(__file__).resolve().parent.parent
_STORE_MODULE = "_hermes_rich_ui_store_" + hashlib.sha256(
    str(_PLUGIN_ROOT / "engine").encode("utf-8")).hexdigest()[:16]
VERSION = "0.1.0"


def _store():
    """Load this plugin's engine/store.py without binding a global `engine` package."""
    module = sys.modules.get(_STORE_MODULE)
    if module is not None:
        return module
    spec = importlib.util.spec_from_file_location(_STORE_MODULE, _PLUGIN_ROOT / "engine" / "store.py")
    if spec is None or spec.loader is None:
        raise ImportError("cannot load store module from %s" % _PLUGIN_ROOT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[_STORE_MODULE] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(_STORE_MODULE, None)
        raise
    return module


try:
    from fastapi import APIRouter
    from fastapi.responses import JSONResponse
    router = APIRouter()
except ImportError:
    router = None
    JSONResponse = None


def health_view():
    return {"ok": True, "cards": _store().card_count(), "version": VERSION}


def card_view(card_id):
    """(status, body): id validated by the store before any disk access."""
    rec = _store().read_card(card_id)
    if rec is None:
        return 404, {"ok": False, "error": "not found"}
    return 200, {"ok": True, "card": rec}


if router is not None:
    @router.get("/health")
    async def health():
        return health_view()

    @router.get("/cards/{card_id}")
    async def get_card(card_id: str):
        status, body = card_view(card_id)
        return JSONResponse(status_code=status, content=body)
