import qrcode from 'qrcode-generator';
import type { QrSegment } from '../../../utils/menuLink';

/*
 * The QR code as vector art.
 *
 * Our own renderer rather than a styling library, for three reasons: the
 * payload is two segments in two modes (see utils/menuLink.ts), which the
 * libraries' single-string API cannot express; the same markup has to drop
 * into print templates and sheets as plain SVG, synchronously; and the shapes
 * can be tuned to stay readable instead of merely decorative.
 *
 * Everything here is in *module* units — one module is 1×1 — and scaled by
 * whoever places the markup.
 */

/** How the data modules are drawn. */
export type DotStyle = 'square' | 'fluid' | 'dots' | 'tiles' | 'lines';

/** How the three finder patterns ("eyes") are drawn. */
export type EyeStyle = 'square' | 'rounded' | 'circle' | 'leaf';

/** What sits in the middle of the code. */
export type CenterMark =
  | { kind: 'none' }
  | { kind: 'image'; href: string }
  | { kind: 'icon' };

export interface QrLook {
  dots: DotStyle;
  eyes: EyeStyle;
  /** Data modules. */
  color: string;
  /** Finder patterns. */
  eyeColor: string;
  /** Second colour of a diagonal gradient across the data modules. */
  gradientTo: string | null;
}

export interface QrMatrix {
  size: number;
  dark: (row: number, col: number) => boolean;
}

/**
 * Error correction for a code with or without a centre mark.
 *
 * H survives 30% damage and is what a logo needs. Without one, Q — not the
 * usual M — because with the compact payload Q costs no extra modules at all,
 * and it buys margin for a scuffed sticker or a glossy reflection.
 */
export function errorCorrectionFor(center: CenterMark): 'Q' | 'H' {
  return center.kind === 'none' ? 'Q' : 'H';
}

export function buildMatrix(segments: QrSegment[], level: 'M' | 'Q' | 'H'): QrMatrix {
  const qr = qrcode(0, level);
  for (const segment of segments) qr.addData(segment.data, segment.mode);
  qr.make();
  const size = qr.getModuleCount();
  const cells = new Uint8Array(size * size);
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      cells[row * size + col] = qr.isDark(row, col) ? 1 : 0;
    }
  }
  return {
    size,
    dark: (row, col) =>
      row >= 0 && col >= 0 && row < size && col < size && cells[row * size + col] === 1,
  };
}

/** Trims coordinates so paths stay short without visible loss. */
const n = (value: number) => Math.round(value * 1000) / 1000;

/** A rectangle with its own radius on each corner, as path data. */
function roundRect(
  x: number,
  y: number,
  w: number,
  h: number,
  [tl, tr, br, bl]: [number, number, number, number],
): string {
  const arc = (r: number, ex: number, ey: number) =>
    r > 0 ? `A${n(r)} ${n(r)} 0 0 1 ${n(ex)} ${n(ey)}` : '';
  return (
    `M${n(x + tl)} ${n(y)}H${n(x + w - tr)}${arc(tr, x + w, y + tr)}` +
    `V${n(y + h - br)}${arc(br, x + w - br, y + h)}` +
    `H${n(x + bl)}${arc(bl, x, y + h - bl)}` +
    `V${n(y + tl)}${arc(tl, x + tl, y)}Z`
  );
}

function circle(cx: number, cy: number, r: number): string {
  return (
    `M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0` +
    `a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z`
  );
}

/** Top-left corners of the three finder patterns. */
function eyeOrigins(size: number): { row: number; col: number; inner: number }[] {
  // `inner` is the corner that faces the middle of the code: 0 TL, 1 TR,
  // 2 BR, 3 BL — the one the leaf style keeps sharp.
  return [
    { row: 0, col: 0, inner: 2 },
    { row: 0, col: size - 7, inner: 3 },
    { row: size - 7, col: 0, inner: 1 },
  ];
}

/**
 * Centres of the alignment patterns — the small 5×5 targets a scanner uses
 * to correct perspective. Standard positions (ISO/IEC 18004, annex E), minus
 * the three that would collide with the finder patterns.
 */
function alignmentCentres(size: number): { row: number; col: number }[] {
  const version = (size - 17) / 4;
  if (version < 2) return [];
  const count = Math.floor(version / 7) + 2;
  const step =
    version === 32 ? 26 : Math.floor((version * 4 + count * 2 + 1) / (count * 2 - 2)) * 2;
  const positions = [6];
  for (let i = count - 1, pos = size - 7; i >= 1; i -= 1, pos -= step) {
    positions.splice(1, 0, pos);
  }
  const last = positions[positions.length - 1];
  const centres: { row: number; col: number }[] = [];
  for (const row of positions) {
    for (const col of positions) {
      const touchesFinder =
        (row === 6 && col === 6) ||
        (row === 6 && col === last) ||
        (row === last && col === 6);
      if (!touchesFinder) centres.push({ row, col });
    }
  }
  return centres;
}

function inEye(size: number, row: number, col: number): boolean {
  return (
    (row < 7 && col < 7) || (row < 7 && col >= size - 7) || (row >= size - 7 && col < 7)
  );
}

function eyeShape(
  style: EyeStyle,
  x: number,
  y: number,
  side: number,
  radius: number,
  inner: number,
): string {
  if (style === 'circle') return circle(x + side / 2, y + side / 2, side / 2);
  if (style === 'square') return roundRect(x, y, side, side, [0, 0, 0, 0]);
  if (style === 'rounded')
    return roundRect(x, y, side, side, [radius, radius, radius, radius]);
  const radii: [number, number, number, number] = [radius, radius, radius, radius];
  radii[inner] = 0;
  return roundRect(x, y, side, side, radii);
}

/** One finder pattern: the 7×7 ring (outline plus hole, for even-odd
 *  filling) and the 3×3 pupil. */
function eye(style: EyeStyle, col: number, row: number, inner: number) {
  const outerRadius = style === 'leaf' ? 2.8 : 2.2;
  return {
    ring:
      eyeShape(style, col, row, 7, outerRadius, inner) +
      eyeShape(style, col + 1, row + 1, 5, outerRadius - 1, inner),
    pupil: eyeShape(style, col + 2, row + 2, 3, style === 'leaf' ? 1.3 : 0.9, inner),
  };
}

function eyesPath(style: EyeStyle, size: number): { rings: string; pupils: string } {
  let rings = '';
  let pupils = '';
  for (const { row, col, inner } of eyeOrigins(size)) {
    const { ring, pupil } = eye(style, col, row, inner);
    rings += ring;
    pupils += pupil;
  }
  return { rings, pupils };
}

function dotsPath(
  style: DotStyle,
  matrix: QrMatrix,
  cleared: (row: number, col: number) => boolean,
  drawnElsewhere: (row: number, col: number) => boolean = () => false,
): string {
  const { size } = matrix;
  const on = (row: number, col: number) =>
    matrix.dark(row, col) &&
    !inEye(size, row, col) &&
    !drawnElsewhere(row, col) &&
    !cleared(row, col);
  const parts: string[] = [];

  if (style === 'lines') {
    // Vertical runs become pills: reads as stripes, scans as modules.
    for (let col = 0; col < size; col += 1) {
      let row = 0;
      while (row < size) {
        if (!on(row, col)) {
          row += 1;
          continue;
        }
        const start = row;
        while (row < size && on(row, col)) row += 1;
        const r = 0.38;
        parts.push(
          roundRect(col + 0.12, start + 0.06, 0.76, row - start - 0.12, [r, r, r, r]),
        );
      }
    }
    return parts.join('');
  }

  for (let row = 0; row < size; row += 1) {
    if (style === 'square') {
      // Horizontal runs as single rectangles: one path, no seams between cells.
      let col = 0;
      while (col < size) {
        if (!on(row, col)) {
          col += 1;
          continue;
        }
        const start = col;
        while (col < size && on(row, col)) col += 1;
        parts.push(`M${start} ${row}h${col - start}v1h${start - col}z`);
      }
      continue;
    }
    for (let col = 0; col < size; col += 1) {
      if (!on(row, col)) continue;
      if (style === 'dots') {
        parts.push(circle(col + 0.5, row + 0.5, 0.45));
      } else if (style === 'tiles') {
        const r = 0.26;
        parts.push(roundRect(col + 0.07, row + 0.07, 0.86, 0.86, [r, r, r, r]));
      } else {
        // Fluid: a corner rounds off only where both of its sides are open,
        // so neighbours melt into one shape and lone modules become dots.
        const up = on(row - 1, col);
        const down = on(row + 1, col);
        const left = on(row, col - 1);
        const right = on(row, col + 1);
        const r = 0.5;
        parts.push(
          roundRect(col, row, 1, 1, [
            !up && !left ? r : 0,
            !up && !right ? r : 0,
            !down && !right ? r : 0,
            !down && !left ? r : 0,
          ]),
        );
      }
    }
  }
  return parts.join('');
}

/** Material "restaurant menu" (fork and knife) glyph, 24×24. */
const FORK_AND_KNIFE =
  'm8.1 13.34 2.83-2.83-6.19-6.18c-.48-.48-1.31-.35-1.61.27-.71 1.49-.45 3.32.78 4.56zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L4.4 19.17c-.39.39-.39 1.02 0 1.41s1.02.39 1.41 0L12 14.41l6.18 6.18c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41L13.41 13z';

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface QrArtOptions {
  matrix: QrMatrix;
  look: QrLook;
  center: CenterMark;
  /** Share of the code's width given to the centre mark (0.18–0.26). */
  centerScale: number;
  /** Light margin around the code, in modules. The standard asks for 4. */
  quietZone: number;
  /** Fill behind the code; null leaves it transparent. */
  background: string | null;
  /** Unique per rendered instance: gradient and clip ids live in one document. */
  id: string;
}

/**
 * The code as SVG markup in module units, `extent` modules square
 * (the code plus its quiet zone on both sides).
 */
export function qrArt(options: QrArtOptions): { markup: string; extent: number } {
  const { matrix, look, center, centerScale, quietZone, background, id } = options;
  const { size } = matrix;
  const extent = size + quietZone * 2;

  // The centre mark gets a whole-module hole, sized to an odd count so it
  // sits on the grid symmetrically.
  let hole = 0;
  if (center.kind !== 'none') {
    hole = Math.round(size * centerScale);
    if (hole % 2 !== size % 2) hole += 1;
  }
  const holeStart = (size - hole) / 2;
  const cleared = (row: number, col: number) =>
    row >= holeStart &&
    row < holeStart + hole &&
    col >= holeStart &&
    col < holeStart + hole;

  // Alignment patterns are drawn whole, in the eye style, rather than as
  // loose dots: broken into dots they stop looking like a target, and a
  // scanner loses its perspective correction. Measured — with dots, the
  // decode test failed in three of four formats until this was done.
  const alignments = alignmentCentres(size).filter(
    ({ row, col }) =>
      !(cleared(row, col) || cleared(row - 2, col - 2) || cleared(row + 2, col + 2)),
  );
  const inAlignment = (row: number, col: number) =>
    alignments.some((a) => Math.abs(a.row - row) <= 2 && Math.abs(a.col - col) <= 2);
  const dots = dotsPath(look.dots, matrix, cleared, inAlignment);
  const eyes = eyesPath(look.eyes, size);
  for (const { row, col } of alignments) {
    const style = look.eyes === 'leaf' ? 'rounded' : look.eyes;
    eyes.rings +=
      eyeShape(style, col - 2, row - 2, 5, 1.6, 2) +
      eyeShape(style, col - 1, row - 1, 3, 0.8, 2);
    eyes.pupils +=
      style === 'circle'
        ? circle(col + 0.5, row + 0.5, 0.5)
        : roundRect(
            col,
            row,
            1,
            1,
            style === 'square' ? [0, 0, 0, 0] : [0.3, 0.3, 0.3, 0.3],
          );
  }
  const gradientId = `${id}-grad`;
  const dotsFill = look.gradientTo ? `url(#${gradientId})` : look.color;

  let markup = '';
  if (look.gradientTo) {
    markup +=
      `<defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${look.color}"/>` +
      `<stop offset="1" stop-color="${look.gradientTo}"/>` +
      `</linearGradient></defs>`;
  }
  if (background) {
    markup += `<rect width="${extent}" height="${extent}" fill="${background}"/>`;
  }
  markup += `<g transform="translate(${quietZone} ${quietZone})">`;
  markup += `<path d="${dots}" fill="${dotsFill}"/>`;
  markup += `<path d="${eyes.rings}" fill="${look.eyeColor}" fill-rule="evenodd"/>`;
  markup += `<path d="${eyes.pupils}" fill="${look.eyeColor}"/>`;

  if (center.kind === 'icon') {
    const c = size / 2;
    const r = hole / 2 - 0.35;
    const scale = (r * 1.35) / 24;
    markup +=
      `<circle cx="${n(c)}" cy="${n(c)}" r="${n(r)}" fill="${look.eyeColor}"/>` +
      `<path d="${FORK_AND_KNIFE}" fill="#FFFFFF" ` +
      `transform="translate(${n(c - 12 * scale)} ${n(c - 12 * scale)}) scale(${n(scale)})"/>`;
  } else if (center.kind === 'image') {
    const inset = 0.35;
    const plate = hole - inset * 2;
    const x = holeStart + inset;
    const pad = plate * 0.1;
    markup +=
      `<rect x="${n(x)}" y="${n(x)}" width="${n(plate)}" height="${n(plate)}" ` +
      `rx="${n(plate * 0.22)}" fill="#FFFFFF"/>` +
      `<image x="${n(x + pad)}" y="${n(x + pad)}" width="${n(plate - pad * 2)}" ` +
      `height="${n(plate - pad * 2)}" preserveAspectRatio="xMidYMid meet" ` +
      `href="${escapeXml(center.href)}" xlink:href="${escapeXml(center.href)}"/>`;
  }
  markup += '</g>';
  return { markup, extent };
}

/** SVG namespace attributes every standalone document needs. */
export const SVG_NS =
  'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';

/** A fixed 5×5 fragment, for showing a dot style on its own. */
const SAMPLE = ['10110', '11011', '01101', '11100', '10111'];

/** A small SVG of a dot style, in `currentColor`. */
export function dotSample(style: DotStyle): string {
  const matrix: QrMatrix = {
    size: 5,
    dark: (row, col) => SAMPLE[row]?.[col] === '1',
  };
  // A 5×5 matrix is all "eye" to the real renderer, so offset it into a
  // larger grid where the finder zones are elsewhere.
  const shifted: QrMatrix = {
    size: 21,
    dark: (row, col) => matrix.dark(row - 8, col - 8),
  };
  const d = dotsPath(style, shifted, () => false);
  return `<svg ${SVG_NS} viewBox="8 8 5 5"><path d="${d}" fill="currentColor"/></svg>`;
}

/** A small SVG of one finder pattern ("eye") style, in `currentColor`. */
export function eyeSample(style: EyeStyle): string {
  // The top-left eye, whose inward-facing corner is bottom-right.
  const { ring, pupil } = eye(style, 0, 0, 2);
  return (
    `<svg ${SVG_NS} viewBox="0 0 7 7"><path d="${ring}" fill="currentColor" ` +
    `fill-rule="evenodd"/><path d="${pupil}" fill="currentColor"/></svg>`
  );
}
