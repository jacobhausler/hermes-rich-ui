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
VERSION = "0.1.3"


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

COMPONENTS = ["Card", "Stack", "Grid", "Divider", "Tabs", "Accordion", "Heading", "Text",
              "Callout", "Badge", "Metric", "Progress", "KeyValueList", "Image", "DataTable",
              "Chart", "Timeline", "SourceList", "Checklist", "ChipSet", "CodeBlock",
              "ImageGallery", "AsOf", "Sparkline", "BarList", "HeatMap"]

_COMPONENT_DOC = (
    "A2UI `hermes-rich-ui/1` adjacency list. Every item is FLAT: {\"id\", \"component\", ...props at "
    "the top level} — there is NO `props` wrapper. EXACTLY ONE item has id \"root\" (usually a Card). "
    "Containers reference children by id: Card/Stack/Grid `children: [ids]`, Tabs `tabs:[{title, "
    "child}]`, Accordion `items:[{title, child, open?}]`. The 26 components: " + ", ".join(COMPONENTS) + ". "
    "Any dynamic prop is a literal OR a binding {\"path\": \"/data/...\"} (RFC 6901 pointer into "
    "`data`; `/meta/...` also allowed). Enums (exact strings): Stack.direction vertical|horizontal, "
    "gap none|sm|md|lg; DataTable column.type text|number|currency|percent|date|sources (required "
    "per column); Metric.format number|currency|percent (value MUST be a number or null — never a "
    "string like \"233 KB\"; put units in `unit`); Chart.kind bar|line|scatter|histogram|area|waterfall|range; "
    "Callout.tone info|caution|success|error; Badge.tone neutral|info|success|caution|error|outline; "
    "Timeline item status done|active|pending|failed; Heading.level 1|2|3|4. DENSE by default: put related short blocks side by "
    "side (`Stack horizontal` or `Grid` columns 2..4), never a full-width vertical run of 1-2-line "
    "items; a summary card reads as TWO columns (timeline left, facts+notes right). Only charts and "
    "wide tables earn full width. Read-only: no actions, no functions. Budgets: <=64 "
    "components, depth <=8, table <=100x12, chart series <=4x512 points, timeline <=30, kv <=32, "
    "sources <=32, image src https:// only. Metric value null renders 'unavailable', never 0. "
    "Chart: REQUIRED prop series:[{label, data}] (1..4 series); series is ALWAYS a literal "
    "array (never a binding); to bind, bind each series' data: {label, data:{\"path\": "
    "\"/data/...\"}}; each series.data is "
    "points shaped per kind: bar [{label,value}], line [{x,y}] (x finite number OR "
    "ISO-8601 string, never mixed in one series), scatter [{x,y,label?}], histogram "
    "[{low,high,count}] (bins supplied, never computed), area [{x,y}] (like line), "
    "waterfall [{label,value,total?}], range [{label,low,high}]; there is NO top-level Chart "
    "'data' prop. Timeline items are {label, date?, text?, status?} — the text key is "
    "'label' (not 'title'); Grid columns is 1..4. New types (required props + caps): "
    "Checklist items (<=32) {label, done? true|false|null}, showTally?; ChipSet labels "
    "(<=24 strings), tone? neutral|info|success|caution; CodeBlock code (<=4 KiB literal "
    "text), caption?, language? (label only, never parsed); ImageGallery items (<=8) "
    "{src https:// only, alt required}, columns? 1..4; AsOf observedAt?/publishedAt? "
    "ISO-8601 (only timestamps actually observed, absent if unknown); Sparkline values? "
    "(<=512 number|null, null=gap), direction? line|bar, tone? default|success|danger; "
    "BarList items (<=30) {label, value number|null}, format? number|currency|percent, "
    "sort? desc|asc|none; HeatMap rows (<=12 {label}) x cols (<=12 {label}) x cells "
    "(<=144) {row: <declared row label string>, col: <declared col label string>, value "
    "number|null} — one cell per (row, col) pair; row/col are LABELS not indices. Minimal valid example: "
    "[{\"id\":\"root\",\"component\":\"Card\",\"title\":\"T\",\"children\":[\"m\"]},"
    "{\"id\":\"m\",\"component\":\"Metric\",\"label\":\"Suite\",\"value\":{\"path\":\"/data/n\"}}]"
)

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
TOOL_SCHEMA = {
    "description": (
        "Publish a rich, evidence-backed answer card (tables, charts, metrics, timelines, "
        "sources) that renders inline in the Hermes desktop transcript. Build an A2UI "
        "`hermes-rich-ui/1` component list (one component has id \"root\"), bind values with "
        "{\"path\": \"/data/...\"} into `data`, cite `sources`. Components: " + ", ".join(COMPONENTS) +
        ". Returns {ok, card_id, directive} — paste the `directive` line ALONE on its own line "
        "in your reply; that renders the card. Static data only — the plugin registers exactly "
        "this one tool; there is no source/polling variant."
    ),
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
