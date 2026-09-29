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

export const DOT_OPTIONS: { value: DotStyle; label: string }[] = [
  { value: 'square', label: 'Kwadraty' },
  { value: 'fluid', label: 'Płynne' },
  { value: 'dots', label: 'Kropki' },
  { value: 'tiles', label: 'Kafelki' },
  { value: 'lines', label: 'Linie' },
];

export const EYE_OPTIONS: { value: EyeStyle; label: string }[] = [
  { value: 'square', label: 'Kwadratowe' },
  { value: 'rounded', label: 'Zaokrąglone' },
  { value: 'circle', label: 'Okrągłe' },
  { value: 'leaf', label: 'Listek' },
];

export const CTA_PRESETS = [
  'Zeskanuj, aby zobaczyć menu',
  'Zeskanuj menu',
  'Menu',
  'Zeskanuj menu · Scan the menu',
] as const;

export const CTA_MAX_LENGTH = 40;

/** Dark, print-safe colours: every one reads at 7:1 or better on white. */
export const SAFE_SWATCHES: { color: string; label: string }[] = [
  { color: INK, label: 'Grafit' },
  { color: '#000000', label: 'Czarny' },
  { color: '#1F3A5F', label: 'Granat' },
  { color: '#1E4D2B', label: 'Butelkowa zieleń' },
  { color: '#6E1F2A', label: 'Bordo' },
  { color: '#5A3A22', label: 'Czekolada' },
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

export interface QrPreset {
  id: string;
  name: string;
  look: QrLook;
}

/** The ready-made designs, in the restaurant's colour. */
export function presetsFor(brandColor: string): QrPreset[] {
  const brand = readableOnWhite(brandColor);
  const deep = readableOnWhite(darken(brand, 0.35), 7);
  return [
    {
      id: 'brand',
      name: 'Twoja marka',
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
      name: 'Klasyczny',
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
      name: 'Akcent',
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
      name: 'Miękki',
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
      name: 'Linie',
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
      name: 'Elegancki',
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
    wording: { cta: CTA_PRESETS[0], showName: true, surface: 'brand' },
  };
}

// ---------------------------------------------------------------------------
// Readability
// ---------------------------------------------------------------------------

export type Verdict = 'great' | 'ok' | 'weak' | 'bad';

export interface ReadabilityCheck {
  verdict: Verdict;
  label: string;
  detail: string;
}

export interface Readability {
  verdict: Verdict;
  title: string;
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

/** Scanning distance for a printed code width. Rule of thumb: a code reads
 *  from about ten times its own width. */
function scanDistance(codeWidthMm: number): string {
  const cm = Math.round(codeWidthMm / 10) * 10;
  return cm >= 100 ? `${(cm / 100).toLocaleString('pl-PL')} m` : `${cm} cm`;
}

/** Smallest printed module that phones read comfortably, and the floor below
 *  which even a steady hand at arm's length struggles, in millimetres. */
const GOOD_MODULE = 0.5;
const MIN_MODULE = 0.35;

const cm = (mm: number) => `${(Math.round(mm) / 10).toLocaleString('pl-PL')} cm`;

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
  const contrast: ReadabilityCheck =
    ratio >= 7
      ? {
          verdict: 'great',
          label: 'Kontrast',
          detail: `${ratio.toFixed(1)} : 1 — doskonały`,
        }
      : ratio >= 4.5
        ? { verdict: 'ok', label: 'Kontrast', detail: `${ratio.toFixed(1)} : 1 — dobry` }
        : ratio >= 3
          ? {
              verdict: 'weak',
              label: 'Kontrast',
              detail: `${ratio.toFixed(1)} : 1 — słaby, przy gorszym świetle kod może zawodzić`,
            }
          : {
              verdict: 'bad',
              label: 'Kontrast',
              detail: `${ratio.toFixed(1)} : 1 — za jasny, wybierz ciemniejszy kolor`,
            };

  const scan: ReadabilityCheck =
    decoded === null
      ? { verdict: 'ok', label: 'Test odczytu', detail: 'Sprawdzam…' }
      : decoded
        ? {
            verdict: 'great',
            label: 'Test odczytu',
            detail: 'Kod odczytany poprawnie z obrazu',
          }
        : {
            verdict: 'bad',
            label: 'Test odczytu',
            detail: 'Nie udało się odczytać — przyciemnij kolor lub zmniejsz logo',
          };

  const saved = Math.round(
    (1 - (modules * modules) / (plainModules * plainModules)) * 100,
  );
  const density: ReadabilityCheck = {
    verdict: 'great',
    label: 'Skrócony link',
    detail:
      saved > 0
        ? `${modules} × ${modules} punktów zamiast ${plainModules} × ${plainModules} — o ${saved}% mniej`
        : `${modules} × ${modules} punktów`,
  };

  // Module size decides how small a print still scans; distance follows the
  // code's width.
  const codeWidth = printedCodeWidth(format, size);
  const moduleSize = codeWidth / modules;
  const share = FORMATS[format].codeWidth / FORMATS[format].width;
  const comfortable = cm((GOOD_MODULE * modules) / share);
  const distance: ReadabilityCheck =
    moduleSize >= GOOD_MODULE
      ? {
          verdict: 'great',
          label: 'Na wydruku',
          detail: `kod ${cm(codeWidth)} — skanuje się z ok. ${scanDistance(codeWidth)}`,
        }
      : moduleSize >= MIN_MODULE
        ? {
            verdict: 'weak',
            label: 'Na wydruku',
            detail: `kod ${cm(codeWidth)} — mały, czyta się tylko z bliska; pewniej od rozmiaru ${comfortable}`,
          }
        : {
            verdict: 'bad',
            label: 'Na wydruku',
            detail: `kod ${cm(codeWidth)} — za mały dla wielu telefonów; wybierz rozmiar od ${comfortable}`,
          };

  const checks = [scan, contrast, density, distance];
  const verdict = checks.reduce<Verdict>(
    (worst, check) =>
      RANK.indexOf(check.verdict) > RANK.indexOf(worst) ? check.verdict : worst,
    'great',
  );
  const title =
    verdict === 'great'
      ? 'Świetna czytelność'
      : verdict === 'ok'
        ? 'Dobra czytelność'
        : verdict === 'weak'
          ? 'Czytelność do poprawy'
          : 'Ten kod może się nie skanować';
  return { verdict, title, checks };
}
