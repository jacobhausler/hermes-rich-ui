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

## KPI trend row

```json
{
  "title": "Throughput",
  "summary": "Requests and error rate with renderer-computed trend strips.",
  "components": [
    {
      "id": "root",
      "component": "Card",
      "title": "Throughput",
      "children": [
        "row",
        "note"
      ]
    },
    {
      "id": "row",
      "component": "Stack",
      "direction": "horizontal",
      "gap": "md",
      "children": [
        "m1",
        "sp1",
        "m2",
        "sp2"
      ]
    },
    {
      "id": "m1",
      "component": "Metric",
      "label": "Requests",
      "value": {
        "path": "/data/rps"
      },
      "unit": "rps"
    },
    {
      "id": "sp1",
      "component": "Sparkline",
      "values": [
        900,
        980,
        1010,
        null,
        1150,
        1240
      ]
    },
    {
      "id": "m2",
      "component": "Metric",
      "label": "Errors",
      "value": {
        "path": "/data/err"
      },
      "unit": "%",
      "precision": 1
    },
    {
      "id": "sp2",
      "component": "Sparkline",
      "tone": "danger",
      "direction": "bar",
      "series": [
        0.9,
        0.8,
        0.6,
        null,
        0.5,
        0.4
      ]
    },
    {
      "id": "note",
      "component": "Text",
      "text": "Trend chips are computed first-vs-last by the renderer.",
      "variant": "caption"
    }
  ],
  "data": {
    "rps": 1240,
    "rps_series": [
      900,
      980,
      1010,
      null,
      1150,
      1240
    ],
    "err": 0.4,
    "err_series": [
      0.9,
      0.8,
      0.6,
      null,
      0.5,
      0.4
    ]
  },
  "sources": [
    {
      "id": "s1",
      "kind": "web",
      "label": "Example metrics",
      "url": "https://example.com/metrics",
      "accessed_at": "2026-09-26T10:00:00Z"
    }
  ],
  "derivations": []
}
```

## Ranked list

> A 4–12-row ranked list is a **BarList**, not a Chart or a DataTable; anything
> already tabular (filter/paging/sources columns) stays a DataTable.

```json
{
  "title": "Top traffic sources",
  "summary": "Sessions by source, ranked; the null row renders unavailable, never 0.",
  "components": [
    {
      "id": "root",
      "component": "Card",
      "title": "Top traffic sources",
      "children": [
        "bl",
        "src"
      ]
    },
    {
      "id": "bl",
      "component": "BarList",
      "items": {
        "path": "/data/rows"
      },
      "unit": " sessions",
      "sort": "desc",
      "sourceIds": [
        "s1"
      ]
    },
    {
      "id": "src",
      "component": "SourceList"
    }
  ],
  "data": {
    "rows": [
      {
        "label": "Search",
        "value": 4820,
        "sourceIds": [
          "s1"
        ]
      },
      {
        "label": "Direct",
        "value": 2310,
        "sourceIds": [
          "s1"
        ]
      },
      {
        "label": "Referral",
        "value": null,
        "sourceIds": [
          "s1"
        ]
      }
    ]
  },
  "sources": [
    {
      "id": "s1",
      "kind": "web",
      "label": "Example metrics",
      "url": "https://example.com/metrics",
      "accessed_at": "2026-09-26T10:00:00Z"
    }
  ],
  "derivations": []
}
```

## Day x lane matrix

```json
{
  "title": "Build minutes by day and lane",
  "summary": "HeatMap matrix; null cells hatch as an em-dash, never a guessed color.",
  "components": [
    {
      "id": "root",
      "component": "Card",
      "title": "Build minutes by day and lane",
      "children": [
        "hm"
      ]
    },
    {
      "id": "hm",
      "component": "HeatMap",
      "rows": {
        "path": "/data/rows"
      },
      "cols": {
        "path": "/data/cols"
      },
      "cells": {
        "path": "/data/cells"
      },
      "unit": "min",
      "sourceIds": [
        "s1"
      ]
    }
  ],
  "data": {
    "rows": [
      {
        "label": "Mon"
      },
      {
        "label": "Tue"
      },
      {
        "label": "Wed"
      }
    ],
    "cols": [
      {
        "label": "lint"
      },
      {
        "label": "test"
      },
      {
        "label": "build"
      }
    ],
    "cells": [
      {
        "row": "Mon",
        "col": "lint",
        "value": 2
      },
      {
        "row": "Mon",
        "col": "test",
        "value": 9
      },
      {
        "row": "Mon",
        "col": "build",
        "value": 5
      },
      {
        "row": "Tue",
        "col": "lint",
        "value": 1
      },
      {
        "row": "Tue",
        "col": "test",
        "value": null
      },
      {
        "row": "Wed",
        "col": "build",
        "value": 7
      }
    ]
  },
  "sources": [
    {
      "id": "s1",
      "kind": "web",
      "label": "Example metrics",
      "url": "https://example.com/metrics",
      "accessed_at": "2026-09-26T10:00:00Z"
    }
  ],
  "derivations": []
}
```

## Show the code

```json
{
  "title": "Reproduce the failure",
  "summary": "Exact config and command output, verbatim, with the source cited.",
  "components": [
    {
      "id": "root",
      "component": "Card",
      "children": [
        "cfg",
        "out",
        "src"
      ]
    },
    {
      "id": "cfg",
      "component": "CodeBlock",
      "code": {
        "path": "/data/config"
      },
      "caption": "nginx.conf fragment as shipped",
      "language": "nginx",
      "sourceIds": [
        "s1"
      ]
    },
    {
      "id": "out",
      "component": "CodeBlock",
      "code": {
        "path": "/data/output"
      },
      "caption": "verbatim stdout",
      "language": "text",
      "showLines": true
    },
    {
      "id": "src",
      "component": "SourceList"
    }
  ],
  "data": {
    "config": "location /api {\n    proxy_pass http://127.0.0.1:9000;\n}",
    "output": "$ curl -s https://example.com/health\n{\"status\":\"degraded\"}"
  },
  "sources": [
    {
      "id": "s1",
      "kind": "file",
      "label": "Config as shipped",
      "accessed_at": "2026-09-27T10:00:00Z"
    }
  ],
  "derivations": []
}
```

## Evidence strip

```json
{
  "title": "Menu board evidence",
  "summary": "Two photos of the posted menu, observed 2026-09-27T14:05Z.",
  "components": [
    {
      "id": "root",
      "component": "Card",
      "children": [
        "gal",
        "asof",
        "src"
      ]
    },
    {
      "id": "gal",
      "component": "ImageGallery",
      "title": "Posted menu",
      "columns": 2,
      "items": {
        "path": "/data/tiles"
      },
      "sourceIds": [
        "s1"
      ]
    },
    {
      "id": "asof",
      "component": "AsOf",
      "observedAt": {
        "path": "/data/observed"
      },
      "note": "Prices read from the posted board; not an out-the-door quote."
    },
    {
      "id": "src",
      "component": "SourceList"
    }
  ],
  "data": {
    "tiles": [
      {
        "src": "https://example.com/menu-1.jpg",
        "alt": "Menu board, left half",
        "caption": "Mains",
        "sourceIds": [
          "s1"
        ]
      },
      {
        "src": "https://example.com/menu-2.jpg",
        "alt": "Menu board, right half",
        "sourceIds": [
          "s1"
        ]
      }
    ],
    "observed": "2026-09-27T14:05:00Z"
  },
  "sources": [
    {
      "id": "s1",
      "kind": "web",
      "label": "Menu page",
      "url": "https://example.com/menu",
      "accessed_at": "2026-09-27T14:05:00Z"
    }
  ],
  "derivations": []
}
```

