"""est-6i54 S4: version-parity grep — the type count is ONE number across catalog,
README, SKILL.md table, and the registry comment; version literals stay at parity
(release_check owns the 9-literal sweep; here we grep the count)."""
import json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails = []
def check(name, ok, detail=""):
    print(("PASS" if ok else "FAIL") + " " + name + ((" -- " + detail) if not ok and detail else ""))
    if not ok: fails.append(name)
cat = json.load(open(os.path.join(ROOT, "catalog/hermes-rich-ui.catalog.json")))
n = len(cat["components"])
readme = open(os.path.join(ROOT, "README.md")).read()
skill = open(os.path.join(ROOT, "skill/SKILL.md")).read()
idx = open(os.path.join(ROOT, "desktop/src/components/index.mjs")).read()
check("catalog ships PhaseTracker", "PhaseTracker" in cat["components"])
check(f"README heading counts {n} types", f"## The {n} types" in readme)
check(f"SKILL.md table has {n} rows", len(re.findall(r"^\| \d+ \| ", skill, re.M)) == n)
check(f"index.mjs comment says ({n} types)", f"({n} types)" in idx)
check("release_check gate present", os.path.exists(os.path.join(ROOT, "scripts/release_check.py")))
print(f"{5 - len(fails)}/5 checks, {len(fails)} FAIL")
sys.exit(1 if fails else 0)
