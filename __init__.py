"""hermes-rich-ui — the `rich_present` tool: publish evidence-backed answer cards.

The door is thin: schema + handler registration. The record builder lives in
engine/tool.py, persistence in engine/store.py, admission in engine/admission.py.
Siblings are bound by PATH (hermes-workflows pattern) so no other plugin's
`engine` package can shadow ours.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
_TAG = hashlib.sha256(str(HERE).encode("utf-8")).hexdigest()[:16]
VERSION = "0.1.4"


def _load(relpath, name):
    key = "_hermes_rich_ui_%s_%s" % (name, _TAG)
    mod = sys.modules.get(key)
    if mod is not None:
        return mod
    spec = importlib.util.spec_from_file_location(key, HERE / relpath)
    if spec is None or spec.loader is None:
        raise ImportError("cannot load %s from %s" % (relpath, HERE))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[key] = mod
    try:
        spec.loader.exec_module(mod)
    except Exception:
        sys.modules.pop(key, None)
        raise
    return mod


_tool = _load("engine/tool.py", "tool")
rich_present = _tool.rich_present
handle_present = _tool.handle_present

# J12/J16 (#27): every agent-visible component sentence is GENERATED from the
# catalog at import — one signature line per type (all 26, every enum, `?` for
# optional), the literal-only rule, the one defaults sentence. Aliases that
# admission accepts but the catalog does not announce (Sparkline tone
# info/error) never reach a signature (AD-10). A hand-written line here would
# fail tests/test_tool_description.py's property-set check.
_tool_desc = _load("engine/tool_description.py", "tool_description")

CATALOG = _tool_desc.load_catalog()
COMPONENTS = list(CATALOG["components"])

_COMPONENT_DOC = _tool_desc.build_components_description(CATALOG)

RICH_PRESENT_PARAMS = {
    "type": "object",
    "properties": {
        "title": {"type": "string",
                  "description": "Card title (plain text). REQUIRED (top-level, alongside `summary`) unless "
                                 "`view` supplies one — a missing title is rejected with "
                                 "'title: required non-empty string'."},
        "summary": {"type": "string",
                    "description": "Plain-text summary of what the card shows — the fallback text "
                                   "shown where the card cannot render. Required."},
        "components": {"type": "array", "items": {"type": "object"},
                       "description": _COMPONENT_DOC},
        "data": {"type": "object",
                 "description": "The values components bind to via {\"path\": \"/data/<key>...\"}. "
                                "Finite JSON only (no NaN/Infinity), strings <=4 KiB, depth <=12, "
                                "<=128 KiB total. Tables bind rows: {\"path\": \"/data/rows\"}."},
        "sources": {"type": "array", "items": {"type": "object"},
                    "description": "Evidence: [{id, kind (web|file|tool|manual), label, url? (https:// "
                                   "only), accessed_at?, note?}] <=32. Components cite them via "
                                   "sourceIds:[id]; SourceList renders them."},
        "derivations": {"type": "array", "items": {"type": "object"},
                        "description": "How computed values were derived: [{id, output_path:'/data/...', "
                                       "input_paths:['/data/...'], method, caveat?}]. Paths must "
                                       "resolve in `data`."},
        "view": {"type": "string",
                 "description": "Reuse a saved component list: id ^[a-z][a-z0-9-]{0,63}$. Title and "
                                "components come from the view; pass only data/summary/sources."},
        "save_view_as": {"type": "string",
                         "description": "Persist this call's title+components under this view id "
                                        "(^[a-z][a-z0-9-]{0,63}$) for later `view` reuse."},
    },
    # `title` is required at the door too, but only when `view` is absent — the schema cannot express
    # that, so it stays out of `required` and the description carries the rule (papercut 2026-09-25).
    "required": ["summary"],
}

# Registry shape = {description, parameters}; a bare JSON-schema object registers but
# tool_describe reads fn["parameters"] and hands the model {} (papercut 2026-09-22).
# The description itself is catalog-generated (J12) — see engine/tool_description.py.
TOOL_SCHEMA = {
    "description": _tool_desc.build_tool_description(CATALOG),
    "parameters": RICH_PRESENT_PARAMS,
}


def register(ctx):
    ctx.register_tool(name="rich_present", toolset="rich-ui", schema=TOOL_SCHEMA,
                      handler=handle_present,
                      description=TOOL_SCHEMA["description"])
    try:
        ctx.register_skill("rich-ui", HERE / "skill" / "SKILL.md",
                           description="Publish rich, evidence-backed answer cards")
    except Exception:  # skill registration is optional on older hosts
        pass
