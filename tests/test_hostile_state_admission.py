"""est-6i54 S4: hostile admission for the #57 additive surface (Checklist item
state/note, PhaseTracker stages). Unknown state REJECTED naming the five tokens
(the #38 discipline); caps enforced; inputs byte-stable (helpers.rejects pins it)."""
from helpers.admit import check, rejects, admits, finish

DM = {"data": {}, "meta": {"title": "t", "summary": "s", "sources": [], "derivations": []}}
def cl(items):
    return [{"id": "root", "component": "Checklist", "items": items}]
def pt(stages):
    return [{"id": "root", "component": "PhaseTracker", "stages": stages}]

admits("S4: checklist state+note form admits", cl([{"label": "a", "state": "blocked", "note": "x" * 60}]), DM)
rejects("S4: checklist note over 512 rejected", cl([{"label": "a", "done": True, "note": "n" * 600}]), DM, needle="note")
rejects("S4: checklist item unknown state rejected", cl([{"label": "a", "state": "exploded"}]), DM, needle="state")

admits("S4: phasetracker minimal admits", pt([{"label": "a", "state": "pending"}]), DM)
rejects("S4: phasetracker unknown state rejected naming the five tokens", pt([{"label": "a", "state": "__proto__"}]), DM, needle="__proto__")
rejects("S4: phasetracker stage missing state rejected", pt([{"label": "a"}]), DM, needle="state")
rejects("S4: phasetracker >12 stages rejected", pt([{"label": str(i), "state": "pending"} for i in range(13)]), DM, needle="stages")
rejects("S4: phasetracker owner over cap rejected", pt([{"label": "a", "state": "active", "owner": "o" * 200}]), DM, needle="owner")

from engine.admission import admit
errs, _ = admit(pt([{"label": "a", "state": "nope"}]), DM)
joined = " ".join(errs).lower()
check("S4: rejection names the five tokens", bool(errs) and all(tok in joined for tok in ("pending", "active", "done", "blocked", "skipped")), errs[:3])
finish()
