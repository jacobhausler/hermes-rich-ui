"""Card + view store for hermes-rich-ui (CONTRACTS §0: card store / view store).

Paths are resolved at CALL time from HERMES_HOME so tests and multi-profile hosts
never bind a stale home. Writes are atomic (tmp in the same dir + os.replace).
Ids are validated BEFORE any disk access; nothing here ever deletes.
"""
from __future__ import annotations

import fcntl
import json
import os
import re
from pathlib import Path
from typing import Optional

# REVIEW-C0 E7: matched with fullmatch — `$` would accept a trailing newline.
CARD_ID_RE = re.compile(r"ru-[0-9a-f]{12}")
VIEW_ID_RE = re.compile(r"[a-z][a-z0-9-]{0,63}")
QUOTA_BYTES = 32 * 1024 * 1024  # cards dir hard cap; refuse, never delete


class StoreError(Exception):
    """Any refusal by the store (bad id, quota, malformed record)."""


class QuotaExceeded(StoreError):
    pass


def hermes_home() -> Path:
    return Path(os.environ.get("HERMES_HOME") or (Path.home() / ".hermes"))


def root() -> Path:
    return hermes_home() / "rich-ui"


def cards_dir() -> Path:
    return root() / "cards"


def views_dir() -> Path:
    return root() / "views"


def new_card_id() -> str:
    return "ru-" + os.urandom(6).hex()


def valid_card_id(card_id) -> bool:
    return isinstance(card_id, str) and CARD_ID_RE.fullmatch(card_id) is not None


def valid_view_id(view_id) -> bool:
    return isinstance(view_id, str) and VIEW_ID_RE.fullmatch(view_id) is not None


def _atomic_write(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + "." + str(os.getpid()) + "." + os.urandom(3).hex() + ".tmp")
    try:
        with open(tmp, "wb") as fh:
            fh.write(payload)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def dir_bytes(path: Path) -> int:
    total = 0
    try:
        with os.scandir(path) as it:
            for entry in it:
                try:
                    if entry.is_file(follow_symlinks=False):
                        total += entry.stat(follow_symlinks=False).st_size
                except OSError:
                    continue
    except FileNotFoundError:
        return 0
    return total


def card_count() -> int:
    try:
        return sum(1 for p in cards_dir().iterdir()
                   if p.suffix == ".json" and valid_card_id(p.stem))
    except FileNotFoundError:
        return 0


def _card_path(card_id: str) -> Path:
    if not valid_card_id(card_id):
        raise StoreError("invalid card_id %r (expected ru-<12 hex>)" % (card_id,))
    return cards_dir() / (card_id + ".json")


def _lockfile_path() -> Path:
    # Deliberately OUTSIDE cards_dir() so dir_bytes() never counts the lock file.
    return root() / "cards.lock"


def _acquire_store_lock():
    """Exclusive cross-process lock around the quota check + commit (#54).
    Returns the open fd; closing it releases the flock. stdlib-only (law 2)."""
    lock_path = _lockfile_path()
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(lock_path), os.O_RDWR | os.O_CREAT, 0o644)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
    except BaseException:
        os.close(fd)
        raise
    return fd


def write_card(record: dict) -> Path:
    """Atomically persist a §1 record under cards/<card_id>.json.

    Raises StoreError on a bad id / shape and QuotaExceeded when the cards dir is
    already at or would exceed QUOTA_BYTES. The existing files are never touched.
    Measurement, admission, and commit run under one exclusive store lock so two
    concurrent writers can never both pass the quota check on the same free space.
    """
    if not isinstance(record, dict):
        raise StoreError("record must be an object")
    card_id = ((record.get("envelope") or {}).get("card_id")) if isinstance(record.get("envelope"), dict) else None
    path = _card_path(card_id)
    payload = json.dumps(record, ensure_ascii=False, indent=2, sort_keys=False).encode("utf-8")
    fd = _acquire_store_lock()
    try:
        used = dir_bytes(cards_dir())
        if used + len(payload) > QUOTA_BYTES:
            raise QuotaExceeded(
                "card store quota exceeded: %s holds %d bytes, cap %d bytes; this card is %d bytes. "
                "Nothing was written and nothing is deleted automatically — remove old cards by hand."
                % (cards_dir(), used, QUOTA_BYTES, len(payload)))
        _atomic_write(path, payload)
    finally:
        os.close(fd)  # dropping the fd releases the flock, even on failure paths
    return path


def read_card(card_id) -> Optional[dict]:
    """Validate the id BEFORE touching disk; None when absent or unreadable."""
    if not valid_card_id(card_id):
        return None
    path = cards_dir() / (card_id + ".json")
    try:
        with open(path, "rb") as fh:
            rec = json.loads(fh.read().decode("utf-8"))
    except (OSError, ValueError):
        return None
    return rec if isinstance(rec, dict) else None


def save_view(view_id, title, components) -> Path:
    if not valid_view_id(view_id):
        raise StoreError("invalid view id %r (expected ^[a-z][a-z0-9-]{0,63}$)" % (view_id,))
    if not isinstance(components, list):
        raise StoreError("view components must be a list")
    payload = json.dumps({"view_id": view_id, "title": title, "components": components},
                         ensure_ascii=False, indent=2).encode("utf-8")
    path = views_dir() / (view_id + ".json")
    _atomic_write(path, payload)
    return path


def list_views() -> list[dict]:
    """Saved ids/titles in stable order; skip malformed files and never create the store."""
    try:
        paths = sorted(views_dir().iterdir())
    except FileNotFoundError:
        return []
    views = []
    for path in paths:
        if path.suffix != ".json" or not valid_view_id(path.stem) or path.is_symlink() or not path.is_file():
            continue
        view = load_view(path.stem)
        if view is not None and view.get("view_id") == path.stem:
            views.append({"view_id": path.stem, "title": view.get("title")})
    return views


def load_view(view_id) -> Optional[dict]:
    """{view_id, title, components} or None (bad id, absent, malformed)."""
    if not valid_view_id(view_id):
        return None
    path = views_dir() / (view_id + ".json")
    try:
        with open(path, "rb") as fh:
            rec = json.loads(fh.read().decode("utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(rec, dict) or not isinstance(rec.get("components"), list):
        return None
    return rec
