# Recipes — one complete minimal `rich_present` argument each

Each block is a whole tool argument (`components` + `data` + evidence). Bindings are
`{"path": "/data/..."}` / `{"path": "/meta/..."}`; exactly one component has `id: "root"`;
every `sourceIds` entry resolves in `sources` (source ids only — a derivation id is never a
citation; name the derivation in Callout/Text prose instead). A DataTable cites per row
through a declared `{"key": "<k>", "label": "…", "type": "sources"}` column whose cell is a
list of source ids. Every block below admits as written. These are starting shapes, not
templates.

## Compare

```json
{
  "title": "Advertised price comparison",
  "summary": "Two advertised prices compared as-of; excludes fees and incentives.",
  "components": [
    {"id": "root", "component": "Card", "title": "Dealer comparison", "subtitle": "As-of 2026-09-25; advertised prices only", "children": ["hdr", "tbl", "bar", "ca", "src"]},
    {"id": "hdr", "component": "Heading", "text": {"path": "/data/heading"}, "level": 3},
    {"id": "tbl", "component": "DataTable", "title": "Advertised price", "columns": [{"key": "dealer", "label": "Dealer", "type": "text"}, {"key": "price", "label": "Price", "type": "currency", "unit": "USD"}, {"key": "sources", "label": "Sources", "type": "sources"}], "rows": {"path": "/data/offers"}},
    {"id": "bar", "component": "Chart", "kind": "bar", "title": "Advertised price", "unit": "USD", "yLabel": "USD", "series": [{"label": "Advertised", "data": {"path": "/data/bars"}}], "sourceIds": ["s1"], "caveat": "Advertised prices only; not out-the-door quotes."},
    {"id": "ca", "component": "Callout", "title": "Compare like for like", "text": {"path": "/data/caveat"}, "tone": "caution"},
    {"id": "src", "component": "SourceList", "title": "Where this came from"}
  ],
  "data": {
    "heading": "Two offers at a glance",
    "offers": [{"dealer": "Example A", "price": 42000, "sources": ["s1"]}, {"dealer": "Example B", "price": 44500, "sources": ["s1"]}],
    "bars": [{"label": "Example A", "value": 42000}, {"label": "Example B", "value": 44500}],
    "caveat": "Fees, incentives and specification differences are not normalized."
  },
  "sources": [{"id": "s1", "kind": "web", "label": "Dealership listings", "url": "https://example.com/listings", "accessed_at": "2026-09-25T10:00:00Z", "note": "advertised, as-of"}],
  "derivations": []
}
```

## Distribution

```json
{
  "title": "Price distribution",
  "summary": "18 quotes across 4 bins; median 43,000 USD (derived by the author, see derivation d1).",
  "components": [
    {"id": "root", "component": "Card", "children": ["med", "hist", "ca", "src"]},
    {"id": "med", "component": "Metric", "label": "Median quote", "value": {"path": "/data/median"}, "unit": "USD", "format": "currency", "precision": 0, "sourceIds": ["s1"]},
    {"id": "hist", "component": "Chart", "kind": "histogram", "title": "Advertised price counts", "unit": "USD", "series": [{"label": "Quotes", "data": {"path": "/data/bins"}}], "sourceIds": ["s1"]},
    {"id": "ca", "component": "Callout", "title": "Method", "text": {"path": "/data/method"}, "tone": "info"},
    {"id": "src", "component": "SourceList"}
  ],
  "data": {
    "median": 43000,
    "method": "Median 43,000 USD is derivation d1: median of the 18 quoted prices (source s1); bins include low, exclude high. Bins and median were computed by the author, not the renderer.",
    "bins": [{"low": 40000, "high": 42500, "count": 5}, {"low": 42500, "high": 45000, "count": 8}, {"low": 45000, "high": 47500, "count": 4}, {"low": 47500, "high": 50000, "count": 1}]
  },
  "sources": [{"id": "s1", "kind": "web", "label": "Quote sweep", "url": "https://example.com/quotes", "accessed_at": "2026-09-25T10:00:00Z"}],
  "derivations": [{"id": "d1", "output_path": "/data/median", "input_paths": ["/data/bins"], "method": "median of 18 quoted prices; bins include low, exclude high", "note": "Bins and median computed by the author, not the renderer."}]
}
```

## Change over time

```json
{
  "title": "Latency over the observation window",
  "summary": "Median latency p50 by hour, observed 2026-09-24T00:00Z to 2026-09-25T00:00Z.",
  "components": [
    {"id": "root", "component": "Card", "children": ["line", "win", "src"]},
    {"id": "line", "component": "Chart", "kind": "line", "title": "Median latency", "xLabel": "Time (UTC)", "yLabel": "ms", "unit": "ms", "series": [{"label": "p50", "data": {"path": "/data/points"}}], "sourceIds": ["s1"], "caveat": "Gaps are missing observations, not zero."},
    {"id": "win", "component": "Text", "text": {"path": "/data/window"}, "tone": "muted", "variant": "caption"},
    {"id": "src", "component": "SourceList"}
  ],
  "data": {
    "points": [{"x": "2026-09-24T00:00:00Z", "y": 210}, {"x": "2026-09-24T06:00:00Z", "y": 190}, {"x": "2026-09-24T12:00:00Z", "y": null}, {"x": "2026-09-24T18:00:00Z", "y": 240}],
    "window": "Observation window: 24 h, hourly samples; null hours had no data."
  },
  "sources": [{"id": "s1", "kind": "file", "label": "metrics export", "note": "author-measured"}]
}
```

## Explain a plan

```json
{
  "title": "Migration plan",
  "summary": "Three-step plan; steps 2-3 pending. Authored plan, no telemetry.",
  "components": [
    {"id": "root", "component": "Card", "children": ["tl", "kv", "ca"]},
    {"id": "tl", "component": "Timeline", "title": "Steps", "items": {"path": "/data/steps"}},
    {"id": "kv", "component": "KeyValueList", "items": {"path": "/data/facts"}},
    {"id": "ca", "component": "Callout", "title": "Caveat", "text": {"path": "/data/caveat"}, "tone": "caution"}
  ],
  "data": {
    "steps": [{"date": "2026-10-01", "label": "Freeze writes", "status": "done"}, {"date": "2026-10-02", "label": "Copy data", "status": "active"}, {"label": "Cutover", "status": "pending", "sourceIds": ["s1"]}],
    "facts": [{"label": "Owner", "value": "platform team"}, {"label": "Rollback", "value": "keep old host 7 days"}],
    "caveat": "Dates are proposed, not committed."
  },
  "sources": [{"id": "s1", "kind": "derived", "label": "Authored plan", "note": "written by the agent; not system telemetry"}],
  "derivations": []
}
```

## Monitor

```json
{
  "title": "Job progress",
  "summary": "Snapshot at 2026-09-25T10:11Z; static, not a live feed.",
  "components": [
    {"id": "root", "component": "Card", "children": ["grid", "prog", "line", "src"]},
    {"id": "grid", "component": "Grid", "columns": 2, "children": ["m1", "m2"]},
    {"id": "m1", "component": "Metric", "label": "Items done", "value": {"path": "/data/done"}, "format": "number"},
    {"id": "m2", "component": "Metric", "label": "Rate", "value": {"path": "/data/rate"}, "unit": "/min", "precision": 1},
    {"id": "prog", "component": "Progress", "label": "Import", "current": {"path": "/data/done"}, "total": {"path": "/data/total"}},
    {"id": "line", "component": "Chart", "kind": "line", "title": "Throughput", "unit": "/min", "series": [{"label": "rate", "data": {"path": "/data/points"}}], "sourceIds": ["s1"]},
    {"id": "src", "component": "SourceList"}
  ],
  "data": {
    "done": 640,
    "total": 1000,
    "rate": 42.5,
    "points": [{"x": "2026-09-25T09:00:00Z", "y": 38}, {"x": "2026-09-25T09:30:00Z", "y": 44}, {"x": "2026-09-25T10:00:00Z", "y": 42.5}]
  },
  "sources": [{"id": "s1", "kind": "file", "label": "job log tail", "note": "read at publish time; card does not auto-refresh"}],
  "derivations": []
}
```
