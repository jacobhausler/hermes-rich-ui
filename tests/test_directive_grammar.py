"""Pin our emitted ::richui{id="ru-..."} against upstream Hermes Desktop's transcript
directive grammar (NousResearch/hermes-agent origin/main@6ffe3b2b59):
  apps/desktop/src/lib/transcript-directives.ts:62  DIRECTIVE_RE
  apps/desktop/src/lib/transcript-directives.ts:69  ATTR_RE
  apps/desktop/src/lib/markdown-preprocess.ts:119   DIRECTIVE_LINE_ONLY_RE
  apps/desktop/src/lib/markdown-preprocess.ts:211   MARKDOWN_INLINE_META_RE
If upstream tightens the grammar, this goes red before cards degrade to raw text."""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lane_backend import load  # noqa: E402

tool = load("engine/tool.py", "dg_tool")

DIRECTIVE_RE = re.compile(r"^::([a-z][a-z0-9-]{0,63})(?:\{([^{}]{0,1024})\})?$")
ATTR_RE = re.compile(r"""([a-z][\w-]{0,63})=(?:"([^"]*)"|'([^']*)')""", re.IGNORECASE)
DIRECTIVE_LINE_ONLY_RE = re.compile(r"^[ \t]*::[a-z][a-z0-9-]{0,63}\{[^{}\n]{0,1024}\}[ \t]*$")
MARKDOWN_INLINE_META_RE = re.compile(r"[\\`*_~\[\]<>]")

if __name__ == "__main__":
    for _ in range(200):
        cid = tool.store.new_card_id()
        d = tool.directive(cid)
        assert DIRECTIVE_RE.fullmatch(d), d
        assert DIRECTIVE_LINE_ONLY_RE.fullmatch(d), d
        attrs = {m[0].lower(): (m[1] or m[2]) for m in ATTR_RE.findall(d)}
        assert attrs == {"id": cid}, (d, attrs)
        assert not MARKDOWN_INLINE_META_RE.search(d), d
        assert len(d) <= 1200, d
    # canaries: malformed directives must NOT match (test cannot pass vacuously)
    for bad in ('::richui{id="ru-}deadbeef01"}', '::RichUI{id="ru-0123456789ab"}',
                '::richui{id="ru-0123456789ab"', '::richui{id="ru-0123456789ab"} trailing'):
        assert not DIRECTIVE_RE.fullmatch(bad), bad
        assert not DIRECTIVE_LINE_ONLY_RE.fullmatch(bad), bad
    print("PASS")
