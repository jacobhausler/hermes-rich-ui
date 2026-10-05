"""Generated agent-facing tool text — J12/J16 + AD-10 (#27 slice 4, spec §4.3).

Everything the agent reads about components is GENERATED from
catalog/hermes-rich-ui.catalog.json at import time — one signature line per
type (all 26), every enum value on its own type's line, `?` for optional
(closes the #19 description half: every type that takes `title` says
`title?`), plus the one defaults sentence and the literal-only rule (J16).
Admitted-only aliases (Sparkline tone info/error) are catalog-silent and so
never reach a signature (AD-10). tests/test_tool_description.py derives every
expectation from the catalog at assert time — a hard-coded line fails the
per-type property-set check.

The agent-visible union (TOOL_SCHEMA description + the `components` param
description) is capped at 5,000 chars; tests pin the cap.
"""
from __future__ import annotations

import json
import os

CATALOG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "catalog",
    "hermes-rich-ui.catalog.json",
)

DESCRIPTION_CAP = 5000

# Common A2UI plumbing every type carries; never printed on a signature line.
COMMON_PROPS = frozenset({"id", "component", "accessibility", "sourceIds"})

# The ONE defaults sentence (spec §4.3). It appears exactly once in the whole
# agent-visible text (pinned by tests/test_tool_description.py).
DEFAULTS_SENTENCE = (
    "Omit anything cosmetic: numbers are formatted to 3 significant figures with k/M/B/T, "
    "dates, colours, sizes and layout are chosen by the renderer. Set `unit` for what a "
    "number is, `precision` only when exact digits matter, `invertTone` when lower is better."
)

# Call shape + flat rule + binding rule + literal-only (J16) + null semantics +
# one tiny example without a duplicated title (spec §4.3). No line may begin
# with a catalog type name: signature lines are recognized by their head token.
_HEADER = (
    'A2UI `hermes-rich-ui/1` flat adjacency list: every item {"id", "component", ...props at '
    'top level}, one item id "root". Containers reference children by id: Card/Stack/Grid '
    "children [ids], Tabs tabs:[{title, child}], Accordion items:[{title, child, open?}]. "
    'Any dynamic prop is a literal or a binding {"path": "/data/..."} (RFC 6901 into `data`; '
    "/meta also allowed), EXCEPT the literal-only props (never a binding at that level): "
    "Chart.series, DataTable.columns, Tabs.tabs, Accordion.items, KeyValueList.items, "
    "Timeline.items, Checklist.items, ImageGallery.items, HeatMap.rows/cols/cells — bind the "
    "arrays they hold instead (Chart: bind each series' data). null means unknown, never 0. "
    "Numbers are JSON numbers; units go in `unit`; an identifier stays a string. Minimal "
    'example: [{"id":"root","component":"Card","title":"T","children":["m"]},'
    '{"id":"m","component":"Metric","label":"Suite","value":{"path":"/data/n"}}]'
)

_POINTS = (
    "Points per Chart.kind: bar [{label,value}] line [{x,y}] scatter [{x,y,label?}] "
    "histogram [{low,high,count}] (bins supplied, never computed) area [{x,y}] "
    "waterfall [{label,value,total?}] range [{label,low,high}]."
)


def load_catalog(path=None):
    with open(path or CATALOG_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def _enum_values(node, seen):
    """Every enum value reachable under `node`, catalog order, de-duplicated."""
    if isinstance(node, dict):
        for v in node.get("enum", []):
            s = str(v)
            if s not in seen:
                seen.append(s)
        for sub in node.values():
            _enum_values(sub, seen)
    elif isinstance(node, list):
        for sub in node:
            _enum_values(sub, seen)
    return seen


def _array_items(node):
    """The `items` object schema of a prop's literal-array branch, or None."""
    if not isinstance(node, dict):
        return None
    for cand in [node] + list(node.get("oneOf", []) or []):
        if isinstance(cand, dict) and cand.get("type") == "array":
            it = cand.get("items")
            if isinstance(it, dict) and it.get("type") == "object" and it.get("properties"):
                return it
    return None


def _item_shape(items):
    """`[{req1,req2,opt?}]` from an array-items object schema — the item keys an
    agent must write, required first in catalog order, optional keys `?`-marked.
    est-2ek.1.173: series {label,data} / Timeline {label} / etc. were validator
    requirements the signature lines never stated."""
    props = items.get("properties", {})
    required = [r for r in items.get("required", []) if r in props]
    optional = [p for p in props if p not in required]
    keys = list(required) + [p + "?" for p in optional]
    return "[" + "{" + ",".join(keys) + "}]" if keys else None


def _signature_line(name, schema):
    """`Name req1, req2 (enum…), opt1?, opt2? (enum…)` — props in catalog
    order; required props unmarked, optional props carry `?`; enum values ride
    the prop they belong to (nested item enums too); array-of-object props state
    their item shape, bounded integer props state `min..max` (est-2ek.1.173 —
    all generated from the catalog, never hand-written)."""
    props = schema.get("properties", {})
    required = set(schema.get("required", []))
    tokens = []
    for prop, sub in props.items():
        if prop in COMMON_PROPS:
            continue
        token = prop if prop in required else prop + "?"
        shape = _item_shape(_array_items(sub) or {})
        if shape:
            token += " " + shape
        vals = _enum_values(sub, [])
        if len(vals) == 1 and vals[0] == prop:
            vals = []
        if vals:
            token += " " + "|".join(vals)
        elif isinstance(sub, dict) and sub.get("type") == "integer" \
                and "minimum" in sub and "maximum" in sub:
            token += " %s..%s" % (sub["minimum"], sub["maximum"])
        tokens.append(token)
    shown = set()
    for sub in (s for p, s in props.items() if p not in COMMON_PROPS):
        shown.update(_enum_values(sub, []))
    deep = [v for v in _enum_values(schema, []) if v not in shown]
    line = name + " " + ", ".join(tokens) if tokens else name
    if deep:
        # enums that live on shared $defs: on the line, but in a parenthetical
        # segment so no stray token enters the property set.
        line += ", (" + "|".join(deep) + ")"
    return line


def build_components_description(catalog=None):
    catalog = catalog or load_catalog()
    lines = [_HEADER]
    for name, schema in catalog["components"].items():
        lines.append(_signature_line(name, schema))
    lines.append(_POINTS)
    lines.append(DEFAULTS_SENTENCE)
    return "\n".join(lines)


def build_tool_description(catalog=None):
    catalog = catalog or load_catalog()
    names = ", ".join(catalog["components"])
    return (
        "Publish a rich, evidence-backed answer card (tables, charts, metrics, timelines, "
        "sources) that renders inline in the Hermes desktop transcript. Build an A2UI "
        '`hermes-rich-ui/1` component list (one component has id "root"), bind values with '
        '{"path": "/data/..."} into `data`, cite `sources`. Components: ' + names + ". "
        "Returns {ok, card_id, directive} — paste the `directive` line ALONE on its own line "
        "in your reply; that renders the card. Static data only — the plugin registers exactly "
        "this one tool; there is no source/polling variant."
    )


def build_tool_schema(catalog=None, parameters=None):
    """The registered registry shape {description, parameters} (papercut
    2026-09-22: a bare schema object registers but tool_describe reads
    fn["parameters"]). The door passes its own `parameters`; this helper only
    exists so the shape has one provenance."""
    catalog = catalog or load_catalog()
    return {"description": build_tool_description(catalog), "parameters": parameters}
