# Decisions (measured, owner-ratified 2026-09-25)

> Revision 2026-09-27 (publish scrub): D9/D10 prose genericized for public release —
> estate host names, estate CLI names, and seat/model aliases replaced with generic
> terms. The decisions themselves and all other rows are unchanged. (Objection per
> AGENTS.md law 1: DECISIONS.md is FROZEN; this wording-only edit is authorized by the
> owner's publish-scrub brief and carries this revision line as the law requires.)

| # | Decision | Evidence |
|---|---|---|
| D1 | Canonical record = A2UI v1.0 `createSurface`; our own catalog `hermes-rich-ui/1`; json-render `Renderer` as engine; components on the Hermes SDK | A2UI spec pinned `fcec476bff134adc742cfab94cb863855b7933bf`; json-render docs list A2UI as a supported catalog shape |
| D2 | `@a2ui/react` renderer REJECTED | `hermes plugins validate` desktop scan: 2 prototype-patching hits + `document.adoptedStyleSheets` |
| D3 | `@json-render/shadcn` implementations REJECTED, prop vocabulary KEPT as the model | 20/117 of its Tailwind classes absent from the app's purged CSS; every shadcn token (`--card`, `--muted`, `--border`, `--primary`) undefined in Hermes (app uses `--ui-*`) |
| D4 | Ship the zod-stubbed Renderer (88 KB) not the full 660 KB build | jsdom render test PASS through `JSONUIProvider` + `Renderer` with `$state` binding resolved |
| D5 | Chart engine = uPlot 1.6.32 (94.5 KB, validate 0 hits); recharts rejected | recharts bundle 727 KB with 10 prototype-patching hits |
| D6 | Fence = 18 read-only types (briefing 14 + Heading, Tabs, Accordion, Image) | owner choice |
| D7 | Naming: `hermes-rich-ui` / `rich_present` + `rich_present_source` / `::richui{id}` | owner choice |
| D8 | Scope this run: C0–C3, HOLD before public repo / catalog PR | owner choice |
| D9 | A5 live monitor: attach to a real long-running inference-server process (owner picks the serving lane) | owner choice |
| D10 | Consults: two frontier seats + one open-weight seat (subscription seats exhausted) | owner statement |
| D11 | Admission runs in Python on the gateway (stdlib mini-schema interpreter over the catalog JSON); the desktop trusts admitted records | single source of truth = `catalog/hermes-rich-ui.catalog.json` |
