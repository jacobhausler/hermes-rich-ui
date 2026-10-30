"""dir_bytes boundary coverage: missing/empty -> 0; flat-only (no recursion);
symlinks neither followed nor counted; OSError(EIO) entries skipped (mock sim,
precedent test_store_views.py). Carrier bead est-bn9lo. Run: python3 tests/test_store_dir_bytes.py (exit 0 = green)."""
import os
import shutil
import sys
import tempfile
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import load  # noqa: E402

store = load("engine/store.py", "store"); RESULTS = []


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond)))
    print("%s %s%s" % ("PASS" if cond else "FAIL", name, (" -- " + str(detail)) if (detail and not cond) else ""))


def mk(p, n): p.write_bytes(b"x" * n)


def entry(is_file_exc=None, stat_exc=None, size=0):
    e = mock.Mock()
    e.is_file = mock.Mock(return_value=True, side_effect=is_file_exc)
    e.stat = mock.Mock(return_value=mock.Mock(st_size=size), side_effect=stat_exc)
    return e


def scanned(entries):
    cm = mock.MagicMock()
    cm.__enter__.return_value = iter(entries)
    return mock.patch.object(os, "scandir", return_value=cm)


root = Path(tempfile.mkdtemp(prefix="richui-dirbytes-"))
try:
    check("missing dir -> 0 (FileNotFoundError catch)", store.dir_bytes(root / "nope") == 0)
    (root / "empty").mkdir(); check("empty dir -> 0", store.dir_bytes(root / "empty") == 0)
    flat = root / "flat"; flat.mkdir(); mk(flat / "a.txt", 10); mk(flat / "b.json", 20)
    check("flat a.txt(10)+b.json(20) -> 30", store.dir_bytes(flat) == 30)
    (flat / "sub").mkdir(); mk(flat / "sub" / "big.bin", 999)
    check("sub/big.bin(999) NOT recursed: still 30", store.dir_bytes(flat) == 30)
    links = root / "links"; links.mkdir(); mk(root / "target.bin", 500)
    os.symlink(root / "target.bin", links / "link.bin"); os.symlink(root / "gone.bin", links / "dangling.bin")
    check("symlink(500B target)+dangling -> 0 (neither followed nor counted)", store.dir_bytes(links) == 0)
    eio = OSError(5, "I/O error")
    with scanned([entry(is_file_exc=eio), entry(size=40), entry(size=60)]):
        got = store.dir_bytes(root)
    check("is_file() OSError(EIO) skipped, healthy files still sum 100", got == 100, got)
    with scanned([entry(size=40), entry(stat_exc=eio), entry(size=60)]):
        got = store.dir_bytes(root)
    check("stat() OSError(EIO) skipped, healthy files still sum 100", got == 100, got)
finally:
    shutil.rmtree(root, ignore_errors=True)
failed = [n for n, ok in RESULTS if not ok]; print("---")
print("%d checks, %d failed" % (len(RESULTS), len(failed)))
sys.exit(1 if failed else 0)
