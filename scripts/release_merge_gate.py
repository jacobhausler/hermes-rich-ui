#!/usr/bin/env python3
"""release_merge_gate.py — the peer-receipt-before-merge predicate for the
release lane (est-clrlx law, ported verbatim from the sibling hermes-workflows
gate; the v0.1.6 merge ran THAT copy, from that checkout — this file makes this
repo self-sufficient).

The predicate is old law, not new law: a release PR merges only on a PEER
review marker sitting at the exact head — never on gates-green + mergeable
alone (CONTRIBUTING.md: `merge` verdict + green CI is what merges a PR, and the
independent deep peer lane can still be in flight when the checks turn green).
Prose is not a gate: the release lane's merge step must not be issuable without
a machine check, so the lane calls this script instead of hand-writing a merge
PUT.

Predicate (the EXISTING review-marker law, ported to code verbatim):
  1. GET pulls/{n}: state == open AND head.sha == --head. A head that moved
     since the review is `head-moved`: the exact-head contract says the old
     seal does not carry ("merge never carries to a new head").
  2. The LATEST `repo-admin reviewed=` marker across the PR's issue comments
     (ordered by updated_at) and reviews (submitted_at) — the one newest marker
     decides, an older seal never outranks a newer verdict (a merge stamp
     superseded by a newer changes/decision stamp REFUSES) — must carry
     verdict=merge with reviewed= matching the CURRENT head (7-40 hex prefix of
     --head exactly).
  3. Non-author (PEER LAW): the marker's reviewer= must exist and differ from
     the PR's author bot stamp `repo-admin bot-id=` in the body (fallback
     --owner-bot; no author identity known = refuse, fail-closed). The shared
     GitHub login is NOT authorship — markers are the identity of record.
  4. Only when 1-3 hold: PUT /merge {merge_method: squash}, then read back the
     PR: merged == true and merge_commit_sha == the returned sha. An
     unverified merge is reported merged=false, loud, never silent, and no
     receipt is written.

Exit codes: 0 = merged AND read-back verified (receipt written when --receipt
given); 1 = refused on the predicate (typed reason, ZERO write attempted);
2 = transport/read failure (predicate unverifiable — fail-closed, zero merge).
The token is read from GITHUB_TOKEN (or --token-file) and NEVER printed.
Stdlib only, python 3.9 safe; one network seam (`_transport`) so behavior tests
fake GitHub. `--repo` keeps the gate repo-agnostic: the same file serves this
repo or any other the lane releases. The marker grammar is the reviewer bot's
own stamp:
  <!-- repo-admin reviewed=<sha> verdict=<merge|changes|pending>
       profile=<bot> reviewer=<bot> -->
Usage:
  GITHUB_TOKEN=... python3 scripts/release_merge_gate.py \
      --repo octo/widgets --pr N --head <40-hex> [--owner-bot b] [--receipt PATH]
"""
from __future__ import annotations


import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request

API = "https://api.github.com"
# MARK/BOTID grammars: the watcher's own (scripts/team-watch.py), ported verbatim.
MARK = re.compile(r"<!--\s*repo-admin\s+reviewed=([0-9a-f]{7,40})"
                  r"(?:\s+verdict=(\w+))?(?:\s+profile=\S+)?"
                  r"(?:\s+reviewer=([\w.-]+))?")
BOTID = re.compile(r"<!--\s*repo-admin\s+bot-id=([\w.-]+)\s*-->")


def _transport(method, url, body, token):
    """The ONE network seam: tests replace it with a fake.
    Returns (status:int, parsed_json_or_{})."""
    req = urllib.request.Request(
        url, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": f"token {token}",
                 "Accept": "application/vnd.github+json",
                 "User-Agent": "hermes-rich-ui-release-merge-gate"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read())
        except Exception:
            payload = {}
        return e.code, payload


def _ok(st):
    return 200 <= st < 300


def latest_marker(repo, pr, token, transport):
    """(ts, reviewed_sha_prefix, verdict, reviewer) of the NEWEST repo-admin
    marker across issue comments (ordered by updated_at — law 3 PATCHes one
    live marker) and reviews (submitted_at — reviews are immutable). A failed
    read raises: an unverifiable marker census is never 'no marker'."""
    best = ("", "", None, None)
    for path, ts_key in ((f"{API}/repos/{repo}/issues/{pr}/comments?per_page=100",
                          "updated_at"),
                         (f"{API}/repos/{repo}/pulls/{pr}/reviews?per_page=100",
                          "submitted_at")):
        st, rows = transport("GET", path, None, token)
        if not _ok(st) or not isinstance(rows, list):
            raise RuntimeError(f"marker-read-failed {path} status={st}")
        for c in rows:
            m = MARK.search(str((c or {}).get("body") or ""))
            if m:
                ts = str(c.get(ts_key) or c.get("created_at") or "")
                if ts >= best[0]:
                    best = (ts, m.group(1), m.group(2), m.group(3))
    return best


def refuse(reason, **extra):
    out = {"merged": False, "reason": reason}
    out.update({k: v for k, v in extra.items() if v not in ("", None)})
    return out


def gate(repo, pr, head, owner_bot="", token=None, transport=_transport):
    """The predicate + (only on pass) the squash-merge + read-back. Returns a
    verdict dict; `merged=True` only ever alongside a verified read-back."""
    token = token or os.environ.get("GITHUB_TOKEN") or ""
    st, pull = transport("GET", f"{API}/repos/{repo}/pulls/{pr}", None, token)
    if not _ok(st):
        return refuse("pr-read-failed", status=st)
    if str((pull or {}).get("state")) != "open":
        return refuse("pr-not-open", state=pull.get("state"))
    actual = str(((pull or {}).get("head") or {}).get("sha") or "")
    if actual != head:
        return refuse("head-moved", head_expected=head, head_seen=actual)
    ts, m_sha, verdict, reviewer = latest_marker(repo, pr, token, transport)
    if not m_sha:
        return refuse("no-peer-marker")
    if verdict != "merge":
        return refuse(f"verdict-{verdict or 'missing'}", reviewed=m_sha)
    if not head.startswith(m_sha):
        # A push after the stamp invalidates it: the seal must sit at THIS head.
        return refuse("marker-stale-head", reviewed=m_sha, head_expected=head)
    author_m = BOTID.search(str((pull or {}).get("body") or ""))
    author_id = author_m.group(1) if author_m else (owner_bot or "")
    if not author_id:
        return refuse("author-unknown", reviewed=m_sha)
    if not reviewer:
        return refuse("marker-no-reviewer", reviewed=m_sha)
    if reviewer.lower() == author_id.lower():
        return refuse("self-review", reviewer=reviewer, author=author_id)
    # Predicate holds — issue the merge, then PROVE it by read-back.
    st_m, res = transport("PUT", f"{API}/repos/{repo}/pulls/{pr}/merge",
                          {"merge_method": "squash"}, token)
    sha = str((res or {}).get("sha") or "")
    if not _ok(st_m) or not sha:
        return refuse("merge-write-failed", status=st_m)
    st_b, back = transport("GET", f"{API}/repos/{repo}/pulls/{pr}", None, token)
    if not _ok(st_b) or not (back or {}).get("merged") \
            or str(back.get("merge_commit_sha") or "") != sha:
        return refuse("read-back-unverified", sha=sha, status=st_b)
    return {"merged": True, "sha": sha, "head": head,
            "marker": {"ts": ts, "reviewed": m_sha, "verdict": verdict,
                       "reviewer": reviewer},
            "author_bot": author_id}


def main(argv=None):
    ap = argparse.ArgumentParser(
        description="Peer-receipt-before-merge gate (est-clrlx)")
    ap.add_argument("--repo", required=True)
    ap.add_argument("--pr", required=True, type=int)
    ap.add_argument("--head", required=True,
                    help="the exact reviewed head (40-hex) the seal must sit at")
    ap.add_argument("--owner-bot", default="",
                    help="author fallback when the body carries no bot-id stamp")
    ap.add_argument("--token-file", default=None,
                    help="file holding the GitHub token (else GITHUB_TOKEN env)")
    ap.add_argument("--receipt", default=None,
                    help="write the verified merge receipt JSON here")
    a = ap.parse_args(argv)
    token = ""
    if a.token_file:
        with open(a.token_file, encoding="utf-8") as f:
            token = f.read().strip()
    try:
        out = gate(a.repo, a.pr, a.head, owner_bot=a.owner_bot, token=token)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    print(json.dumps(out, indent=2, default=str)[:4000])
    if out.get("merged"):
        if a.receipt:
            with open(a.receipt, "w", encoding="utf-8") as f:
                json.dump(out, f, indent=2, default=str)
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
