# Install

hermes-rich-ui has two halves on two machines. Both are required for cards to
render; each is harmless alone (see Negative control).

## Half 1 — gateway (the machine running `hermes serve`)

Copy the gateway half into the Hermes plugins dir:

```
cp -r dashboard/ engine/ catalog/ skill/ ~/.hermes/plugins/hermes-rich-ui/
```

(From a checkout: copy the plugin's `dashboard/`, `engine/`, `catalog/`, and
`skill/` into `~/.hermes/plugins/hermes-rich-ui/` keeping the layout the repo has.)

Enable it in `~/.hermes/config.yaml`:

```yaml
plugins:
  enabled:
    - hermes-rich-ui
```

Restart the gateway:

```
hermes serve
```

**Proof line** — the serve log must contain:

```
Mounted plugin API routes: /api/plugins/hermes-rich-ui/
```

Then `curl -s http://<gateway>/api/plugins/hermes-rich-ui/health` should return
`{ok:true, cards:..., version:...}`.

## Half 2 — desktop (the APP machine, where the Hermes desktop runs)

Install the ONE bundled ESM file — there is no build step on the app machine:

```
mkdir -p ~/.hermes/desktop-plugins/hermes-rich-ui
cp desktop/plugin.js ~/.hermes/desktop-plugins/hermes-rich-ui/plugin.js
```

Verify the bundle is intact against the shipped checksum:

```
sha256sum -c desktop/plugin.js.sha256    # Linux  (macOS: shasum -a 256 -c)
```

(expected: `desktop/plugin.js: OK`)

Then in the desktop app open Settings → Plugins (Capabilities), find
**hermes-rich-ui**, and flip its toggle on. Reload the app.

## Negative control — when only one half is installed

- **Gateway only, no desktop half:** `rich_present` works and returns a card_id and
  directive; the agent reply contains the `::richui{id="ru-..."}` line but the
  transcript shows it as plain literal text — no card appears, and the desktop
  plugins settings never list hermes-rich-ui. The REST health route still answers;
  that proves the gateway half is fine and the desktop half is missing.
- **Desktop half only, no gateway:** hermes-rich-ui appears in the Capabilities
  list, but no `rich_present` tool is offered to agents; any `::richui{id="..."}`
  directive pasted into a reply renders an error/unavailable placeholder (the
  card fetch from `/api/plugins/hermes-rich-ui/cards/<id>` fails), and the serve
  log has NO `Mounted plugin API routes: /api/plugins/hermes-rich-ui/` line.
  That proves the renderer is fine and the gateway half is missing.

If both proof lines are present and cards still don't render, check the desktop
plugin toggle and reload the app window.
