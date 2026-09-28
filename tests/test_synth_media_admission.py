"""Lane L6 admission-logic pins (expansion v0.1.1, counsel 20260928).

engine/admission.py and the catalog are shared seams (L8 owns the merge): this
file keeps the EXACT code the integrator pastes — the AsOf per-field ISO-8601
branch (S6) and the ImageGallery checks + per-item sourceIds collection (S6,
REQUIRED) — and exercises it end-to-end through the real admit() by injecting
the two catalog entries and monkeypatching the two functions (process-local;
no shared file is edited; byte-stability of inputs is checked by admits()).

Run: python3 tests/test_synth_media_admission.py  (exit 0 = green)
"""
from __future__ import annotations

import copy
import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(_ROOT, "tests"))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import engine.admission as admission  # noqa: E402
from engine.admission import _check_str, parse_iso8601  # noqa: E402
from helpers.admit import check, rejects, admits, finish  # noqa: E402

ASOF_PROPS = ("observedAt", "publishedAt", "note")
TIMESTAMP_PROPS = ("observedAt", "publishedAt")
GALLERY_ITEM_KEYS = ("src", "alt", "caption", "sourceIds")


# ---- EXACT code for the integrator (MANIFEST.md): AsOf branch of _check_leaf_specifics
def _check_asof_fields(comp, data_model, errors):
    """AsOf (S6): nullable ISO-8601 strings via the EXISTING parse_iso8601 — no new
    parser. null/absent is legal and OMITS its segment at render; a non-null value
    (literal or bound) must parse, else the error names the offending property and
    the rule. Unresolvable bindings are already an error from the schema pass."""
    label = comp.get("id")
    for k in TIMESTAMP_PROPS:
        found, v = admission._resolve_prop(comp, k, data_model)
        if not found or v is None:
            continue
        ptr = "%s: /%s" % (label, k)
        if not isinstance(v, str):
            errors.append("%s: must be ISO-8601; leave absent if unknown (expected string, got %s)" % (ptr, type(v).__name__))
        elif parse_iso8601(v) is None:
            errors.append("%s: %r must be ISO-8601; leave absent if unknown" % (ptr, v[:64]))


# ---- EXACT code for the integrator: ImageGallery branch of _check_leaf_specifics
def _check_gallery_items(label, items, errors):
    """ImageGallery (S6): every item is a closed {src(https), alt REQUIRED,
    caption?, sourceIds?} object; src is additionally swept by the URL_KEYS scan."""
    for i, it in enumerate(items):
        ptr = "%s: /items/%d" % (label, i)
        if not isinstance(it, dict):
            errors.append("%s: gallery item must be an object" % ptr)
            continue
        for k in it:
            if k not in GALLERY_ITEM_KEYS:
                errors.append("%s: unknown property '%s'" % (ptr, k))
        _check_str(it.get("src"), ptr + "/src", 1, 4096, errors, required=True)
        _check_str(it.get("alt"), ptr + "/alt", 1, 4096, errors, required=True)
        if it.get("caption") is not None:
            _check_str(it.get("caption"), ptr + "/caption", 0, 4096, errors)


# ---- EXACT replacement for _collect_source_ids: identical to shipped code with
# the REQUIRED ImageGallery per-item branch (same shape as the KeyValueList branch).
_collect_source_ids_orig = admission._collect_source_ids


def _collect_source_ids_patched(comp, data_model, out):
    _collect_source_ids_orig(comp, data_model, out)
    if comp.get("component") == "ImageGallery":
        found, items = admission._resolve_prop(comp, "items", data_model)
        if found and isinstance(items, list):
            for i, it in enumerate(items):
                if isinstance(it, dict) and isinstance(it.get("sourceIds"), list):
                    for j, sid in enumerate(it["sourceIds"]):
                        out.append(("%s: /items/%d/sourceIds/%d" % (comp.get("id"), i, j), sid))


def _check_leaf_specifics_patched(comp, catalog, data_model, errors):
    _check_leaf_specifics_orig(comp, catalog, data_model, errors)
    t = comp.get("component")
    label = comp.get("id")
    if t == "AsOf":
        _check_asof_fields(comp, data_model, errors)
    elif t == "ImageGallery":
        found, items = admission._resolve_prop(comp, "items", data_model)
        if found and isinstance(items, list):
            _check_gallery_items(label, items, errors)


_check_leaf_specifics_orig = admission._check_leaf_specifics

# ---- The two catalog entries (MANIFEST.md carries the same JSON verbatim).
GALLERY_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "src": {"type": "string", "maxLength": 4096, "pattern": "^https://",
                "description": "https:// only; no credentials, no control characters. Admission never fetched or verified this URL."},
        "alt": {"type": "string", "minLength": 1, "maxLength": 4096},
        "caption": {"type": "string", "maxLength": 4096},
        "sourceIds": {"type": "array", "items": {"type": "string", "maxLength": 4096},
                      "maxItems": 32, "description": "Evidence links; every id must resolve in /meta/sources."},
    },
    "required": ["src", "alt"],
    "additionalProperties": False,
}

GALLERY_ENTRY = {
    "type": "object",
    "description": "Evidence strip of up to 8 tiles (one component replaces Image+alt+caption Text x N).",
    "properties": {
        "id": {"$ref": "#/$defs/ComponentId"},
        "component": {"const": "ImageGallery"},
        "accessibility": {"$ref": "#/$defs/Accessibility"},
        "sourceIds": {"type": "array", "items": {"type": "string", "maxLength": 4096},
                      "maxItems": 32, "description": "Evidence links; every id must resolve in /meta/sources."},
        "title": {"type": "string", "maxLength": 4096},
        "columns": {"type": "integer", "minimum": 1, "maximum": 4, "default": 2},
        "items": {
            "description": "Up to 8 tiles; every src is https://-only (URL-key swept); alt is required.",
            "oneOf": [
                {"type": "array", "items": GALLERY_ITEM_SCHEMA, "maxItems": 8},
                {"$ref": "#/$defs/DataBinding"},
            ],
        },
    },
    "required": ["id", "component", "items"],
    "additionalProperties": False,
}

def _ts(prop):
    return {"oneOf": [{"type": "string", "maxLength": 4096},
                      {"type": "null"},
                      {"$ref": "#/$defs/DataBinding"}],
            "description": "ISO-8601 timestamp you ACTUALLY OBSERVED; leave absent if unknown — never publish a timestamp you did not observe."}

ASOF_ENTRY = {
    "type": "object",
    "description": "Evidence-law caption line: Observed/Published (Accessed is source-scoped in SourceList). Only publish timestamps you actually observed.",
    "properties": {
        "id": {"$ref": "#/$defs/ComponentId"},
        "component": {"const": "AsOf"},
        "accessibility": {"$ref": "#/$defs/Accessibility"},
        "sourceIds": {"type": "array", "items": {"type": "string", "maxLength": 4096},
                      "maxItems": 32, "description": "Evidence links; every id must resolve in /meta/sources."},
        "observedAt": _ts("observedAt"),
        "publishedAt": _ts("publishedAt"),
        "note": {"type": "string", "maxLength": 4096},
    },
    "required": ["id", "component"],
    "additionalProperties": False,
}

DM = {"data": {}, "meta": {"sources": [
    {"id": "s1", "kind": "web", "label": "Example site", "url": "https://example.com/", "accessed_at": "2026-09-26", "note": "primary"},
    {"id": "s2", "kind": "tool", "label": "Local computation"},
]}}


def gallery_item(**over):
    it = {"src": "https://example.com/a.png", "alt": "first evidence"}
    it.update(over)
    return it


def main():
    cat = admission.load_catalog()
    cat["components"]["ImageGallery"] = copy.deepcopy(GALLERY_ENTRY)
    cat["components"]["AsOf"] = copy.deepcopy(ASOF_ENTRY)
    # E10 catalog delta (MANIFEST.md): Badge tone enum gains error/outline — same
    # four public tones, additive only (L8). Applied process-local like the entries.
    badge_tone = cat["components"]["Badge"]["properties"]["tone"]
    badge_tone_enum_before = list(badge_tone["enum"])
    badge_tone["enum"] = badge_tone_enum_before + ["error", "outline"]
    admission._check_leaf_specifics = _check_leaf_specifics_patched
    admission._collect_source_ids = _collect_source_ids_patched
    try:
        # ---- positive: the ratified shapes admit
        admits("gallery: two tiles with captions and per-item sourceIds admit",
               [{"id": "root", "component": "ImageGallery", "title": "Evidence", "columns": 2, "items": [
                   gallery_item(caption="panel A", sourceIds=["s1"]),
                   {"src": "https://example.com/b.png", "alt": "second evidence"}]}], DM)
        admits("gallery: bound items admit and per-item sourceIds still resolve",
               [{"id": "root", "component": "ImageGallery",
                 "items": {"path": "/data/g"}}],
               {"data": {"g": [gallery_item(sourceIds=["s1", "s2"])]}, "meta": DM["meta"]})
        admits("gallery: 8 items is at the cap",
               [{"id": "root", "component": "ImageGallery",
                 "items": [gallery_item(src="https://example.com/%d.png" % i, alt="t%d" % i) for i in range(8)]}], DM)
        admits("asof: observed + published + note admit",
               [{"id": "root", "component": "AsOf", "observedAt": "2026-09-26T10:00:00Z",
                 "publishedAt": "2026-09-01", "note": "audited by hand", "sourceIds": ["s2"]}], DM)
        admits("asof: nullable fields (explicit null) admit — absent/null omits its segment",
               [{"id": "root", "component": "AsOf", "observedAt": None,
                 "publishedAt": "2026-09-01T08:00:00Z"}], DM)
        admits("asof: date-only precision admits (publish only what you observed)",
               [{"id": "root", "component": "AsOf", "observedAt": "2026-09-26"}], DM)
        admits("asof: bound observedAt resolves and admits when ISO",
               [{"id": "root", "component": "AsOf", "observedAt": {"path": "/data/obs"}}],
               {"data": {"obs": "2026-09-26T10:00:00Z"}, "meta": DM["meta"]})
        rejects("asof: bound observedAt that is not ISO rejected naming the property",
                [{"id": "root", "component": "AsOf", "observedAt": {"path": "/data/obs"}}],
                {"data": {"obs": "last tuesday"}, "meta": DM["meta"]}, "must be ISO-8601")
        # E10 additive enum: error/outline are catalog-admissible (no per-type code).
        admits("badge: tone error admits (E10 additive enum)",
               [{"id": "root", "component": "Badge", "label": "failed", "tone": "error"}], DM)
        admits("badge: tone outline admits (E10 additive enum)",
               [{"id": "root", "component": "Badge", "label": "plain", "tone": "outline"}], DM)

        # ---- negative: every rejection names the offending property + the rule (L4)
        rejects("gallery: http src rejected (https posture, L3)",
                [{"id": "root", "component": "ImageGallery", "items": [gallery_item(src="http://example.com/x.png")]}],
                DM, "https")
        rejects("gallery: 9 items rejected naming the ≤8 cap",
                [{"id": "root", "component": "ImageGallery",
                  "items": [gallery_item(src="https://example.com/%d.png" % i, alt="t%d" % i) for i in range(9)]}],
                DM, "maximum 8")
        rejects("gallery: missing alt rejected naming the property",
                [{"id": "root", "component": "ImageGallery", "items": [{"src": "https://example.com/a.png"}]}],
                DM, "'alt'")
        rejects("gallery: unknown item key rejected naming the property",
                [{"id": "root", "component": "ImageGallery", "items": [gallery_item(hue="neon")]}],
                DM, "'hue'")
        rejects("gallery: columns above the enum-range maximum rejected",
                [{"id": "root", "component": "ImageGallery", "items": [gallery_item()], "columns": 5}],
                DM, "maximum")
        rejects("gallery: per-item sourceId that does not resolve is rejected (S6 branch)",
                [{"id": "root", "component": "ImageGallery", "items": [gallery_item(sourceIds=["nope"])]}],
                DM, "/items/0/sourceIds/0")
        rejects("gallery: unknown top-level property rejected (closed grammar, L2)",
                [{"id": "root", "component": "ImageGallery", "items": [gallery_item()], "layout": "masonry"}],
                DM, "'layout'")
        rejects("asof: non-ISO observedAt rejected naming the property + rule",
                [{"id": "root", "component": "AsOf", "observedAt": "yesterday"}], DM, "observedAt")
        for name in ("yesterday", "2026-13-45T99:99:99Z", "not-a-date"):
            rejects("asof: observedAt %r rejected (must be ISO-8601; leave absent if unknown)" % name,
                    [{"id": "root", "component": "AsOf", "observedAt": name}], DM, "must be ISO-8601")
        rejects("asof: non-ISO publishedAt rejected naming the property",
                [{"id": "root", "component": "AsOf", "publishedAt": "last week"}], DM, "publishedAt")
        rejects("asof: accessedAt is NOT in the grammar (F8 trim)",
                [{"id": "root", "component": "AsOf", "accessedAt": "2026-09-26"}], DM, "'accessedAt'")
        # truth table: parse_iso8601 accepts what we accept, rejects the rest
        check("parse_iso8601: accepted forms parse", parse_iso8601("2026-09-26") is not None
              and parse_iso8601("2026-09-26T10:00:00Z") is not None
              and parse_iso8601("2026-09-26T10:00:00+00:00") is not None)
        check("parse_iso8601: junk stays unparsed", parse_iso8601("yesterday") is None
              and parse_iso8601("") is None and parse_iso8601(None) is None)
    finally:
        admission._check_leaf_specifics = _check_leaf_specifics_orig
        admission._collect_source_ids = _collect_source_ids_orig
        for t in ("ImageGallery", "AsOf"):
            cat["components"].pop(t, None)
        badge_tone["enum"] = badge_tone_enum_before
    finish()


if __name__ == "__main__":
    main()
