#!/usr/bin/env python3
"""Serial bounded test suite: per-case logs + atomic exits.json ledger.

Usage: python3 scripts/suite.py <plugin-root> <out-dir>
Runs tests/test_*.py under the current python and tests/test_*.mjs under node,
one at a time, 90 s wall each, HERMES_HOME pointed at a throwaway suite home so
no test touches the real ~/.hermes. Prints `<name>: <exit>` per case and
`TOTAL N FAIL M`; exit 1 if any case failed. This IS the merge gate — run it in
the background from the integrator, never inside a lane.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
out.mkdir(parents=True, exist_ok=True)
ledger = out / 'exits.json'
rows = []  # fresh ledger every run — an append-only ledger kept a stale FAIL alive across re-runs (2026-09-25)
py = sorted((root / 'tests').glob('test_*.py'))
js = sorted((root / 'tests').glob('test_*.mjs'))
cases = [[sys.executable, str(p)] for p in py] + [['node', '--experimental-strip-types', str(p)] for p in js]
for argv in cases:
    name = Path(argv[-1]).name
    log = out / (name + '.log')
    try:
        with log.open('w') as fh:
            result = subprocess.run(argv, cwd=root,
                                    env={**os.environ, 'HERMES_HOME': str(root / 'tests' / '.suite-home')},
                                    stdout=fh, stderr=subprocess.STDOUT, timeout=90)
        rc = result.returncode
    except subprocess.TimeoutExpired:
        rc = 124
    except Exception as exc:
        log.write_text(f'{type(exc).__name__}: {exc}\n')
        rc = 125
    rows.append({'test': name, 'exit': rc, 'log': str(log)})
    tmp = ledger.with_suffix('.tmp')
    tmp.write_text(json.dumps(rows, indent=2) + '\n')
    os.replace(tmp, ledger)
    print(f'{name}: {rc}', flush=True)
print(f'TOTAL {len(rows)} FAIL {sum(row["exit"] != 0 for row in rows)}', flush=True)
raise SystemExit(1 if any(row['exit'] != 0 for row in rows) else 0)
