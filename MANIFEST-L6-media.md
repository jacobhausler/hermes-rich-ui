# MANIFEST — lane L6 (media + provenance + _shared), expansion v0.1.1

Branch `exp/L6-media`, base `a6d7775`. L6 is SOLE WRITER of
`desktop/src/components/image.mjs` and `desktop/src/components/_shared.mjs`
(E10 re-laned per RATIFY F5); everything below is what L8 pastes into the
SHARED seams. Every entry keeps catalog `hermes-rich-ui/1`, additive only (L8),
`additionalProperties:false` (L2).

Lane ACCEPT (all green on this branch):
- `node --test tests/test_synth_media.mjs` → 11/11 pass
- `python3 tests/test_synth_media_admission.py` → 25 checks, 0 FAIL (exercises
  the admission code below through the real `admit()` via process-local
  monkeypatch; L8 merges it verbatim)
- `node --test tests/test_components.mjs` → 26/26 pass UNMODIFIED (Image/Badge
  changes are strictly additive; see "existing-test notes" at the bottom)

---

## 1. catalog/hermes-rich-ui.catalog.json — two new component entries

Add these two keys to `components` (sibling of `Image`, `Badge`). They are the
exact entries the lane admission test injects and exercised end-to-end.

### ImageGallery

```json
"ImageGallery": {
  "type": "object",
  "description": "Evidence strip of up to 8 tiles (one component replaces Image+alt+caption Text x N). Each src is https://-only; admission never fetched or verified any URL — tiles render exactly what fails to load.",
  "properties": {
    "id": { "$ref": "#/$defs/ComponentId" },
    "component": { "const": "ImageGallery" },
    "accessibility": { "$ref": "#/$defs/Accessibility" },
    "sourceIds": {
      "type": "array",
      "items": { "type": "string", "maxLength": 4096 },
      "maxItems": 32,
      "description": "Evidence links; every id must resolve in /meta/sources."
    },
    "title": { "type": "string", "maxLength": 4096 },
    "columns": { "type": "integer", "minimum": 1, "maximum": 4, "default": 2 },
    "items": {
      "description": "Up to 8 tiles; every src is https://-only (URL-key swept); alt is required.",
      "oneOf": [
        {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "src": { "type": "string", "maxLength": 4096, "pattern": "^https://", "description": "https:// only; no credentials, no control characters. Admission never fetched or verified this URL." },
              "alt": { "type": "string", "minLength": 1, "maxLength": 4096 },
              "caption": { "type": "string", "maxLength": 4096 },
              "sourceIds": {
                "type": "array",
                "items": { "type": "string", "maxLength": 4096 },
                "maxItems": 32,
                "description": "Evidence links; every id must resolve in /meta/sources."
              }
            },
            "required": ["src", "alt"],
            "additionalProperties": false
          },
          "maxItems": 8
        },
        { "$ref": "#/$defs/DataBinding" }
      ]
    }
  },
  "required": ["id", "component", "items"],
  "additionalProperties": false
}
```

Note: `src` also lives in the engine's URL_KEYS scan (`url`, `src`, `href`,
admission.py:87 → `_scan_values` at :419-423) — it is swept for free, no new
URL code (F's verification).

### AsOf

```json
"AsOf": {
  "type": "object",
  "description": "Evidence-law caption line: Observed/Published timestamps (Accessed is source-scoped in SourceList, F8). Only publish timestamps you actually observed — date-only precision is honest when that is all you observed; leave absent if unknown.",
  "properties": {
    "id": { "$ref": "#/$defs/ComponentId" },
    "component": { "const": "AsOf" },
    "accessibility": { "$ref": "#/$defs/Accessibility" },
    "sourceIds": {
      "type": "array",
      "items": { "type": "string", "maxLength": 4096 },
      "maxItems": 32,
      "description": "Evidence links; every id must resolve in /meta/sources."
    },
    "observedAt": {
      "oneOf": [
        { "type": "string", "maxLength": 4096 },
        { "type": "null" },
        { "$ref": "#/$defs/DataBinding" }
      ],
      "description": "ISO-8601 timestamp you ACTUALLY OBSERVED; leave absent if unknown — never publish a timestamp you did not observe."
    },
    "publishedAt": {
      "oneOf": [
        { "type": "string", "maxLength": 4096 },
        { "type": "null" },
        { "$ref": "#/$defs/DataBinding" }
      ],
      "description": "ISO-8601 timestamp the source ACTUALLY PUBLISHED; leave absent if unknown — never publish a timestamp you did not observe."
    },
    "note": { "type": "string", "maxLength": 4096 }
  },
  "required": ["id", "component"],
  "additionalProperties": false
}
```

S6 precision/timezone rule (documented in the descriptions above, pinned by
the lane test): any string `parse_iso8601` accepts is admitted — full ISO
datetime (with `Z` or offset) and date-only both legal; publish only the
precision you actually observed; `null`/absent OMITS its rendered segment.

### Badge tone enum (E10) — delta, not a new entry

`components.Badge.properties.tone.enum`: `["neutral","info","success","caution"]`
→ `["neutral","info","success","caution","error","outline"]`. The four public
tones are unchanged; the map values ship in `_shared.mjs` (L6 already wrote
them): `error → 'destructive'`, `outline → 'outline'`, both members of
`BADGE_VARIANTS_REAL` (pinned, `_shared.mjs:52`).

## 2. desktop/src/components/index.mjs — import + registry lines

```js
import { ImageGallery } from './gallery.mjs'
import { AsOf } from './asof.mjs'
```
and in the `components` object literal add `ImageGallery, AsOf`
(e.g. after `Image`), keeping the trailing `}` on the same statement.

## 3. desktop/src/lower.mjs — KNOWN_TYPES

```js
'ImageGallery', 'AsOf'
```
append inside the `KNOWN_TYPES` set literal (line ~14-17). No lowering change
needed: `items` already lands in props via `c.items !== undefined` (:68) and
the gallery is a leaf like Image.

## 4. engine/admission.py — two branches (S6)

### 4a. `_check_leaf_specifics` (call sites unchanged; add branches)

Add next to the `Chart`/`DataTable` branches of `_check_leaf_specifics`:

```python
    elif t == "AsOf":
        # S6: nullable ISO-8601 via the EXISTING parse_iso8601 (:556) — no new parser.
        # null/absent is legal and OMITS its rendered segment; unresolvable bindings
        # are already schema-pass errors. Error names the property + the rule (L4).
        for k in ("observedAt", "publishedAt"):
            found, v = _resolve_prop(comp, k, data_model)
            if not found or v is None:
                continue
            ptr = "%s: /%s" % (label, k)
            if not isinstance(v, str):
                errors.append("%s: must be ISO-8601; leave absent if unknown (expected string, got %s)" % (ptr, type(v).__name__))
            elif parse_iso8601(v) is None:
                errors.append("%s: %r must be ISO-8601; leave absent if unknown" % (ptr, v[:64]))
    elif t == "ImageGallery":
        found, items = _resolve_prop(comp, "items", data_model)
        if found and isinstance(items, list):
            for i, it in enumerate(items):
                ptr = "%s: /items/%d" % (label, i)
                if not isinstance(it, dict):
                    errors.append("%s: gallery item must be an object" % ptr)
                    continue
                for k in it:
                    if k not in ("src", "alt", "caption", "sourceIds"):
                        errors.append("%s: unknown property '%s'" % (ptr, k))
                _check_str(it.get("src"), ptr + "/src", 1, 4096, errors, required=True)
                _check_str(it.get("alt"), ptr + "/alt", 1, 4096, errors, required=True)
                if it.get("caption") is not None:
                    _check_str(it.get("caption"), ptr + "/caption", 0, 4096, errors)
```

(`_check_str` is at :701, `parse_iso8601` at :556, `_resolve_prop` at :548 —
reuse, not new parsers. ≤8 cap is enforced by the schema `maxItems` at :283.)

### 4b. `_collect_source_ids` — REQUIRED per-item branch (S6)

Extend the `KeyValueList/Timeline` dispatch (:676) — paste as an `elif` after
it, identical shape so per-tile evidence resolves against /meta/sources:

```python
    elif t == "ImageGallery":
        found, items = _resolve_prop(comp, "items", data_model)
        if found and isinstance(items, list):
            for i, it in enumerate(items):
                if isinstance(it, dict) and isinstance(it.get("sourceIds"), list):
                    for j, sid in enumerate(it["sourceIds"]):
                        out.append(("%s: /items/%d/sourceIds/%d" % (label, i, j), sid))
```

The lane test proves the unregistered-sourceId rejection names
`/items/0/sourceIds/0`.

## 5. tests/fixtures/surface-all-types.json — additive rows (L8)

Suggested additions (fixture currently exercises the 18 legacy types):

```json
{ "id": "gal", "component": "ImageGallery", "title": "Evidence", "columns": 2,
  "sourceIds": ["s1"],
  "items": [
    { "src": "https://example.com/a.png", "alt": "first evidence", "caption": "panel A", "sourceIds": ["s1"] },
    { "src": "https://example.com/b.png", "alt": "second evidence" }
  ] },
{ "id": "asof", "component": "AsOf", "observedAt": "2026-09-26T10:00:00Z",
  "publishedAt": "2026-09-01", "note": "audited by hand", "sourceIds": ["s2"] },
{ "id": "bd2", "component": "Badge", "label": "failed", "tone": "error" }
```
(child ids wired wherever L8 mounts them; they are leaves).

## 6. skill/SKILL.md — component table rows (replace the Badge row text)

```
| 19 | ImageGallery | items ≤8 {src (https:// only), alt (required), caption?, sourceIds?}, title?, columns? 1..4 — one evidence strip; never claim admission fetched or verified a src |
| 20 | AsOf | observedAt?, publishedAt?, note? — ISO-8601 only, only publish timestamps you actually observed; leave absent if unknown (Accessed lives in SourceList) |
```
Badge row 10 becomes: `label, tone? (neutral|info|success|caution|error|outline)`.

## 7. skill/references/recipes.md — recipe (suggested block)

Under "## Monitor" or a new "## Evidence strip": one `ImageGallery` (tiles with
per-item `sourceIds`) followed by one `AsOf` whose `observedAt` is the time you
actually looked at the source — replaces the today-pattern of N Image+alt+Text
triples plus a hand-merged "as of …" caption Text.

## 8. Caps / constants

No new caps constants: `8` (items) and `1..4` (columns) live in the catalog
schema (`maxItems`/minimum/maximum) enforced by the generic validator; renderer
clamps mirror grid.mjs idiom defensively.

## Existing-test notes (L8 / L9 audit)

- `tests/test_components.mjs` passes UNMODIFIED (26/26): Image renders the
  shared ImageTile with byte-identical DOM/markers; Badge's D6 pin iterates
  `Object.entries(BADGE_VARIANT)` and every value (incl. the two new ones) is
  in `BADGE_VARIANTS_REAL`, so no assertion there needs to change.
- RECOMMENDED assertion EXTENSION for L8 when it registers the new types (do
  not exist in the unmodified file; add with the surface-all-types rows):
  `[data-ru="ImageGallery"]` has `data-ru-count="2"` and two
  `[data-ru-tile]` figures; `[data-ru="AsOf"]` has `data-ru-fields="2"` and
  text `Observed 2026-09-26T10:00:00Z · Published 2026-09-01`;
  `[data-ru="Badge"][...] [data-variant="destructive"]` for the `error` tone.
- Lane pins L8 must keep true: `node --check`-able components, no
  `Date.now(`/`new Date`/`performance.now` in asof.mjs, gallery.mjs, image.mjs,
  _shared.mjs (grep-pinned in test_synth_media.mjs); `ImageTile` stays the ONE
  tile implementation imported by both gallery.mjs and image.mjs.
- `tests/test_public_strings.py` passes with the new files (all strings
  generic: example.com, "Example site", "Local computation").
