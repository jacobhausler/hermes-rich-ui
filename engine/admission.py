"""Admission for hermes-rich-ui records — OWNED BY THE catalog LANE.

Public API (frozen; other modules import exactly this):

    admit(components: list, data_model: dict) -> tuple[list[str], dict]
        Validates an A2UI component list + dataModel against
        catalog/hermes-rich-ui.catalog.json and docs/CONTRACTS.md §2/§3.
        Returns (errors, normalized). errors == [] means admitted. Each error is
        "<component id or /json/pointer>: <reason>". normalized is the component
        list with catalog defaults applied (never mutates the input). When errors
        are present `normalized` is still returned but must not be persisted.

    CATALOG_ID = "hermes-rich-ui/1"

Design (D11): a stdlib mini-JSON-Schema interpreter runs over the catalog file
(the single source of truth), then structural rules from CONTRACTS §3 run over
the graph and the data model. Supported schema keywords: type, const, enum,
properties, required, additionalProperties:false, items, minItems, maxItems,
minimum, maximum, minLength, maxLength, pattern, oneOf, $ref (in-file), default.

Binding resolution happens inside the interpreter: when a value is an A2UI
DataBinding ({"path": "/data/..."}) at a position whose schema admits one, the
path is checked (prefix, RFC 6901 resolution) and the RESOLVED value is
validated against the same schema with the binding alternative removed. That
one rule yields every per-type resolved-value check (Metric number|null,
KeyValueList/Timeline item shapes and caps, DataTable row objects <=100, Chart
series <=512). Chart point shapes (per `kind`) and table column-key discipline
are checked structurally because plain JSON Schema cannot express them.

Note: SourceList without `sourceIds` means "all of /meta/sources" at render
time; normalization does NOT bake the list in (components never change after
publish, meta may be refreshed).
"""
from __future__ import annotations

import copy
import json
import math
import os
import re
import unicodedata
from datetime import datetime
from urllib.parse import urlsplit

CATALOG_ID = "hermes-rich-ui/1"

CATALOG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "catalog",
    "hermes-rich-ui.catalog.json",
)

# CONTRACTS §3 budgets
MAX_COMPONENTS = 64
MAX_DEPTH = 8
MAX_COMPONENTS_BYTES = 64 * 1024
MAX_DATA_MODEL_BYTES = 128 * 1024
MAX_STRING = 4096
MAX_DATA_DEPTH = 12
MAX_SERIES = 4
MAX_POINTS = 512
MAX_ROWS = 100
MAX_COLUMNS = 12
MAX_TIMELINE = 30
MAX_SOURCES = 32
MAX_KV = 32

FORBIDDEN_KEYS = ("__proto__", "constructor", "prototype")
# REVIEW-C0 E3: component ids, DataTable column keys, source ids, derivation ids.
ID_RE = re.compile(r"[A-Za-z0-9_.:-]{1,128}")
# REVIEW-C0 E1: components nesting cap (props nest at most a few levels; 3000-deep
# hostile input must be refused, never recursed into).
MAX_COMPONENTS_DEPTH = 16
# REVIEW-C0 E1: "finite JSON values" = representable as a JS double.
MAX_SAFE_INT = 2 ** 53
# REVIEW-C0 E4: Unicode categories never admitted anywhere inside a URL string.
URL_BAD_CATEGORIES = ("Cc", "Cf", "Zs", "Zl", "Zp")
# REVIEW-C0 E5/E6: closed shapes for /meta/sources and /meta/derivations.
SOURCE_KINDS = ("web", "file", "tool", "derived")
SOURCE_KEYS = ("id", "kind", "label", "url", "accessed_at", "note")
DERIVATION_KEYS = ("id", "method", "input_paths", "output_path", "note", "caveat")
MAX_LABEL = 256
MAX_NOTE = 1024
CONTAINER_CHILDREN = ("Card", "Stack", "Grid")  # `children: [...]`
CONTAINER_TABS = "Tabs"                          # `tabs[].child`
CONTAINER_ACCORDION = "Accordion"                # `items[].child`
URL_KEYS = ("url", "src", "href")

_CATALOG = None


def load_catalog():
    """Load (and cache) the catalog JSON. Raises if the file is missing/invalid."""
    global _CATALOG
    if _CATALOG is None:
        with open(CATALOG_PATH, "r", encoding="utf-8") as fh:
            _CATALOG = json.load(fh)
    return _CATALOG


def _compact(obj):
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False, allow_nan=True)


# ---------------------------------------------------------------- JSON pointer

_BAD_ESCAPE_RE = re.compile(r"~(?![01])")
_INDEX_RE = re.compile(r"(0|[1-9][0-9]*)\Z")


def unescape_token(tok):
    """RFC 6901 §3 strict decoding; returns None when `~` is not followed by 0/1."""
    if _BAD_ESCAPE_RE.search(tok):
        return None
    return tok.replace("~1", "/").replace("~0", "~")


def resolve_pointer(doc, pointer):
    """RFC 6901 resolution. Returns (found: bool, value)."""
    if not isinstance(pointer, str):
        return (False, None)
    if pointer == "":
        return (True, doc)
    if not pointer.startswith("/"):
        return (False, None)
    cur = doc
    for raw in pointer.split("/")[1:]:
        tok = unescape_token(raw)
        if tok is None:
            return (False, None)
        if isinstance(cur, dict):
            if tok not in cur:
                return (False, None)
            cur = cur[tok]
        elif isinstance(cur, list):
            if not _INDEX_RE.match(tok):
                return (False, None)
            idx = int(tok)
            if idx >= len(cur):
                return (False, None)
            cur = cur[idx]
        else:
            return (False, None)
    return (True, cur)


def _escape_token(tok):
    return str(tok).replace("~", "~0").replace("/", "~1")


# ------------------------------------------------------------- schema engine

def _is_number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _type_of(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "boolean"
    if isinstance(v, int):
        return "integer"
    if isinstance(v, float):
        return "number"
    if isinstance(v, str):
        return "string"
    if isinstance(v, list):
        return "array"
    if isinstance(v, dict):
        return "object"
    return type(v).__name__


def _finite(v):
    """True for ints/floats that are finite AND representable as a JS double."""
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return False
    if isinstance(v, float):
        return not (math.isnan(v) or math.isinf(v))
    return -MAX_SAFE_INT <= v <= MAX_SAFE_INT


def _type_matches(v, t):
    if t == "number":
        return _is_number(v)
    if t == "integer":
        return _is_number(v) and (isinstance(v, int) or float(v).is_integer())
    if t == "string":
        return isinstance(v, str)
    if t == "boolean":
        return isinstance(v, bool)
    if t == "null":
        return v is None
    if t == "array":
        return isinstance(v, list)
    if t == "object":
        return isinstance(v, dict)
    return False


def _is_binding(v):
    return isinstance(v, dict) and list(v.keys()) == ["path"]


class _Ctx(object):
    def __init__(self, catalog, data_model):
        self.catalog = catalog
        self.data_model = data_model
        self.bindings = []  # (pointer, path) pairs seen

    def deref(self, ref):
        if not ref.startswith("#/"):
            raise ValueError("unsupported $ref %r" % ref)
        found, val = resolve_pointer(self.catalog, ref[1:])
        if not found:
            raise ValueError("unresolvable $ref %r" % ref)
        return val

    def is_binding_schema(self, schema):
        return isinstance(schema, dict) and schema.get("$ref") == "#/$defs/DataBinding"

    def describe(self, schema):
        if isinstance(schema, dict):
            if "$ref" in schema:
                return schema["$ref"].rsplit("/", 1)[-1]
            if "const" in schema:
                return repr(schema["const"])
            if "enum" in schema:
                return "one of %s" % (schema["enum"],)
            if "type" in schema:
                return schema["type"] if isinstance(schema["type"], str) else "|".join(schema["type"])
            if "oneOf" in schema:
                return " | ".join(self.describe(s) for s in schema["oneOf"])
        return "value"

    def validate(self, inst, schema, ptr, errors):
        """Validate `inst` against `schema`; append errors (prefixed by ptr).
        Returns the instance with defaults applied (a new object where changed)."""
        if schema is True:
            return inst
        if schema is False:
            errors.append("%s: not allowed" % ptr)
            return inst
        if "$ref" in schema:
            target = self.deref(schema["$ref"])
            merged = dict(target)
            for k, v in schema.items():
                if k != "$ref":
                    merged.setdefault(k, v)
            return self.validate(inst, merged, ptr, errors)
        if "oneOf" in schema:
            return self._validate_one_of(inst, schema, ptr, errors)
        if "type" in schema:
            types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
            if not any(_type_matches(inst, t) for t in types):
                errors.append("%s: expected %s, got %s" % (ptr, "|".join(types), _type_of(inst)))
                return inst
        if "const" in schema and inst != schema["const"]:
            errors.append("%s: expected %r" % (ptr, schema["const"]))
            return inst
        if "enum" in schema and not any(inst == e and isinstance(inst, bool) == isinstance(e, bool) for e in schema["enum"]):
            errors.append("%s: expected one of %s, got %r" % (ptr, schema["enum"], inst))
            return inst
        if _is_number(inst):
            if not _finite(inst):
                errors.append("%s: number must be finite" % ptr)
                return inst
            if "minimum" in schema and inst < schema["minimum"]:
                errors.append("%s: %r is below minimum %r" % (ptr, inst, schema["minimum"]))
            if "maximum" in schema and inst > schema["maximum"]:
                errors.append("%s: %r is above maximum %r" % (ptr, inst, schema["maximum"]))
        if isinstance(inst, str):
            if "minLength" in schema and len(inst) < schema["minLength"]:
                errors.append("%s: string shorter than %d" % (ptr, schema["minLength"]))
            if "maxLength" in schema and len(inst) > schema["maxLength"]:
                errors.append("%s: string longer than %d chars" % (ptr, schema["maxLength"]))
            if "pattern" in schema and not re.search(schema["pattern"], inst):
                errors.append("%s: does not match pattern %s" % (ptr, schema["pattern"]))
        if isinstance(inst, list):
            if "minItems" in schema and len(inst) < schema["minItems"]:
                errors.append("%s: fewer than %d items" % (ptr, schema["minItems"]))
            if "maxItems" in schema and len(inst) > schema["maxItems"]:
                errors.append("%s: %d items exceeds maximum %d" % (ptr, len(inst), schema["maxItems"]))
            if "items" in schema:
                out = []
                changed = False
                for i, item in enumerate(inst):
                    new = self.validate(item, schema["items"], "%s/%d" % (ptr, i), errors)
                    changed = changed or new is not item
                    out.append(new)
                if changed:
                    return out
        if isinstance(inst, dict):
            props = schema.get("properties", {})
            for req in schema.get("required", []):
                if req not in inst:
                    errors.append("%s: missing required property '%s'" % (ptr, req))
            if schema.get("additionalProperties") is False:
                for k in inst:
                    if k not in props:
                        errors.append("%s: unknown property '%s'" % (ptr, k))
            out = None
            for k, sub in props.items():
                if k in inst:
                    new = self.validate(inst[k], sub, "%s/%s" % (ptr, _escape_token(k)), errors)
                    if new is not inst[k]:
                        out = out if out is not None else dict(inst)
                        out[k] = new
                else:
                    dflt = self._default_of(sub)
                    if dflt is not None:
                        out = out if out is not None else dict(inst)
                        out[k] = copy.deepcopy(dflt)
            if out is not None:
                return out
        return inst

    def _default_of(self, schema):
        if isinstance(schema, dict):
            if "default" in schema:
                return schema["default"]
            if "$ref" in schema:
                return self._default_of(self.deref(schema["$ref"]))
        return None

    def _validate_one_of(self, inst, schema, ptr, errors):
        branches = schema["oneOf"]
        binding_branches = [b for b in branches if self.is_binding_schema(b)]
        other = [b for b in branches if not self.is_binding_schema(b)]
        if binding_branches and _is_binding(inst):
            # Validate the binding object itself (path prefix/pattern), then the resolved value.
            berr = []
            self.validate(inst, binding_branches[0], ptr, berr)
            if berr:
                errors.extend(berr)
                return inst
            path = inst["path"]
            self.bindings.append((ptr, path))
            found, value = resolve_pointer(self.data_model, path)
            if not found:
                errors.append("%s: binding path '%s' does not resolve in dataModel" % (ptr, path))
                return inst
            if other:
                rerr = []
                self._one_of(value, other, "%s(resolved %s)" % (ptr, path), rerr)
                errors.extend(rerr)
            return inst
        return self._one_of(inst, branches, ptr, errors)

    def _type_ok(self, inst, schema):
        """True when `schema` declares a type and `inst` is of that type."""
        if isinstance(schema, dict) and "$ref" in schema:
            schema = self.deref(schema["$ref"])
        if not isinstance(schema, dict) or "type" not in schema:
            return False
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        return any(_type_matches(inst, t) for t in types)

    def _one_of(self, inst, branches, ptr, errors):
        matches = []
        near = []  # errors from branches whose top-level type matched (specific reasons)
        for b in branches:
            e = []
            new = self.validate(inst, b, ptr, e)
            if not e:
                matches.append(new)
            elif self._type_ok(inst, b):
                near.append(e)
        if len(matches) == 1:
            return matches[0]
        if not matches:
            if len(near) == 1:
                errors.extend(near[0])
            else:
                errors.append("%s: expected %s, got %s" % (ptr, " | ".join(self.describe(b) for b in branches), _type_of(inst)))
        else:
            errors.append("%s: matches more than one alternative" % ptr)
        return inst


# ---------------------------------------------------------- structural rules

def _walk(obj, ptr, on_key, on_str, on_num, depth=0, max_depth=None, depth_err=None):
    """Generic walk over JSON; callbacks receive (ptr, value).

    `max_depth` is a hard cap: the walk never recurses past it, so hostile
    3000-deep input costs one error, never a RecursionError (REVIEW-C0 E1)."""
    if isinstance(obj, dict):
        if max_depth is not None and depth > max_depth:
            depth_err(ptr)
            return
        for k, v in obj.items():
            on_key(ptr, k)
            _walk(v, "%s/%s" % (ptr, _escape_token(k)), on_key, on_str, on_num, depth + 1, max_depth, depth_err)
    elif isinstance(obj, list):
        if max_depth is not None and depth > max_depth:
            depth_err(ptr)
            return
        for i, v in enumerate(obj):
            _walk(v, "%s/%d" % (ptr, i), on_key, on_str, on_num, depth + 1, max_depth, depth_err)
    elif isinstance(obj, str):
        on_str(ptr, obj)
    elif _is_number(obj):
        on_num(ptr, obj)


def _scan_values(obj, root_ptr, errors, max_depth=None):
    """Forbidden keys, string length, finite numbers, URL keys, nesting depth."""
    seen_depth = set()

    def on_key(ptr, k):
        if k in FORBIDDEN_KEYS:
            errors.append("%s: forbidden key '%s'" % (ptr, k))

    def on_str(ptr, s):
        if len(s) > MAX_STRING:
            errors.append("%s: string longer than %d chars" % (ptr, MAX_STRING))
        last = ptr.rsplit("/", 1)[-1]
        if last in URL_KEYS:
            reason = check_url(s)
            if reason:
                errors.append("%s: %s" % (ptr, reason))

    def on_num(ptr, n):
        if not _finite(n):
            errors.append("%s: number must be finite (representable as a JS double)" % ptr)

    def depth_err(ptr):
        if root_ptr not in seen_depth:
            seen_depth.add(root_ptr)
            errors.append("%s: nesting deeper than %d" % (ptr, max_depth))

    _walk(obj, root_ptr, on_key, on_str, on_num, 0, max_depth, depth_err)


def check_url(s):
    """Return a reason string if the URL is not admissible, else None."""
    if not isinstance(s, str):
        return "url must be a string"
    if any(ord(c) < 0x20 or ord(c) == 0x7F or c.isspace() for c in s):
        return "url contains control characters or whitespace"
    for c in s:
        cat = unicodedata.category(c)
        if cat in URL_BAD_CATEGORIES:
            return "url contains a U+%04X character (Unicode category %s)" % (ord(c), cat)
    if not s.startswith("https://"):
        return "url must use https://"
    try:
        parts = urlsplit(s)
    except ValueError:
        return "url is malformed"
    if not parts.netloc or parts.scheme != "https":
        return "url must use https:// with a host"
    if "@" in parts.netloc or parts.username or parts.password:
        return "url must not contain credentials"
    return None


def check_id(value):
    """Return a reason string when `value` is not an admissible id (REVIEW-C0 E3), else None."""
    if not isinstance(value, str):
        return "id must be a string, got %s" % _type_of(value)
    if value in FORBIDDEN_KEYS:
        return "id %r is a forbidden name" % value
    if not ID_RE.fullmatch(value):
        return "id %r does not match ^[A-Za-z0-9_.:-]{1,128}$" % (value[:64],)
    return None


def _child_refs(comp):
    """Yield (pointer-suffix, child id) for a component's outgoing edges."""
    t = comp.get("component")
    if t in CONTAINER_CHILDREN:
        for i, c in enumerate(comp.get("children") or []):
            yield ("/children/%d" % i, c)
    elif t == CONTAINER_TABS:
        for i, tab in enumerate(comp.get("tabs") or []):
            if isinstance(tab, dict):
                yield ("/tabs/%d/child" % i, tab.get("child"))
    elif t == CONTAINER_ACCORDION:
        for i, it in enumerate(comp.get("items") or []):
            if isinstance(it, dict):
                yield ("/items/%d/child" % i, it.get("child"))


def _label(comp, index):
    cid = comp.get("id") if isinstance(comp, dict) else None
    if isinstance(cid, str) and cid:
        return cid
    return "/components/%d" % index


def _check_graph(comps, errors):
    by_id = {}
    for i, c in enumerate(comps):
        cid = c.get("id")
        if isinstance(cid, str) and cid:
            if cid in by_id:
                errors.append("%s: duplicate component id" % cid)
            else:
                by_id[cid] = c
    if "root" not in by_id:
        errors.append("/components: no component with id 'root'")
        return
    parent_of = {}
    for c in comps:
        src = c.get("id")
        for suffix, child in _child_refs(c):
            if not isinstance(child, str):
                errors.append("%s: child ref at %s must be a component id string, got %s"
                              % (_label(c, 0), suffix, _type_of(child)))
                continue
            if child not in by_id:
                errors.append("%s: child '%s' (at %s) does not resolve" % (_label(c, 0), child, suffix))
                continue
            if child == "root":
                errors.append("%s: 'root' cannot be a child" % src)
                continue
            if child in parent_of:
                errors.append("%s: child '%s' is already used by '%s' (shared child)" % (src, child, parent_of[child]))
                continue
            parent_of[child] = src
    # depth + cycles via DFS from root
    reached = set()
    stack = [("root", 1, ("root",))]
    max_depth_seen = 0
    while stack:
        cid, depth, path = stack.pop()
        if cid in reached:
            continue
        reached.add(cid)
        max_depth_seen = max(max_depth_seen, depth)
        for _suffix, child in _child_refs(by_id[cid]):
            if not isinstance(child, str) or child not in by_id:
                continue
            if child in path:
                errors.append("%s: cycle through '%s'" % (cid, child))
                continue
            stack.append((child, depth + 1, path + (child,)))
    if max_depth_seen > MAX_DEPTH:
        errors.append("root: tree depth %d exceeds %d" % (max_depth_seen, MAX_DEPTH))
    for cid in by_id:
        if cid not in reached:
            errors.append("%s: unreachable from root" % cid)


def _resolve_prop(comp, key, data_model):
    """Return (ok, value) for a literal-or-bound prop."""
    v = comp.get(key)
    if _is_binding(v):
        return resolve_pointer(data_model, v["path"])
    return (True, v)


def parse_iso8601(s):
    """ISO-8601 check for Chart line `x` (REVIEW-C0 E12): a string
    `datetime.fromisoformat` accepts on Python 3.9, with a trailing `Z`
    normalized to `+00:00` first. Returns the datetime or None."""
    if not isinstance(s, str) or not s or not s[0].isdigit():
        return None
    txt = s[:-1] + "+00:00" if s.endswith("Z") else s
    try:
        return datetime.fromisoformat(txt)
    except ValueError:
        return None


def _check_line_series(label, i, data, errors):
    """Every x a finite number OR an ISO-8601 string; never mixed within one series."""
    kinds = set()
    for j, pt in enumerate(data):
        if not isinstance(pt, dict):
            continue
        x = pt.get("x")
        where = "%s: /series/%d/data/%d/x" % (label, i, j)
        if _is_number(x):
            kinds.add("number")
        elif isinstance(x, str):
            if parse_iso8601(x) is None:
                errors.append("%s: %r is not an ISO-8601 timestamp (line x must be ISO-8601 or a number)" % (where, x[:64]))
                continue
            kinds.add("iso8601")
    if len(kinds) > 1:
        errors.append("%s: /series/%d/data: x values mix numbers and ISO-8601 strings within one series" % (label, i))


def _check_histogram_series(label, i, data, errors):
    """Bins: low < high, sorted ascending, non-overlapping."""
    prev_high = None
    for j, pt in enumerate(data):
        if not isinstance(pt, dict):
            continue
        low, high = pt.get("low"), pt.get("high")
        if not (_is_number(low) and _is_number(high)):
            continue
        where = "%s: /series/%d/data/%d" % (label, i, j)
        if not low < high:
            errors.append("%s: bin low %r must be < high %r" % (where, low, high))
            continue
        if prev_high is not None and low < prev_high:
            errors.append("%s: bin [%r, %r) overlaps or precedes the previous bin (bins must be sorted, non-overlapping)"
                          % (where, low, high))
        prev_high = high if prev_high is None else max(prev_high, high)


def _check_leaf_specifics(comp, catalog, data_model, errors):
    """Rules JSON Schema cannot express: chart point shapes per kind, table column keys."""
    t = comp.get("component")
    label = comp.get("id")
    if t == "Chart":
        kind = comp.get("kind")
        shape = catalog["$defs"].get("ChartPoint_%s" % kind)
        series = comp.get("series")
        if not shape or not isinstance(series, list):
            return
        ctx = _Ctx(catalog, data_model)
        for i, s in enumerate(series):
            if not isinstance(s, dict):
                continue
            found, data = _resolve_prop(s, "data", data_model)
            if not found or not isinstance(data, list):
                continue
            before = len(errors)
            for j, pt in enumerate(data):
                ctx.validate(pt, shape, "%s: /series/%d/data/%d" % (label, i, j), errors)
            if len(errors) != before:
                continue
            if kind == "line":
                _check_line_series(label, i, data, errors)
            elif kind == "histogram":
                _check_histogram_series(label, i, data, errors)
    elif t == "DataTable":
        cols = comp.get("columns")
        if not isinstance(cols, list):
            return
        keys = []
        kinds = {}
        for ci, c in enumerate(cols):
            if not isinstance(c, dict):
                continue
            k = c.get("key")
            reason = check_id(k)
            if reason:
                errors.append("%s: /columns/%d/key: %s" % (label, ci, reason))
                continue
            keys.append(k)
            kinds[k] = c.get("type")
        if len(set(keys)) != len(keys):
            errors.append("%s: duplicate column keys" % label)
        found, rows = _resolve_prop(comp, "rows", data_model)
        if not found or not isinstance(rows, list):
            return
        for i, row in enumerate(rows):
            if not isinstance(row, dict):
                continue
            for k, v in row.items():
                if k not in kinds:
                    errors.append("%s: row %d has undeclared column key '%s'" % (label, i, k))
                    continue
                if kinds[k] == "sources":
                    # REVIEW-C0 E11: the cell under the declared key is a list of source ids.
                    if not (isinstance(v, list) and all(isinstance(x, str) for x in v)) and v is not None:
                        errors.append("%s: row %d column '%s' (sources) must be a string[]" % (label, i, k))
                elif isinstance(v, (dict, list)):
                    errors.append("%s: row %d column '%s' must be a scalar" % (label, i, k))


def _collect_source_ids(comp, data_model, out):
    """(pointer-ish label, id) for every sourceIds entry on a component, incl. bound rows/items."""
    label = comp.get("id")
    if isinstance(comp.get("sourceIds"), list):
        for i, sid in enumerate(comp["sourceIds"]):
            out.append(("%s: /sourceIds/%d" % (label, i), sid))
    t = comp.get("component")
    if t in ("KeyValueList", "Timeline"):
        found, items = _resolve_prop(comp, "items", data_model)
        if found and isinstance(items, list):
            for i, it in enumerate(items):
                if isinstance(it, dict) and isinstance(it.get("sourceIds"), list):
                    for j, sid in enumerate(it["sourceIds"]):
                        out.append(("%s: /items/%d/sourceIds/%d" % (label, i, j), sid))
    elif t == "DataTable":
        # REVIEW-C0 E11: resolve every `sources`-typed column under ITS declared key.
        cols = comp.get("columns") if isinstance(comp.get("columns"), list) else []
        src_keys = [c.get("key") for c in cols
                    if isinstance(c, dict) and c.get("type") == "sources" and isinstance(c.get("key"), str)]
        if not src_keys:
            return
        found, rows = _resolve_prop(comp, "rows", data_model)
        if found and isinstance(rows, list):
            for i, row in enumerate(rows):
                if not isinstance(row, dict):
                    continue
                for k in src_keys:
                    if isinstance(row.get(k), list):
                        for j, sid in enumerate(row[k]):
                            out.append(("%s: /rows/%d/%s/%d" % (label, i, _escape_token(k), j), sid))


def _check_str(v, ptr, lo, hi, errors, required=False):
    if v is None:
        if required:
            errors.append("%s: missing required string" % ptr)
        return
    if not isinstance(v, str):
        errors.append("%s: expected string, got %s" % (ptr, _type_of(v)))
        return
    if len(v) < lo:
        errors.append("%s: string shorter than %d" % (ptr, lo))
    if len(v) > hi:
        errors.append("%s: string longer than %d chars" % (ptr, hi))


def _check_source_shape(s, ptr, errors):
    """REVIEW-C0 E5: closed object {id, kind, label, url?, accessed_at?, note?}.
    Optional keys may be null (= absent)."""
    for k in s:
        if k not in SOURCE_KEYS:
            errors.append("%s: unknown property '%s'" % (ptr, k))
    kind = s.get("kind")
    if kind not in SOURCE_KINDS:
        errors.append("%s/kind: expected one of %s, got %r" % (ptr, list(SOURCE_KINDS), kind))
    _check_str(s.get("label"), ptr + "/label", 1, MAX_LABEL, errors, required=True)
    url = s.get("url")
    if url is not None:
        if not isinstance(url, str):
            errors.append("%s/url: expected string, got %s" % (ptr, _type_of(url)))
        else:
            reason = check_url(url)
            if reason:
                errors.append("%s/url: %s" % (ptr, reason))
    if s.get("accessed_at") is not None:
        _check_str(s.get("accessed_at"), ptr + "/accessed_at", 0, MAX_LABEL, errors)
    if s.get("note") is not None:
        _check_str(s.get("note"), ptr + "/note", 0, MAX_NOTE, errors)


def _check_data_model(data_model, errors):
    """Shape + budgets of the dataModel; returns the set of known source ids."""
    known = set()
    if not isinstance(data_model, dict):
        errors.append("/dataModel: must be an object")
        return known
    keys = set(data_model.keys())
    if keys != set(["data", "meta"]):
        errors.append("/dataModel: must have exactly the keys 'data' and 'meta' (got %s)" % sorted(keys))
    if not isinstance(data_model.get("data"), dict):
        errors.append("/data: must be an object")
    meta = data_model.get("meta")
    if not isinstance(meta, dict):
        errors.append("/meta: must be an object")
        return known
    sources = meta.get("sources", [])
    if not isinstance(sources, list):
        errors.append("/meta/sources: must be an array")
        sources = []
    if len(sources) > MAX_SOURCES:
        errors.append("/meta/sources: %d sources exceeds %d" % (len(sources), MAX_SOURCES))
    for i, s in enumerate(sources):
        ptr = "/meta/sources/%d" % i
        if not isinstance(s, dict):
            errors.append("%s: must be an object" % ptr)
            continue
        reason = check_id(s.get("id"))
        if reason:
            errors.append("%s/id: %s" % (ptr, reason))
        else:
            if s["id"] in known:
                errors.append("%s: duplicate source id '%s'" % (ptr, s["id"]))
            known.add(s["id"])
        _check_source_shape(s, ptr, errors)
    derivs = meta.get("derivations", [])
    if not isinstance(derivs, list):
        errors.append("/meta/derivations: must be an array")
        derivs = []
    seen_d = set()
    for i, d in enumerate(derivs):
        if not isinstance(d, dict):
            errors.append("/meta/derivations/%d: must be an object" % i)
            continue
        dptr = "/meta/derivations/%d" % i
        reason = check_id(d.get("id"))
        if reason:
            errors.append("%s/id: %s" % (dptr, reason))
        else:
            if d["id"] in seen_d:
                errors.append("%s: duplicate derivation id '%s'" % (dptr, d["id"]))
            seen_d.add(d["id"])
        for k in d:
            if k not in DERIVATION_KEYS:
                errors.append("%s: unknown property '%s'" % (dptr, k))
        _check_str(d.get("method"), dptr + "/method", 1, MAX_LABEL, errors, required=True)
        for k in ("note", "caveat"):
            if d.get(k) is not None:
                _check_str(d.get(k), "%s/%s" % (dptr, k), 0, MAX_NOTE, errors)
        if "input_paths" not in d:
            errors.append("%s: missing required property 'input_paths'" % dptr)
        paths = [("/meta/derivations/%d/output_path" % i, d.get("output_path"))]
        ins = d.get("input_paths", [])
        if not isinstance(ins, list):
            errors.append("/meta/derivations/%d/input_paths: must be an array" % i)
            ins = []
        for j, p in enumerate(ins):
            paths.append(("/meta/derivations/%d/input_paths/%d" % (i, j), p))
        for ptr, p in paths:
            if not isinstance(p, str) or not p.startswith("/"):
                errors.append("%s: derivation path must be a JSON pointer string" % ptr)
                continue
            found, _v = resolve_pointer(data_model, p)
            if not found:
                errors.append("%s: derivation path '%s' does not resolve in dataModel" % (ptr, p))
    return known


# ------------------------------------------------------------------- admit

def admit(components, data_model):
    """See module docstring. Never mutates `components` or `data_model`."""
    errors = []
    catalog = load_catalog()

    if not isinstance(components, list):
        return (["/components: must be an array"], [])

    # 1. budgets on counts / nesting / raw bytes. The depth-capped scan runs
    # FIRST so hostile deep nesting never reaches deepcopy/json.dumps (E1).
    if len(components) > MAX_COMPONENTS:
        errors.append("/components: %d components exceeds %d" % (len(components), MAX_COMPONENTS))
    _scan_values(components, "/components", errors, max_depth=MAX_COMPONENTS_DEPTH)
    _scan_values(data_model, "/dataModel", errors, max_depth=MAX_DATA_DEPTH)
    if errors:
        # forbidden keys / non-finite numbers / too deep: stop before touching the values
        return (errors, [])
    normalized = copy.deepcopy(components)
    try:
        cbytes = len(_compact(components).encode("utf-8"))
        dbytes = len(_compact(data_model).encode("utf-8"))
    except (TypeError, ValueError, RecursionError) as exc:
        return (["/: not JSON-serializable (%s)" % exc], normalized)
    if cbytes > MAX_COMPONENTS_BYTES:
        errors.append("/components: %d bytes exceeds %d" % (cbytes, MAX_COMPONENTS_BYTES))
    if dbytes > MAX_DATA_MODEL_BYTES:
        errors.append("/dataModel: %d bytes exceeds %d" % (dbytes, MAX_DATA_MODEL_BYTES))
    if errors:
        return (errors, normalized)

    # 2. data model shape (sources, derivations)
    known_sources = _check_data_model(data_model, errors)
    if not isinstance(data_model, dict):
        return (errors, normalized)

    # 3. per-component schema validation over the catalog
    ctx = _Ctx(catalog, data_model)
    comp_schemas = catalog["components"]
    comps = []
    for i, comp in enumerate(components):
        if not isinstance(comp, dict):
            errors.append("/components/%d: must be an object" % i)
            continue
        label = _label(comp, i)
        t = comp.get("component")
        if t not in comp_schemas:
            errors.append("%s: unknown component type %r" % (label, t))
            continue
        reason = check_id(comp.get("id"))
        if reason:
            errors.append("%s: /id: %s" % (label, reason))
        if t not in CONTAINER_CHILDREN and "children" in comp:
            errors.append("%s: %s is a leaf type and takes no children" % (label, t))
        cerr = []
        new = ctx.validate(comp, comp_schemas[t], "", cerr)
        errors.extend("%s: %s" % (label, e[2:] if e.startswith(": ") else e) for e in cerr)
        normalized[i] = new
        comps.append(comp)

    # 4. graph rules
    _check_graph(comps, errors)

    # 5. rules the schema cannot express + sourceIds resolution
    for comp in comps:
        _check_leaf_specifics(comp, catalog, data_model, errors)
        refs = []
        _collect_source_ids(comp, data_model, refs)
        for where, sid in refs:
            if not isinstance(sid, str) or sid not in known_sources:
                errors.append("%s: sourceId %r does not resolve in /meta/sources" % (where, sid))

    # 6. REVIEW-C0 E9: the 64 KiB budget is measured on the NORMALIZED components
    # (defaults applied) — the artifact that is actually persisted.
    if not errors:
        try:
            nbytes = len(_compact(normalized).encode("utf-8"))
        except (TypeError, ValueError, RecursionError) as exc:
            errors.append("/: normalized components not JSON-serializable (%s)" % exc)
        else:
            if nbytes > MAX_COMPONENTS_BYTES:
                errors.append("/components: %d bytes after normalization exceeds %d" % (nbytes, MAX_COMPONENTS_BYTES))

    return (errors, normalized)


__all__ = ["admit", "CATALOG_ID", "CATALOG_PATH", "load_catalog", "resolve_pointer", "check_url",
           "check_id", "parse_iso8601"]
