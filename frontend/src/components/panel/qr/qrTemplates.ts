import { getFontStack } from '../../../constants/menu';
import {
  contrastRatio,
  getContrastingTextColor,
  isDarkColor,
} from '../../../utils/colors';
import { SVG_NS, escapeXml } from './qrArt';

/*
 * Print templates: the code set into something a guest actually meets.
 *
 * Every template is drawn in millimetres at its real printed size, so the
 * same markup serves the on-screen preview, the PNG and SVG downloads, and
 * the A4 print sheet — what the owner sees is exactly what comes out of the
 * printer.
 */

export type QrFormat = 'code' | 'tent' | 'sticker' | 'poster';

export interface QrBrand {
  name: string;
  primary: string;
  /** The menu's background colour, used for the light surface. */
  background: string;
  fontFamily: string;
}

export interface QrWording {
  cta: string;
  showName: boolean;
  /** Brand colour behind the code, or a light surface with brand accents. */
  surface: 'brand' | 'light';
}

export interface FormatSpec {
  label: string;
  /** Printed size, in millimetres. */
  width: number;
  height: number;
  /** Width of the code itself when printed, for the scanning-distance hint. */
  codeWidth: number;
  sizeLabel: string;
  sheet: {
    orientation: 'portrait' | 'landscape';
    cols: number;
    rows: number;
    gap: number;
    label: string;
  };
}

export const FORMATS: Record<QrFormat, FormatSpec> = {
  code: {
    label: 'Sam kod',
    width: 50,
    height: 50,
    codeWidth: 42,
    sizeLabel: '5 × 5 cm',
    sheet: {
      orientation: 'portrait',
      cols: 3,
      rows: 4,
      gap: 15,
      label: '12 kodów na arkuszu A4',
    },
  },
  tent: {
    label: 'Stojak na stolik',
    width: 105,
    height: 148,
    codeWidth: 60,
    sizeLabel: 'A6 · 10,5 × 14,8 cm',
    sheet: {
      orientation: 'landscape',
      cols: 2,
      rows: 1,
      gap: 12,
      label: '2 karty na arkuszu A4',
    },
  },
  sticker: {
    label: 'Naklejka',
    width: 80,
    height: 80,
    codeWidth: 36,
    sizeLabel: 'Ø 8 cm',
    sheet: {
      orientation: 'portrait',
      cols: 2,
      rows: 3,
      gap: 14,
      label: '6 naklejek na arkuszu A4',
    },
  },
  poster: {
    label: 'Plakat A4',
    width: 210,
    height: 297,
    codeWidth: 110,
    sizeLabel: 'A4 · 21 × 29,7 cm',
    sheet: { orientation: 'portrait', cols: 1, rows: 1, gap: 0, label: 'Cała strona A4' },
  },
};

const INK = '#161C25';
const CTA_FONT = 'Montserrat';

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

let measureContext: CanvasRenderingContext2D | null | undefined;

/** Width of `text` in millimetres when set at `size` mm. */
function textWidth(text: string, family: string, size: number): number {
  if (measureContext === undefined) {
    measureContext =
      typeof document === 'undefined'
        ? null
        : document.createElement('canvas').getContext('2d');
  }
  if (!measureContext) return text.length * size * 0.58;
  measureContext.font = `700 100px ${getFontStack(family)}`;
  return (measureContext.measureText(text).width / 100) * size;
}

/**
 * The largest size, up to `maxSize`, at which `text` fits `maxWidth` — on one
 * line if that stays at or above `minSize`, otherwise broken at the space that
 * balances two lines best.
 */
function fitText(
  text: string,
  family: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
): { lines: string[]; size: number } {
  const oneLine = Math.min(maxSize, maxWidth / textWidth(text, family, 1));
  const words = text.split(' ');
  if (oneLine >= minSize || words.length < 2) return { lines: [text], size: oneLine };

  let best = { lines: [text], widest: Infinity };
  for (let cut = 1; cut < words.length; cut += 1) {
    const lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
    const widest = Math.max(...lines.map((line) => textWidth(line, family, 1)));
    if (widest < best.widest) best = { lines, widest };
  }
  return { lines: best.lines, size: Math.min(maxSize, maxWidth / best.widest) };
}

function textTag(
  x: number,
  y: number,
  content: string,
  attrs: {
    size: number;
    family: string;
    fill: string;
    spacing?: number;
    opacity?: number;
  },
): string {
  return (
    `<text x="${x}" y="${y.toFixed(2)}" text-anchor="middle" ` +
    `font-family="${escapeXml(getFontStack(attrs.family))}" font-weight="700" ` +
    `font-size="${attrs.size.toFixed(2)}" fill="${attrs.fill}"` +
    (attrs.spacing ? ` letter-spacing="${attrs.spacing}"` : '') +
    (attrs.opacity !== undefined ? ` fill-opacity="${attrs.opacity}"` : '') +
    `>${escapeXml(content)}</text>`
  );
}

/** A block of centred lines whose visual middle sits at `middle`. */
function textBlock(
  x: number,
  middle: number,
  fit: { lines: string[]; size: number },
  family: string,
  fill: string,
): string {
  const lineHeight = fit.size * 1.18;
  // Baseline of the first line, placing the caps' optical centre on `middle`.
  const first = middle - ((fit.lines.length - 1) * lineHeight) / 2 + fit.size * 0.36;
  return fit.lines
    .map((line, index) =>
      textTag(x, first + index * lineHeight, line, { size: fit.size, family, fill }),
    )
    .join('');
}

// ---------------------------------------------------------------------------
// Colour roles
// ---------------------------------------------------------------------------

interface Palette {
  surface: string;
  /** Headline and body text on the surface. */
  text: string;
  /** Restaurant name and decorative details. */
  accent: string;
  /** Outline around the code's white panel, when the surface is light. */
  panelStroke: string | null;
}

function palette(brand: QrBrand, surface: QrWording['surface']): Palette {
  if (surface === 'brand') {
    const text = getContrastingTextColor(brand.primary, { dark: INK });
    return { surface: brand.primary, text, accent: text, panelStroke: null };
  }
  const background = isDarkColor(brand.background) ? '#FFFFFF' : brand.background;
  const accent = contrastRatio(brand.primary, background) >= 3 ? brand.primary : INK;
  return { surface: background, text: INK, accent, panelStroke: accent };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/** The rendered code: markup in module units, `extent` modules square. */
export interface QrArtwork {
  markup: string;
  extent: number;
}

function placeCode(art: QrArtwork, x: number, y: number, size: number): string {
  return (
    `<svg x="${x}" y="${y}" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${art.extent} ${art.extent}">${art.markup}</svg>`
  );
}

function panel(
  x: number,
  y: number,
  size: number,
  radius: number,
  stroke: string | null,
) {
  return (
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${radius}" fill="#FFFFFF"` +
    (stroke ? ` stroke="${stroke}" stroke-width="0.6"` : '') +
    '/>'
  );
}

function tent(art: QrArtwork, brand: QrBrand, wording: QrWording): string {
  const { width: W, height: H } = FORMATS.tent;
  const colors = palette(brand, wording.surface);
  let body = `<rect width="${W}" height="${H}" fill="${colors.surface}"/>`;
  if (wording.showName && brand.name) {
    const name = fitText(brand.name, brand.fontFamily, 84, 6.5, 6.5);
    body += textTag(W / 2, 19, name.lines[0], {
      size: name.size,
      family: brand.fontFamily,
      fill: colors.accent,
    });
  }
  if (wording.cta) {
    const cta = fitText(wording.cta, CTA_FONT, 88, 10, 7);
    const top = wording.showName && brand.name ? 26 : 12;
    body += textBlock(W / 2, (top + 48) / 2, cta, CTA_FONT, colors.text);
  }
  body += panel(16.5, 52, 72, 5, colors.panelStroke);
  body += placeCode(art, 22.5, 58, 60);
  body += textTag(W / 2, 134, 'Otwórz aparat w telefonie i skieruj go na kod', {
    size: 3.1,
    family: CTA_FONT,
    fill: colors.text,
    opacity: 0.8,
  });
  return body;
}

function sticker(art: QrArtwork, brand: QrBrand, wording: QrWording, id: string): string {
  const R = 40;
  const inner = 28.5;
  const ring = R - inner;
  const colors = palette(brand, wording.surface);
  let body =
    `<circle cx="${R}" cy="${R}" r="${R}" fill="${colors.surface}"/>` +
    `<circle cx="${R}" cy="${R}" r="${inner}" fill="#FFFFFF"` +
    (colors.panelStroke ? ` stroke="${colors.panelStroke}" stroke-width="0.6"` : '') +
    '/>';

  // Text runs along the ring: the call to action over the top, the name
  // under the bottom — both upright. A top-arc baseline sits low in the ring
  // (glyphs grow outwards), a bottom-arc one high (glyphs grow inwards).
  const arcText = (content: string, maxSize: number, bottom: boolean, key: string) => {
    const letters = content.toUpperCase();
    const spacing = 0.5;
    const rough = bottom ? R - ring / 2 : inner + ring / 2;
    const room = Math.PI * rough * 0.78;
    const unit = textWidth(letters, CTA_FONT, 1) + spacing * letters.length;
    const size = Math.max(2.6, Math.min(maxSize, room / unit));
    const cap = size * 0.7;
    const radius = bottom ? R - (ring - cap) / 2 : inner + (ring - cap) / 2;
    const pathId = `${id}-${key}`;
    const d = bottom
      ? `M${R - radius} ${R}A${radius} ${radius} 0 0 0 ${R + radius} ${R}`
      : `M${R - radius} ${R}A${radius} ${radius} 0 0 1 ${R + radius} ${R}`;
    return (
      `<path id="${pathId}" d="${d}" fill="none"/>` +
      `<text font-family="${escapeXml(getFontStack(CTA_FONT))}" font-weight="700" ` +
      `font-size="${size.toFixed(2)}" letter-spacing="${spacing}" fill="${colors.accent}" ` +
      `text-anchor="middle"><textPath href="#${pathId}" xlink:href="#${pathId}" ` +
      `startOffset="50%">${escapeXml(letters)}</textPath></text>`
    );
  };
  if (wording.cta) body += arcText(wording.cta, 5, false, 'top');
  if (wording.showName && brand.name) body += arcText(brand.name, 4, true, 'bottom');
  for (const x of [R - (inner + ring / 2), R + (inner + ring / 2)]) {
    body += `<circle cx="${x}" cy="${R}" r="0.9" fill="${colors.accent}"/>`;
  }
  body += placeCode(art, R - 18, R - 18, 36);
  return body;
}

function poster(art: QrArtwork, brand: QrBrand, wording: QrWording): string {
  const { width: W, height: H } = FORMATS.poster;
  const colors = palette(brand, wording.surface);
  let body = `<rect width="${W}" height="${H}" fill="${colors.surface}"/>`;
  if (wording.showName && brand.name) {
    const name = fitText(brand.name, brand.fontFamily, 170, 12, 12);
    body += textTag(W / 2, 38, name.lines[0], {
      size: name.size,
      family: brand.fontFamily,
      fill: colors.accent,
    });
  }
  if (wording.cta) {
    const cta = fitText(wording.cta, CTA_FONT, 172, 17, 11);
    const top = wording.showName && brand.name ? 50 : 26;
    body += textBlock(W / 2, (top + 92) / 2, cta, CTA_FONT, colors.text);
  }
  body += panel(40, 100, 130, 8, colors.panelStroke);
  body += placeCode(art, 50, 110, 110);

  const steps = ['Otwórz aparat', 'Skieruj na kod', 'Wybierz dania'];
  const badge = wording.surface === 'brand' ? '#FFFFFF' : colors.accent;
  const badgeText = getContrastingTextColor(badge, { dark: INK });
  steps.forEach((label, index) => {
    const x = 45 + index * 60;
    body +=
      `<circle cx="${x}" cy="252" r="6.5" fill="${badge}"/>` +
      textTag(x, 254.3, String(index + 1), {
        size: 6.4,
        family: CTA_FONT,
        fill: badgeText,
      }) +
      textTag(x, 270, label, { size: 4.6, family: CTA_FONT, fill: colors.text });
  });
  return body;
}

function codeOnly(art: QrArtwork): string {
  const { width } = FORMATS.code;
  return (
    `<rect width="${width}" height="${width}" fill="#FFFFFF"/>` +
    placeCode(art, 0, 0, width)
  );
}

/** The template's markup, in millimetres from its top-left corner. */
export function templateBody(
  format: QrFormat,
  art: QrArtwork,
  brand: QrBrand,
  wording: QrWording,
  id: string,
): string {
  switch (format) {
    case 'tent':
      return tent(art, brand, wording);
    case 'sticker':
      return sticker(art, brand, wording, id);
    case 'poster':
      return poster(art, brand, wording);
    default:
      return codeOnly(art);
  }
}

/**
 * A standalone SVG document. `size: 'print'` gives it real millimetre
 * dimensions; `'fluid'` lets it fill whatever box it is placed in.
 */
export function svgDocument(
  width: number,
  height: number,
  body: string,
  { size = 'print', fontCss = '' }: { size?: 'print' | 'fluid'; fontCss?: string } = {},
): string {
  const dimensions =
    size === 'print'
      ? `width="${width}mm" height="${height}mm"`
      : 'width="100%" height="100%"';
  return (
    `<svg ${SVG_NS} ${dimensions} viewBox="0 0 ${width} ${height}">` +
    (fontCss ? `<style>${fontCss}</style>` : '') +
    body +
    '</svg>'
  );
}

/** An A4 sheet of copies with light cutting guides, as an SVG document. */
export function sheetDocument(format: QrFormat, itemBody: string, fontCss = ''): string {
  const spec = FORMATS[format];
  const { cols, rows, gap, orientation } = spec.sheet;
  const pageW = orientation === 'portrait' ? 210 : 297;
  const pageH = orientation === 'portrait' ? 297 : 210;
  if (format === 'poster') return svgDocument(pageW, pageH, itemBody, { fontCss });

  const blockW = cols * spec.width + (cols - 1) * gap;
  const blockH = rows * spec.height + (rows - 1) * gap;
  const left = (pageW - blockW) / 2;
  const top = (pageH - blockH) / 2;
  let body = `<rect width="${pageW}" height="${pageH}" fill="#FFFFFF"/>`;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = left + col * (spec.width + gap);
      const y = top + row * (spec.height + gap);
      body += `<g transform="translate(${x} ${y})">${itemBody}</g>`;
      body +=
        format === 'sticker'
          ? `<circle cx="${x + spec.width / 2}" cy="${y + spec.height / 2}" r="${spec.width / 2 + 0.4}"`
          : `<rect x="${x - 0.4}" y="${y - 0.4}" width="${spec.width + 0.8}" height="${spec.height + 0.8}"`;
      body +=
        ' fill="none" stroke="#9AA0A6" stroke-width="0.2" stroke-dasharray="1.5 1.5"/>';
    }
  }
  return svgDocument(pageW, pageH, body, { fontCss });
}
