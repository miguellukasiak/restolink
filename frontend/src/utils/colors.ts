/**
 * Color math for the readability guardrail — given any brand background color,
 * decide whether text laid over it should be light or dark so a restaurant can
 * never accidentally ship an unreadable (e.g. dark-on-dark) menu.
 */

/** Parses `#RGB` or `#RRGGBB` into 8-bit `[r, g, b]`, or `null` if malformed. */
export function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = hex.trim().replace(/^#/, '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/**
 * WCAG 2.x relative luminance (0 = black … 1 = white). Applies the sRGB
 * gamma-expansion each channel before the perceptual weighting, so it tracks
 * how bright a color actually *looks*, not its raw RGB average.
 */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors (1 = identical … 21 = black/white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * True when a background is dark enough that *light* text reads better over it.
 * Decided by whichever of black/white actually yields the higher contrast ratio
 * — the correct readability test, not a naïve luminance midpoint.
 */
export function isDarkColor(hex: string): boolean {
  return contrastRatio(hex, '#FFFFFF') >= contrastRatio(hex, '#000000');
}

/**
 * Picks the text color that stays readable over `background`. Defaults return
 * pure white or a near-black dark grey (softer than #000 for a premium feel);
 * callers can override either end via `light` / `dark`.
 */
export function getContrastingTextColor(
  background: string,
  { light = '#FFFFFF', dark = '#1A1A1A' }: { light?: string; dark?: string } = {},
): string {
  return isDarkColor(background) ? light : dark;
}
