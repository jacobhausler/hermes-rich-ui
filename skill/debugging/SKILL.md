---
name: rich-ui-debugging
description: "Use when a card is rejected, blank, or mis-rendered. Symptom -> where to look -> exact command, every command real."
version: 0.1.0
metadata:
  hermes:
    tags: [debugging, cards, charts, rest, gateway]
---

# Debugging hermes-rich-ui — card lifecycle failure map

The lifecycle: agent calls `rich_present` → admission (engine/admission.py) → card
store (`$HERMES_HOME/rich-ui/cards/<card_id>.json`) → reply carries
`::richui{id="ru-<12hex>"}` → desktop directive area (desktop/plugin.js) fetches
`/api/plugins/hermes-rich-ui/cards/<id>` via the SDK rest channel → lowered + rendered.
Walk it in order; each symptom below names the segment. Always re-run the merge gate
after any fix: `python3 scripts/suite.py . out` → `TOTAL N FAIL 0`.

## Card rejected (tool call never produces a card)

- Error shape: `rich_present` NEVER raises — every failure is `{"ok": false, "errors":
  ["<component id or /path>: <reason>", ...]}` (engine/tool.py `_fail`). Read the
  prefix: before the colon it names the component id or data path the fix belongs to.
  Author-side repair etiquette lives in `skill/SKILL.md`.
- Exact commands:
  ```sh
  python3 tests/test_admission.py        # engine itself (negative controls included)
  python3 tests/test_fixtures_admit.py   # every shipped fixture/example/recipe ADMITS
  ```
  If real-world input rejects but both are green, the caller's payload is wrong or the
  three sources of truth have drifted — see catalog mismatch next.
- Catalog mismatch triage: admission runs a mini-schema interpreter over
  `catalog/hermes-rich-ui.catalog.json` (engine/admission.py `load_catalog`) — the
  SINGLE source of truth; `docs/CONTRACTS.md` §2 is its frozen prose mirror and the
  tool schema in `__init__.py` restates prop shapes. A prop that works on the desktop
  but rejects at admission (or vice versa) means one of the three drifted. Command:
  ```sh
  python3 tests/test_skill_docs.py       # CONTRACTS §2 table vs skill/SKILL.md, 18 types
  grep -n '"<Type>"' catalog/hermes-rich-ui.catalog.json   # what admission actually enforces
  ```
  Fix the drifting side toward the catalog file, never the other way; contracts changes
  need a revision line, not an edit.

## Blank card in the transcript (directive visible, no card)

Check in this order — first hit is usually the answer:

1. Committed bundle != fresh build (someone edited `desktop/src/**` without rebuilding):
   ```sh
   node scripts/build.mjs
   git diff --exit-code desktop/plugin.js    # non-zero = committed bundle is stale; commit the rebuild
   sha256sum -c desktop/plugin.js.sha256     # expected: desktop/plugin.js: OK
   ```
   On an app machine instead: reinstall `desktop/plugin.js` into
   `~/.hermes/desktop-plugins/hermes-rich-ui/` and flip the plugin toggle, reload.
2. Directive text off-spec: the line must be exactly `::richui{id="ru-xxxxxxxxxxxx"}`
   — `ru-` + 12 lowercase hex (card.mjs `ID_RE`). A mangled/prefixed/backticked
   directive renders as literal text: the agent did not paste it verbatim.
   The card file proves the gateway side: `ls "$HERMES_HOME/rich-ui/cards/"`.
3. Card exists but renderer errors: if the transcript shows literal `::richui{...}`
   text and the Capabilities list lacks hermes-rich-ui, the desktop half is missing
   (INSTALL.md negative control). Fetch the card directly — `{ok:true,card:...}`
   means store/gateway fine, renderer is the suspect.
4. CSS var names: renderer paints ONLY with `--ui-*` vars (`--ui-text-primary`,
   `--ui-text-secondary`, `--ui-text-tertiary`, `--ui-stroke-secondary`,
   `--ui-stroke-tertiary`, `--ui-bg-elevated`, `--ui-bg-tertiary`, `--ui-accent`,
   `--ui-green`, `--ui-red`, `--ui-yellow`, `--ui-purple`, `--ui-orange`).
   A typo'd or invented var resolves to empty → invisible text on invisible chrome:
   looks blank, isn't. `grep -rn 'var(--' desktop/src/ | sort -u` — every hit must be
   in that list.

## Chart artifacts (legend rows, ': --' junk, missing series)

- uPlot legend law, pinned by tests: options carry `legend: { show: true, live: false }`
  (desktop/src/components/chart.mjs `buildOpts`). `live:false` is what drops the
  x-readout row and the `": --"` hover artifacts — flipping it to `true` or deleting it
  from a diff is a regression.
- Never hide legend rows in CSS (no `.u-legend .u-series:first-child{display:none}`):
  with live:false that rule silently eats series 1. Proven by
  `node --test tests/test_chart.mjs` (asserts both the absence of the first-child rule
  and live:false).
- uPlot class CSS must stay scoped under `[data-richui="chart-canvas"]` and injected
  once per document (`style[data-richui-uplot-css]` in head) — unscoped selectors leak
  into other charts; a re-injected stylesheet flickers.
- Bar/histogram category labels: rotated at -35 deg for long labels; if labels overlap
  again, the rotate path in chart.mjs was touched — re-run the chart tests before bisecting further.

## Styles missing / class-y look

- Tailwind purge law: the desktop app's Tailwind build is purged — utility classes you
  "know exist" DO NOT exist in the app CSS (AGENTS.md law 4; CONTRACTS §6). Renderer
  styling is inline `style` + `--ui-*` vars only.
- Symptom: correct structure, browser-default look (raw table, no gaps/colors). Cause:
  someone shipped `class="..."` utilities or a `<style>` block relying on app CSS.
  `grep -rn "className" desktop/src/` must print nothing.
- Fix = inline styles on `--ui-*` vars, rebuild, run the desktop blast gates.

## Stale gateway (REST answers an old shape / route 404 / no new card route)

- Plugin REST routes mount ONLY at `hermes serve` start: the serve log must carry
  `Mounted plugin API routes: /api/plugins/hermes-rich-ui/` (INSTALL.md proof line).
  If the log lacks it after a backend edit, the running gateway is stale — restart
  `hermes serve`; a 404 with no mount line = never mounted, not a code bug.
- Proof of life after restart:
  `curl -s http://<gateway>/api/plugins/hermes-rich-ui/health` → `{ok:true,cards:...,version:...}`
  (`version` drift = old code still running → stale gateway again, or version parity broken).

## REST 401 on the card fetch

- The desktop fetches `/cards/<id>` through the SDK rest channel
  (desktop/src/index.mjs: `setRest((path, opts) => ctx.rest(path, opts))`) — the session
  token gate lives in the SDK/host there, not in this repo: `dashboard/plugin_api.py`
  itself only ever returns 200 or 404.
- A 401 therefore proves: the route is mounted and the host answered; the session
  credential on the SDK channel was missing/expired. Fix = reload/re-login the desktop
  app session — do NOT go hunting in plugin code.
- What a 401 does NOT prove: plugin not installed (that's literal `::richui` text +
  absent Capabilities entry), card store broken (that's `{ok:false,error:"not found"}`
  / 404), renderer bug (that's a fetch that succeeds and paints wrong).
- Card id sanity before anything: `ru-[0-9a-f]{12}` exactly (store.py `CARD_ID_RE`,
  card.mjs `ID_RE`); the renderer short-circuits invalid ids to an inline error.

## Pitfalls

- Debugging the desktop for a gateway problem or vice versa: run the health curl and
  check the Capabilities list FIRST — the two halves fail differently (INSTALL.md
  negative control), and the wrong half's logs burn the whole session.
- "Fixing" admission by widening the catalog to admit a failing payload: the catalog is
  the contract; the payload is wrong until proven otherwise (test_fixtures_admit green
  means the engine agrees with every shipped example).
