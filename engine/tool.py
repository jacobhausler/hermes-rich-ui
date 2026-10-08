"""`rich_present` — CONTRACTS §4: build a §1 record, admit it, persist it.

The handler NEVER raises: every failure is {ok: False, errors: [...]} and nothing
is written before admission passes. Sibling modules (store, admission) are bound
by PATH via importlib (the hermes-workflows pattern) so another plugin's `engine`
package can never shadow ours. Tests monkeypatch the module-level `admit`.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
_TAG = hashlib.sha256(str(HERE).encode("utf-8")).hexdigest()[:16]


def _sibling(name):
    """Load engine/<name>.py by path under a root-unique module name (cached)."""
    key = "_hermes_rich_ui_%s_%s" % (name, _TAG)
    mod = sys.modules.get(key)
    if mod is not None:
        return mod
    spec = importlib.util.spec_from_file_location(key, HERE / (name + ".py"))
    if spec is None or spec.loader is None:
        raise ImportError("cannot load %s from %s" % (name, HERE))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[key] = mod
    try:
        spec.loader.exec_module(mod)
    except Exception:
        sys.modules.pop(key, None)
        raise
    return mod


LOG = logging.getLogger("hermes_rich_ui")

store = _sibling("store")
_admission = _sibling("admission")
admit = _admission.admit          # tests monkeypatch tool.admit
CATALOG_ID = _admission.CATALOG_ID

SOURCE_ONLY_ARGS = ("source_id", "mode", "poll_ms", "update_until")
SURFACE_VERSION = "v1.0"
POLICY = "embedded"


def _now_z() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def directive(card_id: str) -> str:
    return '::richui{id="%s"}' % card_id


# The core labels an unnamed home "custom" (and ~/.hermes "default"); neither is an attribution.
_CORE_SENTINELS = ("custom", "default")


def _env_pin():
    for key in ("HERMES_PROFILE_NAME", "HERMES_PROFILE"):
        name = (os.environ.get(key) or "").strip()
        if name:
            return name
    return None


def _profile_name():
    """Prefer task-scoped core identity; older cores fall back to launcher pins/home.

    Never invent attribution: a core sentinel survives only when a launcher explicitly
    pinned that same name (and no task-scoped home override is bound).
    """
    try:
        from hermes_cli.profiles import current_profile_name
    except ImportError:
        pass
    else:
        name = current_profile_name(default=None)
        if name not in _CORE_SENTINELS:
            return name
        try:
            from hermes_constants import get_hermes_home_override
            overridden = get_hermes_home_override() is not None
        except ImportError:
            overridden = False
        return name if not overridden and _env_pin() == name else None
    name = _env_pin()
    if name:
        return name
    home = store.hermes_home()
    return home.name if home.parent.name == "profiles" else None


def build_record(card_id, title, summary, components, data, sources, derivations, now=None):
    """The §1 record, key order exactly as the contract lists it."""
    now = now or _now_z()
    data_model = {
        "data": data,
        "meta": {
            "title": title,
            "summary": summary,
            "authored_at": now,
            "dataset": {"id": "card:" + card_id, "revision": 1,
                        "observed_at": None, "published_at": now},
            "sources": sources,
            "derivations": derivations,
        },
    }
    record = {
        "envelope": {
            "card_id": card_id,
            "session_id": os.environ.get("HERMES_SESSION_ID") or None,
            "profile": _profile_name(),
            "created_at": now,
            "policy": POLICY,
            "source": None,
            "revision": 1,
        },
        "surface": {
            "version": SURFACE_VERSION,
            "createSurface": {
                "surfaceId": card_id,
                "catalogId": CATALOG_ID,
                "components": components,
                "dataModel": data_model,
                "metadata": {"extensions": {"hermes_policy": POLICY}},
            },
        },
    }
    # §1 has no `title` key on createSurface: the title is the root Card's `title`
    # prop (agent-authored) and is persisted with the view when save_view_as is set.
    return record, data_model


def _fail(*errors):
    return {"ok": False, "errors": [str(e) for e in errors]}


def _present(args):
    if not isinstance(args, dict):
        return _fail("args: must be an object")
    bad = [k for k in SOURCE_ONLY_ARGS if k in args]
    if bad:
        return _fail("%s: not accepted by rich_present — this build publishes embedded snapshots "
                     "only; source-backed publication and polling refresh (source_id/mode/poll_ms/"
                     "update_until) are not implemented. To present this data now, fetch it with "
                     "available tools and pass it to `rich_present` as an embedded snapshot "
                     "(components + data)." % (", ".join(bad),))

    title = args.get("title")
    components = args.get("components")
    view_id = args.get("view")
    if view_id is not None and components is not None:
        # REVIEW-C0 E10: never silently pick one.
        return _fail("/: give view OR components, not both")
    if view_id is not None:
        if not store.valid_view_id(view_id):
            return _fail("view: invalid view id %r (expected ^[a-z][a-z0-9-]{0,63}$)" % (view_id,))
        view = store.load_view(view_id)
        if view is None:
            return _fail("view: no saved view named %r" % (view_id,))
        components = view["components"]
        if title is None:
            title = view.get("title")

    errors = []
    if not isinstance(title, str) or not title.strip():
        errors.append("title: required non-empty string")
    summary = args.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        errors.append("summary: required non-empty string (plain-text fallback for the card)")
    if not isinstance(components, list) or not components:
        errors.append("components: required non-empty array of A2UI components (one with id \"root\")")
    data = args.get("data", {})
    if data is None:
        data = {}
    if not isinstance(data, dict):
        errors.append("data: must be an object (bound via {\"path\": \"/data/...\"})")
    sources = args.get("sources", [])
    if sources is None:
        sources = []
    if not isinstance(sources, list):
        errors.append("sources: must be an array")
    derivations = args.get("derivations", [])
    if derivations is None:
        derivations = []
    if not isinstance(derivations, list):
        errors.append("derivations: must be an array")
    save_as = args.get("save_view_as")
    if save_as is not None and not store.valid_view_id(save_as):
        errors.append("save_view_as: invalid view id %r (expected ^[a-z][a-z0-9-]{0,63}$)" % (save_as,))
    if errors:
        return _fail(*errors)

    card_id = store.new_card_id()
    record, data_model = build_record(card_id, title, summary, components, data, sources, derivations)

    result = admit(components, data_model)
    try:
        adm_errors, normalized = result
    except (TypeError, ValueError):
        return _fail("admission: returned an unexpected shape %r" % (type(result).__name__,))
    if adm_errors:
        return {"ok": False, "errors": [str(e) for e in adm_errors]}
    if isinstance(normalized, list):
        record["surface"]["createSurface"]["components"] = normalized

    try:
        store.write_card(record)
    except store.StoreError as e:
        return _fail("store: %s" % e)
    warnings = []
    if save_as is not None:
        try:
            if store.load_view(save_as) is not None:
                # REVIEW-C0 E10: overwriting an existing view is allowed but never silent.
                warnings.append("view '%s' overwritten" % save_as)
            store.save_view(save_as, title, record["surface"]["createSurface"]["components"])
        except store.StoreError as e:
            warnings.append("save_view_as: card published but view not saved: %s" % e)
        except OSError as e:
            # #55: past the card commit the publication boundary is crossed — an
            # expected filesystem failure (PermissionError, FileExistsError, ...)
            # must not hide the receipt. Class name only in the warning: str(e)
            # embeds host paths (CONTRIBUTING 'Boundaries that never move'); the
            # detail goes to the log, never to the response (REVIEW-C0 E2).
            LOG.warning("save_view_as: card published but view not saved", exc_info=True)
            warnings.append("save_view_as: card published but view not saved: filesystem error %s"
                            % type(e).__name__)
    return {"ok": True, "card_id": card_id, "directive": directive(card_id),
            "summary": summary, "warnings": warnings}


INTERNAL_ERROR = "/: admission failed (internal)"


def rich_present(args) -> dict:
    """Never raises. REVIEW-C0 E2: an internal exception is logged, never returned —
    the §4 shape is {ok, errors} with no trace and no exception text."""
    try:
        return _present(args)
    except Exception:  # noqa: BLE001 — the contract is a typed error, never a trace
        LOG.exception("rich_present: internal failure")
        return {"ok": False, "errors": [INTERNAL_ERROR]}


def handle_present(args, **kwargs) -> str:
    try:
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except ValueError as e:
                return json.dumps({"ok": False, "errors": ["args: not valid JSON: %s" % e]})
        return json.dumps(rich_present(args), ensure_ascii=False, default=str)
    except Exception:  # noqa: BLE001
        LOG.exception("handle_present: internal failure")
        return json.dumps({"ok": False, "errors": [INTERNAL_ERROR]})
