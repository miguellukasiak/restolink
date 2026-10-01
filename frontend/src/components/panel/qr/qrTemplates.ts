import { fontStack } from '../../../constants/menuStyle';
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
 *
 * Every word printed on them — the name, the headline, the card's line under
 * the code, the poster's steps — is the owner's to write (QrWording), in
 * whatever language their guests read: a Polish restaurant may well print in
 * English. They start in Polish, the menu's base language, whatever the
 * panel's; an empty one is left off.
 */

export type QrFormat = 'code' | 'tent' | 'sticker' | 'poster';

export interface QrBrand {
  name: string;
  primary: string;
  /** The menu's background colour, used for the light surface. */
  background: string;
  /** The menu's heading face, for the restaurant's name. */
  fontFamily: string;
  fontWeight: number;
}

export interface QrWording {
  /** The headline: "Zeskanuj menu". */
  cta: string;
  showName: boolean;
  /** The name as printed; null prints the restaurant's own, as it is now. */
  name: string | null;
  /** The table card's line under the code. */
  footer: string;
  /** The poster's numbered steps under the code; empty ones are left out. */
  steps: string[];
  /** Brand colour behind the code, or a light surface with brand accents. */
  surface: 'brand' | 'light';
}

/** A size the design can be printed at, in millimetres. */
export interface PrintSize {
  id: string;
  width: number;
  height: number;
}

/** A format's name, and how copies of it are counted, are panel strings
 *  (`qr.format.<format>`, `qr.unit.<format>`). */
export interface FormatSpec {
  /**
   * The design canvas, in millimetres at the default size. Other sizes scale
   * the whole design — text and code together — so its proportions hold.
   */
  width: number;
  height: number;
  /** Width of the code itself on the design canvas. */
  codeWidth: number;
  sizes: PrintSize[];
  defaultSize: string;
}

/** Custom sizes for the bare code, in centimetres. Up to 18 so one still
 *  fits inside an A4 page's printable area. */
export const CUSTOM_CODE_CM = { min: 2, max: 18 } as const;

const square = (cm: number): PrintSize => ({
  id: String(cm),
  width: cm * 10,
  height: cm * 10,
});

/**
 * How a size reads — in full on the stage, short in the size picker — with
 * numbers written the way `locale` writes them ("7,4" or "7.4").
 */
export function sizeLabels(
  format: QrFormat,
  size: PrintSize,
  locale: string,
): { label: string; short: string } {
  const cm = (mm: number) =>
    (mm / 10).toLocaleString(locale, { maximumFractionDigits: 1 });
  if (format === 'sticker') {
    const diameter = `Ø ${cm(size.width)} cm`;
    return { label: diameter, short: diameter };
  }
  if (format === 'code') {
    return {
      label: `${cm(size.width)} × ${cm(size.height)} cm`,
      short: `${cm(size.width)} cm`,
    };
  }
  return {
    label: `${size.id} · ${cm(size.width)} × ${cm(size.height)} cm`,
    short: size.id,
  };
}

export const FORMATS: Record<QrFormat, FormatSpec> = {
  code: {
    width: 50,
    height: 50,
    codeWidth: 42,
    sizes: [3, 4, 5, 7, 10].map(square),
    defaultSize: '5',
  },
  tent: {
    width: 105,
    height: 148,
    codeWidth: 60,
    sizes: [
      { id: 'A7', width: 74, height: 105 },
      { id: 'A6', width: 105, height: 148 },
      { id: 'A5', width: 148, height: 210 },
    ],
    defaultSize: 'A6',
  },
  sticker: {
    width: 80,
    height: 80,
    codeWidth: 36,
    sizes: [5, 6, 8, 10].map(square),
    defaultSize: '8',
  },
  poster: {
    width: 210,
    height: 297,
    codeWidth: 110,
    sizes: [
      { id: 'A5', width: 148, height: 210 },
      { id: 'A4', width: 210, height: 297 },
      { id: 'A3', width: 297, height: 420 },
    ],
    defaultSize: 'A4',
  },
};

/** The chosen size of a format; `custom` (bare code only) is in centimetres. */
export function resolveSize(
  format: QrFormat,
  sizeId: string,
  customCm: number,
): PrintSize {
  const spec = FORMATS[format];
  if (format === 'code' && sizeId === 'custom') {
    const cm = Math.min(CUSTOM_CODE_CM.max, Math.max(CUSTOM_CODE_CM.min, customCm));
    return { ...square(Math.round(cm * 10) / 10), id: 'custom' };
  }
  return (
    spec.sizes.find((size) => size.id === sizeId) ??
    spec.sizes.find((size) => size.id === spec.defaultSize) ??
    spec.sizes[0]
  );
}

/**
 * The design canvas for a size: the format's width, and a height that
 * follows the size's own proportions. The A-sizes are only nearly similar
 * (A5 is not exactly √2 × A6 once rounded to millimetres), so a card or
 * poster grows or shrinks by a millimetre rather than being stretched.
 */
export function designBox(format: QrFormat, size: PrintSize) {
  const spec = FORMATS[format];
  const height =
    format === 'code' || format === 'sticker'
      ? spec.height
      : Math.round(((spec.width * size.height) / size.width) * 100) / 100;
  return { width: spec.width, height, scale: size.width / spec.width };
}

/** Width of the printed code at a size, in millimetres. */
export function printedCodeWidth(format: QrFormat, size: PrintSize): number {
  return FORMATS[format].codeWidth * designBox(format, size).scale;
}

const INK = '#161C25';
const CTA_FONT = 'Montserrat';

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

let measureContext: CanvasRenderingContext2D | null | undefined;

/** Width of `text` in millimetres when set at `size` mm. */
function textWidth(text: string, family: string, size: number, weight = 700): number {
  if (measureContext === undefined) {
    measureContext =
      typeof document === 'undefined'
        ? null
        : document.createElement('canvas').getContext('2d');
  }
  if (!measureContext) return text.length * size * 0.58;
  measureContext.font = `${weight} 100px ${fontStack(family)}`;
  return (measureContext.measureText(text).width / 100) * size;
}

/** The largest size, up to `maxSize`, at which `text` fits `maxWidth` on one
 *  line — for a name, which is never broken. */
function fitLine(
  text: string,
  family: string,
  maxWidth: number,
  maxSize: number,
  weight = 700,
): number {
  return Math.min(maxSize, maxWidth / textWidth(text, family, 1, weight));
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
  weight = 700,
): { lines: string[]; size: number } {
  const oneLine = Math.min(maxSize, maxWidth / textWidth(text, family, 1, weight));
  const words = text.split(' ');
  if (oneLine >= minSize || words.length < 2) return { lines: [text], size: oneLine };

  // "Zeskanuj menu · Scan the menu": a separator is where it wants to break,
  // and it has no place at the start or end of a line.
  const halves = text.split(' · ');
  if (halves.length === 2) {
    const widest = Math.max(...halves.map((half) => textWidth(half, family, 1, weight)));
    return { lines: halves, size: Math.min(maxSize, maxWidth / widest) };
  }

  let best = { lines: [text], widest: Infinity };
  for (let cut = 1; cut < words.length; cut += 1) {
    const lines = [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
    const widest = Math.max(...lines.map((line) => textWidth(line, family, 1, weight)));
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
    weight?: number;
  },
): string {
  return (
    `<text x="${x}" y="${y.toFixed(2)}" text-anchor="middle" ` +
    `font-family="${escapeXml(fontStack(attrs.family))}" font-weight="${attrs.weight ?? 700}" ` +
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
  opacity?: number,
): string {
  const lineHeight = fit.size * 1.18;
  // Baseline of the first line, placing the caps' optical centre on `middle`.
  const first = middle - ((fit.lines.length - 1) * lineHeight) / 2 + fit.size * 0.36;
  return fit.lines
    .map((line, index) =>
      textTag(x, first + index * lineHeight, line, {
        size: fit.size,
        family,
        fill,
        opacity,
      }),
    )
    .join('');
}

/** The name as it will be printed, or '' when there is none. */
export function printedName(brand: QrBrand, wording: QrWording): string {
  return wording.showName ? (wording.name ?? brand.name).trim() : '';
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

function tent(art: QrArtwork, brand: QrBrand, wording: QrWording, H: number): string {
  const W = FORMATS.tent.width;
  const colors = palette(brand, wording.surface);
  let body = `<rect width="${W}" height="${H}" fill="${colors.surface}"/>`;
  const name = printedName(brand, wording);
  if (name) {
    body += textTag(W / 2, 19, name, {
      size: fitLine(name, brand.fontFamily, 84, 6.5, brand.fontWeight),
      family: brand.fontFamily,
      weight: brand.fontWeight,
      fill: colors.accent,
    });
  }
  const cta = wording.cta.trim();
  if (cta) {
    const top = name ? 26 : 12;
    body += textBlock(
      W / 2,
      (top + 48) / 2,
      fitText(cta, CTA_FONT, 88, 10, 7),
      CTA_FONT,
      colors.text,
    );
  }
  body += panel(16.5, 52, 72, 5, colors.panelStroke);
  body += placeCode(art, 22.5, 58, 60);
  const footer = wording.footer.trim();
  if (footer) {
    const fit = fitText(footer, CTA_FONT, 88, 3.1, 2.6);
    body += textBlock(W / 2, 133, fit, CTA_FONT, colors.text, 0.8);
  }
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
      `<text font-family="${escapeXml(fontStack(CTA_FONT))}" font-weight="700" ` +
      `font-size="${size.toFixed(2)}" letter-spacing="${spacing}" fill="${colors.accent}" ` +
      `text-anchor="middle"><textPath href="#${pathId}" xlink:href="#${pathId}" ` +
      `startOffset="50%">${escapeXml(letters)}</textPath></text>`
    );
  };
  const cta = wording.cta.trim();
  const name = printedName(brand, wording);
  if (cta) body += arcText(cta, 5, false, 'top');
  if (name) body += arcText(name, 4, true, 'bottom');
  for (const x of [R - (inner + ring / 2), R + (inner + ring / 2)]) {
    body += `<circle cx="${x}" cy="${R}" r="0.9" fill="${colors.accent}"/>`;
  }
  body += placeCode(art, R - 18, R - 18, 36);
  return body;
}

function poster(art: QrArtwork, brand: QrBrand, wording: QrWording, H: number): string {
  const W = FORMATS.poster.width;
  const colors = palette(brand, wording.surface);
  let body = `<rect width="${W}" height="${H}" fill="${colors.surface}"/>`;
  const name = printedName(brand, wording);
  if (name) {
    body += textTag(W / 2, 38, name, {
      size: fitLine(name, brand.fontFamily, 170, 12, brand.fontWeight),
      family: brand.fontFamily,
      weight: brand.fontWeight,
      fill: colors.accent,
    });
  }
  const cta = wording.cta.trim();
  if (cta) {
    const top = name ? 50 : 26;
    body += textBlock(
      W / 2,
      (top + 92) / 2,
      fitText(cta, CTA_FONT, 172, 17, 11),
      CTA_FONT,
      colors.text,
    );
  }
  body += panel(40, 100, 130, 8, colors.panelStroke);
  body += placeCode(art, 50, 110, 110);

  // The steps the owner kept, numbered in order and centred as a row.
  const steps = wording.steps.map((step) => step.trim()).filter(Boolean);
  const badge = wording.surface === 'brand' ? '#FFFFFF' : colors.accent;
  const badgeText = getContrastingTextColor(badge, { dark: INK });
  steps.forEach((label, index) => {
    const x = W / 2 + (index - (steps.length - 1) / 2) * 60;
    body +=
      `<circle cx="${x}" cy="252" r="6.5" fill="${badge}"/>` +
      textTag(x, 254.3, String(index + 1), {
        size: 6.4,
        family: CTA_FONT,
        fill: badgeText,
      }) +
      textBlock(x, 268.3, fitText(label, CTA_FONT, 56, 4.6, 3.6), CTA_FONT, colors.text);
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

/** The template's markup, in design millimetres from its top-left corner. */
export function templateBody(
  format: QrFormat,
  art: QrArtwork,
  brand: QrBrand,
  wording: QrWording,
  id: string,
  height: number = FORMATS[format].height,
): string {
  switch (format) {
    case 'tent':
      return tent(art, brand, wording, height);
    case 'sticker':
      return sticker(art, brand, wording, id);
    case 'poster':
      return poster(art, brand, wording, height);
    default:
      return codeOnly(art);
  }
}

/**
 * A standalone SVG document over a `width` × `height` canvas. `size: 'print'`
 * gives it real dimensions — `print` millimetres, or the canvas size when
 * omitted; `'fluid'` lets it fill whatever box it is placed in.
 */
export function svgDocument(
  width: number,
  height: number,
  body: string,
  {
    size = 'print',
    fontCss = '',
    print,
  }: {
    size?: 'print' | 'fluid';
    fontCss?: string;
    print?: { width: number; height: number };
  } = {},
): string {
  const dimensions =
    size === 'print'
      ? `width="${print?.width ?? width}mm" height="${print?.height ?? height}mm"`
      : 'width="100%" height="100%"';
  return (
    `<svg ${SVG_NS} ${dimensions} viewBox="0 0 ${width} ${height}">` +
    (fontCss ? `<style>${fontCss}</style>` : '') +
    body +
    '</svg>'
  );
}

/** How copies of a design fill a printed page. */
export interface SheetPlan {
  page: 'A5' | 'A4' | 'A3';
  orientation: 'portrait' | 'landscape';
  width: number;
  height: number;
  /** Top-left corner of each copy, in millimetres. */
  positions: { x: number; y: number }[];
}

const PAGES = {
  A5: [148, 210],
  A4: [210, 297],
  A3: [297, 420],
} as const;

/** Space home printers cannot reach, and the gap left for cutting. */
const MARGIN = 10;
const GAP = 8;

/**
 * As many copies as fit on an A4 sheet, in whichever orientation fits more.
 * A poster is its own page instead: A5, A4 or A3, edge to edge.
 */
export function planSheet(format: QrFormat, size: PrintSize): SheetPlan {
  if (format === 'poster') {
    const page = (size.id in PAGES ? size.id : 'A4') as SheetPlan['page'];
    const [width, height] = PAGES[page];
    return { page, orientation: 'portrait', width, height, positions: [{ x: 0, y: 0 }] };
  }
  const layouts = (['portrait', 'landscape'] as const).map((orientation) => {
    const [width, height] = orientation === 'portrait' ? [210, 297] : [297, 210];
    const cols = Math.floor((width - 2 * MARGIN + GAP) / (size.width + GAP));
    const rows = Math.floor((height - 2 * MARGIN + GAP) / (size.height + GAP));
    return { orientation, width, height, cols, rows, count: cols * rows };
  });
  const best = layouts[1].count > layouts[0].count ? layouts[1] : layouts[0];
  const cols = Math.max(1, best.cols);
  const rows = Math.max(1, best.rows);
  const left = (best.width - (cols * size.width + (cols - 1) * GAP)) / 2;
  const top = (best.height - (rows * size.height + (rows - 1) * GAP)) / 2;
  const positions: { x: number; y: number }[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      positions.push({
        x: left + col * (size.width + GAP),
        y: top + row * (size.height + GAP),
      });
    }
  }
  return {
    page: 'A4',
    orientation: best.orientation,
    width: best.width,
    height: best.height,
    positions,
  };
}

/** A printed page of copies with light cutting guides, as an SVG document. */
export function sheetDocument(
  format: QrFormat,
  itemBody: string,
  size: PrintSize,
  plan: SheetPlan,
  fontCss = '',
): string {
  const box = designBox(format, size);
  if (format === 'poster') {
    return svgDocument(box.width, box.height, itemBody, {
      fontCss,
      print: { width: plan.width, height: plan.height },
    });
  }
  let body = `<rect width="${plan.width}" height="${plan.height}" fill="#FFFFFF"/>`;
  for (const { x, y } of plan.positions) {
    body +=
      `<svg x="${x}" y="${y}" width="${size.width}" height="${size.height}" ` +
      `viewBox="0 0 ${box.width} ${box.height}">${itemBody}</svg>`;
    body +=
      format === 'sticker'
        ? `<circle cx="${x + size.width / 2}" cy="${y + size.height / 2}" r="${size.width / 2 + 0.4}"`
        : `<rect x="${x - 0.4}" y="${y - 0.4}" width="${size.width + 0.8}" height="${size.height + 0.8}"`;
    body +=
      ' fill="none" stroke="#9AA0A6" stroke-width="0.2" stroke-dasharray="1.5 1.5"/>';
  }
  return svgDocument(plan.width, plan.height, body, { fontCss });
}
