#!/usr/bin/env python3
"""release-merge gate behavior — the release lane's merge step is GATED on a
peer receipt at the exact head (ported from the sibling hermes-workflows
est-clrlx gate + its behavior test; the v0.1.6 release merge of THIS repo ran
that copy from that checkout, so this repo ships its own).

RED-class pin: without scripts/release_merge_gate.py a release lane can merge
on green CI alone, which is exactly the incident that wrote the law (the
release PR was PUT-merged on state/head/mergeable + green shards while the
independent deep peer lane was still in flight; the verdict arrived after the
merge, explicitly retrospective).

Pinned law (scripts/release_merge_gate.py), against a STATEFUL fake GitHub —
the network never runs, the transport seam IS the fake. Every identifier below
is synthetic: repo `octo/widgets`, PR 4242, made-up 40-hex shas, placeholder
bot names (author stamp `widgets-bot`, peer reviewer `octo-bot`).
  T1  POSITIVE: open PR at head H, author stamp bot-id=widgets-bot, newest
      marker `reviewed=H verdict=merge reviewer=octo-bot` -> the squash PUT
      issues ONCE, read-back verifies, the verdict dict carries sha+marker
      provenance.
  T2  NEGATIVE (the incident shape): NO marker anywhere -> refuse
      no-peer-marker, ZERO writes attempted.
  T3  push-after-stamp: marker at the old head, PR now at H -> refuse
      marker-stale-head ("merge never carries to a new head").
  T4  PEER LAW: reviewer == author bot-id -> refuse self-review; no author
      stamp and no --owner-bot -> refuse author-unknown (fail-closed).
  T5  verdict=pending (deep lane mid-flight) -> refuse verdict-pending.
  T6  HEAD contract: PR head moved off --head -> refuse head-moved BEFORE any
      marker census (a fresh review must answer the CURRENT head).
  T7  newest marker rules: an old verdict=merge superseded by a newer
      verdict=changes -> refuse verdict-changes (never the stale seal).
  T8  merge write answered OK but the read-back disproves it -> merged False,
      reason read-back-unverified (loud, never silent).
  T9  every call rides the ONE token; the verdict dict prints no credential.
Stdlib only; python 3.9 safe (AGENTS.md law 2).

Run: python3 tests/test_release_merge_gate.py   (exit 0 = green)
"""
import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "release_merge_gate.py"

spec = importlib.util.spec_from_file_location("_release_merge_gate", SCRIPT)
fails = 0


def check(label, cond, detail: object = ""):
    global fails
    print(("PASS " if cond else "FAIL ") + label +
          (f"  {str(detail)[:400]}" if detail and not cond else ""))
    if not cond:
        fails += 1


if spec is None:
    check("scripts/release_merge_gate.py exists", False, str(SCRIPT))
    print("DONE release_merge_gate FAIL")
    sys.exit(1)
mod = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(mod)
except Exception as exc:
    check("module loads", False, f"{type(exc).__name__}: {exc}")
    print("DONE release_merge_gate FAIL")
    sys.exit(1)

REPO = "octo/widgets"
PR = 4242
HEAD = "9f3c1d2be45a7680c1d2e3f405162738495a6b7c"      # the reviewed head
OLD = "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d"        # pre-push head
MERGE_SHA = "d4c3b2a1f0e9d8c7b6a594837261504f3e2d1c0b"
AUTHOR_BODY = "release: v0.1.7\n\n<!-- repo-admin bot-id=widgets-bot -->"


def marker(sha, verdict, reviewer, ts, profile="bot"):
    return (f"findings...\n<!-- repo-admin reviewed={sha} verdict={verdict} "
            f"profile={profile} reviewer={reviewer} -->")


class FakeGitHub:
    """Stateful transport: the PR, its comments and reviews, and the merge
    shelf. `merge_lies=True` accepts the PUT but the read-back stays unmerged
    (models a lost write). Writes are recorded — the gate must never write on
    a refusal."""

    def __init__(self, head=HEAD, state="open", body=AUTHOR_BODY,
                 comments=(), reviews=(), merged=False, merge_lies=False):
        self.calls = []
        self.pr = {"state": state, "head": {"sha": head}, "body": body,
                   "user": {"login": "octocat"},
                   "merged": merged, "merge_commit_sha": MERGE_SHA if merged else ""}
        self.comments = list(comments)    # [{body, updated_at|created_at}]
        self.reviews = list(reviews)      # [{body, submitted_at}]
        self.merge_lies = merge_lies

    def __call__(self, method, url, body, token):
        self.calls.append((method, url, body, token))
        p = url.replace(mod.API, "")
        base = f"/repos/{REPO}"
        if method == "GET" and p == f"{base}/pulls/{PR}":
            return 200, dict(self.pr)
        if method == "GET" and p.startswith(f"{base}/issues/{PR}/comments"):
            return 200, list(self.comments)
        if method == "GET" and p.startswith(f"{base}/pulls/{PR}/reviews"):
            return 200, list(self.reviews)
        if method == "PUT" and p == f"{base}/pulls/{PR}/merge":
            if not self.merge_lies:
                self.pr["merged"] = True
                self.pr["merge_commit_sha"] = MERGE_SHA
            return 200, {"sha": MERGE_SHA, "merged": True,
                         "message": "Pull request successfully merged"}
        raise AssertionError(f"unexpected call {method} {url}")

    def writes(self):
        return [c for c in self.calls if c[0] in ("PUT", "POST", "PATCH", "DELETE")]

    def merges(self):
        return [c for c in self.calls if c[0] == "PUT" and c[1].endswith("/merge")]


SEAL = ({"body": marker(HEAD, "merge", "octo-bot", "2026-10-25T19:59:00Z")},)

# ---- T1 POSITIVE: receipt at the exact head by a non-author -> merge issues
g = FakeGitHub(comments=SEAL)
out = mod.gate(REPO, PR, HEAD, token="t0ken", transport=g)
check("T1 peer receipt at exact head: merged=True with verified sha+marker",
      out.get("merged") is True and out.get("sha") == MERGE_SHA
      and out.get("marker", {}).get("reviewer") == "octo-bot"
      and out.get("author_bot") == "widgets-bot", out)
check("T1 the squash PUT issued exactly once, method=squash",
      len(g.merges()) == 1 and g.merges()[0][2] == {"merge_method": "squash"},
      g.merges())
check("T1 merge is PROVEN by read-back (final GET shows merged + same sha)",
      g.calls[-1][0] == "GET" and g.calls[-1][1].endswith(f"/pulls/{PR}")
      and g.pr["merged"] is True and out.get("sha") == g.pr["merge_commit_sha"],
      g.calls[-1])

# ---- T2 NEGATIVE (the incident shape): no marker at all -> refuse, zero writes
g2 = FakeGitHub()
out2 = mod.gate(REPO, PR, HEAD, token="t0ken", transport=g2)
check("T2 no receipt -> refuse no-peer-marker, ZERO writes attempted",
      out2.get("merged") is False and out2.get("reason") == "no-peer-marker"
      and g2.writes() == [], (out2, g2.writes()))

# ---- T3 push-after-stamp: seal sits at the OLD head -> refuse
g3 = FakeGitHub(comments=({"body": marker(OLD, "merge", "octo-bot",
                                          "2026-10-25T19:40:00Z")},))
out3 = mod.gate(REPO, PR, HEAD, token="t0ken", transport=g3)
check("T3 seal at a superseded head -> refuse marker-stale-head (never carries)",
      out3.get("merged") is False and out3.get("reason") == "marker-stale-head"
      and g3.writes() == [], (out3, g3.writes()))

# ---- T4 PEER LAW: reviewer == author stamp; and fail-closed when unknown
g4 = FakeGitHub(comments=({"body": marker(HEAD, "merge", "widgets-bot",
                                          "2026-10-25T19:59:00Z")},))
out4 = mod.gate(REPO, PR, HEAD, token="t0ken", transport=g4)
check("T4 reviewer == author bot-id -> refuse self-review",
      out4.get("merged") is False and out4.get("reason") == "self-review"
      and g4.writes() == [], (out4, g4.writes()))
g4b = FakeGitHub(body="release with no bot-id stamp",
                 comments=SEAL)
out4b = mod.gate(REPO, PR, HEAD, token="t0ken", transport=g4b)
out4c = mod.gate(REPO, PR, HEAD, owner_bot="widgets-bot", token="t0ken",
                 transport=FakeGitHub(body="release with no bot-id stamp",
                                      comments=SEAL))
check("T4 no author stamp -> refuse author-unknown (fail-closed); "
      "--owner-bot fallback resolves the same verdict",
      out4b.get("reason") == "author-unknown"
      and out4c.get("merged") is True and out4c.get("author_bot") == "widgets-bot",
      (out4b, out4c))

# ---- T5 mid-flight verdict does not authorize: pending -> refuse
g5 = FakeGitHub(comments=({"body": marker(HEAD, "pending", "octo-bot",
                                          "2026-10-25T19:59:00Z")},))
out5 = mod.gate(REPO, PR, HEAD, token="t0ken", transport=g5)
check("T5 verdict=pending (deep lane mid-flight) -> refuse verdict-pending",
      out5.get("merged") is False and out5.get("reason") == "verdict-pending"
      and g5.writes() == [], (out5, g5.writes()))

# ---- T6 the PR head itself moved off the reviewed head -> refuse at step 1
g6 = FakeGitHub(head=OLD, comments=SEAL)
out6 = mod.gate(REPO, PR, HEAD, token="t0ken", transport=g6)
check("T6 PR head moved -> refuse head-moved before any marker census",
      out6.get("merged") is False and out6.get("reason") == "head-moved"
      and g6.writes() == []
      and not any("comments" in c[1] for c in g6.calls), (out6, g6.calls))

# ---- T7 the NEWEST marker rules: old merge seal superseded by changes
g7 = FakeGitHub(comments=({"body": marker(HEAD, "merge", "octo-bot",
                                          "2026-10-25T19:40:00Z"),
                           "updated_at": "2026-10-25T19:40:00Z"},
                          {"body": marker(HEAD, "changes", "octo-bot",
                                          "2026-10-25T20:00:00Z"),
                           "updated_at": "2026-10-25T20:00:00Z"}))
out7 = mod.gate(REPO, PR, HEAD, token="t0ken", transport=g7)
check("T7 newer verdict=changes supersedes an older merge seal -> refuse",
      out7.get("merged") is False and out7.get("reason") == "verdict-changes"
      and g7.writes() == [], (out7, g7.writes()))

# ---- T8 write accepted but disproved by read-back -> merged=False, loud
g8 = FakeGitHub(comments=SEAL, merge_lies=True)
out8 = mod.gate(REPO, PR, HEAD, token="t0ken", transport=g8)
check("T8 merge write not proven by read-back -> merged=False "
      "read-back-unverified (never silent success)",
      out8.get("merged") is False and out8.get("reason") == "read-back-unverified",
      out8)

# ---- T9 one credential, never echoed
all_calls = g.calls + g2.calls + g3.calls + g4.calls + g5.calls + g7.calls + g8.calls
check("T9 every API call rides the ONE passed token; verdict dicts carry no token",
      all(c[3] == "t0ken" for c in all_calls)
      and all("t0ken" not in str(o) for o in (out, out2, out3, out4, out5,
                                              out6, out7, out8)))

print("DONE release_merge_gate", "OK" if fails == 0 else "FAIL")
sys.exit(0 if fails == 0 else 1)
