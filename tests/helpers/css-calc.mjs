// jsdom 29.0.0 dropped cssstyle + rrweb-cssom for a rewritten CSSOM, and the rewrite
// normalizes what it serializes back out of an inline style: a calc() is simplified
// algebraically, so the authored track share
//   calc((100% - 32px) / 3)
// round-trips as
//   33.3333% - 10.6667px        (measured on jsdom 31.0.0 for c=2/3/4: 50% - 16px,
//                               33.3333% - 10.6667px, 25% - 8px — est-trz4b)
// Same share, different spelling. The pre-29 pins read the serializer's choice as if
// it were our formula, which is why dependabot's 27 -> 31 bump went red (PR #206).
// Pin BOTH spellings so the assert fails on a wrong c, a wrong gutter total or a wrong
// floor — never on the engine's formatter.
const esc = s => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
// jsdom prints at most 4 decimals and drops trailing zeros (32/2 -> '16', 32/3 -> '10.6667').
const num = x => x.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')

/** Both legal spellings of one grid track share, plus a matcher for the whole template. */
export const autoFitTracks = (floor, gutters, cols) => {
  const authored = `calc((100% - ${gutters}px) / ${cols})`
  const simplified = `${num(100 / cols)}% - ${num(gutters / cols)}px`
  return { authored, simplified, cols,
    re: new RegExp(`^repeat\\(auto-fit, minmax\\(max\\(${floor}px, (?:${esc(authored)}|${esc(simplified)})\\), 1fr\\)\\)$`) }
}
