/** Curated subset of qr-code-styling's DotType — the per-dot module shape. */
export type QrDotType =
  | 'square'
  | 'dots'
  | 'rounded'
  | 'classy'
  | 'classy-rounded'
  | 'extra-rounded';

/** Style of the 3 big finder-pattern squares (the corner markers). */
export type QrCornerSquareType = 'square' | 'dot' | 'extra-rounded';

/** Style of the small dot inside each finder-pattern square. */
export type QrCornerDotType = 'square' | 'dot';

export type QrColorMode = 'solid' | 'gradient';
export type QrGradientType = 'linear' | 'radial';

export interface QrStyleState {
  dotsType: QrDotType;
  cornerSquareType: QrCornerSquareType;
  cornerDotType: QrCornerDotType;
  colorMode: QrColorMode;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  gradientType: QrGradientType;
  /** Degrees; only meaningful for linear gradients. */
  gradientRotation: number;
}

export const DOT_TYPE_OPTIONS: { value: QrDotType; label: string }[] = [
  { value: 'square', label: 'Kwadratowe' },
  { value: 'dots', label: 'Kropki' },
  { value: 'rounded', label: 'Zaokrąglone' },
  { value: 'classy', label: 'Eleganckie' },
  { value: 'classy-rounded', label: 'Elegan. zaokr.' },
  { value: 'extra-rounded', label: 'Bardzo okrągłe' },
];

export const CORNER_SQUARE_OPTIONS: { value: QrCornerSquareType; label: string }[] = [
  { value: 'square', label: 'Kwadratowy' },
  { value: 'dot', label: 'Okrągły' },
  { value: 'extra-rounded', label: 'Zaokrąglony' },
];

export const CORNER_DOT_OPTIONS: { value: QrCornerDotType; label: string }[] = [
  { value: 'square', label: 'Kwadratowa' },
  { value: 'dot', label: 'Okrągła' },
];

/** CSS border-radius approximation for each dot shape, used in tiny preview tiles. */
export const DOT_SHAPE_RADIUS: Record<QrDotType, string> = {
  square: '0%',
  rounded: '35%',
  dots: '50%',
  classy: '0% 45% 0% 45%',
  'classy-rounded': '45% 0% 45% 0%',
  'extra-rounded': '46%',
};

export const CORNER_SQUARE_RADIUS: Record<QrCornerSquareType, string> = {
  square: '0%',
  dot: '50%',
  'extra-rounded': '32%',
};

export const CORNER_DOT_RADIUS: Record<QrCornerDotType, string> = {
  square: '0%',
  dot: '50%',
};

/** Quick solid-color swatches for the "Kolory" tab. */
export const SOLID_COLOR_SWATCHES = [
  { color: '#1C1B22', label: 'Czarny' },
  { color: '#C62828', label: 'Czerwony' },
  { color: '#2E7D32', label: 'Zielony' },
  { color: '#00696D', label: 'Morski' },
  { color: '#1A237E', label: 'Granatowy' },
] as const;

/** Quick two-tone gradient presets for the "Kolory" tab. */
export const GRADIENT_PRESETS: { from: string; to: string; label: string }[] = [
  { label: 'Ognisty', from: '#FF512F', to: '#DD2476' },
  { label: 'Oceaniczny', from: '#00C6FB', to: '#005BEA' },
  { label: 'Zachód słońca', from: '#F7971E', to: '#FFD200' },
  { label: 'Fiolet', from: '#8E2DE2', to: '#4A00E0' },
];

export interface QrPreset {
  id: string;
  name: string;
  description: string;
  style: QrStyleState;
}

/**
 * Predefined, visually distinct style combinations. Applying one replaces the
 * entire style state at once; logo settings are left untouched since they're
 * the user's own asset, independent of the chosen theme.
 */
export const QR_PRESETS: QrPreset[] = [
  {
    id: 'classic',
    name: 'Klasyczny',
    description: 'Ostre kwadraty, pełna czytelność',
    style: {
      dotsType: 'square',
      cornerSquareType: 'square',
      cornerDotType: 'square',
      colorMode: 'solid',
      color: '#1C1B22',
      gradientFrom: '#1C1B22',
      gradientTo: '#1C1B22',
      gradientType: 'linear',
      gradientRotation: 0,
    },
  },
  {
    id: 'modern',
    name: 'Nowoczesny',
    description: 'Zaokrąglone kropki, gładki styl',
    style: {
      dotsType: 'rounded',
      cornerSquareType: 'extra-rounded',
      cornerDotType: 'dot',
      colorMode: 'solid',
      color: '#00696D',
      gradientFrom: '#00696D',
      gradientTo: '#00696D',
      gradientType: 'linear',
      gradientRotation: 0,
    },
  },
  {
    id: 'elegant',
    name: 'Elegancki',
    description: 'Eleganckie kropki i gradient',
    style: {
      dotsType: 'classy-rounded',
      cornerSquareType: 'extra-rounded',
      cornerDotType: 'dot',
      colorMode: 'gradient',
      color: '#5B4CDB',
      gradientFrom: '#5B4CDB',
      gradientTo: '#C2185B',
      gradientType: 'linear',
      gradientRotation: 45,
    },
  },
  {
    id: 'vibrant',
    name: 'Kontrastowy',
    description: 'Odważne kropki, żywy gradient',
    style: {
      dotsType: 'dots',
      cornerSquareType: 'dot',
      cornerDotType: 'dot',
      colorMode: 'gradient',
      color: '#ED6C02',
      gradientFrom: '#FF512F',
      gradientTo: '#F09819',
      gradientType: 'radial',
      gradientRotation: 0,
    },
  },
];

export const DEFAULT_QR_STYLE: QrStyleState = QR_PRESETS[0].style;
