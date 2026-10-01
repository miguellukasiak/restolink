import { contrastRatio, hexToRgb } from '../../../utils/colors';
import type { DotStyle, EyeStyle, QrLook } from './qrArt';
import {
  FORMATS,
  printedCodeWidth,
  type PrintSize,
  type QrFormat,
  type QrWording,
} from './qrTemplates';

/*
 * The owner-facing design model: what can be chosen, what is offered first,
 * and how readable the result is.
 *
 * The starting point is never a blank form. Every ready-made design is built
 * from the restaurant's own colour (set in "Wygląd menu"), darkened where
 * needed so it still scans — the owner picks a finished code and only then,
 * if they want, adjusts it.
 */

export type CenterChoice = 'logo' | 'icon' | 'upload' | 'none';
export type CenterSize = 'S' | 'M' | 'L';

export interface QrDesign {
  look: QrLook;
  /** The ready-made design this came from, until something is changed. */
  presetId: string | null;
  center: CenterChoice;
  centerSize: CenterSize;
  format: QrFormat;
  /** The chosen print size of each format, so switching tabs keeps them. */
  sizes: Record<QrFormat, string>;
  /** The bare code's custom size, in centimetres, when `sizes.code` is 'custom'. */
  customCm: number;
  wording: QrWording;
}

export const DEFAULT_SIZES: Record<QrFormat, string> = {
  code: FORMATS.code.defaultSize,
  tent: FORMATS.tent.defaultSize,
  sticker: FORMATS.sticker.defaultSize,
  poster: FORMATS.poster.defaultSize,
};

/** Share of the code's width the centre mark takes. Capped well inside what
 *  error correction H recovers, so a logo never costs readability. */
export const CENTER_SCALE: Record<CenterSize, number> = { S: 0.18, M: 0.22, L: 0.26 };

export const INK = '#161C25';
const WHITE = '#FFFFFF';

/** Named in the panel by `qr.dots.<style>` and `qr.eyes.<style>`. */
export const DOT_OPTIONS: readonly DotStyle[] = [
  'square',
  'fluid',
  'dots',
  'tiles',
  'lines',
];

export const EYE_OPTIONS: readonly EyeStyle[] = ['square', 'rounded', 'circle', 'leaf'];

/** How long each printed text may be, so it still fits its place. */
export const TEXT_LIMITS = { name: 40, cta: 40, footer: 80, step: 40 } as const;

/**
 * Every printed text at once, in one language or two — the starting points
 * the owner then edits freely. Printed for guests, so these are the guests'
 * words whatever the panel's language; Polish first, the menu's base.
 * Named in the panel by `qr.textSet.<id>`.
 */
export interface PrintedTextSet {
  id: 'pl' | 'en' | 'plEn';
  cta: string;
  footer: string;
  steps: string[];
}

export const PRINTED_TEXT_SETS: readonly PrintedTextSet[] = [
  {
    id: 'pl',
    cta: 'Zeskanuj, aby zobaczyć menu',
    footer: 'Otwórz aparat w telefonie i skieruj go na kod',
    steps: ['Otwórz aparat', 'Skieruj na kod', 'Wybierz dania'],
  },
  {
    id: 'en',
    cta: 'Scan to see the menu',
    footer: 'Open your phone camera and point it at the code',
    steps: ['Open the camera', 'Point it at the code', 'Choose your dishes'],
  },
  {
    // " · " is where the template breaks a line, so each language gets its own.
    id: 'plEn',
    cta: 'Zeskanuj menu · Scan the menu',
    footer: 'Otwórz aparat i skieruj na kod · Open the camera, point at the code',
    steps: [
      'Otwórz aparat · Open the camera',
      'Skieruj na kod · Point at the code',
      'Wybierz dania · Choose your dishes',
    ],
  },
];

export const DEFAULT_TEXTS = PRINTED_TEXT_SETS[0];

/** Dark, print-safe colours: every one reads at 7:1 or better on white.
 *  Named in the panel by `qr.swatch.<id>`. */
export const SAFE_SWATCHES: { color: string; id: string }[] = [
  { color: INK, id: 'graphite' },
  { color: '#000000', id: 'black' },
  { color: '#1F3A5F', id: 'navy' },
  { color: '#1E4D2B', id: 'bottleGreen' },
  { color: '#6E1F2A', id: 'burgundy' },
  { color: '#5A3A22', id: 'chocolate' },
];

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** `color` moved `amount` (0–1) of the way to black. */
export function darken(color: string, amount: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return toHex(rgb.map((v) => v * (1 - amount)) as [number, number, number]);
}

/**
 * `color`, darkened just enough to reach `min` contrast on white. A light
 * brand colour (gold, pastel) keeps its hue and becomes usable for modules.
 */
export function readableOnWhite(color: string, min = 4.5): string {
  if (!hexToRgb(color)) return INK;
  for (let step = 0; step <= 20; step += 1) {
    const candidate = darken(color, step * 0.05);
    if (contrastRatio(candidate, WHITE) >= min) return candidate;
  }
  return INK;
}

/** Named in the panel by `qr.preset.<id>`. */
export interface QrPreset {
  id: string;
  look: QrLook;
}

/** The ready-made designs, in the restaurant's colour. */
export function presetsFor(brandColor: string): QrPreset[] {
  const brand = readableOnWhite(brandColor);
  const deep = readableOnWhite(darken(brand, 0.35), 7);
  return [
    {
      id: 'brand',
      look: {
        dots: 'fluid',
        eyes: 'rounded',
        color: brand,
        eyeColor: brand,
        gradientTo: null,
      },
    },
    {
      id: 'classic',
      look: {
        dots: 'square',
        eyes: 'square',
        color: INK,
        eyeColor: INK,
        gradientTo: null,
      },
    },
    {
      id: 'accent',
      look: {
        dots: 'dots',
        eyes: 'circle',
        color: INK,
        eyeColor: brand,
        gradientTo: null,
      },
    },
    {
      id: 'soft',
      look: {
        dots: 'tiles',
        eyes: 'rounded',
        color: brand,
        eyeColor: deep,
        gradientTo: deep,
      },
    },
    {
      id: 'lines',
      look: {
        dots: 'lines',
        eyes: 'leaf',
        color: INK,
        eyeColor: brand,
        gradientTo: null,
      },
    },
    {
      id: 'elegant',
      look: {
        dots: 'fluid',
        eyes: 'leaf',
        color: deep,
        eyeColor: deep,
        gradientTo: brand,
      },
    },
  ];
}

export function defaultDesign(brandColor: string, hasLogo: boolean): QrDesign {
  const [first] = presetsFor(brandColor);
  return {
    look: first.look,
    presetId: first.id,
    center: hasLogo ? 'logo' : 'icon',
    centerSize: 'M',
    format: 'tent',
    sizes: DEFAULT_SIZES,
    customCm: 6,
    wording: {
      cta: DEFAULT_TEXTS.cta,
      showName: true,
      name: null,
      footer: DEFAULT_TEXTS.footer,
      steps: [...DEFAULT_TEXTS.steps],
      surface: 'brand',
    },
  };
}

// ---------------------------------------------------------------------------
// Readability
// ---------------------------------------------------------------------------

export type Verdict = 'great' | 'ok' | 'weak' | 'bad';

export type CheckId = 'scan' | 'contrast' | 'density' | 'print';

/**
 * One finding, as data: the panel words it (`qr.check.<id>.<detail>`), with
 * `values` filled in — lengths in millimetres, for `formatLength`.
 */
export interface ReadabilityCheck {
  id: CheckId;
  verdict: Verdict;
  detail: string;
  values: Record<string, number>;
}

export interface Readability {
  verdict: Verdict;
  checks: ReadabilityCheck[];
}

/** The weakest contrast any part of the code has against its white panel. */
export function weakestContrast(look: QrLook): number {
  return Math.min(
    ...[look.color, look.eyeColor, look.gradientTo]
      .filter((color): color is string => Boolean(color))
      .map((color) => contrastRatio(color, WHITE)),
  );
}

const RANK: Verdict[] = ['great', 'ok', 'weak', 'bad'];

/** Scanning distance for a printed code width, in millimetres rounded to
 *  10 cm. Rule of thumb: a code reads from about ten times its own width. */
function scanDistance(codeWidthMm: number): number {
  return Math.round(codeWidthMm / 10) * 100;
}

/** A printed length as `locale` writes it: "4,2 cm", "1.5 m". */
export function formatLength(mm: number, locale: string): string {
  const number = (value: number) =>
    value.toLocaleString(locale, { maximumFractionDigits: 2 });
  return mm >= 1000 ? `${number(mm / 1000)} m` : `${number(Math.round(mm) / 10)} cm`;
}

/** Smallest printed module that phones read comfortably, and the floor below
 *  which even a steady hand at arm's length struggles, in millimetres. */
const GOOD_MODULE = 0.5;
const MIN_MODULE = 0.35;

export function assessReadability({
  look,
  format,
  size,
  modules,
  plainModules,
  decoded,
}: {
  look: QrLook;
  format: QrFormat;
  size: PrintSize;
  modules: number;
  plainModules: number;
  /** Result of decoding the rendered design; null while the test runs. */
  decoded: boolean | null;
}): Readability {
  const ratio = weakestContrast(look);
  const contrastVerdict: Verdict =
    ratio >= 7 ? 'great' : ratio >= 4.5 ? 'ok' : ratio >= 3 ? 'weak' : 'bad';
  const contrast: ReadabilityCheck = {
    id: 'contrast',
    verdict: contrastVerdict,
    detail: contrastVerdict,
    values: { ratio },
  };

  const scan: ReadabilityCheck =
    decoded === null
      ? { id: 'scan', verdict: 'ok', detail: 'pending', values: {} }
      : decoded
        ? { id: 'scan', verdict: 'great', detail: 'great', values: {} }
        : { id: 'scan', verdict: 'bad', detail: 'bad', values: {} };

  const saved = Math.round(
    (1 - (modules * modules) / (plainModules * plainModules)) * 100,
  );
  const density: ReadabilityCheck = {
    id: 'density',
    verdict: 'great',
    detail: saved > 0 ? 'saved' : 'plain',
    values: { modules, plain: plainModules, saved },
  };

  // Module size decides how small a print still scans; distance follows the
  // code's width.
  const codeWidth = printedCodeWidth(format, size);
  const moduleSize = codeWidth / modules;
  const share = FORMATS[format].codeWidth / FORMATS[format].width;
  const comfortable = (GOOD_MODULE * modules) / share;
  const printVerdict: Verdict =
    moduleSize >= GOOD_MODULE ? 'great' : moduleSize >= MIN_MODULE ? 'weak' : 'bad';
  const distance: ReadabilityCheck = {
    id: 'print',
    verdict: printVerdict,
    detail: printVerdict,
    values: { code: codeWidth, distance: scanDistance(codeWidth), comfortable },
  };

  const checks = [scan, contrast, density, distance];
  const verdict = checks.reduce<Verdict>(
    (worst, check) =>
      RANK.indexOf(check.verdict) > RANK.indexOf(worst) ? check.verdict : worst,
    'great',
  );
  return { verdict, checks };
}
