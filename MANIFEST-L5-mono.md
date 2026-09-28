# MANIFEST — lane L5 (mono): CodeBlock (N1)

Integrator (L8): paste each block verbatim into the named shared seam. Catalog
stays `hermes-rich-ui/1`; everything here is additive (L8). No new runtime
dependencies, no interactivity, no HTML injection (jsx escapes; component
never uses dangerouslySetInnerHTML).

Owns (already committed on `exp/L5-mono`): `desktop/src/components/codeblock.mjs`,
`tests/test_synth_mono.mjs`, `tests/test_synth_mono.py`.

ACCEPT (run from worktree root, both exit 0):
- `node --test tests/test_synth_mono.mjs`  (9 render asserts, jsdom via helpers/render.mjs)
- `python3 tests/test_synth_mono.py`       (22 admission checks incl. the pure cap helper)
- regression re-run green: `node --test tests/test_components.mjs`

## 1. catalog/hermes-rich-ui.catalog.json — add to `components`

`additionalProperties:false` (L2). Description states language is a LABEL ONLY,
never parsed, and the 4 KiB cap (never truncated):

```json
"CodeBlock": {
  "type": "object",
  "description": "Monospace code/config/shell block, literal text only. No markdown, no HTML, no syntax highlighting. 'language' is a LABEL ONLY, never parsed. 'code' is capped at 4 KiB (UTF-8); over-cap input is rejected at admission, never truncated. 'showLines' renders per-line numbers in the renderer; the agent never numbers lines itself.",
  "properties": {
    "id": { "$ref": "#/$defs/ComponentId" },
    "component": { "const": "CodeBlock" },
    "accessibility": { "$ref": "#/$defs/Accessibility" },
    "sourceIds": {
      "type": "array",
      "items": { "type": "string", "maxLength": 4096 },
      "maxItems": 32,
      "description": "Evidence links; every id must resolve in /meta/sources."
    },
    "code": { "$ref": "#/$defs/DynamicString" },
    "caption": { "type": "string", "maxLength": 4096 },
    "language": { "type": "string", "maxLength": 64 },
    "showLines": { "type": "boolean", "default": false }
  },
  "required": ["id", "component", "code"],
  "additionalProperties": false
}
```

## 2. engine/admission.py — caps constant + explicit check

The generic `_scan_values` string cap (MAX_STRING = 4096) already rejects a
LITERAL over-cap `code`, but the scan never reaches into dataModel, so a
BOUND (`{"path": ...}`) `code` could smuggle an unbounded string — and the
generic message names chars, not the cap. Ship an explicit check so the error
names the cap and the offending property (L4) and the cap is enforced in
UTF-8 BYTES on the resolved value.

Constants block (next to `MAX_STRING = 4096`, ~line 58):

```python
MAX_CODE = 4096  # CodeBlock `code`, UTF-8 bytes of the resolved value
```

Function (module level, near `_check_histogram_series`):

```python
def check_code_cap(comp, data_model, errors):
    """Append an error when CodeBlock `code` (literal or bound) exceeds 4 KiB.

    The generic string scan caps every literal string at MAX_STRING (4096) but
    never reaches inside dataModel, so a bound `code` could smuggle an
    unbounded string; this closes the gap and names the cap (L4).
    """
    found, val = _resolve_prop(comp, "code", data_model)
    if found and isinstance(val, str) and len(val.encode("utf-8")) > MAX_CODE:
        errors.append("%s: /code: code exceeds %d KiB cap (%d bytes)"
                      % (comp.get("id"), MAX_CODE // 1024, len(val.encode("utf-8"))))
```

Call site — first lines of `_check_leaf_specifics` (~line 607), after
`t = comp.get("component")` / `label = comp.get("id")`:

```python
    if t == "CodeBlock":
        check_code_cap(comp, data_model, errors)
        return
```

Lane-tested verbatim (the truth-table in tests/test_synth_mono.py tests this
exact code via a shimmed catalog that injects the entry above and routes
`CodeBlock` to the hook; the pure helper is also tested directly). Boundary is
inclusive: exactly 4096 bytes admits, 4097 errors — never truncated (L1).

## 3. desktop/src/components/index.mjs — import + registry line

```js
import { CodeBlock } from './codeblock.mjs'
```

and in the `components` object (append after `SourceList`):

```js
CodeBlock
```

(full line becomes: `export const components = { Card, Stack, Grid, Divider, Tabs, Accordion, Heading, Text, Callout, Badge, Metric, Progress, KeyValueList, Image, DataTable, Chart, Timeline, SourceList, CodeBlock }`; header comment becomes 19 types)

## 4. desktop/src/lower.mjs — KNOWN_TYPES

```js
'Metric', 'Progress', 'KeyValueList', 'Image', 'DataTable', 'Chart', 'Timeline', 'SourceList', 'CodeBlock'
```

(append `'CodeBlock'` to the existing set literal; no other lower.mjs change —
CodeBlock is a leaf, all props map through the generic path).

## 5. skill/SKILL.md — component table row 19

```
| 19 | CodeBlock | code (≤4 KiB literal text), caption?, language? (LABEL only, never parsed), showLines? |
```

## 6. skill/references/recipes.md — recipe (paste at end; admits as written)

## Show the code

```json
{
  "title": "Reproduce the failure",
  "summary": "Exact config and command output, verbatim, with the source cited.",
  "components": [
    {"id": "root", "component": "Card", "children": ["cfg", "out", "src"]},
    {"id": "cfg", "component": "CodeBlock", "code": {"path": "/data/config"}, "caption": "nginx.conf fragment as shipped", "language": "nginx", "sourceIds": ["s1"]},
    {"id": "out", "component": "CodeBlock", "code": {"path": "/data/output"}, "caption": "verbatim stdout", "language": "text", "showLines": true},
    {"id": "src", "component": "SourceList"}
  ],
  "data": {
    "config": "location /api {\n    proxy_pass http://127.0.0.1:9000;\n}",
    "output": "$ curl -s https://example.com/health\n{\"status\":\"degraded\"}"
  },
  "sources": [{"id": "s1", "kind": "file", "label": "Config as shipped", "accessed_at": "2026-09-27T10:00:00Z"}],
  "derivations": []
}
```

## Notes for the integrator

- Component renders `data-ru="CodeBlock"` on its root (via `common(element)`);
  markers: `data-ru-caption`, `data-ru-lang`, `data-ru-lines`,
  `data-ru-line`, `data-ru-line-no`; null `code` → shared `unavailable()` (L1).
- Styles use only `--ui-*` theme vars already in the repo (bg3/stroke3/text/
  text2/text3) — L7. Mono idiom copied from table.mjs:108
  (`ui-monospace, monospace`).
- `showLines` numbers are renderer-side per-line spans (no agent numbering, no
  CSS-counter dependency); gutter is `aria-hidden`, `user-select: none`.
- long tokens: `word-break: break-all` + `white-space: pre-wrap` + `overflow: auto`.
- No syntax highlighting anywhere; `language` never parsed by component or
  admission (plain string ≤64 chars).
- The synth .py tests monkeypatch the catalog in-process (documented there);
  after your merge they can be pointed at the real catalog — the shimmed
  assertions are the merge contract.
- scripts/build.mjs banned-surface scan: codeblock.mjs touches no
  document/window; `node scripts/build.mjs` + committed bundle check unaffected
  until you rebuild after the index.mjs merge (then rerun suite per O11/S5).
