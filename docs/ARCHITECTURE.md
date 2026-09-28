# ARCHITECTURE — the mental model of hermes-rich-ui

Audience: a new maintainer. Read this once, then `docs/CONTRACTS.md` (the law),
`docs/DECISIONS.md` (why the law is shaped like that), `AGENTS.md` (the laws that
get enforced in review). Every claim here cites `file:line` or a catalog key —
when this doc and the code disagree, the code wins and this doc is a bug.

A rendered, dark-theme version of the lifecycle diagram lives at
`docs/architecture-diagram.html` (self-contained, no external assets); its
markdown twin is §3 below.

## 1. The two-halves picture

`hermes-rich-ui` is **two programs that never import each other**, glued together
by two shared artifacts: the record schema (CONTRACTS §1) and the catalog
(`catalog/hermes-rich-ui.catalog.json`).

**Gateway half — Python, stdlib only.** Runs in the gateway process. It owns:

- the tool door: `register(ctx)` registers exactly one tool, `rich_present`
  (`__init__.py:126-129`), schema `{description, parameters}` at
  `__init__.py:112-123`;
- the admission engine (`engine/admission.py`) — a stdlib mini-JSON-Schema
  interpreter plus structural rules, validating against the catalog;
- the card/view store (`engine/store.py`) — files under
  `$HERMES_HOME/rich-ui/{cards,views}/`, paths resolved at CALL time
  (`store.py:29-42`) so tests and multi-profile hosts never bind a stale home;
- a read-only REST projection (`dashboard/plugin_api.py`) mounted by the host at
  `/api/plugins/hermes-rich-ui` (CONTRACTS §5): `GET /health` (`:47,:60`),
  `GET /cards/{card_id}` (`:51,:64`). The FastAPI router only exists when
  FastAPI is importable (`plugin_api.py:38-44`); the route bodies are plain
  functions, which is why they are testable without a server.

**Desktop half — one committed ESM bundle.** `desktop/plugin.js` is the esbuild
output of `desktop/src/` (`scripts/build.mjs`) and the *only* artifact the
desktop loads. It registers exactly ONE contribution — a
`TRANSCRIPT_DIRECTIVE_AREA` directive named `richui`
(`desktop/src/index.mjs:47-54`) — and may import only `@hermes/plugin-sdk`,
`react`, `react/jsx-runtime` (plus the bundled `@json-render/react` and uPlot).
There is no dashboard UI: `dashboard/manifest.json` sets `"tab": {"hidden":
true}` — the dashboard directory is the REST half of the gateway side, not a UI.

The halves never talk to each other directly: the gateway writes a JSON record
and the desktop *fetches it over the host's plugin REST API* (step ⑦ below).
That indirection is the design: each half can be tested (and fails) alone.

## 2. Module map

| File | Responsibility | Key lines |
|---|---|---|
| `__init__.py` | thin door: schema + handler registration; siblings bound by PATH via `_load` so no other plugin's `engine` package can shadow ours | `:21-36` `_load`, `:126-133` `register` |
| `engine/tool.py` | `rich_present` handler: triage → build §1 record → admit → persist → directive | `:59` `directive()`, `:63` `build_record`, `:108` `_present`, `:194` never-raises wrapper |
| `engine/admission.py` | the security boundary: budgets → closed meta shapes → catalog schema (bindings resolved *inside* the interpreter) → graph rules → schema-inexpressible rules → normalized-bytes re-check | `admit` `:818-900`, budgets `:54-66`, `_Ctx.validate` `:237`, `_check_graph` `:494`, `_check_leaf_specifics` `:607` |
| `engine/store.py` | atomic persistence, id validation before any disk access, quota that refuses and never deletes | `:57-71` `_atomic_write`, `:103-121` `write_card`, `QUOTA_BYTES` `:18` |
| `dashboard/plugin_api.py` | read-only REST projection of the store | `:47` `health_view`, `:51` `card_view` |
| `catalog/hermes-rich-ui.catalog.json` | SINGLE source of truth: 18 component schemas, `$defs` (incl. `ChartPoint_{bar,line,scatter,histogram}`), authoring `instructions` (`:8`), and the read-only law made structural: `"functions": {}` (`:1025`) | `catalogId: "hermes-rich-ui/1"` |
| `desktop/src/index.mjs` | directive registration; `withSources` HOF injects `/meta/sources` into every component's props so `sourceIds` superscripts resolve (`:12-22`) | `:47-54` |
| `desktop/src/card.mjs` | `RichCard` fetch + states, `CardBoundary` error isolation, `CardBody` composition | `:9` id regex, `:58-66` boundary, `:109` body, `:154` `makeRichCard` |
| `desktop/src/lower.mjs` | deterministic A2UI → json-render lowering + `unlowerable()` reasons | `:53-74` `lower`, `:77-101` `unlowerable` |
| `desktop/src/components/*.mjs` | the 18 renderers; `V` = the twelve `--ui-*` theme vars (`_shared.mjs:5-18`) | `index.mjs:21` registry |
| `desktop/src/components/chart.mjs` | the ONE chart engine: uPlot 1.6.32 (`:12`), necessary CSS subset scoped `[data-richui="chart-canvas"]` (`:24-33`, CONTRACTS §6 W4) | `:321` canvas host |
| `scripts/build.mjs` | esbuild → one ESM file; zod stub (`:33-40`); banned-surface scan (BANNED `:15-19`, ALLOWLIST `:20-23`) with ONE content-allowlisted occurrence (uPlot's env guard); `.sha256` sidecar | `:24-30` `scanBanned` |

## 3. The card lifecycle — one diagram, both halves

Rendered twin: `docs/architecture-diagram.html`.

```mermaid
flowchart TD
    AG["AGENT (model seat)<br/>calls rich_present · pastes the directive line"]

    subgraph GW["GATEWAY HALF — Python, stdlib only"]
        T1["① rich_present(args)<br/>__init__.py:126 → engine/tool.py:108"]
        T2["② build_record — §1 A2UI v1.0 record<br/>engine/tool.py:63 · dataModel{data,meta}"]
        T3{"③ ADMIT — admit(components, dataModel)<br/>engine/admission.py:818<br/>catalog schema + graph + budgets + URLs<br/>rejects, never truncates (CONTRACTS §3)"}
        REJ["REJECT → {ok:false, errors[]}<br/>nothing is written"]
        CAT[("FROZEN CATALOG<br/>catalog/hermes-rich-ui.catalog.json<br/>18 types · functions{} — single source of truth")]
        ST[("④ card store<br/>$HERMES_HOME/rich-ui/cards/card_id.json<br/>atomic tmp+rename · quota refuses, never deletes")]
        T5["⑤ return {ok, card_id, directive}<br/>engine/tool.py:187 · tool.py:59"]
        API["REST (read-only)<br/>GET /api/plugins/hermes-rich-ui/cards/{card_id} · /health<br/>dashboard/plugin_api.py:51,64"]
    end

    subgraph DT["DESKTOP HALF — one committed ESM bundle"]
        D1["⑥ ::richui{id=...} matches the registered directive<br/>desktop/src/index.mjs:47 (TRANSCRIPT_DIRECTIVE_AREA)"]
        D2["⑦ RichCard → useQuery('/cards/'+id)<br/>desktop/src/card.mjs:154 · id checked before fetch (:9)"]
        D3["⑧ lower() — deterministic lowering<br/>lower.mjs:53 · component→type · {path}→{$state}"]
        D4["⑨ Renderer: JSONUIProvider + Renderer<br/>card.mjs:138 · @json-render/react, zod stubbed (D4)<br/>uPlot charts (D5) · inline styles, --ui-* only"]
        D5["inline card: summary above body · 480px cap + Show more<br/>CardBoundary → InlineError, never a dead message (card.mjs:58)"]
    end

    AG -->|tool call| T1
    AG -.->|"reply prose carries '::richui{id=...}'"| D1
    T1 --> T2 --> T3
    T3 -->|fail| REJ
    CAT -.->|validation source of truth (D11)| T3
    T3 -->|pass → normalized components| ST --> T5
    ST -->|reads| API
    D1 --> D2
    D2 -.->|"GET /cards/<id> over the host plugin API"| API
    D2 --> D3 --> D4 --> D5
```

The steps, with the receipts:

1. **Call.** The agent calls `rich_present` with `{title, summary, components,
   data, sources?, derivations?, view?, save_view_as?}`
   (`__init__.py:74-108`). The handler never raises: every failure is
   `{ok:false, errors:[...]}` and an internal exception surfaces only as
   `"/: admission failed (internal)"` — no trace in the reply
   (`engine/tool.py:194-201`, REVIEW-C0 E2).
2. **Record.** `build_record` (`engine/tool.py:63-101`) wraps the agent's
   components + data into the §1 A2UI v1.0 `createSurface` record with exact
   key order; `envelope` picks up `HERMES_SESSION_ID`/`HERMES_PROFILE` from env
   (`:81-82`) and `meta` (title/summary/authored_at/dataset/sources/derivations)
   is host-authored.
3. **Admission.** `admit(components, data_model)`
   (`engine/admission.py:818-900`) runs, in order: (a) budgets + a
   depth-capped scan FIRST so hostile nesting never reaches deepcopy
   (`:828-834`, E1); (b) closed `/meta/sources` + `/meta/derivations` shapes
   (`:739`); (c) per-component validation against the catalog by the stdlib
   mini-JSON-Schema interpreter — an A2UI `{"path": ...}` binding is validated
   as a binding AND its *resolved* value re-validated with the binding
   alternative removed (`:327-349`), which is the one rule that yields every
   per-type resolved-value check; (d) graph rules — root exists, refs resolve,
   no cycles/shared children/unreachables (`:494`); (e) the rules plain JSON
   Schema cannot say: chart point shapes per `kind`, DataTable column
   discipline (`:607`), and `sourceIds` → `/meta/sources` resolution
   (`:881-887`); (f) the 64 KiB budget re-measured on the NORMALIZED components
   (`:889-898`, rev 2026-09-25c (c)). Errors → `{ok:false, errors}`, nothing
   written (`engine/tool.py:169-170`).
4. **Persist.** `store.write_card` (`engine/store.py:103-121`) atomic
   tmp+fsync+`os.replace` into `$HERMES_HOME/rich-ui/cards/<card_id>.json`,
   quota 32 MiB: full ⇒ refuse with a message that says *nothing was deleted*
   (`:116-119`). Cards are immutable after publish — refresh semantics (C2)
   replace data, never components (CONTRACTS §1).
5. **Directive.** The tool returns `{ok, card_id, directive, summary, warnings}`
   (`engine/tool.py:187-188`); `directive()` (`:59-60`) is exactly
   `::richui{id="<card_id>"}`. The agent pastes that line, alone, in its reply.
6. **Directive match.** The desktop bundle registered the `richui` directive
   name once (`desktop/src/index.mjs:47-54`); the app's transcript renderer
   matches the line and mounts `<RichCard id>` in its place.
7. **Fetch.** `RichCard` checks the id against
   `/^ru-[0-9a-f]{12}$/` BEFORE any network call (`card.mjs:9,156`) and
   `useQuery`-fetches `GET /cards/<id>` via the host SDK's `rest` (`:157`),
   which lands on `card_view` (`dashboard/plugin_api.py:51`) reading the store.
   Pending → Skeleton; error/bad-id → `InlineError` (`card.mjs:158-162`).
8. **Lowering.** `lower(createSurface)` (`lower.mjs:53-74`) is deterministic:
   `components[]` → `elements{}` keyed by id (a **null-prototype** dict, `:57`),
   `component` → `type`, structural keys → `children[]`, `{"path":...}` →
   `{$state: path}` recursively (`:29-38`), `spec.root = "root"`,
   `initialState = dataModel`. `unlowerable()` (`:77-101`) pre-checks the
   surface; reasons render as a red list INSTEAD of the body (`card.mjs:130-133`).
9. **Render.** `JSONUIProvider` + `Renderer` from `@json-render/react`
   (`card.mjs:138-140`) resolve `$state` against the dataModel and walk the
   registry (`index.mjs:38-40`); unknown types hit the `UnknownType` fallback
   (`card.mjs:52-55`), throws die at `CardBoundary` (`:58-66`) — a broken card
   degrades to an inline error, never a dead message. The plain-text summary
   always renders above the body (`:129`): the accessible, non-rendering fallback.
   Local interaction (sort/filter/page, legend toggle, expand past the 480 px
   cap) lives IN components, never in the spec (CONTRACTS §2).

## 4. Component catalog — 18 types, grouped

The frozen table is CONTRACTS §2 (rows 1-18); the machine-readable truth is
`catalog/hermes-rich-ui.catalog.json → components`. Groupings are ours (for
reading), the schemas are the contract's. Every component's common envelope is
`{id, component, accessibility?, sourceIds?}` — no other keys (§2).

| Group | Types | Notes |
|---|---|---|
| Layout containers | `Card` `Stack` `Grid` | reference `children: ComponentId[]`; Card is the usual `root`; Grid columns 1..4 |
| Grouping / disclosure | `Tabs` `Accordion` `Divider` | child via `tabs[].child` / `items[].child`; interactive locally only |
| Prose | `Heading` `Text` `Callout` | `Text` is plain text (newlines kept); Callout tone info\|caution\|success |
| Status & figures | `Badge` `Metric` `Progress` | `Metric.value` is number\|null — null renders "unavailable", never 0 (`components/_shared.mjs:30-33`; catalog `DynamicNumber`/`NullableDynamicNumber`) |
| Data views | `KeyValueList` `DataTable` `Chart` `Timeline` | the data-heavy four: kv ≤32, table ≤100×12, chart ≤4 series×512 pts (`$defs.ChartPoint_*` per kind), timeline ≤30 |
| Media & evidence | `Image` `SourceList` | Image `src` https:// only + required `alt`; SourceList defaults to ALL of `/meta/sources` (admission docstring `:30-32`: not baked in at normalize time, because meta may be refreshed) |

Dense-by-default authoring law (catalog `instructions`, `:8`): two-column
summary cards, no full-width vertical runs; only charts and wide tables earn
full width.

## 5. Trust model

**Why read-only.** The spec author is a *model*, and model output is untrusted
input that happens to be rendered inside a logged-in desktop app. The catalog
makes the read-only law structural, not stylistic: `"functions": {}`
(catalog `:1025`) — the A2UI extension point for callables exists but is empty;
no actions, no `sendDataModel`, no `on`/watch fields, no `catalogId` overrides
(CONTRACTS §1, AGENTS.md law 7). A card can therefore never exfiltrate data,
execute anything, or rewrite its own model; the only side effects are the
user's own clicks (links open via the host external-link path only, §2).
Refresh belongs to trusted chrome (C2), never to spec fields.

**Why admission is the security boundary (D11).** Admission runs in Python on
the gateway, over the catalog file — the same file the renderer is built
against, so a spec either satisfies the catalog or never persists. Everything
downstream (store, REST, desktop) can then *trust the record*: the renderer
re-checks shape (`unlowerable`, forbidden keys, null-prototype element dict —
defense in depth, `lower.mjs:21-24,57`) but never re-implements validation.
The concrete teeth, all in `engine/admission.py`: forbidden prototype keys
(`:68`, also as ids `:460-468`), numbers finite and ≤2^53 (`:175-181`), URLs
https-only with no credentials and no Cc/Cf/Zs/Zl/Zp characters (`:437-457`),
closed source/derivation shapes (`:715-736`), and budgets that reject, never
truncate (CONTRACTS §3). Rejection is total: an unadmitted card writes zero
bytes (`engine/tool.py:169-170`).

**The second boundary** is the bundle itself: `scripts/build.mjs` refuses to
build if the output touches `window.hermesDesktop`, `localStorage`,
`document.querySelector`, `innerHTML`, `eval`, `new Function`, dynamic
`import()`, `adoptedStyleSheets`, or even the bare identifiers `document`/`window`
(BANNED `:15-19`), with exactly ONE content-allowlisted exception — uPlot's env
guard (ALLOWLIST `:20-23`, scan in `scanBanned` `:24-30`; pinned by
`tests/test_bundle_scan.mjs`). The renderer reaches the
outside world only through `@hermes/plugin-sdk` (`ctx.rest`, `ctx.os.openExternal`,
`index.mjs:48-49`).

**Store hygiene** closes the disk angle: ids validated before ANY filesystem
touch (`store.py:49-54,97-100,125-127`), atomic writes, quota that refuses and
never deletes.

## 6. The dependency trade (D-numbers → docs/DECISIONS.md)

- **`@json-render/react` as the engine, with zod stubbed — D1, D4.** A2UI
  catalogs are a supported shape for json-render's `Renderer` (D1), so we
  adopt a spec-driven renderer instead of hand-wiring 18 components to a state
  store. The Renderer never actually calls zod; shipping it would cost ~570 KB
  for dead weight, so `scripts/build.mjs:33-40` replaces the `zod` specifier
  with a Proxy stub — 88 KB instead of 660 KB, proven by a jsdom render test
  through `JSONUIProvider` + `$state` resolution (D4). The stub is a build-time
  substitution only; if a future json-render version starts *calling* zod, the
  render tests fail first.
- **`@a2ui/react` REJECTED — D2.** `hermes plugins validate` found 2
  prototype-patching hits + `document.adoptedStyleSheets`; the desktop law
  forbids exactly that surface, and the validator gates the bundle.
- **`@json-render/shadcn` REJECTED as implementation, kept as prop vocabulary
  — D3.** 20/117 of its Tailwind classes are absent from the app's purged CSS
  and its shadcn tokens (`--card`, `--muted`, …) don't exist in Hermes — the
  app themes via `--ui-*`, which is why our components are inline-style +
  `--ui-*` only (`_shared.mjs:5-18`, AGENTS.md law 4).
- **uPlot as the ONE chart engine — D5, CONTRACTS §0/§6.** 94.5 KB and clean
  under `hermes plugins validate`; recharts was 727 KB with 10
  prototype-patching hits. uPlot's class CSS ships inside the bundle, every
  selector scoped under `[data-richui="chart-canvas"]`, injected once per
  document (`chart.mjs:24-33`, §6 rev W4) — no runtime CSS fetching, no
  global style pollution.
- **No self-updater** (AGENTS.md law 5): the committed `desktop/plugin.js` IS
  the artifact; CI rebuilds and diffs it (`ci.yml`, needle-asserted by
  `tests/test_skill_docs.py:191-194`), so what you review is what runs.

## 7. Extension points

**Adding a component type = three gates, all mandatory:**

1. **Catalog** — a schema under `components.<Name>` in
   `catalog/hermes-rich-ui.catalog.json` (closed: `additionalProperties:false`,
   bindings only via the `$defs` Dynamic* refs). Admission picks it up with zero
   Python change — `admit` looks the type up at `admission.py:863`.
2. **Renderer** — `desktop/src/components/<name>.mjs` (inline styles, `--ui-*`
   via `V`, no SDK-banned surface), exported from
   `desktop/src/components/index.mjs:21`, added to `KNOWN_TYPES`
   (`lower.mjs:14-17`), then rebuild the bundle (`node scripts/build.mjs`) and
   commit `desktop/plugin.js` + `.sha256` with the sources.
3. **Fixtures/tests** — add the type to `tests/fixtures/surface-all-types.json`
   (renders EVERY type through the real Renderer — `tests/test_components.mjs`),
   admit-path coverage (`tests/test_fixtures_admit.py` admits every shipped
   JSON), and the CONTRACTS §2 row + `skill/SKILL.md` mention (the docs gate
   cross-checks §2 ↔ SKILL.md, `tests/test_skill_docs.py:59-62`).

The fences between the gates: `tests/test_bundle_scan.mjs` (banned surface +
committed bundle == fresh build), `tests/test_hostile_admission.py` /
`test_hostile_render.mjs` (attacker-shaped inputs), `python3 scripts/suite.py .
out` for the serial run of everything.

**The catalog fence itself is decision-level:** the 18-type set (briefing 14 +
Heading, Tabs, Accordion, Image) was an owner call (D6). Treat type-count
changes as needing owner sign-off, like the D-series.

**Everything else the plugin is likely to grow:** C2 (`rich_present_source`,
manual/poll refresh, `POST /cards/{id}/refresh`, `GET /cards/{id}/poll`) is
specified in CONTRACTS §4/§5 but NOT implemented in C0 — engine names it only
in a rejection message (`engine/tool.py:49-50`). That's the designed seam: the
envelope already reserves `policy`/`source`/`revision` (§1), and refresh must
respect the two immutability laws — components never change after publish,
refresh belongs to trusted chrome.

## 8. What is deliberately frozen — and how to object

**Frozen:** `docs/CONTRACTS.md` and `docs/DECISIONS.md` (header: "Status:
FROZEN 2026-09-25 for C0–C3", `CONTRACTS.md:1-4`). Also frozen in practice:
the catalog (the §0 identity table binds it — `catalogId`, the 18-type count,
wire format, engines), the record shape §1, the directive syntax, the store
layout, and the REST surface §5.

**Never edit CONTRACTS.md to make a fact true.** If a contract looks wrong:
do not touch the file — raise an objection (open an issue / tell the maintainer
lane). A change requires a NEW revision line in the file (the pattern:
"Revision line 2026-09-25c … (a)-(h), W4", each letter amending the section it
names, history never deleted — `tests/test_skill_docs.py:157-159` asserts old
revision lines survive) AND a retest of every lane that reads the changed
section. The amendment letters in place today (ids, URL categories,
normalized-bytes budget, closed meta shapes, sources-column, chart x/bins,
data-depth pin, view/components exclusivity, uPlot CSS scoping) show the
expected granularity: code probes first, wording pins the measured behavior
(e.g. (g): "11 nested lists admit, 12 reject — probe-proven; the wording pins
that behavior rather than changing code").

**Why freeze at all:** admission + store + REST on one side and the renderer on
the other only cohere because both were written against the same frozen text.
The tests encode the freeze (skill-docs gate on §2 ↔ SKILL.md; fixture-admits
gate on engine over every shipped JSON). If you can read a §-section and run
its checks, you can change the plugin safely; if a change *can't* live inside
this doc's boundaries, it's an objection, not an edit.

---

*Maintenance notes for this file:* it is documentation, outside the doc gate's
scanned list (`tests/test_skill_docs.py:174-175`) — but keep it that gate-clean
anyway: no absolute home paths, no hostnames, no author names. When you change
the lifecycle (new tool, new area, new store), update §3's diagram AND
`docs/architecture-diagram.html` in the same commit; they are twins.
