// Harness pin (defaults epic #33, acceptance "harness mark-fill pin"): every mark
// fill — BarList bar, DataTable bar cell, Progress fill — must hit >= 3:1 contrast
// against the card surface in BOTH themes. jsdom can't resolve color-mix/var, so the
// pinned computation is pure: resolve the theme tokens (host-border-chromium idiom),
// mix in sRGB exactly as the browser would, compare WCAG relative luminance.
// If MARK_FILL_MIX fails the gate the CONSTANT moves (test_tokens pins it); the RULE
// (3:1 in both themes) never moves.
import assert from 'node:assert/strict'

// Light pair and dark pair are the host's own published fallback values (chart.mjs
// FALLBACK / test_host_border_chromium TOKEN_CSS): tertiary surface + elevated card.
export const THEMES = {
  light: { '--ui-bg-elevated': '#ffffff', '--ui-bg-tertiary': '#f3f4f6', '--ui-accent': '#3b82f6', '--ui-stroke-secondary': '#4b5563' },
  dark: { '--ui-bg-elevated': '#111827', '--ui-bg-tertiary': '#1f2937', '--ui-accent': '#3b82f6', '--ui-stroke-secondary': '#4b5563' }
}

export function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim())
  assert.ok(m, `pinned themes use #rrggbb tokens, got ${hex}`)
  return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255)
}

export function mixInSrgb(a, b, pct) {
  const [ar, ag, ab] = hexToRgb(a), [br, bg, bb] = hexToRgb(b)
  const ch = (x, y) => Math.round(x * pct / 100 + y * (100 - pct) / 100)
  return `rgb(${ch(ar, br) * 255 | 0}, ${ch(ag, bg) * 255 | 0}, ${ch(ab, bb) * 255 | 0})`.replace(/(\d+), (\d+), (\d+)/, (_, r, g, b) =>
    `rgb(${Math.round(ar * 255 * pct / 100 + br * 255 * (100 - pct) / 100)}, ${Math.round(ag * 255 * pct / 100 + bg * 255 * (100 - pct) / 100)}, ${Math.round(ab * 255 * pct / 100 + bb * 255 * (100 - pct) / 100)})`)
}

export function contrastRatio(fg, bg) {
  const lum = (rgb) => {
    const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(rgb)
    const [r, g, b] = [m[1], m[2], m[3]].map(v => Number(v) / 255).map(c =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}

// The mark-fill color the components build: MARK_FILL_MIX% accent over the inset
// (tertiary) surface, expressed as the exact string the components emit so this pin
// parses the SAME value the browser would resolve.
export function markFill(accent, tertiary, mix) {
  return { css: `color-mix(in srgb, ${accent} ${mix}%, ${tertiary})`, resolved: mixInSrgb(accent, tertiary, mix) }
}

export function assertMarkFillsContrast(fillFn, { accentKey = '--ui-accent', surfaceKey = '--ui-bg-tertiary', cardKey = '--ui-bg-elevated' } = {}) {
  for (const [theme, tokens] of Object.entries(THEMES)) {
    const fill = fillFn(tokens[accentKey], tokens[surfaceKey])
    const ratio = contrastRatio(fill.resolved ?? fill, tokens[cardKey])
    assert.ok(ratio >= 3, `${theme} theme: mark fill ${fill.css ?? fill} vs card has contrast ${ratio.toFixed(2)} < 3:1`)
  }
}
