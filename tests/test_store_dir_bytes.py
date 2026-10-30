"""dir_bytes boundary coverage (nightly pass 2026-10-30): pins the five defensive
semantics — missing dir -> 0, empty dir -> 0, top-level regular files only,
symlinks neither followed nor counted, per-entry OSError skipped not fatal."""
import os, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import Runner, load

store = load("engine/store.py", "store")


def home(*parts):
    return Path(os.environ["HERMES_HOME"]).joinpath(*parts)


def test_missing_or_empty_dir_returns_zero():
    assert store.dir_bytes(home("absent-dir")) == 0
    d = home("empty"); d.mkdir(parents=True)
    assert store.dir_bytes(d) == 0


def test_counts_top_level_regular_files_only():
    d = home("top")
    (d / "sub").mkdir(parents=True)
    (d / "a.json").write_bytes(b"12345")
    (d / "b.json").write_bytes(b"67")
    (d / "sub" / "c.json").write_bytes(b"9" * 100)
    assert store.dir_bytes(d) == 7  # non-recursive: subdir bytes ignored


def test_symlinks_not_followed_not_counted():
    d = home("links")
    d.mkdir(parents=True)
    (d / "real.json").write_bytes(b"abcd")
    os.symlink(d / "real.json", d / "alias.json")
    os.symlink(d / "absent", d / "dangling.json")
    assert store.dir_bytes(d) == 4  # follow would give 8


def test_unreadable_entry_skipped_not_fatal():
    d = home("mixed")
    d.mkdir(parents=True)
    (d / "ok.json").write_bytes(b"xyz")
    class Hostile:  # stat path dies like a failing disk
        def is_file(self, follow_symlinks=False): raise OSError(5, "I/O error")
    class It(list):  # scandir-iterator stand-in carrying one hostile entry
        __enter__ = lambda s: s
        __exit__ = lambda s, *a: False
    entries = It(list(os.scandir(d)) + [Hostile()])
    store.os = type("OS", (), {"scandir": lambda p: entries})
    try: assert store.dir_bytes(d) == 3  # hostile skipped, scan completes
    finally: store.os = os


if __name__ == "__main__":
    r = Runner()
    for n in sorted(globals()):
        if n.startswith("test_"): r.run(globals()[n])
    r.finish()
