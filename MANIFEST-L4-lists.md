# MANIFEST — lane L4 (lists): N3 Checklist + N4 ChipSet

Integrator (L8) pastes these verbatim. Every block below is exercised as-written by
`tests/test_synth_lists.py` (admission, via in-memory catalog injection + patched
`_collect_source_ids`) and `tests/test_synth_lists.mjs` (render). Both are green at
commit time.

---

## 1. catalog/hermes-rich-ui.catalog.json

### 1a. Two new entries under `"components"` (add after `"KeyValueList"`)

Both closed (`additionalProperties: false`, L2). `tone` is **Badge's existing four
exactly** (byte-identical enum + default to the `Badge.tone` schema — L8), mirroring
`BADGE_VARIANT` in `desktop/src/components/_shared.mjs:54-55` (imported, not edited).

```json
"Checklist": {
  "type": "object",
  "description": "Undated checklist of booleans (Checklist = undated booleans; Timeline = dated). The renderer computes the done tally; null/absent done renders UNKNOWN, never guessed.",
  "properties": {
    "id": { "$ref": "#/$defs/ComponentId" },
    "component": { "const": "Checklist" },
    "accessibility": { "$ref": "#/$defs/Accessibility" },
    "sourceIds": { "type": "array", "items": { "type": "string", "maxLength": 4096 }, "maxItems": 32, "description": "Evidence links; every id must resolve in /meta/sources." },
    "title": { "$ref": "#/$defs/DynamicString" },
    "items": {
      "description": "Up to 32 check items (literal or bound): {label, done? true|false|null, sourceIds?}.",
      "oneOf": [
        {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "label": { "type": "string", "maxLength": 4096 },
              "done": { "oneOf": [ { "type": "boolean" }, { "type": "null" } ] },
              "sourceIds": { "type": "array", "items": { "type": "string", "maxLength": 4096 }, "maxItems": 32, "description": "Evidence links; every id must resolve in /meta/sources." }
            },
            "required": ["label"],
            "additionalProperties": false
          },
          "maxItems": 32
        },
        { "$ref": "#/$defs/DataBinding" }
      ]
    },
    "showTally": { "type": "boolean", "default": true }
  },
  "required": ["id", "component", "items"],
  "additionalProperties": false
},
"ChipSet": {
  "type": "object",
  "description": "One flex-wrap row of chip labels rendered as badges (replaces N separate Badge components). Labels are data, not keys: duplicates allowed. tone is Badge's existing four exactly.",
  "properties": {
    "id": { "$ref": "#/$defs/ComponentId" },
    "component": { "const": "ChipSet" },
    "accessibility": { "$ref": "#/$defs/Accessibility" },
    "sourceIds": { "type": "array", "items": { "type": "string", "maxLength": 4096 }, "maxItems": 32, "description": "Evidence links; every id must resolve in /meta/sources." },
    "labels": {
      "description": "Up to 24 chip labels (literal or bound); duplicates allowed.",
      "oneOf": [
        { "type": "array", "items": { "type": "string", "maxLength": 4096 }, "maxItems": 24 },
        { "$ref": "#/$defs/DataBinding" }
      ]
    },
    "tone": { "type": "string", "enum": ["neutral", "info", "success", "caution"], "default": "neutral" },
    "wrap": { "type": "boolean", "default": true }
  },
  "required": ["id", "component", "labels"],
  "additionalProperties": false
}
```

### 1b. Discriminator arms (`$defs.anyComponent.oneOf`, near the bottom, after the KeyValueList arm)

```json
{ "$ref": "#/components/Checklist" },
{ "$ref": "#/components/ChipSet" }
```

(The lane test asserts the KeyValueList arm exists as the splice anchor.)

---

## 2. engine/admission.py

**Caps live in the catalog `maxItems` (items ≤32, labels ≤24), exactly like
KeyValueList/Timeline** — the mini-interpreter enforces them and the error names
the offending property + rule (L4): `"33 items exceeds maximum 32"`,
`"25 items exceeds maximum 24"`, both pinned by `tests/test_synth_lists.py`.
`MAX_KV`/`MAX_TIMELINE` are documentation-only constants in the current file, so
**no new constants are needed** (deviation-free: mirrors the existing pattern).

**Per-item sourceIds branch** — the ONLY code change: widen the tuple in
`_collect_source_ids` (~line 676, next to the KeyValueList pattern):

```python
    if t in ("KeyValueList", "Timeline", "Checklist"):
```

(was `("KeyValueList", "Timeline")`). The existing body already resolves literal
OR bound `items` via `_resolve_prop` and emits `"<id>: /items/<i>/sourceIds/<j>"`
errors naming the pointer; both paths are pinned by the lane test, including
bound per-item `sourceIds` that fail to resolve in `/meta/sources`.
ChipSet has no per-item sourceIds (labels are plain strings) — component-level
`sourceIds` rides the existing generic branch.

---

## 3. desktop/src/components/index.mjs

```js
import { Checklist } from './checklist.mjs'
import { ChipSet } from './chipset.mjs'
```

and add to the `components` object (append after `SourceList`):

```js
..., Checklist, ChipSet }
```

(Exact line: `export const components = { Card, Stack, Grid, Divider, Tabs, Accordion, Heading, Text, Callout, Badge, Metric, Progress, KeyValueList, Image, DataTable, Chart, Timeline, SourceList, Checklist, ChipSet }`)
Also update that file's header comment `(18 types)` → `(20 types)`.

## 4. desktop/src/lower.mjs — KNOWN_TYPES

```js
export const KNOWN_TYPES = new Set([
  'Card', 'Stack', 'Grid', 'Divider', 'Tabs', 'Accordion', 'Heading', 'Text', 'Callout', 'Badge',
  'Metric', 'Progress', 'KeyValueList', 'Image', 'DataTable', 'Chart', 'Timeline', 'SourceList',
  'Checklist', 'ChipSet'
])
```

No other lower.mjs change: `items` is already re-added for every component
(`if (c.items !== undefined) props.items = bind(c.items)`, the KeyValueList/Timeline
data rule) and `bind()` handles `labels`/`title` bindings generically.

## 5. skill/SKILL.md — table rows (after row 18) + evidence-rule tweak

```markdown
| 19 | Checklist | title?, items (DynamicArray ≤32): {label, done? (true\|false\|null), sourceIds?}, showTally? (default true; tally computed by the renderer). Checklist = undated booleans; Timeline = dated |
| 20 | ChipSet | labels (DynamicArray ≤24 of string; duplicates allowed), tone? (neutral\|info\|success\|caution — Badge's existing four exactly), wrap? (default true) |
```

Ruling line (kept out of the Timeline/Checklist synonym drift, per the ratified
F ruling) is embedded in row 19; the ChipSet tone note is embedded in row 20.

Evidence-rules bullet — extend the sentence "Timeline and KeyValueList items
carry their own `sourceIds`;" to:

```markdown
Timeline, KeyValueList and Checklist items carry their own `sourceIds`;
```

⚠ **INTEGRATOR WARNING:** `tests/test_skill_docs.py` pins `SKILL.md < 110 lines`
and the file is currently exactly 109. Adding 2 table rows needs 2 lines reclaimed
elsewhere in SKILL.md in the same merge (or the L8 cycle adjusts that guard —
L8 owns that file).

## 6. skill/references/recipes.md — NO CHANGE (deliberate)

`tests/test_skill_docs.py` pins `recipes_has_5_examples` (exactly 5 JSON blocks);
adding a checklist recipe would break it. No recipes.md lines ship from this lane.

## 7. tests/fixtures/surface-all-types.json — leave to L8

Adding Checklist/ChipSet entries there requires the matching TYPES edit in
`tests/test_components.mjs` (shared-seam banned for this lane); the L4 synth tests
do not depend on that fixture. If L8 adds them, sample props that admit:
`{"id":"ck","component":"Checklist","title":"Readiness","items":[{"label":"a","done":true},{"label":"b"}]}`
and `{"id":"cs","component":"ChipSet","labels":["x","y","x"],"tone":"info"}`.

---

## Renderer contract (what the merged components do)

- **Checklist** (`desktop/src/components/checklist.mjs`): root `data-ru="Checklist"` +
  `data-ru-tally="<done>/<total>"` COMPUTED in the renderer (L6; `done===true` over total
  items); visible tally is native read-only `role="status"` text — no checkbox/input ever (S
  ruling). Per item `data-ru-state` = `done|unchecked|unknown`; `done:null`/absent renders a
  distinct UNKNOWN open circle (different marker attr, style, and aria-label from `false` —
  L1, pinned by the null ≠ false test). Items clamped to 32 renderer-side (defense in depth).
- **ChipSet** (`desktop/src/components/chipset.mjs`): root `data-ru="ChipSet"` +
  `data-ru-count="<labels.length>"`; one flex-wrap row of N SDK badges via `badge()`
  imported from `_shared.mjs:52-55` (that file NOT edited); tone maps exactly like
  badge.mjs (`BADGE_VARIANT[tone] ?? 'muted'`, size `xs`, `data-ru-tone` marker);
  duplicate labels render (index keys, data not keys); empty/absent `labels` renders an
  empty wrapper, no crash; labels clamped to 24 renderer-side.

## ACCEPT (lane, all green at commit time)

```
node --test tests/test_synth_lists.mjs   # 11 pass / 0 fail, exit 0
python3 tests/test_synth_lists.py        # 17 checks, 0 FAIL, exit 0
node --test tests/test_components.mjs    # 26 pass / 0 fail (unmodified, no regression)
```
